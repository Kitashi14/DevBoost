// SmartCmd Core Functions
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as aiServices from './aiServices';
import * as activityLogging from '../activityLogging';
import * as scriptManager from './scriptManager';
import { SmartCmdButtonsTreeProvider, smartCmdButton, InputField, SmartCmdButtonTreeItem } from './treeProvider';
import { CustomDialog } from '../commonView/customDialog';
import { InputFormPanel } from '../commonView/inputFormPanel';
import { ButtonFormPanel } from './view/manualButtonFormPanel';
import { AIButtonDescriptionPanel } from './view/aiButtonDescriptionPanel';

// Create AI-suggested buttons based on activity log
export async function createAIButtons( activityLogPath: string | undefined, buttonsProvider: SmartCmdButtonsTreeProvider) {
	// Check if workspace is open
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('Please open a workspace to use SmartCmd.');
		return;
	}

	if (!activityLogPath) {
		vscode.window.showErrorMessage('Activity log path not initialized.');
		return;
	}

	try {
		// Check if activity log file exists
		try {
			await fs.access(activityLogPath);
		} catch (error) {
			// File doesn't exist
			vscode.window.showInformationMessage(
				'No activity log found yet. DevBoost tracks your terminal commands and file operations. ' +
				'Work in your project for a while, then try again. Or create a custom button instead.',
				'Create Custom Button'
			).then(selection => {
				if (selection === 'Create Custom Button') {
					vscode.commands.executeCommand('devboost.smartCmdCreateCustomButton');
				}
			});
			return;
		}

		// Read activity log
		const logContent = await fs.readFile(activityLogPath, 'utf-8');
		
		if (!logContent || logContent.trim().length === 0) {
			vscode.window.showInformationMessage(
				'Activity log is empty. Work in your project for a while to build up command history, then try again.',
				'Create Custom Button'
			).then(selection => {
				if (selection === 'Create Custom Button') {
					vscode.commands.executeCommand('devboost.smartCmdCreateCustomButton');
				}
			});
			return;
		}

		// Optimize log for AI consumption using intelligent sampling
		const optimizedLog = await activityLogging.optimizeLogForAI(activityLogPath);

		// Extract detailed context for AI analysis
		console.log('DevBoost: Recent logs count:', optimizedLog.recentLogs.length);

		if (optimizedLog.recentLogs.length < 5) {
			vscode.window.showInformationMessage(
				'Not enough activity data found. Continue working in your project to build command history.',
				'Create Custom Button'
			).then(selection => {
				if (selection === 'Create Custom Button') {
					vscode.commands.executeCommand('devboost.smartCmdCreateCustomButton');
				}
			});
			return;
		}

		// Get AI suggestions from GitHub Copilot with enhanced context
		const buttons = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Analyzing your workflow patterns in this workspace...",
			cancellable: true
		}, async (progress, token) => {
			token.onCancellationRequested(() => {
				vscode.window.showInformationMessage('Button creation cancelled.');
			});
			const suggestedButtons = await aiServices.getAISuggestions(optimizedLog, buttonsProvider.getButtons());
			if(token.isCancellationRequested){
				return 'cancelled';
			}
			return suggestedButtons;
		});

		if(buttons === 'cancelled'){
			console.log('DevBoost: Button creation was cancelled by user');
			return;
		}

		if (buttons.length === 0) {
			vscode.window.showWarningMessage('Could not generate button suggestions. Please try again.');
			return;
		}

		// Show confirmation dialog with preview of AI-suggested buttons
		const previewMessage = `AI has analyzed your workflow and suggests ${buttons.length} button${buttons.length > 1 ? 's' : ''}:

${buttons.map((btn, i) => {
	let cmdDisplay: string;
	if (btn.scriptContent) {
		// Script button - show script content preview
		const scriptPreview = btn.scriptContent.length > 100 
			? btn.scriptContent.substring(0, 100) + '...' 
			: btn.scriptContent;
		// Add proper indentation to each line of the script
		const indentedScript = scriptPreview.split('\n').map(line => '         ' + line).join('\n');
		cmdDisplay = `Cmd: cd ${btn.execDir && btn.execDir.trim() !== '' ? btn.execDir : '.'} && run_script\n\n   Script:\n${indentedScript}`;
	} else {
		// Regular command button
		cmdDisplay = `Cmd: ${btn.execDir && btn.execDir.trim() !== '.' && btn.execDir.trim() !== '' ? 'cd ' + btn.execDir + ' && ' : ''}${btn.cmd}`;
	}
	
	return `${i + 1}. ${btn.name}

   ${cmdDisplay}

   AI Description: ${btn.description}`;
}).join('\n\n\n')}

Do you want to create these buttons?`;

		const choice = await CustomDialog.show({
			title: 'AI Button Suggestions',
			message: previewMessage,
			buttons: [
				{ label: 'Create All', id: 'Create All', isPrimary: true },
				{ label: 'Review Individually', id: 'Review Individually' }
			],
			markdown: false
		});

		if (!choice) {
			vscode.window.showInformationMessage('Button creation cancelled.');
			return;
		}

		let finalButtons = buttons;

		if (choice === 'Review Individually') {
			let acceptedCount = 0;
			let buttonCount = 0;
			for (const button of buttons) {
				buttonCount += 1;
				let cmdDisplay: string;
				if (button.scriptContent) {
					// Script button - show script content
					const scriptPreview = button.scriptContent.split('\\n').join('\n');
					// Add proper indentation to each line of the script
					const indentedScript = scriptPreview.split('\n').map(line => '      ' + line).join('\n');
					cmdDisplay = `Cmd: cd ${button.execDir && button.execDir.trim() !== '' ? button.execDir : '.'} && run_script\n\nScript:\n${indentedScript}`;
				} else {
					// Regular command button
					cmdDisplay = `Cmd: ${button.execDir && button.execDir.trim() !== '.' && button.execDir.trim() !== '' ? 'cd ' + button.execDir + ' && ' : ''}${button.cmd}`;
				}
				
				const buttonChoice = await CustomDialog.show({
					title: 'Review Button ' + buttonCount,
					message: `Review Button:

Name: ${button.name}

${cmdDisplay}

AI description: ${button.description}

What would you like to do?`,
					buttons: [
						{ label: 'Accept', id: 'Accept', isPrimary: true },
						{ label: 'Edit details', id: 'Edit details' },
						{ label: 'Skip', id: 'Skip' }
					],
					markdown: false
				});

				if (buttonChoice === 'Accept') {
					// Add button immediately for real-time duplicate detection
					const addedCount = await buttonsProvider.addButtons([button], 'workspace');
					acceptedCount += addedCount;
				} else if (buttonChoice === 'Edit details') {

					const editedResult = await InputFormPanel.show(
						`Edit Button ${buttonCount} Details`,
						button.scriptContent ? [
							{
								id: 'name',
								label: 'Button Name',
								defaultValue: button.name,
								placeholder: 'Enter button name',
								required: true,
								validation: (value) => {
									if (!value || value.trim().length === 0) {
										return 'Button name cannot be empty';
									}
									if (value.length > 50) {
										return 'Button name is too long (max 50 characters)';
									}
									return null;
								}
							},
							{
								id: 'description',
								label: 'AI Description',
								defaultValue: button.description,
								placeholder: 'Enter a better description for this button',
								multiline: true,
								required: false,
							},
							{
								id: 'execDir',
								label: 'Execution Directory [e.g., <workspace>, <workspace>/src, /usr/bin/tool, . (current directory)]',
								defaultValue: button.execDir,
								placeholder: 'Enter the execution directory for this button',
								multiline: false,
								required: true,
							},
							{
								id: 'scriptContent',
								label: 'Script Content',
								defaultValue: button.scriptContent,
								placeholder: 'Enter the script content for this button',
								multiline: true,
								required: true,
							}
						] : 
						[
							{
								id: 'name',
								label: 'Button Name',
								defaultValue: button.name,
								placeholder: 'Enter button name',
								required: true,
								validation: (value) => {
									if (!value || value.trim().length === 0) {
										return 'Button name cannot be empty';
									}
									if (value.length > 50) {
										return 'Button name is too long (max 50 characters)';
									}
									return null;
								}
							},
							{
								id: 'description',
								label: 'AI Description',
								defaultValue: button.description,
								placeholder: 'Enter a better description for this button',
								multiline: true,
								required: false,
							},
							{
								id: 'execDir',
								label: 'Execution Directory',
								defaultValue: button.execDir,
								placeholder: 'Enter the execution directory for this button (e.g., <workspace>, <workspace>/src, /usr/bin/tool, . (current directory))',
								multiline: false,
								required: true,
							},
							{
								id: 'cmd',
								label: 'Command',
								defaultValue: button.cmd,
								placeholder: 'Enter the command for this button',
								multiline: true,
								required: true,
							}
						],
						'Save'
					);

					if (!editedResult) {
						continue;
					}
					
					button.name = editedResult.name.trim();
					button.description = editedResult.description.trim();			
					button.execDir = editedResult.execDir.trim();
					if (button.scriptContent) {
						button.scriptContent = editedResult.scriptContent;
					}
					else {
						button.cmd = editedResult.cmd;
					}	
					const addedCount = await buttonsProvider.addButtons([button], 'workspace');
					acceptedCount += addedCount;
				} else if (buttonChoice === 'Skip') {
					// Skip this button
					continue;
				} else {
						return;
				}
			}

			if (acceptedCount === 0) {
				vscode.window.showInformationMessage('No buttons were selected.');
			} else {
				vscode.window.showInformationMessage(`Created ${acceptedCount} AI-suggested button${acceptedCount > 1 ? 's' : ''}`);
			}
			return;
		}

		// Add buttons to tree view (only for 'Create All' choice)
		const addedCount = await buttonsProvider.addButtons(finalButtons, 'workspace');

		if (addedCount > 0) {
			vscode.window.showInformationMessage(`Created ${addedCount} AI-suggested button${addedCount > 1 ? 's' : ''}`);
		}
	} catch (error: any) {
		console.error('DevBoost: Error creating AI buttons:', error);
		
		// Provide specific error messages
		if (error.code === 'ENOENT') {
			vscode.window.showInformationMessage(
				'Activity log not found. Start working in your project, and DevBoost will track your commands automatically.',
				'Create Custom Button'
			).then(selection => {
				if (selection === 'Create Custom Button') {
					vscode.commands.executeCommand('devboost.smartCmdCreateCustomButton');
				}
			});
		} else {
			vscode.window.showErrorMessage(`Failed to create AI buttons: ${error.message || 'Unknown error'}`);
		}
	}
}

