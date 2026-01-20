// SmartCmd Types and Classes
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as aiServices from './aiServices';
import * as scriptManager from './scriptManager';
import { CustomDialog } from '../commonView/customDialog';
import { EditButtonFormPanel } from './view/editButtonFormPanel';
import { BulkOperation } from './view/bulkEditPanel';

// Input field interface for commands that need user input
export interface InputField {
	placeholder: string;  // Placeholder text for the input (e.g., "Enter commit message")
	variable: string;     // Variable name to replace in command (e.g., "{message}")
}

// Button interface
export interface smartCmdButton {
	id?: string;                    // Unique identifier (UUID) for the button
	name: string;
	cmd: string;
	user_prompt?: string;           // Prompt provided by the user
	description?: string;           // Description 
	inputs?: InputField[];          // Optional input fields for dynamic commands
	scope?: 'workspace' | 'global';
	execDir?: string;               // Optional execution directory
	scriptFile?: string;            // Optional script file name (stored in scripts folder)
	scriptContent?: string;         // Script content (only used during creation, not saved to JSON)
	modelUsed?: string;             // AI model used for this button (if any)
}

// Button group interface - stores only button IDs to avoid redundant data
export interface ButtonGroup {
	id: string;                     // Unique identifier for the group
	name: string;                   // Display name of the group
	buttonIds: string[];            // Ordered array of button IDs in this group
	scope: 'workspace' | 'global';  // Whether this is a workspace or global group
	collapsed?: boolean;            // UI state - whether the group is collapsed
}

// Section type for organizing buttons
type SectionType = 'smartcmd' | 'global' | 'workspace';

