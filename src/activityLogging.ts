// Activity Logging Module - Tracks user activities for SmartCmd and other tools
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Log configuration settings
const LOG_CONFIG = {
	MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB max file size
	MAX_ENTRIES: 500, // Maximum number of log entries to keep
	CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // Clean up every 24 hours
};

// Enhanced logging interface for contextual information
interface LogContext {
	terminalId?: string;
	terminalName?: string;
	shellType?: string;
	currentDirectory?: string;
	exitCode?: number;
}

// Track current working directory for each terminal
const terminalDirectories = new Map<string, string>();

/**
 * Get system information for AI context
 */
function getSystemInfo(): { platform: string; shell: string} {
	// Determine OS
	let platform = 'Unknown';
	if (process.platform === 'win32') {
		platform = 'Windows';
	} else if (process.platform === 'darwin') {
		platform = 'macOS';
	} else if (process.platform === 'linux') {
		platform = 'Linux';
	}

	// Get shell information
	const shell = process.env.SHELL || process.env.COMSPEC || 'Unknown shell';
	const shellName = path.basename(shell).replace(/\.(exe|com|bat)$/i, '');

	return {
		platform,
		shell: shellName
	};
}

/**
 * Setup activity logging system
 * Logs file operations and terminal commands to workspace activity log
 * Returns cleanup timer if scheduled
 */
