// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as activityLogging from './activityLogging';
import { activateSmartCmd } from './smartCmd/activateExt';
import { registerPromptEnhancerCommands } from './promptEnhancer/promptEnhancer';
import { PromptEnhancerTreeProvider } from './promptEnhancer/treeProvider';

// Global variables
let activityLogPath: string | undefined;
let cleanupTimer: NodeJS.Timeout | undefined;


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	console.log('DevBoost extension is now active!');

	// Initialize activity log path
	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		activityLogPath = path.join(workspaceRoot, '.vscode', 'devBoost', 'activity.log');
	}

	// Setup activity logging (will schedule cleanup if activityLogPath exists)
	const result = activityLogging.setupActivityLogging(context, activityLogPath);
	cleanupTimer = result.cleanupTimer;

	// Initialize global extension paths (in extension's global storage)
	const globalStoragePath = context.globalStorageUri.fsPath;

	// // Activate SmartCmd tool
	await activateSmartCmd(context, globalStoragePath, activityLogPath);

	// Register Prompt Enhancer commands
	registerPromptEnhancerCommands(context);

	// Register Prompt Enhancer tree provider
	const promptEnhancerProvider = new PromptEnhancerTreeProvider(context);
	vscode.window.createTreeView('devboost.promptEnhancerView', {
		treeDataProvider: promptEnhancerProvider,
		showCollapseAll: false
	});

	// Register test Command
	const helloWorldDisposable = vscode.commands.registerCommand('DevBoost.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from DevBoost!');
	});

	context.subscriptions.push(helloWorldDisposable);

	// Register workspace change listener
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
			console.log('DevBoost: Workspace folders changed');
			
			// Clear existing cleanup timer if any
			if (cleanupTimer) {
				clearInterval(cleanupTimer);
				cleanupTimer = undefined;
			}
			
			// Update activity log path for new workspace
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
				activityLogPath = path.join(workspaceRoot, '.vscode', 'devBoost', 'activity.log');
				console.log('DevBoost: Updated activity log path:', activityLogPath);
				
				// Schedule cleanup for new workspace
				cleanupTimer = activityLogging.scheduleLogCleanup(activityLogPath);
				context.subscriptions.push({
					dispose: () => {
						if (cleanupTimer) {
							clearInterval(cleanupTimer);
						}
					}
				});
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
