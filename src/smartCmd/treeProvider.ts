// SmartCmd Types and Classes
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as aiServices from './aiServices';
import * as scriptManager from './scriptManager';
import { CustomDialog } from '../commonView/customDialog';
import { EditButtonFormPanel } from './view/editButtonFormPanel';

// Input field interface for commands that need user input
export interface InputField {
	placeholder: string;  // Placeholder text for the input (e.g., "Enter commit message")
	variable: string;     // Variable name to replace in command (e.g., "{message}")
}

// Button interface
export interface smartCmdButton {
	name: string;
	cmd: string;
	user_prompt?: string;           // Prompt provided by the user
	description?: string;           // Description 
	inputs?: InputField[];          // Optional input fields for dynamic commands
	scope?: 'workspace' | 'global';
	execDir?: string;               // Optional execution directory
	scriptFile?: string;            // Optional script file name (stored in scripts folder)
	scriptContent?: string;         // Script content (only used during creation, not saved to JSON)
}

// Section type for organizing buttons
type SectionType = 'smartcmd' | 'global' | 'workspace';

// Tree item base class
class SmartCmdTreeItemBase extends vscode.TreeItem {
	constructor(
		label: string,
		collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly itemType: 'smartcmd' | 'section' | 'button'
	) {
		super(label, collapsibleState);
	}
}

// Section tree item (parent nodes for Global/Workspace)
class SmartCmdSectionTreeItem extends SmartCmdTreeItemBase {
	constructor(
		public readonly section: SectionType,
		public readonly buttonCount: number
	) {
		super(
			section === 'global' ? 'Global Commands' : 'Workspace Commands',
			vscode.TreeItemCollapsibleState.Expanded,
			'section'
		);
		this.description = `${buttonCount} button${buttonCount !== 1 ? 's' : ''}`;
		this.contextValue = 'section';
		this.iconPath = new vscode.ThemeIcon(section === 'global' ? 'globe' : 'window');
	}
}

// Tree item for buttons
export class SmartCmdButtonTreeItem extends SmartCmdTreeItemBase {
	constructor(
		public readonly button: smartCmdButton,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(button.name, collapsibleState, 'button');
		
		// Build tooltip with both descriptions
		const tooltipParts: string[] = [];
		
		// Add description if available
		if (button.description) {
			tooltipParts.push(`Description: ${button.description}`);
		}

		if(!button.description){
			tooltipParts.push(`No description available.`);
		}

		if(button.user_prompt){
			tooltipParts.push(`User Prompt: ${button.user_prompt}`);
		}
		
		// Show script file indicator if present
		const cmdDisplay = button.scriptFile 
			? `Script: ${button.execDir && button.execDir.trim() !== '.' && button.execDir.trim() !== '' ? `cd ${button.execDir} && ` : ''}run ${button.scriptFile}`
			: `Command: ${button.execDir && button.execDir.trim() !== '.' && button.execDir.trim() !== '' ? `cd ${button.execDir} && ` : ''}${button.cmd}`;
		
		tooltipParts.push(cmdDisplay);
		
		// Add input fields info
		const inputInfo = button.inputs && button.inputs.length > 0 
			? `\nInputs: ${button.inputs.map(i => i.placeholder).join(', ')}` 
			: '';
		
		this.tooltip = tooltipParts.join('\n\n') + inputInfo;
		
		// Display AI description or user description in the tree view description field
		// Add script indicator in description
		const scriptIndicator = button.scriptFile ? ' 📜' : '';
		this.description = button.description + scriptIndicator;
		
		this.iconPath = new vscode.ThemeIcon(button.scriptFile ? 'debug-line-by-line' : 'play');
		
		// Set contextValue based on button scope and whether it's a script
		// This allows conditional menu items in package.json
		if (button.scriptFile) {
			this.contextValue = button.scope === 'global' ? 'globalScriptButton' : 'workspaceScriptButton';
		} else {
			this.contextValue = button.scope === 'global' ? 'globalButton' : 'workspaceButton';
		}
		
		// Make it clickable - pass the entire button object for input handling
		this.command = {
			command: 'devboost.executeButton',
			title: 'Execute Button',
			arguments: [button]
		};
	}
}