// Create a custom button (manual or AI-assisted)
export async function createCustomButton(
	activityLogPath: string | undefined,
	buttonsProvider: SmartCmdButtonsTreeProvider,
	scopeInput?: 'Workspace' | 'Global'
) {
	if(!scopeInput) {
		scopeInput = 'Global';
	}
	// Get user input whether use AI or manual
	const useAI = await vscode.window.showQuickPick(['Using AI', 'Manual'], {
		placeHolder: 'Select method of creation.'
	});

	if (!useAI) {
		return;
	}

	if (useAI === 'Manual') {
		const result = await ButtonFormPanel.show(scopeInput === 'Workspace' ? "workspace" : "global") as any;

		if (!result) {
			vscode.window.showInformationMessage('Button creation cancelled.');
			return;
		}

		// Extract the selected scope and remove it from the button object
		const selectedScope = result.selectedScope || (scopeInput === 'Workspace' ? 'workspace' : 'global');
		const button = { ...result };
		delete (button as any).selectedScope;

		// Add button to tree view using the scope selected in the form
		const addedCount = await buttonsProvider.addButtons([button], selectedScope);

		if (addedCount > 0) {
			vscode.window.showInformationMessage(`Created custom button: ${button.name}`);
		}
		return;
	}

	try {
		// Show the AI button description form
		const result = await AIButtonDescriptionPanel.show(scopeInput === 'Global' ? 'global' : 'workspace');

		if (!result) {
			return;
		}

		const description = result.description;
		const selectedScope = result.scope;
		const panel = result.panel;

		// Track if panel is disposed
		let isPanelDisposed = false;
		const disposedListener = panel.onDidDispose(() => {
			isPanelDisposed = true;
			vscode.window.showInformationMessage('Button creation cancelled.');
		});

		// Show loading in webview
		AIButtonDescriptionPanel.showLoading(panel);

		let button;
		try {

			// Generate button using AI service with existing buttons for duplication check
			button = await aiServices.getCustomButtonSuggestion(description, selectedScope, activityLogPath, buttonsProvider.getButtons());

			// Check if panel was disposed during generation
			if (isPanelDisposed) {
				console.log('Panel was disposed during button generation, cancelling...');
				disposedListener.dispose();
				return;
			}
		} catch (error) {
			// Check if panel was disposed
			if (isPanelDisposed) {
				console.log('Panel was disposed, cancelling button creation...');
				disposedListener.dispose();
				return;
			}

			// Show error in webview
			const errorMsg = error instanceof Error ? error.message : 'Failed to generate button. Please try again.';
			AIButtonDescriptionPanel.showError(panel, errorMsg);
			console.error('Error creating custom button:', error);
			disposedListener.dispose();
			return;
		}

		// Clean up listener
		disposedListener.dispose();

		// Close the webview
		AIButtonDescriptionPanel.close(panel);

		if (!button) {
			vscode.window.showInformationMessage('Could not generate button. Please try again.');
			return;
		}

		// Show confirmation dialog with AI-generated details
		let cmdDisplay: string;
		if (button.scriptContent) {
			// Script button - show script content
			const scriptPreview = button.scriptContent.split('\\n').join('\n');
			// Add proper indentation to each line of the script
			const indentedScript = scriptPreview.split('\n').map(line => '      ' + line).join('\n');
			cmdDisplay = `Cmd: cd ${button.execDir && button.execDir.trim() !== '' ? button.execDir : '.'} && run_script\n\nScript:\n${indentedScript}`;
		} else {
			// Regular command button
			cmdDisplay = `Cmd: ${button.execDir && button.execDir.trim() !== '.' && button.execDir.trim() !== '' ? `cd ${button.execDir} && ` : ''}${button.cmd}`;
		}
		
		const confirmationMessage = `AI has generated the following button:

Name: ${button.name}

${cmdDisplay}

AI Description:
${button.description}

User Prompt:
${button.user_prompt}

Do you want to create this button?`;

		const choice = await CustomDialog.show({
			title: 'Confirm Custom Button',
			message: confirmationMessage,
			buttons: [
				{ label: 'Create Button', id: 'Create Button', isPrimary: true },
				{ label: 'Edit details', id: 'Edit details' }
			],
			markdown: false
		});

		if (!choice) {
			vscode.window.showInformationMessage('Button creation cancelled.');
			return;
		}

		if (choice === 'Edit details') {
			const editedResult = await InputFormPanel.show(
				'Edit Button Details',
				button.scriptContent ? [
					{
						id: 'name',
						label: 'Button Name',
						defaultValue: button.name,
						placeholder: 'Enter button name',
						required: true,
						validation: (value) => {
							if (!value || value.trim().length === 0) {
								return 'Button name cannot be empty';
							}
							if (value.length > 50) {
								return 'Button name is too long (max 50 characters)';
							}
							return null;
						}
					},
					{
						id: 'description',
						label: 'AI Description',
						defaultValue: button.description,
						placeholder: 'Enter a better description for this button',
						multiline: true,
						required: false,
					},
					{
						id: 'execDir',
						label: 'Execution Directory [e.g., <workspace>, <workspace>/src, /usr/bin/tool, . (current directory)]',
						defaultValue: button.execDir,
						placeholder: 'Enter the execution directory for this button',
						multiline: false,
						required: true,
					},
					{
						id: 'scriptContent',
						label: 'Script Content',
						defaultValue: button.scriptContent,
						placeholder: 'Enter the script content for this button',
						multiline: true,
						required: true,
					}
				] : 
				[
					{
						id: 'name',
						label: 'Button Name',
						defaultValue: button.name,
						placeholder: 'Enter button name',
						required: true,
						validation: (value) => {
							if (!value || value.trim().length === 0) {
								return 'Button name cannot be empty';
							}
							if (value.length > 50) {
								return 'Button name is too long (max 50 characters)';
							}
							return null;
						}
					},
					{
						id: 'description',
						label: 'AI Description',
						defaultValue: button.description,
						placeholder: 'Enter a better description for this button',
						multiline: true,
						required: false,
					},
					{
						id: 'execDir',
						label: 'Execution Directory',
						defaultValue: button.execDir,
						placeholder: 'Enter the execution directory for this button (e.g., <workspace>, <workspace>/src, /usr/bin/tool, . (current directory))',
						multiline: false,
						required: true,
					},
					{
						id: 'cmd',
						label: 'Command',
						defaultValue: button.cmd,
						placeholder: 'Enter the command for this button',
						multiline: true,
						required: true,
					}
				],
				'Save'
			);

			if (!editedResult) {
				vscode.window.showInformationMessage('Button creation cancelled.');
				return;
			}
			
			button.name = editedResult.name.trim();
			button.description = editedResult.description.trim();	
			button.execDir = editedResult.execDir.trim();
			
			if (button.scriptContent) {
				button.scriptContent = editedResult.scriptContent;
			} else {
				button.cmd = editedResult.cmd.trim();
			}		
		}

		// Add button to tree view using the selected scope from the form
		const addedCount = await buttonsProvider.addButtons([button], selectedScope);

		if (addedCount > 0) {
			vscode.window.showInformationMessage(`Created custom button: ${button.name}`);
		}

	} catch (error) {
		console.error('Error creating custom button:', error);
		vscode.window.showErrorMessage('Failed to create custom button.');
	}
}

