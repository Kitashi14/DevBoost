// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as activityLogging from './activityLogging';
import { activateSmartCmd } from './smartCmd/activateExt';

// Global variables
let activityLogPath: string | undefined;

// Flag to track if prompt file is currently in use
let isPromptFileInUse = false;

// Helper function to acquire prompt file lock
export function acquirePromptFileLock(): boolean {
	if (isPromptFileInUse) {
		vscode.window.showWarningMessage('DevBoost: Prompt file is currently in use. Please finish current task by closing the prompt-input.md file.');
		return false;
	}
	isPromptFileInUse = true;
	return true;
}

// Helper function to release prompt file lock
export function releasePromptFileLock(): void {
	isPromptFileInUse = false;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	console.log('DevBoost extension is now active!');

	// Initialize activity log path
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		activityLogPath = path.join(workspaceRoot, '.vscode', 'activity.log');
	}

	// Setup activity logging
	activityLogging.setupActivityLogging(context, activityLogPath);

	// Initialize global extension paths (in extension's global storage)
	const globalStoragePath = context.globalStorageUri.fsPath;
	const promptInputPath = path.join(globalStoragePath, 'prompt-input.md');

	// // Activate SmartCmd tool
	await activateSmartCmd(context, globalStoragePath, activityLogPath, promptInputPath);

	// Register test Command
	const helloWorldDisposable = vscode.commands.registerCommand('DevBoost.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from DevBoost!');
	});

	context.subscriptions.push(helloWorldDisposable);

	// Listen for workspace folder changes to update activity log path
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
			console.log('DevBoost: Workspace folders changed');
			
			// Update activity log path for new workspace
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
				activityLogPath = path.join(workspaceRoot, '.vscode', 'activity.log');
				console.log('DevBoost: Updated activity log path:', activityLogPath);
			} else {
				activityLogPath = undefined;
			}
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Cleanup handled by context.subscriptions
}
