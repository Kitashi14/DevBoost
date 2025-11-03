// SmartCmd Extension Activation
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlers from './handlers';
import { SmartCmdButtonTreeItem, SmartCmdButtonsTreeProvider, smartCmdButton } from './treeProvider';

export async function activateSmartCmd(
	context: vscode.ExtensionContext,
	globalStoragePath: string,
	activityLogPath: string | undefined,
	promptInputPath: string
): Promise<void> {
	// Initialize SmartCmd paths
	const globalButtonsPath = path.join(globalStoragePath, 'global-buttons.json');

	// Ensure global buttons file exists
	try {
		await fs.mkdir(path.dirname(globalButtonsPath), { recursive: true });
		try {
			await fs.access(globalButtonsPath);
		} catch {
			// File doesn't exist, create it with empty array
			await fs.writeFile(globalButtonsPath, '[]');
			console.log('DevBoost: Initialized global buttons file');
		}
	} catch (error) {
		console.error('DevBoost: Error initializing global buttons file:', error);
	}

	// Create and register the tree view provider for SmartCmd
	const buttonsProvider = new SmartCmdButtonsTreeProvider(context, globalButtonsPath);
	const treeView = vscode.window.createTreeView('devboost.buttonsView', {
		treeDataProvider: buttonsProvider,
		showCollapseAll: false
	});
	context.subscriptions.push(treeView);

	// Load existing buttons
	buttonsProvider.loadButtons();

	// Register SmartCmd commands
	const createAIButtonsDisposable = vscode.commands.registerCommand('devboost.smartCmdCreateButtons', async () => {
		await handlers.createAIButtons(activityLogPath, buttonsProvider);
	});

	const createCustomButtonDisposable = vscode.commands.registerCommand('devboost.smartCmdCreateCustomButton', async (sectionObj: any) => {

		if(sectionObj && typeof sectionObj === 'object' && 'section' in sectionObj) {
			if(sectionObj.section == 'global') 
				await handlers.createCustomButton(promptInputPath, buttonsProvider, 'Global');
			else 
				await handlers.createCustomButton(promptInputPath, buttonsProvider, 'Workspace');
		}
		else {
			await handlers.createCustomButton(promptInputPath, buttonsProvider);
		}
	});

	const executeButtonDisposable = vscode.commands.registerCommand('devboost.executeButton', async (buttonOrCmd: smartCmdButton | string | any) => {
		// Handle different argument types
		let button: smartCmdButton;
		
		if (typeof buttonOrCmd === 'string') {
			// Legacy: just a command string
			button = { name: 'Command', cmd: buttonOrCmd };
		} else if (buttonOrCmd && typeof buttonOrCmd === 'object' && 'cmd' in buttonOrCmd && 'name' in buttonOrCmd) {
			// New: Button object
			button = buttonOrCmd as smartCmdButton;
		} else if (buttonOrCmd && typeof buttonOrCmd === 'object' && 'button' in buttonOrCmd) {
			// TreeItem wrapper
			button = buttonOrCmd.button;
		} else {
			vscode.window.showWarningMessage('DevBoost: No command provided to execute.');
			return;
		}
		
		await handlers.executeButtonCommand(button, activityLogPath);
	});

	const deleteButtonDisposable = vscode.commands.registerCommand('devboost.deleteButton', async (item: any) => {
		if (!item) {
			vscode.window.showWarningMessage('DevBoost: No button selected to delete.');
			return;
		}
		await buttonsProvider.deleteButton(item);
	});

	const editButtonDisposable = vscode.commands.registerCommand('devboost.editButton', async (item: any) => {
		if (!item) {
			vscode.window.showWarningMessage('DevBoost: No button selected to edit.');
			return;
		}
		await buttonsProvider.editButton(item);
	});

	const addToGlobalDisposable = vscode.commands.registerCommand('devboost.addToGlobal', async (item: SmartCmdButtonTreeItem) => {
		await handlers.addToGlobal(item, buttonsProvider);
	});

	const refreshButtonsDisposable = vscode.commands.registerCommand('devboost.refreshButtons', async () => {
		await buttonsProvider.loadButtons();
		vscode.window.showInformationMessage('Buttons refreshed!');
	});

	const openButtonsFileDisposable = vscode.commands.registerCommand('devboost.openButtonsFile', async (item: any) => {
		await handlers.openButtonsFile(item, globalButtonsPath);
	});

	// Register all SmartCmd commands
	context.subscriptions.push(
		createAIButtonsDisposable,
		createCustomButtonDisposable,
		executeButtonDisposable,
		deleteButtonDisposable,
		editButtonDisposable,
		addToGlobalDisposable,
		refreshButtonsDisposable,
		openButtonsFileDisposable
	);

	// Listen for workspace folder changes to reload buttons
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
			console.log('DevBoost: Workspace folders changed');
			
			// Reload buttons to get new workspace buttons
			await buttonsProvider.loadButtons();
			vscode.window.showInformationMessage('DevBoost: Buttons reloaded for new workspace');
		})
	);

	console.log('DevBoost: SmartCmd activated successfully');
}