// Execute button command with input field support and correct working directory context
export async function executeButtonCommand(button: smartCmdButton, activityLogPath?: string | undefined) {
	if (!button) {
		vscode.window.showWarningMessage('No button provided to execute.');
		return;
	}

	// Determine the command to execute
	let finalCommand: string;
	
	if (button.scriptFile) {
		// Button uses a script file - scriptFile contains the full path or we need to construct it
		// The cmd field should already contain the command to run the script
		finalCommand = button.cmd;
		
		if (!finalCommand || finalCommand.trim().length === 0) {
			vscode.window.showWarningMessage('Script button has no command to execute.');
			return;
		}
	} else if (button.cmd && button.cmd.trim().length > 0) {
		// Button uses direct command
		finalCommand = button.cmd.trim();
	} else {
		vscode.window.showWarningMessage('No command specified. Please provide a valid command to execute.');
		return;
	}

	// Handle input fields if present
	if (button.inputs && button.inputs.length > 0) {
		for (const input of button.inputs) {
			const userInput = await vscode.window.showInputBox({
				prompt: input.placeholder,
				placeHolder: input.placeholder,
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return 'Input cannot be empty';
					}
					return null;
				}
			});

			if (!userInput) {
				vscode.window.showInformationMessage('Command execution cancelled.');
				return;
			}

			// Replace variable placeholder with user input
			finalCommand = finalCommand.replace(new RegExp(input.variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), userInput.trim());
		}
	}

	// Prepend execution directory if specified
	// This applies to both script and command buttons
	if (button.execDir && button.execDir.trim().length > 0 && button.execDir.trim() !== '.') {
		let execDir = button.execDir.trim();
		
		// Replace <workspace> keyword with actual workspace path
		if (execDir.includes('<workspace>')) {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const workspacePath = workspaceFolder.uri.fsPath;
				execDir = execDir.replace(/<workspace>/g, workspacePath);
			} else {
				vscode.window.showWarningMessage('No workspace folder open. Cannot resolve <workspace> path.');
				return;
			}
		}
		
		finalCommand = `cd ${execDir} && ${finalCommand}`;
	}
	// Check if it's a single-word (eg. VS Code command, no spaces or chaining)
	if (!finalCommand.includes(' ') && !finalCommand.includes('&&') && !finalCommand.includes('||') && !finalCommand.includes(';')) {
		console.log('Attempting to execute as VS Code command:', finalCommand);
		try {
			await vscode.commands.executeCommand(finalCommand);
			vscode.window.showInformationMessage(`Executed VS Code command: ${finalCommand}`);
			return;
		} catch (error) {
			// Not a VS Code command, fall through to terminal execution
			console.warn(`Not a VS Code command, executing in terminal: ${finalCommand}`);
		}
	}

	// Execute as terminal command with correct working directory
	try {
		// Use active terminal if available, otherwise create new one
		const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('DevBoost');
		terminal.show();
		terminal.sendText(finalCommand);
		
		const buttonType = button.scriptFile ? ' (script)' : '';
		vscode.window.setStatusBarMessage(`Executed: ${button.name}${buttonType}`, 3000);
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to execute command: ${button.name}`);
		console.error('Command execution error:', error);
	}
}

// Helper function to open buttons file
export async function openButtonsFile(item: any, globalButtonsPath: string | undefined) {
	if (!item || !(item.section)) {
		vscode.window.showWarningMessage('DevBoost: Invalid section item.');
		return;
	}

	try {
		let filePath: string;
		
		if (item.section === 'global') {
			// Open global buttons file
			if (!globalButtonsPath) {
				vscode.window.showErrorMessage('Global buttons file path not initialized.');
				return;
			}
			filePath = globalButtonsPath;
			
			// Ensure the file exists
			try {
				await fs.access(filePath);
			} catch {
				// Create the file if it doesn't exist
				await fs.mkdir(path.dirname(filePath), { recursive: true });
				await fs.writeFile(filePath, '[]');
			}
		} else {
			// Open workspace buttons file
			if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
				vscode.window.showErrorMessage('No workspace folder open.');
				return;
			}
			
			const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
			filePath = path.join(workspaceRoot, '.vscode', 'devBoost', 'smartCmd.json');
			
			// Ensure the file exists
			try {
				await fs.access(filePath);
			} catch {
				// Create the file if it doesn't exist
				await fs.mkdir(path.dirname(filePath), { recursive: true });
				await fs.writeFile(filePath, '[]');
			}
		}
		
		// Open the file in editor
		const document = await vscode.workspace.openTextDocument(filePath);
		await vscode.window.showTextDocument(document, { preview: false });
	} catch (error) {
		console.error('Error opening buttons file:', error);
		vscode.window.showErrorMessage('Failed to open buttons file.');
	}
}

// Helper function to add button to global scope
export async function addToGlobal(item: SmartCmdButtonTreeItem, buttonsProvider: SmartCmdButtonsTreeProvider) {
	if (!item) {
		vscode.window.showWarningMessage('DevBoost: No button selected to add to global.');
		return;
	}

	// Check if button is already global
	if (item.button.scope === 'global') {
		vscode.window.showInformationMessage('DevBoost: This button is already in global scope.');
		return;
	}

	// Use AI to validate if button is suitable for global scope, skip if it uses a script file
	const safetyCheck = item.button.scriptFile? { isSafe: true } : await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Analyzing button compatibility with global scope...",
		cancellable: true
	}, async (progress, token) => {
		return await aiServices.checkIfButtonIsGlobalSafe(item.button);
	});

	if (!safetyCheck.isSafe) {
		const warningMessage = `This button appears to be workspace-specific and may not work correctly in other projects.

Button Details:
• Name: ${item.button.name}
• Exec Dir: ${item.button.execDir}
• Command: ${item.button.cmd}
• Description: ${item.button.description || 'N/A'}
• User Prompt: ${item.button.user_prompt || 'N/A'}
${item.button.inputs ? `• Inputs: ${item.button.inputs.map((i: any) => i.placeholder).join(', ')}` : ''}
• Current Scope: Workspace

Why it's workspace-specific:
${safetyCheck.reason || 'The button appears to contain project paths, workspace settings, or project-specific commands that might not exist in other projects.'}

Do you want to add it to global scope anyway?`;

		const result = await CustomDialog.show({
			title: '⚠️ Workspace-Specific Button Warning',
			message: warningMessage,
			buttons: [
				{ label: 'Continue Anyway', id: 'Continue Anyway', isPrimary: true },
				{ label: 'Cancel', id: 'Cancel' }
			],
			markdown: false
		});

		// If user didn't click "Continue Anyway" (clicked Cancel or dismissed), abort
		if (result !== 'Continue Anyway') {
			return;
		}
	}

	// Handle script file copying if button uses a script
	let globalButton: smartCmdButton;
	
	if (item.button.scriptFile) {
		// Button uses a script - need to copy script file to global scripts folder
		try {
			// Read the workspace script content
			const scriptContent = await scriptManager.readScript(
				item.button.scriptFile,
				'workspace',
				buttonsProvider.globalStoragePath
			);
			
			if (!scriptContent) {
				vscode.window.showErrorMessage('Failed to read script file. Cannot add to global.');
				return;
			}
			
			// Create button with scriptContent so it will be processed and saved in global scripts
			globalButton = {
				name: item.button.name,
				execDir: item.button.execDir, // Reset execDir for global button
				cmd: '', // Will be set by processButtonWithScript
				scriptContent: scriptContent, // Temporary field for processing
				scriptFile: item.button.scriptFile, // Keep same filename if possible
				user_prompt: item.button.user_prompt,
				description: item.button.description,
				inputs: item.button.inputs,
				scope: 'global',
			};
			
		} catch (error) {
			console.error('Error reading script to global:', error);
			vscode.window.showErrorMessage('Failed to read script file to global scope.');
			return;
		}
	} else {
		// Regular command button - no script to copy
		globalButton = {
			name: item.button.name,
			execDir: item.button.execDir, // Reset execDir for global button
			cmd: item.button.cmd,
			user_prompt: item.button.user_prompt,
			description: item.button.description,
			inputs: item.button.inputs,
			scope: 'global',
		};
	}

	// Use addButtons which handles duplicate detection automatically
	const addedCount = await buttonsProvider.addButtons([globalButton], 'global');
	
	if (addedCount > 0) {
		const buttonType = item.button.scriptFile ? ' (script copied)' : '';
		vscode.window.showInformationMessage(`DevBoost: Button "${item.button.name}" added to global buttons${buttonType}.`);
	}
	// If addedCount is 0, addButtons already showed appropriate warning message
}