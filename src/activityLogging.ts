// Activity Logging Module - Tracks user activities for SmartCmd and other tools
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Track commands executed by tools per workspace to exclude from activity log
// Key: workspace folder path, Value: Set of executed commands
const toolExecutedCommands = new Map<string, Set<string>>();

/**
 * Setup activity logging system
 * Logs file operations and terminal commands to workspace activity log
 */
export function setupActivityLogging(context: vscode.ExtensionContext, activityLogPath: string | undefined) {
	// Log file create operations
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles(async (event) => {
			for (const file of event.files) {
				await logActivity('Create', file.fsPath, activityLogPath);
			}
		})
	);

	// Log file delete operations
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles(async (event) => {
			for (const file of event.files) {
				await logActivity('Delete', file.fsPath, activityLogPath);
			}
		})
	);

	// Log file rename operations
	context.subscriptions.push(
		vscode.workspace.onDidRenameFiles(async (event) => {
			for (const rename of event.files) {
				await logActivity('Rename', `${rename.oldUri.fsPath} to ${rename.newUri.fsPath}`, activityLogPath);
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
			
			// Log successful commands (exit code 0) and interrupted commands (exit code 130, SIGINT)
			// Skip commands with exit code 127 (command not found) and 126 (command not executable)
			if (exitCode === 0 || exitCode === 130 || exitCode === undefined) {
				await logActivity('Command', command, activityLogPath);
			} else if (exitCode === 127 || exitCode === 126) {
				console.log(`DevBoost: Skipping invalid command (exit code ${exitCode}): ${command}`);
			} else {
				// Log other non-zero exit codes but still save them as they might be valid commands that failed for other reasons
				await logActivity('Command', command, activityLogPath);
			}
		})
	);
}

/**
 * Log activity to .vscode/activity.log
 */
export async function logActivity(type: string, detail: string, activityLogPath: string | undefined) {
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
		const logEntry = `${timestamp} | ${type.trim()}: ${detail.trim()}\n`;
		
		// Create .vscode directory if it doesn't exist
		const vscodeDirPath = path.dirname(activityLogPath);
		await fs.mkdir(vscodeDirPath, { recursive: true });
		
		// Append to activity log
		await fs.appendFile(activityLogPath, logEntry);
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
 * Parse activity log and count frequencies
 */
export function parseActivityLog(logContent: string): Map<string, number> {
	const activities = new Map<string, number>();
	const lines = logContent.split('\n').filter(line => line.trim().length > 0);

	for (const line of lines) {
		// Match format: 2025-10-27T10:37:41.083Z | Type: detail
		const match = line.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*\|\s*(.+?)\s*:\s*(.+)$/);
		if (match) {
			const type = match[1].trim();
			const detail = match[2].trim();
			const activity = `${type}: ${detail}`;
			activities.set(activity, (activities.get(activity) || 0) + 1);
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
