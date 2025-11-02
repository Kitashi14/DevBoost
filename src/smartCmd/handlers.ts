// SmartCmd Core Functions
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as aiServices from './aiServices';
import * as activityLogging from '../activityLogging';
import { smartCmdButton, InputField, SmartCmdButtonsTreeProvider } from './treeProvider';
import { acquirePromptFileLock, releasePromptFileLock } from '../extension';

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

		// Optimize log for AI consumption
		const optimizedLogContent = await activityLogging.optimizeLogForAI(activityLogPath);

		// Parse and analyze activities using optimized content
		const activities = activityLogging.parseActivityLog(optimizedLogContent);
		console.log('DevBoost: Parsed activities:', activities);
		const topActivities = activityLogging.getTopActivities(activities, 5);
		console.log('DevBoost: Top activities:', topActivities);

		// Extract detailed context for AI analysis using optimized content
		const detailedContext = activityLogging.extractDetailedLogContext(optimizedLogContent);
		console.log('DevBoost: Detailed context for AI:', detailedContext);

		if (topActivities.length < 3) {
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
		vscode.window.showInformationMessage('Analyzing your workflow patterns...');
		const buttons = await aiServices.getAISuggestions(topActivities, detailedContext);

		if (buttons.length === 0) {
			vscode.window.showWarningMessage('Could not generate button suggestions. Please try again.');
			return;
		}

		// Show confirmation dialog with preview of AI-suggested buttons
		const previewMessage = `AI has analyzed your workflow and suggests ${buttons.length} button${buttons.length > 1 ? 's' : ''}:

${buttons.map((btn, i) => `${i + 1}. **${btn.name}**
   Command: ${btn.cmd}
   Description: ${btn.ai_description}`).join('\n\n')}

Do you want to create these buttons?`;

		const choice = await vscode.window.showInformationMessage(
			previewMessage,
			{ modal: true },
			'✅ Create All Buttons',
			'👀 Review Individual Buttons',
			'❌ Cancel'
		);

		if (choice === '❌ Cancel') {
			vscode.window.showInformationMessage('Button creation cancelled.');
			return;
		}

		let finalButtons = buttons;

		if (choice === '👀 Review Individual Buttons') {
			finalButtons = [];
			
			for (const button of buttons) {
				const buttonChoice = await vscode.window.showInformationMessage(
					`Review Button: **${button.name}**\n\nCommand: ${button.cmd}\nDescription: ${button.ai_description}\n\nWhat would you like to do?`,
					{ modal: true },
					'✅ Accept',
					'✏️ Edit Description',
					'❌ Skip'
				);

				if (buttonChoice === '✅ Accept') {
					finalButtons.push(button);
				} else if (buttonChoice === '✏️ Edit Description') {
					const editedDescription = await vscode.window.showInputBox({
						prompt: 'Edit the AI-generated description',
						value: button.ai_description,
						placeHolder: 'Enter a better description for this button',
						validateInput: (value) => {
							if (!value || value.trim().length === 0) {
								return 'Description cannot be empty';
							}
							return null;
						}
					});

					if (editedDescription) {
						finalButtons.push({
							...button,
							ai_description: editedDescription.trim()
						});
					}
				}
				// Skip button if '❌ Skip' is chosen
			}

			if (finalButtons.length === 0) {
				vscode.window.showInformationMessage('No buttons were selected.');
				return;
			}
		}

		// Add buttons to tree view
		const addedCount = await buttonsProvider.addButtons(finalButtons, 'workspace');

		if (addedCount > 0) {
			vscode.window.showInformationMessage(`✨ Created ${addedCount} AI-suggested button${addedCount > 1 ? 's' : ''}!`);
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

// Create custom button from user description
export async function createCustomButton(
	promptInputPath: string | undefined,
	buttonsProvider: SmartCmdButtonsTreeProvider,
	scopeInput?: 'Workspace' | 'Global'
) {
	// Try to acquire the prompt file lock
	if (!acquirePromptFileLock()) {
		return;
	}

	try {
		await createCustomButtonInternal(promptInputPath, buttonsProvider, scopeInput);
	} finally {
		// Always release the lock when done
		releasePromptFileLock();
	}
}

// Internal function to handle the actual button creation logic
async function createCustomButtonInternal(
	promptInputPath: string | undefined,
	buttonsProvider: SmartCmdButtonsTreeProvider,
	scopeInput?: 'Workspace' | 'Global'
) {
	// Get scope
	const scope = scopeInput || await vscode.window.showQuickPick(['Workspace', 'Global'], {
		placeHolder: 'Where should this button be available?'
	});

	if (!scope || scope.trim().length === 0 || (scope !== 'Workspace' && scope !== 'Global')) {
		vscode.window.showInformationMessage('Invalid scope selected. Please choose either "Workspace" or "Global".');
		return;
	}

	if (!promptInputPath) {
		vscode.window.showErrorMessage('Prompt input file path not initialized.');
		return;
	}

	try {
		// Ensure the directory exists
		await fs.mkdir(path.dirname(promptInputPath), { recursive: true });

		// Clean the prompt input file (keep it empty)
		await fs.writeFile(promptInputPath, '');

		// Open the dedicated prompt input file
		const doc = await vscode.workspace.openTextDocument(promptInputPath);
		await vscode.window.showTextDocument(doc, { preview: false });

		// Show info message with tips
		vscode.window.showInformationMessage(
			'💡 Describe the functionality of the button you want to create, then close this file to move on. Example: "Button to add changes and commit code using git"',
			{ modal: true }
		);

		// Wait for the file to be closed - use multiple events to detect closure
		const description = await new Promise<string>((resolve) => {
			let resolved = false;
			
			const checkAndResolve = async () => {
				if (resolved) {
					return;
				}
				
				// Check if document is still open in tabs
				const isOpen = vscode.window.tabGroups.all
					.flatMap(group => group.tabs)
					.some(tab => {
						const tabInput = tab.input as any;
						return tabInput?.uri?.fsPath === doc.uri.fsPath;
					});
				
				if (!isOpen) {
					console.log('Prompt input file closed, reading content...');
					resolved = true;
					disposable1.dispose();
					disposable2.dispose();
					
					// Read content from the document
					const content = doc.getText().trim();
					
					// Clean the file after reading
					fs.writeFile(promptInputPath!, '').catch(error => {
						console.error('Error cleaning prompt file:', error);
					});
					
					console.log('File closed, content read:', content);
					resolve(content);
				}
			};
			
			// Listen to tab changes
			const disposable1 = vscode.window.tabGroups.onDidChangeTabs(async () => {
				console.log('Tab changed, checking if prompt file is closed...');
				await checkAndResolve();
			});
			
			// Also listen to visible editors change as backup
			const disposable2 = vscode.window.onDidChangeVisibleTextEditors(async () => {
				console.log('Visible editors changed, checking if prompt file is closed...');
				await checkAndResolve();
			});
		});

		console.warn('User button description:', description);

		// If content is empty, return
		if (!description || description.length === 0) {
			return;
		}

		// Get user input whether use AI or manual
		const useAI = await vscode.window.showQuickPick(['Yes', 'No'], {
			placeHolder: 'Use AI to generate the button?'
		});

		if (!useAI) {
			return;
		}

		if (useAI === 'No') {
			const button = await getManualButtonInput(description);

			if (!button) {
				vscode.window.showWarningMessage('Could not generate button. Please try again.');
				return;
			}

			// Add button to tree view
			const scopeType = scope === 'Global' ? 'global' : 'workspace';
			const addedCount = await buttonsProvider.addButtons([button], scopeType);

			if (addedCount > 0) {
				vscode.window.showInformationMessage(`✅ Created custom button: ${button.name}`);
			}
			return;
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Creating custom button...",
			cancellable: false
		}, async (progress) => {
			// Get AI suggestion from GitHub Copilot
			const button = await aiServices.getCustomButtonSuggestion(description);

			if (!button) {
				vscode.window.showWarningMessage('Could not generate button. Please try again.');
				return;
			}

			// Show confirmation dialog with AI-generated details
			const confirmationMessage = `AI has generated the following button:

📋 **Button Details:**
• Name: ${button.name}
• Command: ${button.cmd}
• AI Description: ${button.ai_description}
• Your Description: ${button.user_description}
${button.inputs ? `• Inputs: ${button.inputs.map(i => i.placeholder).join(', ')}` : ''}

Do you want to create this button?`;

			const choice = await vscode.window.showInformationMessage(
				confirmationMessage,
				{ modal: true },
				'✅ Create Button',
				'✏️ Edit AI Description',
				'❌ Cancel'
			);

			if (choice === '❌ Cancel') {
				vscode.window.showInformationMessage('Button creation cancelled.');
				return;
			}

			let finalButton = button;

			if (choice === '✏️ Edit AI Description') {
				// Allow user to edit the AI description
				const editedDescription = await vscode.window.showInputBox({
					prompt: 'Edit the AI-generated description',
					value: button.ai_description,
					placeHolder: 'Enter a better description for this button',
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return 'Description cannot be empty';
						}
						return null;
					}
				});

				if (!editedDescription) {
					vscode.window.showInformationMessage('Button creation cancelled.');
					return;
				}

				// Update the button with edited description
				finalButton = {
					...button,
					ai_description: editedDescription.trim()
				};
			}

			// Add button to tree view
			const scopeType = scope === 'Global' ? 'global' : 'workspace';
			const addedCount = await buttonsProvider.addButtons([finalButton], scopeType);

			if (addedCount > 0) {
				vscode.window.showInformationMessage(`✅ Created custom button: ${finalButton.name}`);
			}
		});

	} catch (error) {
		console.error('Error creating custom button:', error);
		vscode.window.showErrorMessage('Failed to create custom button.');
	}
}

