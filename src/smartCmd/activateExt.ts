// SmartCmd Extension Activation
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlers from './handlers';
import * as scriptManager from './scriptManager';
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
	const buttonsProvider = new SmartCmdButtonsTreeProvider(context, globalButtonsPath, globalStoragePath);
	const treeView = vscode.window.createTreeView('devboost.smartCmdView', {
		treeDataProvider: buttonsProvider,
		showCollapseAll: false
	});
	context.subscriptions.push(treeView);

	// Load existing buttons
	await buttonsProvider.loadButtons();

	// Load example buttons if none exist
	await loadExampleButtonsIfNeeded(context, buttonsProvider, globalStoragePath);

	// Register SmartCmd commands
	const createAIButtonsDisposable = vscode.commands.registerCommand('devboost.smartCmdCreateButtons', async () => {
		await handlers.createAIButtons(activityLogPath, buttonsProvider);
	});

	const createCustomButtonDisposable = vscode.commands.registerCommand('devboost.smartCmdCreateCustomButton', async (sectionObj: any) => {

		if(sectionObj && typeof sectionObj === 'object' && 'section' in sectionObj) {
			if(sectionObj.section == 'global'){ 
				await handlers.createCustomButton(promptInputPath, buttonsProvider, 'Global');
			}
			else {
				await handlers.createCustomButton(promptInputPath, buttonsProvider, 'Workspace');
			}
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

	const openScriptFileDisposable = vscode.commands.registerCommand('devboost.openScriptFile', async (item: SmartCmdButtonTreeItem) => {
		await buttonsProvider.openScriptFile(item);
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
		openButtonsFileDisposable,
		openScriptFileDisposable
	);

	// Listen for workspace folder changes to reload buttons
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
			console.log('DevBoost: Workspace folders changed');
			
			// Reload buttons to get new workspace buttons
			await buttonsProvider.loadButtons();

			// Load workspace example buttons if needed for new workspace
    		await loadExampleButtonsIfNeeded(context, buttonsProvider, globalStoragePath);

			vscode.window.showInformationMessage('DevBoost: Buttons reloaded for new workspace');
		})
	);

	console.log('DevBoost: SmartCmd activated successfully');
}

/**
 * Load example buttons if no buttons exist in the respective scope
 */
async function loadExampleButtonsIfNeeded(
	context: vscode.ExtensionContext,
	buttonsProvider: SmartCmdButtonsTreeProvider,
	globalStoragePath: string
): Promise<void> {
	try {
		// Get current button counts
		const workspaceButtonCount = await getButtonCount('workspace');
		const globalButtonCount = await getButtonCount('global', globalStoragePath);

		// Load example buttons file
		const exampleButtonsPath = path.join(context.extensionPath, 'exampleButtons.json');
		const exampleContent = await fs.readFile(exampleButtonsPath, 'utf-8');
		const examples = JSON.parse(exampleContent);

		let loadedCount = 0;

		// Load workspace examples if no workspace buttons exist
		if (workspaceButtonCount === 0 && examples.workspace && examples.workspace.length > 0) {
			// Check if we need to create the example script
			const scriptButton = examples.workspace.find((b: smartCmdButton) => b.scriptFile);
			if (scriptButton && examples.exampleScript) {
				// Create the example script file in workspace
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
					const scriptsDir = path.join(workspaceRoot, '.vscode', 'scripts');
					await fs.mkdir(scriptsDir, { recursive: true });
					
					const scriptPath = path.join(scriptsDir, examples.exampleScript.filename);
					await fs.writeFile(scriptPath, examples.exampleScript.content, { encoding: 'utf-8' });
					
					// Make script executable on Unix-like systems
					if (process.platform !== 'win32') {
						try {
							await fs.chmod(scriptPath, 0o755);
						} catch (chmodError) {
							console.warn('DevBoost: Could not make example script executable:', chmodError);
						}
					}
					
					// Generate command for the script button
					const scriptCommand = scriptManager.generateScriptCommand(
						scriptButton.scriptFile,
						'workspace',
						scriptButton.execDir,
						globalStoragePath,
						scriptButton.inputs
					);
					scriptButton.cmd = scriptCommand;
					
					console.log(`DevBoost: Created example script at ${scriptPath}`);
				}
			}

			const added = await buttonsProvider.addButtons(examples.workspace, 'workspace');
			loadedCount += added;
			console.log(`DevBoost: Loaded ${added} example workspace buttons`);
		}

		// Load global examples if no global buttons exist
		if (globalButtonCount === 0 && examples.global && examples.global.length > 0) {
			const added = await buttonsProvider.addButtons(examples.global, 'global');
			loadedCount += added;
			console.log(`DevBoost: Loaded ${added} example global buttons`);
		}

		if (loadedCount > 0) {
			vscode.window.showInformationMessage(
				`DevBoost: Loaded ${loadedCount} example button${loadedCount > 1 ? 's' : ''} to help you get started!`,
				'View Buttons'
			).then(selection => {
				if (selection === 'View Buttons') {
					vscode.commands.executeCommand('devboost.smartCmdView.focus');
				}
			});
		}
	} catch (error) {
		console.error('DevBoost: Error loading example buttons:', error);
		// Don't show error to user - it's okay if examples fail to load
	}
}

/**
 * Get count of buttons in a scope
 */
async function getButtonCount(scope: 'workspace' | 'global', globalStoragePath?: string): Promise<number> {
	try {
		let buttonsFilePath: string;
		
		if (scope === 'global') {
			if (!globalStoragePath) {
				return 0;
			}
			buttonsFilePath = path.join(globalStoragePath, 'global-buttons.json');
		} else {
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				return 0;
			}
			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			buttonsFilePath = path.join(workspaceRoot, '.vscode', 'devboost.json');
		}

		const content = await fs.readFile(buttonsFilePath, 'utf-8');
		const buttons = JSON.parse(content);
		return Array.isArray(buttons) ? buttons.length : 0;
	} catch (error) {
		// File doesn't exist or error reading - assume no buttons
		return 0;
	}
}