export function setupActivityLogging(
	context: vscode.ExtensionContext, 
	activityLogPath: string | undefined
): { cleanupTimer?: NodeJS.Timeout } {
	let cleanupTimer: NodeJS.Timeout | undefined;
	
	// Schedule periodic log cleanup if we have a log path
	if (activityLogPath) {
		cleanupTimer = scheduleLogCleanup(activityLogPath);
		context.subscriptions.push({
			dispose: () => clearInterval(cleanupTimer!)
		});
		
		// Perform initial cleanup on startup (but don't await to avoid blocking)
		cleanupActivityLog(activityLogPath).catch(error => {
			console.error('DevBoost: Initial log cleanup failed:', error);
		});
	}
	
	// Clean up terminal directory tracking when terminals are closed
	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(async (terminal) => {
			try {
				const pid = await terminal.processId;
				if (pid) {
					terminalDirectories.delete(pid.toString());
					console.log(`DevBoost: Cleaned up directory tracking for terminal ${pid}`);
				}
			} catch (error) {
				// Ignore errors
			}
		})
	);

	// Log file create operations
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles(async (event) => {
			for (const file of event.files) {
				const logContext: LogContext = {
					currentDirectory: path.dirname(file.fsPath)
				};
				await logActivity('Create', file.fsPath, activityLogPath, logContext);
			}
		})
	);

	// Log file delete operations
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles(async (event) => {
			for (const file of event.files) {
				const logContext: LogContext = {
					currentDirectory: path.dirname(file.fsPath)
				};
				await logActivity('Delete', file.fsPath, activityLogPath, logContext);
			}
		})
	);

	// Log file rename operations
	context.subscriptions.push(
		vscode.workspace.onDidRenameFiles(async (event) => {
			for (const rename of event.files) {
				const logContext: LogContext = {
					currentDirectory: path.dirname(rename.newUri.fsPath)
				};
				await logActivity('Rename', `${rename.oldUri.fsPath} to ${rename.newUri.fsPath}`, activityLogPath, logContext);
			}
		})
	);

	// Log when terminal commands are executed
	context.subscriptions.push(
		vscode.window.onDidEndTerminalShellExecution(async (event) => {
		const commandLine = event.execution.commandLine.value;
		const command = commandLine.trim();
		const exitCode = event.exitCode;
		
		// Skip DevBoost's own enable/disable tracking scripts (they're too long and not useful for workflow analysis)
		if (command.includes('DEVBOOST_TRACKING_ENABLED') || 
		    command.includes('devboost_log_command') ||
		    command.includes('DevBoost_LogCommand') ||
		    command.includes('DevBoost tracking')) {
			console.log('DevBoost: Skipping enable/disable tracking script from activity log');
			return;
		}
		
		// Try to get CWD from shell integration if available
		const executionCwd = event.execution.cwd;
		
		// Get current workspace path for tracking
		const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			
		// Gather enhanced context information
		const terminal = event.terminal;
		
		// Get terminal process ID (it's a Promise, so we need to await it)
		let terminalId: string | undefined;
		try {
			const pid = await terminal.processId;
			terminalId = pid?.toString();
		} catch (error) {
			// If we can't get the process ID, just skip it
			terminalId = undefined;
		}
		
		// Initialize terminal directory tracking if this is a new terminal
		if (terminalId && !terminalDirectories.has(terminalId)) {
			// If shell integration provides CWD, use it (most reliable!)
			if (executionCwd) {
				terminalDirectories.set(terminalId, executionCwd.fsPath);
			} else {
				// Fallback to workspace path
				terminalDirectories.set(terminalId, workspacePath || process.cwd());
			}
		}
		
		// Get current tracked directory for this terminal
		// Prefer shell integration CWD if available, otherwise use tracked directory
		let currentDirectory = executionCwd?.fsPath || (terminalId ? terminalDirectories.get(terminalId) : workspacePath);
		
		// Update tracked directory with actual CWD from shell integration
		if (executionCwd && terminalId) {
			terminalDirectories.set(terminalId, executionCwd.fsPath);
			currentDirectory = executionCwd.fsPath;
		}
		
		// Build enhanced context
		const logContext: LogContext = {
			terminalId: terminalId,
			terminalName: terminal.name,
			shellType: getSystemInfo().shell,
			currentDirectory: currentDirectory,
			exitCode: exitCode
		};
		
		// Track directory changes from 'cd' commands (only needed if shell integration unavailable)
		if (!executionCwd) {
			try {
				// Match 'cd' only at the start of the command (not in chains or strings)
				const cdMatch = event.execution.commandLine.value.match(/^\s*cd\s+([^\s;&|]+)/);
				if (cdMatch && cdMatch[1] && terminalId) {
					const targetPath = cdMatch[1];
					
					// Check if it's an absolute path (Unix: starts with /, Windows: starts with C:\ etc.)
					const isAbsolutePath = targetPath.startsWith('/') || /^[A-Z]:\\/i.test(targetPath);
					
					if (isAbsolutePath) {
						// Absolute path - use directly (most reliable)
						terminalDirectories.set(terminalId, targetPath);
						logContext.currentDirectory = targetPath;
					} else {
						// Relative path - resolve from current directory
						const newDir = path.resolve(currentDirectory || workspacePath || '', targetPath);
						terminalDirectories.set(terminalId, newDir);
						logContext.currentDirectory = newDir;
					}
				}
			} catch (error) {
				// Ignore errors in CWD detection
			}
		}
			
			// Skip commands with exit code 127 (command not found) and 126 (command not executable)
			if (exitCode === 127 || exitCode === 126) {
				console.log(`DevBoost: Skipping invalid command (exit code ${exitCode}): ${command}`);
			} else {
				// Log other non-zero exit codes but still save them as they might be valid commands that failed for other reasons
				await logActivity('Command', command, activityLogPath, logContext);
			}
		})
	);

	// Log task executions
	const taskStartTimes = new Map<string, number>();
	
	context.subscriptions.push(
		vscode.tasks.onDidStartTask(async (event) => {
			const task = event.execution.task;
			const taskKey = `${task.name}-${task.source}`;
			taskStartTimes.set(taskKey, Date.now());
			
			const logContext: LogContext = {
				currentDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			};
			
			const taskDetail = `${task.name} [${task.source}]`;
			await logActivity('TaskStart', taskDetail, activityLogPath, logContext);
		})
	);
	
	context.subscriptions.push(
		vscode.tasks.onDidEndTask(async (event) => {
			const task = event.execution.task;
			const taskKey = `${task.name}-${task.source}`;
			const startTime = taskStartTimes.get(taskKey);
			const duration = startTime ? Date.now() - startTime : undefined;
			taskStartTimes.delete(taskKey);
			
			const logContext: LogContext = {
				currentDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
				exitCode: 0 // Tasks don't provide exit codes directly
			};
			
			const taskDetail = duration 
				? `${task.name} [${task.source}] (${Math.round(duration/1000)}s)`
				: `${task.name} [${task.source}]`;
			await logActivity('TaskEnd', taskDetail, activityLogPath, logContext);
		})
	);

	// Log debug sessions
	context.subscriptions.push(
		vscode.debug.onDidStartDebugSession(async (session) => {
			const logContext: LogContext = {
				currentDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			};
			
			const debugDetail = `${session.name} (${session.type})`;
			await logActivity('DebugStart', debugDetail, activityLogPath, logContext);
		})
	);
	
	context.subscriptions.push(
		vscode.debug.onDidTerminateDebugSession(async (session) => {
			const logContext: LogContext = {
				currentDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			};
			
			const debugDetail = `${session.name} (${session.type})`;
			await logActivity('DebugEnd', debugDetail, activityLogPath, logContext);
		})
	);
	
	return { cleanupTimer };
}

/**
 * Log activity to .vscode/devBoost/activity.log with enhanced context
 */