// Tree data provider for buttons with hierarchical structure
export class SmartCmdButtonsTreeProvider implements vscode.TreeDataProvider<SmartCmdTreeItemBase> {
	private _onDidChangeTreeData: vscode.EventEmitter<SmartCmdTreeItemBase | undefined | null | void> = new vscode.EventEmitter<SmartCmdTreeItemBase | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<SmartCmdTreeItemBase | undefined | null | void> = this._onDidChangeTreeData.event;

	private buttons: smartCmdButton[] = [];

	constructor(
		private context: vscode.ExtensionContext,
		private globalButtonsPath: string,
		public readonly globalStoragePath: string // Made public for access in handlers
	) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getButtons(): smartCmdButton[] {
		return this.buttons;
	}

	async loadButtons(): Promise<void> {
		this.buttons = [];

		// Load global buttons from JSON file
		if (this.globalButtonsPath) {
			try {
				const content = await fs.readFile(this.globalButtonsPath, 'utf-8');
				const globalButtons = JSON.parse(content);
				this.buttons.push(...globalButtons.map((b: smartCmdButton) => ({ ...b, scope: 'global' as const })));
			} catch {
				// File doesn't exist or is invalid, no global buttons to load
			}
		}

		// Load workspace buttons
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const buttonsFilePath = path.join(workspaceRoot, '.vscode', 'devBoost', 'smartCmd.json');

			try {
				const content = await fs.readFile(buttonsFilePath, 'utf-8');
				const workspaceButtons = JSON.parse(content);
				this.buttons.push(...workspaceButtons.map((b: smartCmdButton) => ({ ...b, scope: 'workspace' as const })));
			} catch {
				// File doesn't exist, no workspace buttons to load
			}
		}