// Execute button command with input field support and correct working directory context
export async function executeButtonCommand(button: smartCmdButton, activityLogPath?: string | undefined) {
	if (!button || !button.cmd || button.cmd.trim().length === 0) {
		vscode.window.showWarningMessage('No command specified. Please provide a valid command to execute.');
		return;
	}

	let finalCommand = button.cmd.trim();
	const executionStartTime = Date.now();
	const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	// Try to get the most appropriate working directory from activity log context
	let targetWorkingDirectory = workspacePath; // Default fallback
	
	if (activityLogPath) {
		try {
			await fs.access(activityLogPath);
			const optimizedLogContent = await activityLogging.optimizeLogForAI(activityLogPath);
			const detailedContext = activityLogging.extractDetailedLogContext(optimizedLogContent);
			
			// Use the most frequently used directory that's within the current workspace
			if (detailedContext.frequentDirectories.length > 0) {
				for (const dir of detailedContext.frequentDirectories) {
					// Ensure the directory is within the current workspace
					if (workspacePath && dir.startsWith(workspacePath)) {
						targetWorkingDirectory = dir;
						break;
					}
				}
				// If no workspace-relative directory found, use the most frequent one
				if (targetWorkingDirectory === workspacePath && detailedContext.frequentDirectories[0]) {
					targetWorkingDirectory = detailedContext.frequentDirectories[0];
				}
			}
		} catch (error) {
			console.log('DevBoost: Could not extract working directory context, using workspace root');
		}
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

	// Check if it's a single-word VS Code command
	if (!finalCommand.includes(' ') && !finalCommand.includes('&&') && !finalCommand.includes('||') && !finalCommand.includes(';')) {
		try {
			await vscode.commands.executeCommand(finalCommand);
			
			// Log successful VS Code command execution with enhanced context
			await activityLogging.logSmartCmdExecution(
				button.name, 
				finalCommand, 
				'VSCode', 
				activityLogPath,
				{
					duration: Date.now() - executionStartTime,
					workingDirectory: targetWorkingDirectory
				}
			);
			
			vscode.window.showInformationMessage(`Executed VS Code command: ${finalCommand}`);
			return;
		} catch (error) {
			// Not a VS Code command, fall through to terminal execution
			console.log(`Not a VS Code command, executing in terminal: ${finalCommand}`);
		}
	}

	// Execute as terminal command with correct working directory
	try {
		const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('DevBoost');
		terminal.show();
		
		// Track this command as tool-executed to exclude from activity log
		activityLogging.markCommandAsToolExecuted(finalCommand);
		
		// Navigate to the correct directory before executing the command
		// Only change directory if we have a specific target and it's different from workspace root
		if (targetWorkingDirectory && targetWorkingDirectory !== workspacePath) {
			// Use cross-platform cd command
			const cdCommand = process.platform === 'win32' ? `cd /d "${targetWorkingDirectory}"` : `cd "${targetWorkingDirectory}"`;
			terminal.sendText(cdCommand);
			
			// Wait a moment for directory change to complete
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		
		// Log terminal command execution with enhanced context including actual working directory
		await activityLogging.logSmartCmdExecution(
			button.name, 
			finalCommand, 
			'Terminal', 
			activityLogPath,
			{
				terminalName: terminal.name,
				terminalId: terminal.processId?.toString(),
				workingDirectory: targetWorkingDirectory
			}
		);
		
		terminal.sendText(finalCommand);
		vscode.window.setStatusBarMessage(`⚡ Executed: ${button.name} (in ${path.basename(targetWorkingDirectory || workspacePath || 'unknown')})`, 3000);
	} catch (error) {
		// Log execution error with enhanced context
		await activityLogging.logSmartCmdExecution(
			button.name, 
			finalCommand, 
			'Error', 
			activityLogPath,
			{
				workingDirectory: targetWorkingDirectory
			}
		);
		
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
			filePath = path.join(workspaceRoot, '.vscode', 'devboost.json');
			
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
export async function addToGlobal(item: any, buttonsProvider: SmartCmdButtonsTreeProvider) {
	if (!item) {
		vscode.window.showWarningMessage('DevBoost: No button selected to add to global.');
		return;
	}

	// Check if button is already global
	if (item.button.scope === 'global') {
		vscode.window.showInformationMessage('DevBoost: This button is already in global scope.');
		return;
	}

	// Use AI to validate if button is suitable for global scope
	vscode.window.showInformationMessage('Analyzing button compatibility with global scope...');
	const isGlobalSafe = await aiServices.checkIfButtonIsGlobalSafe(item.button);

	if (!isGlobalSafe) {
		const result = await vscode.window.showWarningMessage(
			`DevBoost: This button appears to be workspace-specific (e.g., contains project paths, workspace settings, or project-specific commands). ` +
			`Adding it to global scope might cause issues in other projects. Do you want to continue anyway?`,
			{ modal: true },  // Make it modal so it doesn't auto-dismiss
			'Continue Anyway'
		);

		// If user didn't click "Continue Anyway" (clicked Cancel or dismissed), abort
		if (result !== 'Continue Anyway') {
			vscode.window.showInformationMessage('DevBoost: Add to global cancelled.');
			return;
		}
	}

	// Create a copy of the button for global scope
	const globalButton: smartCmdButton = {
		name: item.button.name,
		cmd: item.button.cmd,
		user_description: item.button.user_description,
		ai_description: item.button.ai_description,
		scope: 'global'
	};

	// Use addButtons which handles duplicate detection automatically
	const addedCount = await buttonsProvider.addButtons([globalButton], 'global');
	
	if (addedCount > 0) {
		vscode.window.showInformationMessage(`DevBoost: Button "${item.button.name}" added to global buttons.`);
	}
	// If addedCount is 0, addButtons already showed appropriate warning message
}

// Helper function to get manual button input as fallback
async function getManualButtonInput(description: string): Promise<smartCmdButton | null> {
	const name = await vscode.window.showInputBox({
		prompt: 'Enter button name',
		value: description.substring(0, 15),
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'Button name cannot be empty';
			}
			if (value.length > 50) {
				return 'Button name is too long (max 50 characters)';
			}
			return null;
		}
	});

	if (!name) {
		vscode.window.showInformationMessage('Button creation cancelled.');
		return null;
	}

	const cmd = await vscode.window.showInputBox({
		prompt: 'Enter command to execute (use {variableName} for inputs)',
		placeHolder: 'e.g., git commit -m \'{message}\' or npm test',
		validateInput: (value) => {
			if (!value || value.trim().length === 0) {
				return 'Command cannot be empty';
			}
			return null;
		}
	});

	if (!cmd) {
		vscode.window.showInformationMessage('Button creation cancelled.');
		return null;
	}

	// Check if command has input placeholders
	const inputMatches = cmd.match(/\{(\w+)\}/g);
	const inputs: InputField[] = [];

	if (inputMatches && inputMatches.length > 0) {
		for (const match of inputMatches) {
			const variable = match;
			const varName = match.slice(1, -1); // Remove { and }
			
			const placeholder = await vscode.window.showInputBox({
				prompt: `Enter placeholder text for ${variable}`,
				placeHolder: `e.g., Enter ${varName}`
			});

			if (placeholder) {
				inputs.push({
					placeholder: placeholder.trim(),
					variable: variable
				});
			}
		}
	}

	return {
		name: name.trim(),
		cmd: cmd.trim(),
		user_description: description?.trim(), // Store as user_description
		inputs: inputs.length > 0 ? inputs : undefined
	};
}