export async function logActivity(type: string, detail: string, activityLogPath: string | undefined, context?: LogContext) {
	// Validate parameters
	if (!type || !detail || type.trim().length === 0 || detail.trim().length === 0) {
		console.log('DevBoost: Skipping log entry - invalid type or detail');
		return;
	}

	if (!activityLogPath) {
		console.log('DevBoost: Activity log path not initialized');
		return;
	}

	try {
		const timestamp = new Date().toISOString();
		const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'unknown';
		const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
		
		// Build enhanced context information (timestamp already in log line prefix, no need to duplicate)
		const contextInfo: any = {
			workspace: {
				path: workspacePath,
				name: workspaceName
			}
		};

		// Add terminal-specific context if provided
		if (context) {
			if (context.terminalId) {
				contextInfo.terminal = { id: context.terminalId };
			}
			if (context.terminalName) {
				contextInfo.terminal = { ...contextInfo.terminal, name: context.terminalName };
			}
			if (context.shellType) {
				contextInfo.terminal = { ...contextInfo.terminal, shell: context.shellType };
			}
			if (context.currentDirectory) {
				contextInfo.terminal = { ...contextInfo.terminal, cwd: context.currentDirectory };
			}
			if (context.exitCode !== undefined) {
				contextInfo.execution = { exitCode: context.exitCode };
			}
		}

		// Format as JSON for structured logging but also maintain human readable format
		const structuredLog = `${timestamp} | ${type.trim()}: ${detail.trim()} | Context: ${JSON.stringify(contextInfo)}\n`;
		
		// Create .vscode/devBoost directory if it doesn't exist
		const vscodeDirPath = path.dirname(activityLogPath);
		await fs.mkdir(vscodeDirPath, { recursive: true });
		
		// Append to activity log
		await fs.appendFile(activityLogPath, structuredLog);
		
		// Also log to console for debugging
		console.log(`DevBoost Log: ${type} - ${detail}`, contextInfo);
	} catch (error) {
		console.error('DevBoost: Error logging activity:', error);
	}
}

/**
 * Parse activity log and count frequencies with enhanced context support
 */
export function parseActivityLog(logContent: string): Map<string, number> {
	const activities = new Map<string, number>();
	const lines = logContent.split('\n').filter(line => line.trim().length > 0);

	for (const line of lines) {
		// Match enhanced format: 2025-10-27T10:37:41.083Z | Type: detail | Context: {...}
		const enhancedMatch = line.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*\|\s*(.+?)\s*:\s*(.+?)\s*\|\s*Context:\s*(.+)$/);
		if (enhancedMatch) {
			const type = enhancedMatch[2].trim();
			const detail = enhancedMatch[3].trim();
			const contextStr = enhancedMatch[4].trim();
			
			try {
				const context = JSON.parse(contextStr);
				// Create a more descriptive activity key that includes context
				const workspaceInfo = context.workspace ? ` [${context.workspace.name}]` : '';
				const terminalInfo = context.terminal ? ` (${context.terminal.shell || 'terminal'})` : '';
				const exitCodeInfo = context.execution?.exitCode !== undefined ? ` [exit:${context.execution.exitCode}]` : '';
				
				const activity = `${type}: ${detail}${workspaceInfo}${terminalInfo}${exitCodeInfo}`;
				activities.set(activity, (activities.get(activity) || 0) + 1);
			} catch (error) {
				// Fallback to simple format if context parsing fails
				const activity = `${type}: ${detail}`;
				activities.set(activity, (activities.get(activity) || 0) + 1);
			}
		} else {
			// Fallback to original format: 2025-10-27T10:37:41.083Z | Type: detail
			const simpleMatch = line.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*\|\s*(.+?)\s*:\s*(.+)$/);
			if (simpleMatch) {
				const type = simpleMatch[1].trim();
				const detail = simpleMatch[2].trim();
				const activity = `${type}: ${detail}`;
				activities.set(activity, (activities.get(activity) || 0) + 1);
			}
		}
	}
	return activities;
}

/**
 * Get top N activities by frequency
 */
export function getTopActivities(activities: Map<string, number>, count: number): string[] {
	return Array.from(activities.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, count)
		.map(([activity]) => activity);
}

/**
 * Clean up activity log to optimize for AI context and prevent bloat
 */
