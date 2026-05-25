// Import/Export functionality for SmartCmds
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import * as scriptManager from './scriptManager';
import { SmartCmdButtonsTreeProvider, smartCmdButton, SmartCmdButtonTreeItem, ButtonGroup } from './treeProvider';

/**
 * Export SmartCmds (buttons, groups, and scripts) to a zip file
 */
export async function exportSmartCmds(buttonsProvider: SmartCmdButtonsTreeProvider): Promise<void> {
	try {
		// Ask user to select scope (global, workspace, or both)
		const scopeChoice = await vscode.window.showQuickPick([
			{ label: 'Both Global and Workspace', value: 'both', description: 'Export all commands' },
			{ label: 'Global Commands', value: 'global', description: 'Export global buttons and scripts' },
			{ label: 'Workspace Commands', value: 'workspace', description: 'Export workspace buttons and scripts' }
		], {
			placeHolder: 'Select which commands to export'
		});

		if (!scopeChoice) {
			return;
		}

		// Get buttons and groups based on scope
		const buttons = buttonsProvider.getButtons();
		const groups = buttonsProvider.getGroups();
		
		let exportButtons: smartCmdButton[] = [];
		let exportGroups: ButtonGroup[] = [];
		
		if (scopeChoice.value === 'global') {
			exportButtons = buttons.filter(b => b.scope === 'global');
			exportGroups = groups.filter(g => g.scope === 'global');
		} else if (scopeChoice.value === 'workspace') {
			exportButtons = buttons.filter(b => b.scope === 'workspace');
			exportGroups = groups.filter(g => g.scope === 'workspace');
		} else {
			exportButtons = buttons;
			exportGroups = groups;
		}

		if (exportButtons.length === 0 && exportGroups.length === 0) {
			vscode.window.showInformationMessage('No commands found to export.');
			return;
		}

		// Ask for save location
		const defaultFileName = `smartcmds_${scopeChoice.value}_${new Date().toISOString().split('T')[0]}.zip`;
		const saveUri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || require('os').homedir(), defaultFileName)),
			filters: { 'Zip Files': ['zip'] },
			saveLabel: 'Export SmartCmds'
		});

		if (!saveUri) {
			return;
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Exporting SmartCmds...",
			cancellable: false
		}, async (progress) => {
			// Create zip file
			const zip = new AdmZip();

			// Add buttons metadata (keep scope, exclude scriptContent)
			const buttonsData = exportButtons.map(({ scriptContent, ...b }) => b);
			zip.addFile('buttons.json', Buffer.from(JSON.stringify(buttonsData, null, 2), 'utf-8'));
			
			// Add groups metadata
			if (exportGroups.length > 0) {
				zip.addFile('groups.json', Buffer.from(JSON.stringify(exportGroups, null, 2), 'utf-8'));
			}

			// Add script files
			const scriptsToExport = exportButtons.filter(b => b.scriptFile);
			if (scriptsToExport.length > 0) {
				progress.report({ message: 'Collecting script files...' });
				
				for (const button of scriptsToExport) {
					try {
						const scriptContent = await scriptManager.readScript(
							button.scriptFile!,
							button.scope || 'workspace',
							buttonsProvider.globalStoragePath
						);
						
						if (scriptContent) {
							// Organize scripts by scope
							const scriptPath = `scripts/${button.scope || 'workspace'}/${button.scriptFile}`;
							zip.addFile(scriptPath, Buffer.from(scriptContent, 'utf-8'));
						}
					} catch (error) {
						console.warn(`Failed to export script ${button.scriptFile}:`, error);
					}
				}
			}

			// Add metadata file with export info
			const metadata = {
				exportDate: new Date().toISOString(),
				exportScope: scopeChoice.value,
				buttonCount: exportButtons.length,
				groupCount: exportGroups.length,
				scriptCount: scriptsToExport.length,
				version: '1.0'
			};
			zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));

			// Write zip file
			progress.report({ message: 'Writing zip file...' });
			await fs.writeFile(saveUri.fsPath, zip.toBuffer());
		});

		vscode.window.showInformationMessage(
			`Successfully exported ${exportButtons.length} button${exportButtons.length !== 1 ? 's' : ''} and ${exportGroups.length} group${exportGroups.length !== 1 ? 's' : ''}.`,
			'Open Folder'
		).then(action => {
			if (action === 'Open Folder') {
				vscode.commands.executeCommand('revealFileInOS', saveUri);
			}
		});
	} catch (error) {
		console.error('Export error:', error);
		vscode.window.showErrorMessage(`Failed to export SmartCmds: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Import SmartCmds (buttons, groups, and scripts) from a zip file
 */
export async function importSmartCmds(buttonsProvider: SmartCmdButtonsTreeProvider): Promise<void> {
	try {
		// Ask user to select zip file
		const fileUri = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: { 'Zip Files': ['zip'] },
			openLabel: 'Import SmartCmds'
		});

		if (!fileUri || fileUri.length === 0) {
			return;
		}

		let importedCount = 0;
		let skippedCount = 0;

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Importing SmartCmds...",
			cancellable: false
		}, async (progress) => {
			// Read zip file
			const zip = new AdmZip(fileUri[0].fsPath);
			const zipEntries = zip.getEntries();

			// Read metadata
			let metadata: any = null;
			const metadataEntry = zipEntries.find(e => e.entryName === 'metadata.json');
			if (metadataEntry) {
				metadata = JSON.parse(metadataEntry.getData().toString('utf-8'));
			}

			// Read buttons
			const buttonsEntry = zipEntries.find(e => e.entryName === 'buttons.json');
			if (!buttonsEntry) {
				throw new Error('Invalid SmartCmds export: buttons.json not found');
			}
			
			const importedButtons: smartCmdButton[] = JSON.parse(buttonsEntry.getData().toString('utf-8'));
			
			// Read groups (optional)
			let importedGroups: ButtonGroup[] = [];
			const groupsEntry = zipEntries.find(e => e.entryName === 'groups.json');
			if (groupsEntry) {
				importedGroups = JSON.parse(groupsEntry.getData().toString('utf-8'));
			}

			// Ask about conflict resolution
			const conflictChoice = await vscode.window.showQuickPick([
				{ label: 'Skip Duplicates', value: 'skip', description: 'Keep existing buttons, skip imported duplicates' },
				{ label: 'Rename Duplicates', value: 'rename', description: 'Import all, rename duplicates automatically' },
				{ label: 'Overwrite', value: 'overwrite', description: 'Replace existing buttons with imported ones' }
			], {
				placeHolder: 'How to handle duplicate button names?'
			});

			if (!conflictChoice) {
				return;
			}

			progress.report({ message: 'Processing buttons...' });
			
			const existingButtons = buttonsProvider.getButtons();
			const existingGroups = buttonsProvider.getGroups();
			
			// Check if workspace is required
			const hasWorkspaceButtons = importedButtons.some(b => (b.scope || 'workspace') === 'workspace');
			const hasWorkspaceGroups = importedGroups.some(g => (g.scope || 'workspace') === 'workspace');
			
			if ((hasWorkspaceButtons || hasWorkspaceGroups) && (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0)) {
				throw new Error('Cannot import workspace-scoped commands without an open workspace. Please open a workspace first.');
			}

			// Import buttons - track ID mappings for groups
			const buttonIdMapping = new Map<string, string>(); // Maps imported button ID to actual ID (existing or new)

			for (const button of importedButtons) {
				// Use the button's original scope
				const originalScope = button.scope || 'workspace';
				button.scope = originalScope;
				
				// Check for duplicates
				const existingButton = existingButtons.find(b => 
					b.name.toLowerCase() === button.name.toLowerCase() && 
					b.scope === button.scope
				);

				if (existingButton) {
					if (conflictChoice.value === 'skip') {
						skippedCount++;
						// Map the imported button ID to the existing button ID
						if (button.id && existingButton.id) {
							buttonIdMapping.set(button.id, existingButton.id);
						}
						continue;
					} else if (conflictChoice.value === 'rename') {
						// Find unique name
						let counter = 1;
						let newName = `${button.name} (${counter})`;
						while (existingButtons.some(b => b.name === newName && b.scope === button.scope)) {
							counter++;
							newName = `${button.name} (${counter})`;
						}
						button.name = newName;
					} else if (conflictChoice.value === 'overwrite') {
						// Remove existing button
						await buttonsProvider.deleteButton(new SmartCmdButtonTreeItem(existingButton, vscode.TreeItemCollapsibleState.None));
					}
				}

				// Import script if exists
				if (button.scriptFile) {
					// Use the original scope from exported button to find the correct script
					// This handles cases where scripts with same name exist in different scopes
					const scriptPath = `scripts/${originalScope}/${button.scriptFile}`;
					const scriptEntry = zipEntries.find(e => e.entryName === scriptPath);
					
					if (scriptEntry) {
						const scriptContent = scriptEntry.getData().toString('utf-8');
						
						// Check if script with same name exists in target scope and ensure uniqueness
						const existingScripts = await scriptManager.listScripts(button.scope, buttonsProvider.globalStoragePath);
						const uniqueScriptFileName = scriptManager.ensureUniqueFileName(button.scriptFile, existingScripts);
						
						// Save script to target scope location with unique name
						await scriptManager.saveScript(
							scriptContent,
							uniqueScriptFileName,
							button.scope, // Use new target scope
							buttonsProvider.globalStoragePath
						);
						
						// Update button's scriptFile and cmd to use the unique filename
						button.scriptFile = uniqueScriptFileName;
						button.cmd = scriptManager.generateScriptCommand(
							uniqueScriptFileName,
							button.scope,
							buttonsProvider.globalStoragePath,
							button.inputs
						);
					} else {
						// Fallback: try to find script in any scope folder (backward compatibility)
						const scriptEntries = zipEntries.filter(e => e.entryName.includes(`scripts/`) && e.entryName.endsWith(button.scriptFile!));
						if (scriptEntries.length > 0) {
							const scriptContent = scriptEntries[0].getData().toString('utf-8');
							
							// Ensure unique filename in target scope
							const existingScripts = await scriptManager.listScripts(button.scope, buttonsProvider.globalStoragePath);
							const uniqueScriptFileName = scriptManager.ensureUniqueFileName(button.scriptFile, existingScripts);
							
							await scriptManager.saveScript(
								scriptContent,
								uniqueScriptFileName,
								button.scope,
								buttonsProvider.globalStoragePath
							);
							
							// Update button to use unique filename
							button.scriptFile = uniqueScriptFileName;
							button.cmd = scriptManager.generateScriptCommand(
								uniqueScriptFileName,
								button.scope,
								buttonsProvider.globalStoragePath,
								button.inputs
							);
						}
					}
				}

				// Add button using provider's method
				const originalId = button.id;
				await buttonsProvider.addButtons([button], button.scope, false, true); // checkDuplicates=false, silent=true
				// Map the imported button ID to itself (it was successfully imported)
				if (originalId && button.id) {
					buttonIdMapping.set(originalId, button.id);
				}
				importedCount++;
			}

			// Import groups
			progress.report({ message: 'Processing groups...' });
			let importedGroupCount = 0;

			for (const group of importedGroups) {
				// Use the group's original scope
				group.scope = group.scope || 'workspace';
				
				// Check for duplicate group names
				const existingGroup = existingGroups.find(g => 
					g.name.toLowerCase() === group.name.toLowerCase() && 
					g.scope === group.scope
				);

				if (existingGroup) {
					if (conflictChoice.value === 'skip') {
						continue;
					} else if (conflictChoice.value === 'rename') {
						let counter = 1;
						let newName = `${group.name} (${counter})`;
						while (existingGroups.some(g => g.name === newName && g.scope === group.scope)) {
							counter++;
							newName = `${group.name} (${counter})`;
						}
						group.name = newName;
					}
				}

				// Remap button IDs using the mapping (handles skipped buttons that now reference existing ones)
				const currentButtons = buttonsProvider.getButtons();
				group.buttonIds = group.buttonIds
					.map(id => buttonIdMapping.get(id) || id) // Replace with mapped ID or keep original
					.filter(id => 
						// Only keep buttons that exist in the current scope
						currentButtons.some(b => b.id === id && b.scope === group.scope)
					);

				if (group.buttonIds.length > 0 || conflictChoice.value !== 'skip') {
					await buttonsProvider.addOrUpdateGroup(group);
					importedGroupCount++;
				}
			}

			buttonsProvider.refresh();
		});

		const message = skippedCount > 0
			? `Imported ${importedCount} button${importedCount !== 1 ? 's' : ''}. Skipped ${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''}.`
			: `Successfully imported ${importedCount} button${importedCount !== 1 ? 's' : ''}.`;
		
		vscode.window.showInformationMessage(message);
	} catch (error) {
		console.error('Import error:', error);
		vscode.window.showErrorMessage(`Failed to import SmartCmds: ${error instanceof Error ? error.message : String(error)}`);
	}
}