// Tree item base class
class SmartCmdTreeItemBase extends vscode.TreeItem {
	constructor(
		label: string,
		collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly itemType: 'smartcmd' | 'section' | 'button' | 'group' | 'allButtons'
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

// Group tree item (for button groups)
export class SmartCmdGroupTreeItem extends SmartCmdTreeItemBase {
	constructor(
		public readonly group: ButtonGroup,
		public readonly validButtonCount: number // Count of buttons that actually exist
	) {
		super(
			group.name,
			vscode.TreeItemCollapsibleState.Collapsed,
			'group'
		);
		this.description = `${validButtonCount} button${validButtonCount !== 1 ? 's' : ''}`;
		this.contextValue = group.scope === 'global' ? 'globalGroup' : 'workspaceGroup';
		this.iconPath = new vscode.ThemeIcon('file-directory');
	}
}

// All buttons tree item (for button groups)
export class SmartCmdAllButtonsTreeItem extends SmartCmdTreeItemBase {
	constructor(
		public readonly group: ButtonGroup,
		public readonly validButtonCount: number // Count of buttons that actually exist
	) {
		super(
			group.name,
			vscode.TreeItemCollapsibleState.Expanded,
			'allButtons'
		);
		this.description = `${validButtonCount} button${validButtonCount !== 1 ? 's' : ''}`;
		this.contextValue = group.scope === 'global' ? 'globalAllB' : 'workspaceAllB';
		this.iconPath = new vscode.ThemeIcon('file-directory');
	}
}

// Tree item for buttons
export class SmartCmdButtonTreeItem extends SmartCmdTreeItemBase {
	constructor(
		public readonly button: smartCmdButton,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly groupId?: string // Optional group ID when button is shown in a group
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
		
		// Show script file indicator if present
		const cmdDisplay = `Command: ${button.execDir && button.execDir.trim() !== '.' && button.execDir.trim() !== '' ? `cd ${button.execDir} && ` : ''}${button.scriptFile 
			? `run ${button.scriptFile}`
			: button.cmd}`;
		
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
		
		// Set contextValue based on button scope, whether it's a script, and if it's in a group
		// This allows conditional menu items in package.json
		const inGroupSuffix = groupId ? 'InGroupB' : '';
		if (button.scriptFile) {
			this.contextValue = (button.scope === 'global' ? 'globalScriptButton' : 'workspaceScriptButton') + inGroupSuffix;
		} else {
			this.contextValue = (button.scope === 'global' ? 'globalButton' : 'workspaceButton') + inGroupSuffix;
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
	private groups: ButtonGroup[] = [];

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

	getGroups(): ButtonGroup[] {
		return this.groups;
	}

	// Get the path for global groups storage
	private getGlobalGroupsPath(): string {
		return path.join(path.dirname(this.globalButtonsPath), 'smartCmdGroups.json');
	}

	// Get the path for workspace groups storage
	private getWorkspaceGroupsPath(): string | null {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			return null;
		}
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		return path.join(workspaceRoot, '.vscode', 'devBoost', 'smartCmdGroups.json');
	}

	async loadButtons(): Promise<void> {
		this.buttons = [];
		this.groups = [];

		// Load global buttons from JSON file
		if (this.globalButtonsPath) {
			try {
				const content = await fs.readFile(this.globalButtonsPath, 'utf-8');
				const globalButtons = JSON.parse(content);
				this.buttons.push(...globalButtons.map((b: smartCmdButton) => ({ 
					...b, 
					id: b.id || crypto.randomUUID(), // Generate UUID if missing
					scope: 'global' as const 
				})));
			} catch {
				// File doesn't exist or is invalid, no global buttons to load
			}

			// Load global groups
			try {
				const groupsContent = await fs.readFile(this.getGlobalGroupsPath(), 'utf-8');
				const globalGroups = JSON.parse(groupsContent);
				this.groups.push(...globalGroups.map((g: ButtonGroup) => ({ 
					...g, 
					scope: 'global' as const 
				})));
			} catch {
				// File doesn't exist or is invalid, no global groups to load
			}
		}

		// Load workspace buttons
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const buttonsFilePath = path.join(workspaceRoot, '.vscode', 'devBoost', 'smartCmd.json');

			try {
				const content = await fs.readFile(buttonsFilePath, 'utf-8');
				const workspaceButtons = JSON.parse(content);
				this.buttons.push(...workspaceButtons.map((b: smartCmdButton) => ({ 
					...b, 
					id: b.id || crypto.randomUUID(), // Generate UUID if missing
					scope: 'workspace' as const 
				})));
			} catch {
				// File doesn't exist, no workspace buttons to load
			}

			// Load workspace groups
			const workspaceGroupsPath = this.getWorkspaceGroupsPath();
			if (workspaceGroupsPath) {
				try {
					const groupsContent = await fs.readFile(workspaceGroupsPath, 'utf-8');
					const workspaceGroups = JSON.parse(groupsContent);
					this.groups.push(...workspaceGroups.map((g: ButtonGroup) => ({ 
						...g, 
						scope: 'workspace' as const 
					})));
				} catch {
					// File doesn't exist, no workspace groups to load
				}
			}
		}
		this.saveButtons(); // Ensure all buttons have IDs
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
			const globalGroups = this.groups.filter(g => g.scope === 'global');
			const workspaceGroups = this.groups.filter(g => g.scope === 'workspace');

			const sections: SmartCmdTreeItemBase[] = [];
			
			// Add Global section if there are global buttons or groups
			if (globalButtons.length > 0 || globalGroups.length > 0) {
				sections.push(new SmartCmdSectionTreeItem('global', globalButtons.length));
			}
			
			// Add Workspace section if there are workspace buttons or groups
			if (workspaceButtons.length > 0 || workspaceGroups.length > 0) {
				sections.push(new SmartCmdSectionTreeItem('workspace', workspaceButtons.length));
			}

			return Promise.resolve(sections);
		}

		// If element is a section, return its groups first, then buttons
		if (element instanceof SmartCmdSectionTreeItem) {
			const children: SmartCmdTreeItemBase[] = [];
			
			// Add groups for this section
			const sectionGroups = this.groups.filter(g => g.scope === element.section);
			for (const group of sectionGroups) {
				// Count valid buttons in the group (buttons that actually exist)
				const validButtonCount = group.buttonIds.filter(id => 
					this.buttons.some(b => b.id === id)
				).length;
				children.push(new SmartCmdGroupTreeItem(group, validButtonCount));
			}
			
			// Add all buttons for this section (buttons appear in section regardless of group membership)
			const sectionButtons = this.buttons
				.filter(b => b.scope === element.section)
				.map(button => new SmartCmdButtonTreeItem(button, vscode.TreeItemCollapsibleState.None));
			if(sectionGroups.length > 0 && sectionButtons.length > 0) {
				const allButtonGroup: ButtonGroup = {
					id: crypto.randomUUID(),
					name: "All Buttons",
					buttonIds: sectionButtons.map(b => b.button.id!),
					scope: element.section == 'global' ? 'global' : 'workspace',
				};
				children.push(new SmartCmdAllButtonsTreeItem(allButtonGroup, sectionButtons.length));
			}
			else {
				children.push(...sectionButtons);
			}
			
			return Promise.resolve(children);
		}

		// If element is a group, return its buttons (in order)
		if (element instanceof SmartCmdGroupTreeItem) {
			const groupButtons: SmartCmdButtonTreeItem[] = [];
			
			// Get buttons in the order specified by the group
			for (const buttonId of element.group.buttonIds) {
				const button = this.buttons.find(b => b.id === buttonId);
				if (button) {
					// Pass group ID so we know this button is in a group context
					groupButtons.push(new SmartCmdButtonTreeItem(
						button, 
						vscode.TreeItemCollapsibleState.None,
						element.group.id
					));
				}
			}
			
			return Promise.resolve(groupButtons);
		}

		if( element instanceof SmartCmdAllButtonsTreeItem) {
			const allButtons: SmartCmdButtonTreeItem[] = [];
			
			// Get buttons in the order specified by the group
			for (const buttonId of element.group.buttonIds) {
				const button = this.buttons.find(b => b.id === buttonId);
				if (button) {
					// Pass group ID so we know this button is in a group context
					allButtons.push(new SmartCmdButtonTreeItem(
						button, 
						vscode.TreeItemCollapsibleState.None
					));
				}
			}
			
			return Promise.resolve(allButtons);
		}

		// If element is a button, it has no children
		return Promise.resolve([]);
	}

	async addButtons(buttons: smartCmdButton[], scope: 'workspace' | 'global', checkDuplicates: boolean = true, silent: boolean = false): Promise<number> {
		if (!buttons || buttons.length === 0) {
			if (!silent) {
				vscode.window.showWarningMessage('DevBoost: No buttons to add.');
			}
			return 0;
		}

		// Process buttons with scripts first
		let processedButtons: smartCmdButton[] = [];
		for (const button of buttons) {
			if (button.scriptContent) {
				// Button needs a script file
				const processedButton = await scriptManager.processButtonWithScript(
					button,
					this.globalStoragePath,
					scope
				);
				
				if (processedButton) {
					processedButton.scope = scope; // Ensure scope is set correctly
					processedButtons.push(processedButton);
				} else {
					console.error('DevBoost: Failed to process script for button:', button.name);
					vscode.window.showWarningMessage(`Failed to create script for button: ${button.name}`);
				}
			} else {
				// Regular command button
				processedButtons.push({ ...button, scope });
			}
		}

		if (processedButtons.length === 0) {
			vscode.window.showWarningMessage('DevBoost: No valid buttons to add after processing.');
			return 0;
		}

		// Validate buttons and check for duplicates
		const validButtons: smartCmdButton[] = [];
		const duplicateButtons: Array<{newButton: smartCmdButton, existingButton: smartCmdButton}> = [];
		var invalidButtons: number = 0;

		const processedButtonsCount = processedButtons.length;
		processedButtons = processedButtons.filter(b=> !(!b.name || !b.cmd || b.name.trim().length === 0 || b.cmd.trim().length === 0))
		invalidButtons = processedButtonsCount - processedButtons.length;

		if(checkDuplicates){
			// Use withProgress for duplicate checking since it calls AI
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Checking for duplicate buttons",
				cancellable: false
			}, async (progress) => {
				for (let i = 0; i < processedButtons.length; i++) {
					const b = processedButtons[i];

					// Check for duplicates using AI-powered semantic comparison
					progress.report({ message: `${i + 1}/${processedButtons.length}` });
					const duplicateButton = await aiServices.checkDuplicateButton(b, this.buttons, scope, this.globalStoragePath);

					if (duplicateButton) {
						duplicateButtons.push({newButton: b, existingButton: duplicateButton});
						console.warn('DevBoost: Duplicate/similar button:', b.name, '(similar to:', duplicateButton.name + ')');
					} else {
						validButtons.push(b);
					}
				}
			});
		}	else {
			validButtons.push(...processedButtons);
		}

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
					const existingIndex = this.buttons.findIndex(b => b.id === dup.existingButton.id);
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
					const existingIndex = this.buttons.findIndex(b => b.id === dup.existingButton.id);
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
			if (!silent) {
				if (invalidButtons > 0) {
					vscode.window.showWarningMessage('DevBoost: No valid buttons to add.');
				} else if (duplicateButtons.length > 0) {
					vscode.window.showInformationMessage(`DevBoost: ${duplicateButtons.length >1 ? 'All duplicate buttons were' : 'Duplicate button was'} skipped.`);
				}
			}
			return 0;
		}

		// Add valid, non-duplicate buttons
		const newButtons = validButtons.map(b => {
			b.execDir = b.execDir && b.execDir.trim() !== '' ? b.execDir : '.';
			return {
				...b, 
				id: b.id || crypto.randomUUID(), // Generate UUID if missing
				scope
			};
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
		if (invalidButtons > 0) {
			messages.push(`${invalidButtons} invalid button${invalidButtons > 1 ? 's' : ''} skipped`);
		}
		
		if (!silent) {
			vscode.window.showInformationMessage(`DevBoost: Added ${messages.join(', ')}.`);
		}
		return validButtons.length;
	}

	async deleteButton(item: SmartCmdButtonTreeItem): Promise<void> {
		console.warn('Delete button invoked for:', item.button);
		if (!item || !item.button) {
			vscode.window.showWarningMessage('DevBoost: Invalid button item.');
			return;
		}

		const index = this.buttons.findIndex(b => b.id === item.button.id);
		if (index === -1) {
			vscode.window.showWarningMessage(`DevBoost: Button "${item.button.name}" not found.`);
			return;
		}

		const button = this.buttons[index];
		
		// Check if button is in any groups
		const groupsContainingButton = this.groups.filter(g => g.buttonIds.includes(button.id!));
		
		if (groupsContainingButton.length > 0) {
			// Show warning about group membership
			const groupNames = groupsContainingButton.map(g => `"${g.name}"`).join(', ');
			const groupWord = groupsContainingButton.length === 1 ? 'group' : 'groups';
			
			const confirmChoice = await CustomDialog.show({
				title: '⚠️ Button in Groups',
				message: `This button "${button.name}" is currently in ${groupsContainingButton.length} ${groupWord}: ${groupNames}.\n\nDeleting this button will also remove it from all these groups.\n\nDo you want to continue?`,
				buttons: [
					{ label: 'Delete', id: 'delete', isPrimary: false },
					{ label: 'Cancel', id: 'cancel', isPrimary: true }
				],
				markdown: false
			});

			if (confirmChoice !== 'delete') {
				return;
			}

			// Remove button from all groups
			for (const group of groupsContainingButton) {
				group.buttonIds = group.buttonIds.filter(id => id !== button.id);
			}
			
			// Save updated groups
			await this.saveGroups();
		}
		
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

	async performBulkOperations(operations: BulkOperation[]): Promise<void> {
		if (!operations || operations.length === 0) {
			return;
		}

		let deleteCount = 0;
		let updateCount = 0;
		let reordered = false;
		const errors: string[] = [];

		// Process reorder first (if present)
		const reorderOp = operations.find(op => op.type === 'reorder');
		if (reorderOp && reorderOp.newOrder) {
			try {
				const buttonMap = new Map(this.buttons.map(b => [b.id!, b]));
				const reorderedButtons: smartCmdButton[] = [];
				
				// Reorder based on newOrder array
				reorderOp.newOrder.forEach(id => {
					const button = buttonMap.get(id);
					if (button) {
						reorderedButtons.push(button);
					}
				});
				
				// Add any buttons not in newOrder (shouldn't happen, but safety check)
				this.buttons.forEach(button => {
					if (!reorderOp.newOrder!.includes(button.id!)) {
						reorderedButtons.push(button);
					}
				});
				
				this.buttons = reorderedButtons;
				reordered = true;
			} catch (error) {
				errors.push('Failed to reorder buttons');
				console.error('Reorder error:', error);
			}
		}

		// Process updates
		const updateOps = operations.filter(op => op.type === 'update');
		const deleteOps = operations.filter(op => op.type === 'delete');

		// Process updates - find by ID
		for (const op of updateOps) {
			try {
				const button = this.buttons.find(b => b.id === op.buttonId);
				if (!button) {
					errors.push(`Button with ID ${op.buttonId} not found`);
					continue;
				}

				if (op.changes?.execDir !== undefined) {
					button.execDir = op.changes.execDir;
					updateCount++;
				}
			} catch (error) {
				errors.push(`Failed to update button: ${op.button?.name || 'Unknown'}`);
				console.error('Update error:', error);
			}
		}

		// Process deletes - find by ID and remove
		for (const op of deleteOps) {
			try {
				const index = this.buttons.findIndex(b => b.id === op.buttonId);
				if (index === -1) {
					errors.push(`Button with ID ${op.buttonId} not found`);
					continue;
				}

				const button = this.buttons[index];

				// Check if button is in any groups
				const groupsContainingButton = this.groups.filter(g => g.buttonIds.includes(button.id!));
				
				if (groupsContainingButton.length > 0) {
					// Show warning about group membership
					const groupNames = groupsContainingButton.map(g => `"${g.name}"`).join(', ');
					const groupWord = groupsContainingButton.length === 1 ? 'group' : 'groups';
					
					const confirmChoice = await CustomDialog.show({
						title: '⚠️ Button in Groups',
						message: `This button "${button.name}" is currently in ${groupsContainingButton.length} ${groupWord}: ${groupNames}.\n\nDeleting this button will also remove it from all these groups.\n\nDo you want to continue?`,
						buttons: [
							{ label: 'Delete', id: 'delete', isPrimary: false },
							{ label: 'Cancel', id: 'cancel', isPrimary: true }
						],
						markdown: false
					});

					if (confirmChoice !== 'delete') {
						continue;
					}

					// Remove button from all groups
					for (const group of groupsContainingButton) {
						group.buttonIds = group.buttonIds.filter(id => id !== button.id);
					}
					
					// Save updated groups
					await this.saveGroups();
				}

				// Delete script file if exists
				if (button.scriptFile && button.scope) {
					await scriptManager.deleteScript(button.scriptFile, button.scope, this.globalStoragePath);
				}

				this.buttons.splice(index, 1);
				deleteCount++;
			} catch (error) {
				errors.push(`Failed to delete button: ${op.button?.name || 'Unknown'}`);
				console.error('Delete error:', error);
			}
		}

		// Save changes
		try {
			await this.saveButtons();
			this.refresh();

			// Show summary
			const messages: string[] = [];
			if (reordered) {
				messages.push('Buttons reordered');
			}
			if (updateCount > 0) {
				messages.push(`${updateCount} button${updateCount !== 1 ? 's' : ''} updated`);
			}
			if (deleteCount > 0) {
				messages.push(`${deleteCount} button${deleteCount !== 1 ? 's' : ''} deleted`);
			}

			if (messages.length > 0) {
				vscode.window.showInformationMessage(`DevBoost: ${messages.join(', ')}`);
			}

			if (errors.length > 0) {
				vscode.window.showWarningMessage(`Some operations failed: ${errors.join(', ')}`);
			}
		} catch (error) {
			vscode.window.showErrorMessage('Failed to save changes');
			console.error('Save error:', error);
		}
	}

	async editButton(item: SmartCmdButtonTreeItem): Promise<void> {
		if (!item || !item.button) {
			vscode.window.showWarningMessage('DevBoost: Invalid button item.');
			return;
		}

		const index = this.buttons.findIndex(b => b.id === item.button.id);
		if (index === -1) {
			vscode.window.showWarningMessage(`DevBoost: Button "${item.button.name}" not found.`);
			return;
		}

		const button = this.buttons[index];

		// Show edit form
		const editedButton = await EditButtonFormPanel.show(button, this.globalStoragePath);

		if (!editedButton) {
			return;
		}

		// Update button
		const buttonExisting = this.buttons.find(b => b.id === editedButton.id);
		if (!buttonExisting) {
			vscode.window.showWarningMessage(`DevBoost: Button "${editedButton.name}" not found for update.`);
			return;
		}
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
		return await EditButtonFormPanel.show(button, this.globalStoragePath);
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

	// ============ GROUP MANAGEMENT METHODS ============

	// Save all groups
	private async saveGroups(): Promise<void> {
		await this.saveGlobalGroups();
		await this.saveWorkspaceGroups();
	}

	// Save global groups
	private async saveGlobalGroups(): Promise<void> {
		if (!this.globalButtonsPath) {
			return;
		}

		try {
			const globalGroupsPath = this.getGlobalGroupsPath();
			await fs.mkdir(path.dirname(globalGroupsPath), { recursive: true });
			
			const globalGroups = this.groups
				.filter(g => g.scope === 'global' && g.name.toLowerCase() !== 'all buttons')
				.map(({ scope, ...g }) => g); // Exclude scope when saving
			
			await fs.writeFile(globalGroupsPath, JSON.stringify(globalGroups, null, 2));
		} catch (error) {
			console.error('Error saving global groups:', error);
		}
	}

	// Save workspace groups
	private async saveWorkspaceGroups(): Promise<void> {
		const workspaceGroupsPath = this.getWorkspaceGroupsPath();
		if (!workspaceGroupsPath) {
			return;
		}

		try {
			await fs.mkdir(path.dirname(workspaceGroupsPath), { recursive: true });
			
			const workspaceGroups = this.groups
				.filter(g => g.scope === 'workspace' && g.name.toLowerCase() !== 'all buttons')
				.map(({ scope, ...g }) => g); // Exclude scope when saving
			
			await fs.writeFile(workspaceGroupsPath, JSON.stringify(workspaceGroups, null, 2));
		} catch (error) {
			console.error('Error saving workspace groups:', error);
		}
	}

	// Create a new group
	async createGroup(name: string, scope: 'workspace' | 'global'): Promise<ButtonGroup | null> {
		// Validate name
		if (!name || name.trim().length === 0) {
			vscode.window.showWarningMessage('Group name cannot be empty.');
			return null;
		}

		if(name.trim().toLowerCase() === 'all buttons') {
			vscode.window.showWarningMessage('The group name "All Buttons" is reserved. Please choose a different name.');
			return null;
		}

		// Check for duplicate group names in the same scope
		const existingGroup = this.groups.find(
			g => g.name.toLowerCase() === name.toLowerCase() && g.scope === scope
		);
		
		if (existingGroup) {
			vscode.window.showWarningMessage(`A group named "${name}" already exists in ${scope} scope.`);
			return null;
		}

		const newGroup: ButtonGroup = {
			id: crypto.randomUUID(),
			name: name.trim(),
			buttonIds: [],
			scope
		};

		this.groups.push(newGroup);
		await this.saveGroups();
		this.refresh();
		
		vscode.window.showInformationMessage(`Created group: ${name}`);
		return newGroup;
	}

	// Delete a group
	async deleteGroup(item: SmartCmdGroupTreeItem): Promise<void> {
		if (!item || !item.group) {
			vscode.window.showWarningMessage('DevBoost: Invalid group item.');
			return;
		}

		const group = item.group;
		const index = this.groups.findIndex(g => g.id === group.id);
		
		if (index === -1) {
			vscode.window.showWarningMessage(`DevBoost: Group "${group.name}" not found.`);
			return;
		}

		// Confirm deletion
		const confirmChoice = await vscode.window.showWarningMessage(
			`Delete group "${group.name}"? Buttons in this group will not be deleted.`,
			{ modal: true },
			'Delete'
		);

		if (confirmChoice !== 'Delete') {
			return;
		}

		this.groups.splice(index, 1);
		await this.saveGroups();
		this.refresh();
		
		vscode.window.showInformationMessage(`Deleted group: ${group.name}`);
	}

	// Rename a group
	async renameGroup(item: SmartCmdGroupTreeItem, newName: string): Promise<void> {
		if (!item || !item.group) {
			vscode.window.showWarningMessage('DevBoost: Invalid group item.');
			return;
		}

		if (!newName || newName.trim().length === 0) {
			vscode.window.showWarningMessage('Group name cannot be empty.');
			return;
		}

		const group = this.groups.find(g => g.id === item.group.id);
		if (!group) {
			vscode.window.showWarningMessage(`DevBoost: Group "${item.group.name}" not found.`);
			return;
		}

		// Check for duplicate names in the same scope
		const existingGroup = this.groups.find(
			g => g.id !== group.id && g.name.toLowerCase() === newName.toLowerCase() && g.scope === group.scope
		);
		
		if (existingGroup) {
			vscode.window.showWarningMessage(`A group named "${newName}" already exists in ${group.scope} scope.`);
			return;
		}

		const oldName = group.name;
		group.name = newName.trim();
		await this.saveGroups();
		this.refresh();
		
		vscode.window.showInformationMessage(`Renamed group from "${oldName}" to "${newName}"`);
	}

	// Add a button to a group
	async addButtonToGroup(buttonItem: SmartCmdButtonTreeItem, groupId: string): Promise<void> {
		if (!buttonItem || !buttonItem.button) {
			vscode.window.showWarningMessage('DevBoost: Invalid button item.');
			return;
		}

		const group = this.groups.find(g => g.id === groupId);
		if (!group) {
			vscode.window.showWarningMessage('DevBoost: Group not found.');
			return;
		}

		const buttonId = buttonItem.button.id;
		if (!buttonId) {
			vscode.window.showWarningMessage('DevBoost: Button does not have a valid ID.');
			return;
		}

		// Check if button is already in the group
		if (group.buttonIds.includes(buttonId)) {
			vscode.window.showInformationMessage(`Button "${buttonItem.button.name}" is already in group "${group.name}".`);
			return;
		}

		// Add button to the group
		group.buttonIds.push(buttonId);
		await this.saveGroups();
		this.refresh();
		
		vscode.window.showInformationMessage(`Added "${buttonItem.button.name}" to group "${group.name}"`);
	}

	// Remove a button from a group
	async removeButtonFromGroup(buttonItem: SmartCmdButtonTreeItem): Promise<void> {
		if (!buttonItem || !buttonItem.button || !buttonItem.groupId) {
			vscode.window.showWarningMessage('DevBoost: Invalid button or group context.');
			return;
		}

		const group = this.groups.find(g => g.id === buttonItem.groupId);
		if (!group) {
			vscode.window.showWarningMessage('DevBoost: Group not found.');
			return;
		}

		const buttonId = buttonItem.button.id;
		if (!buttonId) {
			return;
		}

		const index = group.buttonIds.indexOf(buttonId);
		if (index === -1) {
			return;
		}

		group.buttonIds.splice(index, 1);
		await this.saveGroups();
		this.refresh();
		
		vscode.window.showInformationMessage(`Removed "${buttonItem.button.name}" from group "${group.name}"`);
	}

	// Reorder buttons within a group
	async reorderButtonsInGroup(groupId: string, newOrder: string[]): Promise<void> {
		const group = this.groups.find(g => g.id === groupId);
		if (!group) {
			vscode.window.showWarningMessage('DevBoost: Group not found.');
			return;
		}

		// Validate all IDs exist in the current button list
		const validIds = newOrder.filter(id => 
			group.buttonIds.includes(id) && this.buttons.some(b => b.id === id)
		);

		// Add any missing IDs that were in original group but not in newOrder
		const missingIds = group.buttonIds.filter(id => !validIds.includes(id));
		
		group.buttonIds = [...validIds, ...missingIds];
		await this.saveGroups();
		this.refresh();
	}

	// Get available groups for a button (groups where the button can be added)
	getAvailableGroupsForButton(button: smartCmdButton): ButtonGroup[] {
		// Return groups of the same scope that don't already contain this button
		return this.groups.filter(g => 
			g.scope === button.scope && !g.buttonIds.includes(button.id!)
		);
	}

	// Get groups containing a specific button
	getGroupsContainingButton(buttonId: string): ButtonGroup[] {
		return this.groups.filter(g => g.buttonIds.includes(buttonId));
	}

	// Perform multiple group operations (from GroupEditPanel)
	async performGroupOperations(operations: Array<{
		type: 'delete' | 'rename' | 'reorder' | 'removeButton' | 'reorderGroups';
		groupId: string;
		newName?: string;
		newButtonOrder?: string[];
		buttonIdToRemove?: string;
		newGroupOrder?: string[];
		scope?: 'workspace' | 'global';
	}>): Promise<void> {
		if (!operations || operations.length === 0) {
			return;
		}

		for (const op of operations) {
			// Handle reorderGroups operation separately (doesn't need a specific group)
			if (op.type === 'reorderGroups') {
				if (op.newGroupOrder && op.scope) {
					// Get groups of the specified scope
					const scopeGroups = this.groups.filter(g => g.scope === op.scope);
					const otherGroups = this.groups.filter(g => g.scope !== op.scope);
					
					// Reorder the scope groups based on newGroupOrder
					const reorderedScopeGroups: ButtonGroup[] = [];
					for (const groupId of op.newGroupOrder) {
						const group = scopeGroups.find(g => g.id === groupId);
						if (group) {
							reorderedScopeGroups.push(group);
						}
					}
					
					// Add any groups that weren't in the new order (shouldn't happen, but safety)
					for (const group of scopeGroups) {
						if (!reorderedScopeGroups.find(g => g.id === group.id)) {
							reorderedScopeGroups.push(group);
						}
					}
					
					// Combine: global groups first, then workspace groups
					if (op.scope === 'global') {
						this.groups = [...reorderedScopeGroups, ...otherGroups];
					} else {
						const globalGroups = otherGroups.filter(g => g.scope === 'global');
						this.groups = [...globalGroups, ...reorderedScopeGroups];
					}
				}
				continue;
			}

			const group = this.groups.find(g => g.id === op.groupId);
			if (!group) {
				continue;
			}

			switch (op.type) {
				case 'delete':
					const deleteIndex = this.groups.findIndex(g => g.id === op.groupId);
					if (deleteIndex !== -1) {
						this.groups.splice(deleteIndex, 1);
					}
					break;
				
				case 'rename':
					if (op.newName && op.newName.trim().length > 0) {
						group.name = op.newName.trim();
					}
					break;
				
				case 'reorder':
					if (op.newButtonOrder && Array.isArray(op.newButtonOrder)) {
						// Validate all IDs exist
						const validIds = op.newButtonOrder.filter(id => 
							group.buttonIds.includes(id) && this.buttons.some(b => b.id === id)
						);
						// Add any missing IDs
						const missingIds = group.buttonIds.filter(id => !validIds.includes(id));
						group.buttonIds = [...validIds, ...missingIds];
					}
					break;
				
				case 'removeButton':
					if (op.buttonIdToRemove) {
						const buttonIndex = group.buttonIds.indexOf(op.buttonIdToRemove);
						if (buttonIndex !== -1) {
							group.buttonIds.splice(buttonIndex, 1);
						}
					}
					break;
			}
		}

		await this.saveGroups();
		this.refresh();
	}

	/**
	 * Add or update a group directly (useful for import operations)
	 */
	async addOrUpdateGroup(group: ButtonGroup): Promise<void> {
		const existingIndex = this.groups.findIndex(g => g.id === group.id && g.scope === group.scope);
		
		if (existingIndex !== -1) {
			// Update existing group
			this.groups[existingIndex] = group;
		} else {
			// Add new group
			this.groups.push(group);
		}
		
		await this.saveGroups();
		this.refresh();
	}
}