		this.refresh();
	}

	getTreeItem(element: SmartCmdTreeItemBase): vscode.TreeItem {
		return element;
	}

	getChildren(element?: SmartCmdTreeItemBase): Thenable<SmartCmdTreeItemBase[]> {
		// Root level: show sections directly (Global and Workspace)
		if (!element) {
			const globalButtons = this.buttons.filter(b => b.scope === 'global');
			const workspaceButtons = this.buttons.filter(b => b.scope === 'workspace');

			const sections: SmartCmdTreeItemBase[] = [];
			
			// Add Global section if there are global buttons
			if (globalButtons.length > 0) {
				sections.push(new SmartCmdSectionTreeItem('global', globalButtons.length));
			}
			
			// Add Workspace section if there are workspace buttons
			if (workspaceButtons.length > 0) {
				sections.push(new SmartCmdSectionTreeItem('workspace', workspaceButtons.length));
			}

			return Promise.resolve(sections);
		}

		// If element is a section, return its buttons
		if (element instanceof SmartCmdSectionTreeItem) {
			const sectionButtons = this.buttons
				.filter(b => b.scope === element.section)
				.map(button => new SmartCmdButtonTreeItem(button, vscode.TreeItemCollapsibleState.None));
			
			return Promise.resolve(sectionButtons);
		}

		// If element is a button, it has no children
		return Promise.resolve([]);
	}

	async addButtons(buttons: smartCmdButton[], scope: 'workspace' | 'global'): Promise<number> {
		if (!buttons || buttons.length === 0) {
			vscode.window.showWarningMessage('DevBoost: No buttons to add.');
			return 0;
		}

		// Process buttons with scripts first
		const processedButtons: smartCmdButton[] = [];
		for (const button of buttons) {
			if (button.scriptContent) {
				// Button needs a script file
				const processedButton = await scriptManager.processButtonWithScript(
					{ ...button, scope },
					this.globalStoragePath
				);
				
				if (processedButton) {
					processedButtons.push(processedButton);
				} else {
					console.error('DevBoost: Failed to process script for button:', button.name);
					vscode.window.showWarningMessage(`Failed to create script for button: ${button.name}`);
				}
			} else {
				// Regular command button
				processedButtons.push(button);
			}
		}

		if (processedButtons.length === 0) {
			vscode.window.showWarningMessage('DevBoost: No valid buttons to add after processing.');
			return 0;
		}

		// Validate buttons and check for duplicates
		const validButtons: smartCmdButton[] = [];
		const duplicateButtons: Array<{newButton: smartCmdButton, existingButton: smartCmdButton}> = [];
		const invalidButtons: number[] = [];

		// Use withProgress for duplicate checking since it calls AI
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Checking for duplicate buttons",
			cancellable: false
		}, async (progress) => {
			for (let i = 0; i < processedButtons.length; i++) {
				const b = processedButtons[i];
				
				// Check if button is valid
				if (!b.name || !b.cmd || b.name.trim().length === 0 || b.cmd.trim().length === 0) {
					console.warn('DevBoost: Skipping invalid button:', b);
					invalidButtons.push(i);
					continue;
				}

				// Check for duplicates using AI-powered semantic comparison
				progress.report({ message: `${i + 1}/${processedButtons.length}` });
				const duplicateButton = await aiServices.checkDuplicateButton(b, this.buttons, scope);

				if (duplicateButton) {
					duplicateButtons.push({newButton: b, existingButton: duplicateButton});
					console.warn('DevBoost: Duplicate/similar button:', b.name, '(similar to:', duplicateButton.name + ')');
				} else {
					validButtons.push(b);
				}
			}
		});

		console.log(duplicateButtons)
		// Show feedback about duplicates - ask for confirmation one by one
		if (duplicateButtons.length > 0) {
			for (const dup of duplicateButtons) {
				console.log(dup)
				const newButtonType = dup.newButton.scriptFile ? ' (script)' : '';
				const existingButtonType = dup.existingButton.scriptFile ? ' (script)' : '';
				
				const confirmationMessage = `This button appears similar to an existing one:

New Button${newButtonType}:
• Name: ${dup.newButton.name}
• Command: ${dup.newButton.execDir && dup.newButton.execDir.trim() !== '.' && dup.newButton.execDir.trim() !== '' ? 'cd ' +  dup.newButton.execDir + ' && ' : ''}${dup.newButton.cmd}
• Description: ${dup.newButton.description || 'N/A'}
• Scope: ${scope === 'global' ? 'Global' : 'Workspace'}

Existing Similar Button${existingButtonType}:
• Name: ${dup.existingButton.name}
• Command: ${dup.existingButton.execDir && dup.existingButton.execDir.trim() !== '.' && dup.existingButton.execDir.trim() !== '' ? 'cd ' +  dup.existingButton.execDir + ' && ' : ''}${dup.existingButton.cmd}
• Description: ${dup.existingButton.description || 'N/A'}
• Scope: ${dup.existingButton.scope === 'global' ? 'Global' : 'Workspace'}

What would you like to do?`;
				console.log(confirmationMessage);
				const result = await CustomDialog.show({
					title: '⚠️ Duplicate Button Detected',
					message: confirmationMessage,
					buttons: [
						{ label: 'Add without editing', id: 'Add without editing', isPrimary: true },
						{ label: 'Edit New then Add', id: 'Edit New then Add' },
						{ label: 'Edit Existing then Add', id: 'Edit Existing then Add' },
						{ label: 'Replace Existing', id: 'Replace Existing' },
						{ label: 'Skip', id: 'Skip' }
					],
					markdown: false
				});
				
				if (result === 'Add without editing') {
					// Add the new button alongside the existing one
					validButtons.push(dup.newButton);
				} else if (result === 'Edit New then Add') {
					// Let user edit the new button before adding
					const editedButton = await this.editNewButton(dup.newButton);
					if (editedButton) {
						validButtons.push(editedButton);
					} else {
						// User cancelled - delete the newly created script if any
						if (dup.newButton.scriptFile) {
							await scriptManager.deleteScript(dup.newButton.scriptFile, scope, this.globalStoragePath);
						}
						continue;
					}
				} else if (result === 'Edit Existing then Add') {
					// Let user edit the existing button
					const existingIndex = this.buttons.findIndex(
						b => b.name === dup.existingButton.name && 
						     b.cmd === dup.existingButton.cmd && 
						     b.scope === dup.existingButton.scope &&
							 b.execDir === dup.existingButton.execDir
					);
					if (existingIndex !== -1) {
						const editedButton = await this.editNewButton(this.buttons[existingIndex]);
						if (editedButton) {
							this.buttons[existingIndex] = editedButton;
							await this.saveButtons();
							this.refresh();
							vscode.window.showInformationMessage(`Updated existing button: ${editedButton.name}`);
						}
						else {
							// User cancelled - delete the newly created script if any
							if (dup.newButton.scriptFile) {
								await scriptManager.deleteScript(dup.newButton.scriptFile, scope, this.globalStoragePath);
							}
							continue;
						}
					}
					// Add the new button as well
					validButtons.push(dup.newButton);
				} else if (result === 'Replace Existing') {
					// Remove the existing button and its script if it has one
					const existingIndex = this.buttons.findIndex(
						b => b.name === dup.existingButton.name && 
						     b.cmd === dup.existingButton.cmd && 
						     b.scope === dup.existingButton.scope &&
							 b.execDir === dup.existingButton.execDir
					);
					if (existingIndex !== -1) {
						const existingButton = this.buttons[existingIndex];
						// Delete script file if exists
						if (existingButton.scriptFile && existingButton.scope) {
							await scriptManager.deleteScript(existingButton.scriptFile, existingButton.scope, this.globalStoragePath);
						}
						this.buttons.splice(existingIndex, 1);
					}
					validButtons.push(dup.newButton);
				} 
				else if (result === 'Skip') {
					// Skip - delete the newly created script if any
					if (dup.newButton.scriptFile) {
						await scriptManager.deleteScript(dup.newButton.scriptFile, scope, this.globalStoragePath);
					}
					continue;
				}
				else {
					// User closed dialog or unknown option - treat as Skip for every other duplicate
					if (dup.newButton.scriptFile) {
						await scriptManager.deleteScript(dup.newButton.scriptFile, scope, this.globalStoragePath);
					}
					break;
				}
			}
		}

		if (validButtons.length === 0) {
			if (invalidButtons.length > 0) {
				vscode.window.showWarningMessage('DevBoost: No valid buttons to add.');
			} else if (duplicateButtons.length > 0) {
				vscode.window.showInformationMessage(`DevBoost: ${duplicateButtons.length >1 ? 'All duplicate buttons were' : 'Duplicate button was'} skipped.`);
			}
			return 0;
		}

		// Add valid, non-duplicate buttons
		const newButtons = validButtons.map(b => {
			b.execDir = b.execDir && b.execDir.trim() !== '' ? b.execDir : '.';
			return {...b, scope};
		});
		this.buttons.push(...newButtons);
		await this.saveButtons();
		this.refresh();
		
		// Show summary message
		const messages: string[] = [];
		if (validButtons.length > 0) {
			const scriptCount = validButtons.filter(b => b.scriptFile).length;
			const cmdCount = validButtons.length - scriptCount;
			if (cmdCount > 0) {
				messages.push(`${cmdCount} command button${cmdCount > 1 ? 's' : ''}`);
			}
			if (scriptCount > 0) {
				messages.push(`${scriptCount} script button${scriptCount > 1 ? 's' : ''}`);
			}
		}
		const skippedDuplicates = duplicateButtons.length - duplicateButtons.filter(d => validButtons.includes(d.newButton)).length;
		if (skippedDuplicates > 0) {
			messages.push(`${skippedDuplicates} duplicate${skippedDuplicates > 1 ? 's' : ''} skipped`);
		}
		if (invalidButtons.length > 0) {
			messages.push(`${invalidButtons.length} invalid button${invalidButtons.length > 1 ? 's' : ''} skipped`);
		}
		
		vscode.window.showInformationMessage(`DevBoost: Added ${messages.join(', ')}.`);
		return validButtons.length;
	}

	async deleteButton(item: SmartCmdButtonTreeItem): Promise<void> {
		console.warn('Delete button invoked for:', item.button);
		if (!item || !item.button) {
			vscode.window.showWarningMessage('DevBoost: Invalid button item.');
			return;
		}

		const index = this.buttons.findIndex(b => b.name === item.button.name && b.cmd === item.button.cmd && b.scope === item.button.scope && b.execDir === item.button.execDir);
		if (index === -1) {
			vscode.window.showWarningMessage(`DevBoost: Button "${item.button.name}" not found.`);
			return;
		}

		const button = this.buttons[index];
		
		// Delete script file if exists
		if (button.scriptFile && button.scope) {
			const deleted = await scriptManager.deleteScript(button.scriptFile, button.scope, this.globalStoragePath);
			if (deleted) {
				console.log(`DevBoost: Deleted script file for button: ${button.name}`);
			}
		}
		
		this.buttons.splice(index, 1);
		
		// Remove from storage
		try {
			if (button.scope === 'global') {
				await this.saveGlobalButtons();
			} else {
				await this.saveWorkspaceButtons();
			}
			
			this.refresh();
			const buttonType = button.scriptFile ? ' (with script)' : '';
			vscode.window.showInformationMessage(`Deleted button: ${button.name}${buttonType}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to delete button: ${button.name}`);
			console.error('Delete button error:', error);
		}
	}

	async editButton(item: SmartCmdButtonTreeItem): Promise<void> {
		if (!item || !item.button) {
			vscode.window.showWarningMessage('DevBoost: Invalid button item.');
			return;
		}

		const index = this.buttons.findIndex(b => b.name === item.button.name && b.cmd === item.button.cmd && b.scope === item.button.scope && b.execDir === item.button.execDir);
		if (index === -1) {
			vscode.window.showWarningMessage(`DevBoost: Button "${item.button.name}" not found.`);
			return;
		}

		const button = this.buttons[index];

		// Show edit form
		const editedButton = await EditButtonFormPanel.show(button);

		if (!editedButton) {
			vscode.window.showInformationMessage('Edit cancelled.');
			return;
		}

		// Update button
		this.buttons[index] = editedButton;

		// Save to storage
		try {
			if (button.scope === 'global') {
				await this.saveGlobalButtons();
			} else {
				await this.saveWorkspaceButtons();
			}
			
			this.refresh();
			vscode.window.showInformationMessage(`Updated button: ${editedButton.name}`);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to update button: ${button.name}`);
			console.error('Edit button error:', error);
		}
	}

	private async saveButtons(): Promise<void> {
		await this.saveGlobalButtons();
		await this.saveWorkspaceButtons();
	}

	private async saveGlobalButtons(): Promise<void> {
		if (!this.globalButtonsPath) {
			return;
		}

		try {
			// Ensure the directory exists
			await fs.mkdir(path.dirname(this.globalButtonsPath), { recursive: true });
			
			const globalButtons = this.buttons
				.filter(b => b.scope === 'global')
				.map(({ scope, scriptContent, ...b }) => b); // Exclude scope and scriptContent
			
			await fs.writeFile(this.globalButtonsPath, JSON.stringify(globalButtons, null, 2));
		} catch (error) {
			console.error('Error saving global buttons:', error);
		}
	}

	// Edit a new button (used during duplicate detection)
	// Edit a new button (used during duplicate detection)
	private async editNewButton(button: smartCmdButton): Promise<smartCmdButton | null> {
		return await EditButtonFormPanel.show(button);
	}

	// Open script file in editor
	async openScriptFile(item: SmartCmdButtonTreeItem): Promise<void> {
		if (!item || !item.button || !item.button.scriptFile) {
			vscode.window.showWarningMessage('This button does not have a script file.');
			return;
		}

		const button = item.button;
		const scriptFile = button.scriptFile;
		
		if (!scriptFile) {
			vscode.window.showWarningMessage('This button does not have a script file.');
			return;
		}
		
		const scriptsDir = scriptManager.getScriptsDir(button.scope || 'workspace', this.globalStoragePath);
		
		if (!scriptsDir) {
			vscode.window.showErrorMessage('Could not determine scripts directory.');
			return;
		}

		try {
			const scriptPath = path.join(scriptsDir, scriptFile);
			
			// Check if file exists
			await fs.access(scriptPath);
			
			// Open the file in editor
			const document = await vscode.workspace.openTextDocument(scriptPath);
			await vscode.window.showTextDocument(document, { preview: false });
		} catch (error) {
			console.error('Error opening script file:', error);
			vscode.window.showErrorMessage(`Failed to open script file: ${scriptFile}`);
		}
	}

	private async saveWorkspaceButtons(): Promise<void> {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			return;
		}

		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		const buttonsFilePath = path.join(workspaceRoot, '.vscode', 'devBoost', 'smartCmd.json');

		try {
			await fs.mkdir(path.dirname(buttonsFilePath), { recursive: true });
			const workspaceButtons = this.buttons
				.filter(b => b.scope === 'workspace')
				.map(({ scope, scriptContent, ...b }) => b); // Exclude scope and scriptContent
			await fs.writeFile(buttonsFilePath, JSON.stringify(workspaceButtons, null, 2));
		} catch (error) {
			console.error('Error saving workspace buttons:', error);
		}
	}
}

