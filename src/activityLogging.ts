// Activity Logging Module - Tracks user activities for SmartCmd and other tools
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Track commands executed by tools per workspace to exclude from activity log
// Key: workspace folder path, Value: Set of executed commands
const toolExecutedCommands = new Map<string, Set<string>>();

// Log configuration settings
const LOG_CONFIG = {
	MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB max file size
	MAX_ENTRIES: 1000, // Maximum number of log entries to keep
	CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // Clean up every 24 hours
	COMPRESSION_THRESHOLD: 500 // Compress old entries when count exceeds this
};

// Enhanced logging interface for contextual information
interface LogContext {
	terminalId?: string;
	terminalName?: string;
	shellType?: string;
	workingDirectory?: string;
	exitCode?: number;
	duration?: number;
	userId?: string;
	sessionId?: string;
}

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
 */
export function setupActivityLogging(context: vscode.ExtensionContext, activityLogPath: string | undefined) {
	// Schedule periodic log cleanup if we have a log path
	if (activityLogPath) {
		const cleanupTimer = scheduleLogCleanup(activityLogPath);
		context.subscriptions.push({
			dispose: () => clearInterval(cleanupTimer)
		});
		
		// Perform initial cleanup on startup (but don't await to avoid blocking)
		cleanupActivityLog(activityLogPath).catch(error => {
			console.error('DevBoost: Initial log cleanup failed:', error);
		});
	}

	// Log file create operations
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles(async (event) => {
			for (const file of event.files) {
				const logContext: LogContext = {
					workingDirectory: path.dirname(file.fsPath),
					sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
					workingDirectory: path.dirname(file.fsPath),
					sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
					workingDirectory: path.dirname(rename.newUri.fsPath),
					sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
			
			// Get current workspace path for tracking
			const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
			
			// Skip commands executed by tools in this workspace
			if (workspacePath) {
				const workspaceCommands = toolExecutedCommands.get(workspacePath);
				if (workspaceCommands?.has(command)) {
					console.log(`DevBoost: Skipping tool-executed command in workspace: ${command}`);
					workspaceCommands.delete(command); // Clean up after tracking
					
					// Clean up empty sets to prevent memory leaks
					if (workspaceCommands.size === 0) {
						toolExecutedCommands.delete(workspacePath);
					}
					return;
				}
			}
			
			// Gather enhanced context information
			const terminal = event.terminal;
			
			// Build enhanced context
			const logContext: LogContext = {
				terminalId: terminal.processId?.toString(),
				terminalName: terminal.name,
				shellType: getSystemInfo().shell,
				workingDirectory: workspacePath,
				exitCode: exitCode,
				sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
			};
			
			// Add working directory from terminal if available
			try {
				// Try to get the current working directory from the terminal
				// This is a best effort approach since VS Code API doesn't directly expose CWD
				if (event.execution.commandLine.value.includes('cd ')) {
					const cdMatch = event.execution.commandLine.value.match(/cd\s+([^\s;]+)/);
					if (cdMatch && cdMatch[1]) {
						logContext.workingDirectory = path.resolve(workspacePath || '', cdMatch[1]);
					}
				}
			} catch (error) {
				// Ignore errors in CWD detection
			}
			
			// Log successful commands (exit code 0) and interrupted commands (exit code 130, SIGINT)
			// Skip commands with exit code 127 (command not found) and 126 (command not executable)
			if (exitCode === 0 || exitCode === 130 || exitCode === undefined) {
				await logActivity('Command', command, activityLogPath, logContext);
			} else if (exitCode === 127 || exitCode === 126) {
				console.log(`DevBoost: Skipping invalid command (exit code ${exitCode}): ${command}`);
			} else {
				// Log other non-zero exit codes but still save them as they might be valid commands that failed for other reasons
				await logActivity('Command', command, activityLogPath, logContext);
			}
		})
	);
}

/**
 * Log activity to .vscode/activity.log with enhanced context
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
		
		// Build enhanced context information
		const contextInfo: any = {
			workspace: {
				path: workspacePath,
				name: workspaceName
			},
			system: getSystemInfo(),
			timestamp: timestamp
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
			if (context.workingDirectory) {
				contextInfo.terminal = { ...contextInfo.terminal, cwd: context.workingDirectory };
			}
			if (context.exitCode !== undefined) {
				contextInfo.execution = { exitCode: context.exitCode };
			}
			if (context.duration !== undefined) {
				contextInfo.execution = { ...contextInfo.execution, duration: context.duration };
			}
			if (context.userId) {
				contextInfo.user = { id: context.userId };
			}
			if (context.sessionId) {
				contextInfo.session = { id: context.sessionId };
			}
		}

		// Create structured log entry for better AI parsing
		const logEntry = {
			timestamp,
			type: type.trim(),
			detail: detail.trim(),
			context: contextInfo
		};

		// Format as JSON for structured logging but also maintain human readable format
		const structuredLog = `${timestamp} | ${type.trim()}: ${detail.trim()} | Context: ${JSON.stringify(contextInfo)}\n`;
		
		// Create .vscode directory if it doesn't exist
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
 * Mark a command as executed by a tool to exclude it from activity log
 * Call this before executing a command through a tool (e.g., SmartCmd button)
 */
export function markCommandAsToolExecuted(command: string) {
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (workspacePath) {
		if (!toolExecutedCommands.has(workspacePath)) {
			toolExecutedCommands.set(workspacePath, new Set());
		}
		toolExecutedCommands.get(workspacePath)!.add(command);
	}
}

/**
 * Log SmartCmd button execution with enhanced context
 */
export async function logSmartCmdExecution(
	buttonName: string, 
	command: string, 
	executionType: 'VSCode' | 'Terminal' | 'Error',
	activityLogPath: string | undefined,
	additionalContext?: Partial<LogContext>
) {
	const executionStartTime = Date.now();
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	const logContext: LogContext = {
		workingDirectory: workspacePath,
		sessionId: `smartcmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		userId: `button-${buttonName}`,
		...additionalContext
	};

	const logType = `SmartCmd-${executionType}`;
	const logDetail = `${buttonName}: ${command}`;

	await logActivity(logType, logDetail, activityLogPath, logContext);
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
			const timestamp = enhancedMatch[1].trim();
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
 * Extract detailed context from activity log for AI analysis
 */
export function extractDetailedLogContext(logContent: string): {
	summary: string;
	workspaceInfo: any;
	terminalPatterns: any;
	frequentDirectories: string[];
	commandPatterns: any;
	errorPatterns: any;
} {
	const lines = logContent.split('\n').filter(line => line.trim().length > 0);
	const workspaces = new Set<string>();
	const terminals = new Map<string, number>();
	const directories = new Map<string, number>();
	const commands = new Map<string, number>();
	const errors = new Map<string, number>();
	const shells = new Map<string, number>();
	
	for (const line of lines) {
		const enhancedMatch = line.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*\|\s*(.+?)\s*:\s*(.+?)\s*\|\s*Context:\s*(.+)$/);
		if (enhancedMatch) {
			try {
				const type = enhancedMatch[2].trim();
				const detail = enhancedMatch[3].trim();
				const context = JSON.parse(enhancedMatch[4].trim());
				
				// Extract workspace information
				if (context.workspace?.name) {
					workspaces.add(context.workspace.name);
				}
				
				// Extract terminal patterns
				if (context.terminal?.shell) {
					shells.set(context.terminal.shell, (shells.get(context.terminal.shell) || 0) + 1);
				}
				
				// Extract directory patterns
				if (context.terminal?.cwd) {
					directories.set(context.terminal.cwd, (directories.get(context.terminal.cwd) || 0) + 1);
				}
				
				// Extract command patterns
				if (type === 'Command' || type.startsWith('SmartCmd')) {
					const commandBase = detail.split(' ')[0]; // Get base command
					commands.set(commandBase, (commands.get(commandBase) || 0) + 1);
				}
				
				// Extract error patterns
				if (context.execution?.exitCode && context.execution.exitCode !== 0) {
					errors.set(`${detail} (exit ${context.execution.exitCode})`, (errors.get(`${detail} (exit ${context.execution.exitCode})`) || 0) + 1);
				}
				
			} catch (error) {
				// Skip malformed context
			}
		}
	}
	
	const totalEntries = lines.length;
	const mostUsedShell = shells.size > 0 ? Array.from(shells.entries()).sort((a, b) => b[1] - a[1])[0][0] : 'unknown';
	const topDirectories = Array.from(directories.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([dir]) => dir);
	
	return {
		summary: `Analyzed ${totalEntries} log entries across ${workspaces.size} workspace(s). Most used shell: ${mostUsedShell}`,
		workspaceInfo: {
			count: workspaces.size,
			names: Array.from(workspaces)
		},
		terminalPatterns: {
			shells: Object.fromEntries(shells),
			mostUsed: mostUsedShell
		},
		frequentDirectories: topDirectories,
		commandPatterns: Object.fromEntries(Array.from(commands.entries()).slice(0, 10)),
		errorPatterns: Object.fromEntries(errors)
	};
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
		
	} catch (error) {
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
 * Optimize log for AI consumption by summarizing old entries
 */
export async function optimizeLogForAI(activityLogPath: string): Promise<string> {
	if (!activityLogPath) {
		return '';
	}

	try {
		const logContent = await fs.readFile(activityLogPath, 'utf-8');
		const lines = logContent.split('\n').filter(line => line.trim().length > 0);
		
		if (lines.length <= LOG_CONFIG.COMPRESSION_THRESHOLD) {
			return logContent; // No optimization needed
		}

		// Split into recent (full detail) and old (summarized) entries
		const recentLines = lines.slice(-LOG_CONFIG.COMPRESSION_THRESHOLD);
		const oldLines = lines.slice(0, -LOG_CONFIG.COMPRESSION_THRESHOLD);
		
		// Create summary of old entries
		const oldActivities = parseActivityLog(oldLines.join('\n'));
		const topOldActivities = getTopActivities(oldActivities, 20);
		
		const summary = `# Activity Summary (${oldLines.length} entries compressed)\n` +
			`# Time range: ${oldLines[0]?.substring(0, 19)} to ${oldLines[oldLines.length - 1]?.substring(0, 19)}\n` +
			`# Most frequent activities:\n` +
			topOldActivities.map((activity, i) => `# ${i + 1}. ${activity} (${oldActivities.get(activity)} times)`).join('\n') +
			'\n# --- Recent Detailed Activity ---\n';
		
		return summary + recentLines.join('\n');
		
	} catch (error) {
		console.error('DevBoost: Error optimizing log for AI:', error);
		return '';
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