export async function cleanupActivityLog(activityLogPath: string): Promise<void> {
	if (!activityLogPath) {
		console.log('DevBoost: No activity log path provided for cleanup');
		return;
	}

	try {
		// Check if file exists
		const stats = await fs.stat(activityLogPath);
		
		// Check if cleanup is needed based on file size or last cleanup
		const needsCleanup = stats.size > LOG_CONFIG.MAX_FILE_SIZE;
		
		if (!needsCleanup) {
			console.log('DevBoost: Activity log cleanup not needed');
			return;
		}

		console.log('DevBoost: Starting activity log cleanup...');
		
		// Read and parse the log
		const logContent = await fs.readFile(activityLogPath, 'utf-8');
		const lines = logContent.split('\n').filter(line => line.trim().length > 0);
		
		if (lines.length <= LOG_CONFIG.MAX_ENTRIES) {
			console.log('DevBoost: Log entries within limit, no cleanup needed');
			return;
		}

		// Keep the most recent entries
		const recentLines = lines.slice(-LOG_CONFIG.MAX_ENTRIES);
		
		// Create a backup of the original log
		const backupPath = `${activityLogPath}.backup.${Date.now()}`;
		await fs.writeFile(backupPath, logContent);
		
		// Write the cleaned log
		await fs.writeFile(activityLogPath, recentLines.join('\n') + '\n');
		
		console.log(`DevBoost: Cleaned activity log - kept ${recentLines.length} most recent entries`);
		console.log(`DevBoost: Original log backed up to: ${backupPath}`);
		
		// Clean up old backup files (keep only last 3)
		await cleanupBackupFiles(path.dirname(activityLogPath));
		
	} catch (error: any) {
		// If file doesn't exist yet, that's fine - nothing to clean up
		if (error.code === 'ENOENT') {
			console.log('DevBoost: Activity log file does not exist yet, skipping cleanup');
			return;
		}
		// Log other errors for debugging
		console.error('DevBoost: Error during activity log cleanup:', error);
	}
}

/**
 * Clean up old backup files to prevent disk bloat
 */
async function cleanupBackupFiles(directory: string): Promise<void> {
	try {
		const files = await fs.readdir(directory);
		const backupFiles = files
			.filter(file => file.includes('activity.log.backup.'))
			.map(file => ({
				name: file,
				path: path.join(directory, file),
				timestamp: parseInt(file.split('.').pop() || '0')
			}))
			.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first
		
		// Keep only the 3 most recent backups
		const filesToDelete = backupFiles.slice(3);
		
		for (const file of filesToDelete) {
			try {
				await fs.unlink(file.path);
				console.log(`DevBoost: Deleted old backup: ${file.name}`);
			} catch (error) {
				console.error(`DevBoost: Error deleting backup ${file.name}:`, error);
			}
		}
	} catch (error) {
		console.error('DevBoost: Error cleaning up backup files:', error);
	}
}

/**
 * Get recent sequential logs for AI analysis (preserves workflow order)
 * Returns up to maxEntries recent log entries in their original sequential format
 */
export async function getRecentSequentialLogs(activityLogPath: string, maxEntries: number = LOG_CONFIG.MAX_ENTRIES/2): Promise<string[]> {
	if (!activityLogPath) {
		return [];
	}

	try {
		const logContent = await fs.readFile(activityLogPath, 'utf-8');
		const lines = logContent.split('\n').filter(line => {
			const trimmed = line.trim();
			// Filter out empty lines and comment lines from previous compression
			return trimmed.length > 0 && !trimmed.startsWith('#');
		});
		
		// Return the most recent entries in sequential order
		return lines.slice(-maxEntries);
		
	} catch (error) {
		console.error('DevBoost: Error getting recent sequential logs:', error);
		return [];
	}
}

/**
 * Optimize log for AI consumption using intelligent sampling
 * Combines: statistical summary + recent sequential logs
 */
export async function optimizeLogForAI(activityLogPath: string): Promise<{
	summary: string;
	recentLogs: string[];
}> {
	if (!activityLogPath) {
		return { summary: '', recentLogs: [] };
	}

	try {
		const logContent = await fs.readFile(activityLogPath, 'utf-8');
		const lines = logContent.split('\n').filter(line => {
			const trimmed = line.trim();
			return trimmed.length > 0 && !trimmed.startsWith('#');
		});
		
		// Get statistical summary
		const activities = parseActivityLog(logContent);
		console.log('DevBoost: Parsed activities from log:', activities);
		const topActivities = getTopActivities(activities, 10);
		console.log('DevBoost: Top activities:', topActivities);
		
		const summary = `Log Statistics (${lines.length} total entries):
Top Activities:
${topActivities.map((activity, i) => `${i + 1}. ${activity} (${activities.get(activity)}x)`).join('\n')}`;

		// Get recent sequential logs (last 250 entries) - this provides full context
		const recentLogs = await getRecentSequentialLogs(activityLogPath, LOG_CONFIG.MAX_ENTRIES/2);
		
		return {
			summary,
			recentLogs
		};
		
	} catch (error) {
		console.error('DevBoost: Error optimizing log for AI:', error);
		return { summary: '', recentLogs: [] };
	}
}

/**
 * Schedule periodic log cleanup
 */
export function scheduleLogCleanup(activityLogPath: string): NodeJS.Timeout {
	return setInterval(async () => {
		await cleanupActivityLog(activityLogPath);
	}, LOG_CONFIG.CLEANUP_INTERVAL);
}