import * as vscode from 'vscode';
import * as path from 'path';
import { smartCmdButton, InputField } from '../treeProvider';
import * as scriptManager from '../scriptManager';

export class ButtonFormPanel {
	/**
	 * Show a form to manually create a button
	 * @param scope The scope for the button ('workspace' or 'global')
	 * @param globalStoragePath The global storage path for storing scripts
	 * @returns Promise resolving to smartCmdButton or null if cancelled
	 */
	public static async show(scope: 'workspace' | 'global', globalStoragePath?: string): Promise<smartCmdButton | null> {
		return new Promise<smartCmdButton | null>((resolve) => {
			// Track created script file for cleanup if cancelled
			let createdScriptFile: string | null = null;
			let createdScriptScope: 'workspace' | 'global' | null = null;
			
			const panel = vscode.window.createWebviewPanel(
				'buttonForm',
				'Create Custom Button',
				{ viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			// Get default execDir based on scope
			const defaultExecDir = '<workspace>';

			panel.webview.html = this.getHtmlContent(panel.webview, defaultExecDir, scope, globalStoragePath);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				async message => {
					if (message.command === 'submit') {
						// Clear tracked script since user is submitting (not cancelling)
						createdScriptFile = null;
						createdScriptScope = null;
						
						// Return the button data with the selected scope
						const button: smartCmdButton & { selectedScope: 'workspace' | 'global' } = {
							name: message.data.name,
							cmd: message.data.cmd,
							description: message.data.description || undefined,
							inputs: message.data.inputs && message.data.inputs.length > 0 ? message.data.inputs : undefined,
							execDir: message.data.execDir || '.',
							selectedScope: message.data.scope as 'workspace' | 'global'
						};

						// If scriptFile is provided, include it (cmd is already set)
						if (message.data.scriptFile) {
							button.scriptFile = message.data.scriptFile;
						}
						
						// Dispose panel with animation delay
						setTimeout(() => {
							panel.dispose();
						}, 50);
						
						resolve(button);
					} else if (message.command === 'cancel') {
						// Delete created script file if user cancels
						if (createdScriptFile && createdScriptScope) {
							scriptManager.deleteScript(createdScriptFile, createdScriptScope, globalStoragePath)
								.catch(err => console.error('Failed to delete script on cancel:', err));
							createdScriptFile = null;
						}
						
						// Dispose panel with animation delay
						setTimeout(() => {
							panel.dispose();
						}, 50);
						
						resolve(null);
					} else if (message.command === 'createScript') {
						// check for already created script and delete them first
						if (createdScriptFile && createdScriptScope) {
							scriptManager.deleteScript(createdScriptFile, createdScriptScope, globalStoragePath)
								.catch(err => console.error('Failed to delete script on create:', err));
							createdScriptFile = null;
						}
						// Handle script creation request
						const { fileName, scope: scriptScope } = message.data;
						
						try {
							// Get list of existing scripts to ensure unique filename
							const scriptsDir = scriptManager.getScriptsDir(scriptScope, globalStoragePath);
							let existingFiles: string[] = [];
							
							if (scriptsDir) {
								const scripts = await scriptManager.listScripts(scriptScope, globalStoragePath);
								existingFiles = scripts.map(s => path.basename(s));
							}
							
							// Ensure unique filename (user provides extension)
							const uniqueFileName = scriptManager.ensureUniqueFileName(fileName, existingFiles);
							
							// Create empty script with appropriate shebang based on extension
							const ext = path.extname(uniqueFileName).toLowerCase();
							let scriptContent = '';
							
							// Add shebang based on file extension
							if (ext === '.sh') {
								scriptContent = '#!/bin/bash\n# Script for button: ' + message.data.name + '\n\n';
							} else if (ext === '.py') {
								scriptContent = '#!/usr/bin/env python3\n# Script for button: ' + message.data.name + '\n# Description: ' + message.data.description + '\n\n';
							} else if (ext === '.js') {
								scriptContent = '#!/usr/bin/env node\n// Script for button: ' + message.data.name + '\n// Description: ' + message.data.description + '\n\n';
							} else if (ext === '.rb') {
								scriptContent = '#!/usr/bin/env ruby\n# Script for button: ' + message.data.name + '\n# Description: ' + message.data.description + '\n\n';
							} else if (ext === '.pl') {
								scriptContent = '#!/usr/bin/env perl\n# Script for button: ' + message.data.name + '\n# Description: ' + message.data.description + '\n\n';
							} else if (ext === '.bat' || ext === '.cmd') {
								scriptContent = '@echo off\nREM Script for button: ' + message.data.name + '\nREM Description: ' + message.data.description + '\n\n';
							} else {
								// Generic script without shebang
								scriptContent = '# Script for button: ' + message.data.name + '\n# Description: ' + message.data.description + '\n\n';
							}
							
							// Save the script
							const scriptPath = await scriptManager.saveScript(
								scriptContent,
								uniqueFileName,
								scriptScope,
								globalStoragePath
							);
							
							if (scriptPath) {
								// Track created script for potential cleanup
								createdScriptFile = uniqueFileName;
								createdScriptScope = scriptScope;
								
								// Send success message back to webview
								panel.webview.postMessage({
									command: 'scriptCreated',
									scriptFile: uniqueFileName,
									scriptPath: scriptPath
								});
							} else {
								panel.webview.postMessage({
									command: 'scriptCreationFailed',
									error: 'Failed to create script file'
								});
							}
						} catch (error) {
							panel.webview.postMessage({
								command: 'scriptCreationFailed',
								error: error instanceof Error ? error.message : 'Unknown error'
							});
						}
					} else if (message.command === 'openScript') {
						// Handle opening script file in editor
						const { scriptPath } = message.data;
						
						try {
							const doc = await vscode.workspace.openTextDocument(scriptPath);
							await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: false });
						} catch (error) {
							vscode.window.showErrorMessage(`Failed to open script: ${error instanceof Error ? error.message : 'Unknown error'}`);
						}
					}
				},
				undefined
			);

			// Handle panel disposal
			panel.onDidDispose(() => {
				// Delete created script file if panel is closed without submitting
				if (createdScriptFile && createdScriptScope) {
					scriptManager.deleteScript(createdScriptFile, createdScriptScope, globalStoragePath)
						.catch(err => console.error('Failed to delete script on disposal:', err));
				}
				resolve(null);
			});
		});
	}

	private static getHtmlContent(webview: vscode.Webview, defaultExecDir: string, scope: 'workspace' | 'global', globalStoragePath?: string): string {
		const scopeLabel = scope === 'workspace' ? 'Workspace' : 'Global';
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Create Custom Button</title>
	<style>
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			padding: 20px;
			overflow-y: auto;
		}

		.container {
			max-width: 700px;
			margin: 0 auto;
			animation: fadeIn 0.2s ease-in;
		}

		@keyframes fadeIn {
			from { opacity: 0; }
			to { opacity: 1; }
		}

		@keyframes slideUp {
			from { 
				opacity: 0;
				transform: translateY(10px);
			}
			to { 
				opacity: 1;
				transform: translateY(0);
			}
		}

		h1 {
			font-size: 18px;
			font-weight: 600;
			margin-bottom: 20px;
			color: var(--vscode-foreground);
			animation: slideUp 0.3s ease-out;
		}

		.form-group {
			margin-bottom: 18px;
			animation: slideUp 0.3s ease-out;
		}

		label {
			display: block;
			margin-bottom: 6px;
			font-weight: 500;
			color: var(--vscode-foreground);
		}

		.required {
			color: var(--vscode-errorForeground);
			margin-left: 3px;
		}

		input[type="text"],
		textarea {
			width: 100%;
			padding: 8px 10px;
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			transition: border-color 0.15s ease;
		}

		input[type="text"]:focus,
		textarea:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		input[type="text"].error {
			border-color: var(--vscode-inputValidation-errorBorder);
			background-color: var(--vscode-inputValidation-errorBackground);
		}

		.error-message {
			color: var(--vscode-errorForeground);
			font-size: 12px;
			margin-top: 4px;
			min-height: 16px;
		}

		.hint {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			margin-top: 4px;
		}

		textarea {
			resize: vertical;
			min-height: 60px;
			font-family: var(--vscode-editor-font-family);
		}

		.placeholder-section {
			margin-top: 20px;
			padding: 16px;
			background-color: var(--vscode-editor-inactiveSelectionBackground);
			border-radius: 4px;
			animation: slideUp 0.3s ease-out;
		}

		.placeholder-section h3 {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 12px;
			color: var(--vscode-foreground);
		}

		.placeholder-item {
			margin-bottom: 12px;
			animation: slideUp 0.2s ease-out;
		}

		.placeholder-item:last-child {
			margin-bottom: 0;
		}

		.button-group {
			margin-top: 24px;
			display: flex;
			gap: 10px;
			justify-content: flex-end;
		}

		button {
			padding: 8px 16px;
			font-size: 13px;
			font-family: var(--vscode-font-family);
			border: none;
			border-radius: 2px;
			cursor: pointer;
			transition: all 0.15s ease;
		}

		button:hover {
			transform: scale(1.02);
		}

		button:active {
			transform: scale(0.98);
		}

		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			transform: none;
		}

		.btn-primary {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		.btn-primary:hover:not(:disabled) {
			background-color: var(--vscode-button-hoverBackground);
		}

		.btn-secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}

		.btn-secondary:hover:not(:disabled) {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}

		.variable-badge {
			display: inline-block;
			background-color: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 11px;
			font-family: var(--vscode-editor-font-family);
			margin-right: 6px;
		}

		/* Radio button styles */
		.radio-group {
			display: flex;
			gap: 20px;
			margin-top: 8px;
		}

		.radio-option {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: pointer;
		}

		input[type="radio"] {
			cursor: pointer;
			width: 16px;
			height: 16px;
		}

		.radio-option label {
			cursor: pointer;
			margin-bottom: 0;
			font-weight: normal;
		}

		/* Script section styles */
		.script-section {
			padding: 16px;
			background-color: var(--vscode-editor-inactiveSelectionBackground);
			border-radius: 4px;
			margin-top: 8px;
		}

		.script-created {
			padding: 12px;
			background-color: var(--vscode-list-hoverBackground);
			border-radius: 4px;
			margin-top: 12px;
			border: 1px solid var(--vscode-focusBorder);
		}

		.script-path {
			font-family: var(--vscode-editor-font-family);
			color: var(--vscode-textLink-foreground);
			font-size: 12px;
			margin-top: 6px;
			word-break: break-all;
		}

		.info-box {
			padding: 8px 12px;
			background-color: var(--vscode-inputValidation-infoBackground);
			border-left: 3px solid var(--vscode-inputValidation-infoBorder);
			border-radius: 2px;
			font-size: 12px;
			color: var(--vscode-foreground);
			margin-bottom: 12px;
		}

		.success-message {
			color: var(--vscode-testing-iconPassed);
			font-size: 12px;
			margin-bottom: 8px;
			font-weight: 500;
		}

		.btn-small {
			padding: 6px 12px;
			font-size: 12px;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>Create Custom Button Manual Form</h1>
		
		<form id="buttonForm">
			<div class="form-group">
				<label for="scope">Scope<span class="required">*</span></label>
				<select id="scope" style="width: 100%; padding: 8px 10px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);">
					<option value="workspace" ${scopeLabel === 'Workspace' ? 'selected' : ''}>Workspace</option>
					<option value="global" ${scopeLabel === 'Global' ? 'selected' : ''}>Global</option>
				</select>
				<div class="hint">Choose where this button will be saved</div>
			</div>
			
			<div class="form-group">
				<label for="name">Button Name<span class="required">*</span></label>
				<input type="text" id="name" maxlength="50" placeholder="e.g., Start Server">
				<div class="error-message" id="nameError"></div>
			</div>

			<div class="form-group">
				<label for="description">Description</label>
				<textarea id="description" placeholder="Brief description of what this button does"></textarea>
				<div class="hint">Add a description to help understand this button</div>
			</div>

			<div class="form-group">
				<label for="execDir">Execution Directory</label>
				<input type="text" id="execDir" value="${defaultExecDir}">
				<div class="hint">Directory where the command will be executed (e.g. &lt;workspace&gt;, &lt;workspace&gt;/src, /usr/local/bin, . (current directory), etc.)</div>
			</div>

			<div class="form-group">
				<label>Button Type<span class="required">*</span></label>
				<div class="radio-group">
					<div class="radio-option">
						<input type="radio" id="modeCmd" name="mode" value="cmd" checked>
						<label for="modeCmd">Command Chain</label>
					</div>
					<div class="radio-option">
						<input type="radio" id="modeScript" name="mode" value="script">
						<label for="modeScript">Script File</label>
					</div>
				</div>
				<div class="hint">Choose between command chain or script file</div>
			</div>

			<div id="cmdSection">
				<div class="form-group">
					<label for="cmd">Command<span class="required">*</span></label>
					<textarea id="cmd" placeholder="cmd to be executed in terminal (e.g. npm run, git status && ls -l)"></textarea>
					<div class="error-message" id="cmdError"></div>
					<div class="hint">Use {variableName} for dynamic inputs (e.g., git commit -m '{message}')</div>
				</div>
			</div>

			<div id="scriptSection" style="display: none;">
				<div class="form-group">
					<label>Script File</label>
					<div class="info-box">
						Create a script file that will be linked to this button. You can edit the script after creation.
					</div>
					<div class="script-section">
						<div style="display: flex; gap: 10px; align-items: flex-end;">
							<div style="flex: 1;">
								<label for="scriptName">Script File Name (with extension)<span class="required">*</span></label>
								<input type="text" id="scriptName" placeholder="e.g., deploy.sh, script.py, run.js">
								<div class="hint" style="margin-top: 4px;">Include file extension (.sh, .py, .js, .bat, etc.)</div>
							</div>
							<button type="button" class="btn-primary btn-small" id="createScriptBtn">Create Script</button>
						</div>
						
						<div id="scriptCreatedSection" style="display: none;">
							<div class="script-created">
								<div class="success-message">✓ Script created successfully!</div>
								<div style="display: flex; justify-content: space-between; align-items: center;">
									<div>
										<div style="font-size: 12px; color: var(--vscode-descriptionForeground);">Script Path:</div>
										<div class="script-path" id="scriptPath"></div>
									</div>
									<button type="button" class="btn-secondary btn-small" id="openScriptBtn">Open Script</button>
								</div>
							</div>
						</div>
					</div>
				</div>
				
				<div class="form-group">
					<label for="scriptCmd">Command to Execute Script<span class="required">*</span></label>
					<textarea id="scriptCmd" placeholder="e.g., bash &quot;/path/to/script.sh&quot; {input_1} {input_2}, python &quot;/path/to/script.py&quot;"></textarea>
					<div class="error-message" id="scriptCmdError"></div>
					<div class="hint">Full command to execute the script. Use {variableName} for dynamic inputs.</div>
				</div>
			</div>

			<div id="placeholderSection" style="display: none;">
				<div class="placeholder-section">
					<h3>Input Placeholders</h3>
					<div class="hint" style="margin-bottom: 12px;">Provide user-friendly prompts for each variable in your command</div>
					<div id="placeholderInputs"></div>
				</div>
			</div>

			<div class="button-group">
				<button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
				<button type="submit" class="btn-primary" id="submitBtn" disabled>Create Button</button>
			</div>
		</form>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		const scopeInput = document.getElementById('scope');
		const nameInput = document.getElementById('name');
		const descriptionInput = document.getElementById('description');
		const execDirInput = document.getElementById('execDir');
		const cmdInput = document.getElementById('cmd');
		const submitBtn = document.getElementById('submitBtn');
		const cancelBtn = document.getElementById('cancelBtn');
		const nameError = document.getElementById('nameError');
		const cmdError = document.getElementById('cmdError');
		const placeholderSection = document.getElementById('placeholderSection');
		const placeholderInputs = document.getElementById('placeholderInputs');
		
		// Script mode elements
		const modeCmdRadio = document.getElementById('modeCmd');
		const modeScriptRadio = document.getElementById('modeScript');
		const cmdSection = document.getElementById('cmdSection');
		const scriptSection = document.getElementById('scriptSection');
		const scriptNameInput = document.getElementById('scriptName');
		const scriptCmdInput = document.getElementById('scriptCmd');
		const scriptCmdError = document.getElementById('scriptCmdError');
		const createScriptBtn = document.getElementById('createScriptBtn');
		const scriptCreatedSection = document.getElementById('scriptCreatedSection');
		const scriptPathDiv = document.getElementById('scriptPath');
		const openScriptBtn = document.getElementById('openScriptBtn');

		let currentVariables = [];
		let currentMode = 'cmd';
		let scriptFileName = '';
		let scriptFilePath = '';

		// Restore saved state if available
		const vscodeState = vscode.getState();
		if (vscodeState) {
			if (vscodeState.scope !== undefined) scopeInput.value = vscodeState.scope;
			if (vscodeState.name !== undefined) nameInput.value = vscodeState.name;
			if (vscodeState.description !== undefined) descriptionInput.value = vscodeState.description;
			if (vscodeState.execDir !== undefined) execDirInput.value = vscodeState.execDir;
			if (vscodeState.cmd !== undefined) cmdInput.value = vscodeState.cmd;
			if (vscodeState.mode !== undefined) {
				currentMode = vscodeState.mode;
				if (currentMode === 'script') {
					modeScriptRadio.checked = true;
					cmdSection.style.display = 'none';
					scriptSection.style.display = 'block';
				}
			}
			if (vscodeState.scriptName !== undefined) scriptNameInput.value = vscodeState.scriptName;
			if (vscodeState.scriptCmd !== undefined) scriptCmdInput.value = vscodeState.scriptCmd;
			if (vscodeState.scriptFileName !== undefined) {
				scriptFileName = vscodeState.scriptFileName;
				scriptFilePath = vscodeState.scriptFilePath || '';
				if (scriptFileName) {
					scriptCreatedSection.style.display = 'block';
					scriptPathDiv.textContent = scriptFilePath;
				}
			}
		}

		// Save state whenever form values change
		function saveState() {
			vscode.setState({
				scope: scopeInput.value,
				name: nameInput.value,
				description: descriptionInput.value,
				execDir: execDirInput.value,
				cmd: cmdInput.value,
				mode: currentMode,
				scriptName: scriptNameInput.value,
				scriptCmd: scriptCmdInput.value,
				scriptFileName: scriptFileName,
				scriptFilePath: scriptFilePath
			});
		}

		// Validate name
		function validateName() {
			const value = nameInput.value.trim();
			if (!value) {
				nameError.textContent = 'Button name cannot be empty';
				nameInput.classList.add('error');
				return false;
			}
			if (value.length > 50) {
				nameError.textContent = 'Button name is too long (max 50 characters)';
				nameInput.classList.add('error');
				return false;
			}
			nameError.textContent = '';
			nameInput.classList.remove('error');
			return true;
		}

		// Validate command
		function validateCmd() {
			const value = cmdInput.value.trim();
			if (!value) {
				cmdError.textContent = 'Command cannot be empty';
				cmdInput.classList.add('error');
				return false;
			}
			cmdError.textContent = '';
			cmdInput.classList.remove('error');
			return true;
		}

		// Validate script command
		function validateScriptCmd() {
			const value = scriptCmdInput.value.trim();
			if (!value) {
				scriptCmdError.textContent = 'Command cannot be empty';
				scriptCmdInput.classList.add('error');
				return false;
			}
			scriptCmdError.textContent = '';
			scriptCmdInput.classList.remove('error');
			return true;
		}

		// Update form validation
		function updateValidation() {
			const nameValid = validateName();
			
			let modeValid = false;
			if (currentMode === 'cmd') {
				modeValid = validateCmd();
			} else {
				// Script mode - require script to be created AND command to be entered
				const scriptCreated = scriptFileName !== '';
				const scriptCmdValid = validateScriptCmd();
				modeValid = scriptCreated && scriptCmdValid;
			}
			
			// Check if all placeholder inputs are filled (for both modes)
			let placeholdersValid = true;
			if (currentVariables.length > 0) {
				currentVariables.forEach(variable => {
					const input = document.getElementById('placeholder_' + variable.replace(/[{}]/g, ''));
					if (input && !input.value.trim()) {
						placeholdersValid = false;
					}
				});
			}
			
			submitBtn.disabled = !(nameValid && modeValid && placeholdersValid);
		}

		// Detect variables in command
		function detectVariables() {
			let cmd = '';
			
			// Use appropriate command based on mode
			if (currentMode === 'cmd') {
				cmd = cmdInput.value;
			} else {
				cmd = scriptCmdInput.value;
			}
			
			const matches = cmd.match(/\\{(\\w+)\\}/g);
			const variables = matches ? [...new Set(matches)] : []; // Remove duplicates
			
			// Check if variables changed
			if (JSON.stringify(variables) === JSON.stringify(currentVariables)) {
				return;
			}
			
			currentVariables = variables;
			
			if (variables.length === 0) {
				placeholderSection.style.display = 'none';
				placeholderInputs.innerHTML = '';
			} else {
				placeholderSection.style.display = 'block';
				placeholderInputs.innerHTML = '';
				
				variables.forEach((variable, index) => {
					const varName = variable.slice(1, -1); // Remove { and }
					const div = document.createElement('div');
					div.className = 'placeholder-item';
					div.innerHTML = \`
						<label for="placeholder_\${varName}">
							<span class="variable-badge">\${variable}</span>
							Placeholder text<span class="required">*</span>
						</label>
						<input 
							type="text" 
							id="placeholder_\${varName}" 
							placeholder="e.g., Enter \${varName}"
							data-variable="\${variable}"
						/>
					\`;
					placeholderInputs.appendChild(div);
					
					// Add input listener for validation
					const input = div.querySelector('input');
					input.addEventListener('input', updateValidation);
				});
			}
			
			updateValidation();
		}

		// Event listeners
		modeCmdRadio.addEventListener('change', () => {
			if (modeCmdRadio.checked) {
				currentMode = 'cmd';
				cmdSection.style.display = 'block';
				scriptSection.style.display = 'none';
				detectVariables();
				updateValidation();
				saveState();
			}
		});

		modeScriptRadio.addEventListener('change', () => {
			if (modeScriptRadio.checked) {
				currentMode = 'script';
				cmdSection.style.display = 'none';
				scriptSection.style.display = 'block';
				detectVariables();
				updateValidation();
				saveState();
			}
		});

		scriptNameInput.addEventListener('input', saveState);

		scriptCmdInput.addEventListener('input', () => {
			detectVariables();
			updateValidation();
			saveState();
		});

		createScriptBtn.addEventListener('click', () => {
			const fileName = scriptNameInput.value.trim();
			if (!fileName) {
				return;
			}
			
			// Send message to create script
			vscode.postMessage({
				command: 'createScript',
				data: {
					fileName: fileName,
					name: nameInput.value.trim(),
					description: descriptionInput.value.trim(),
					scope: scopeInput.value
				}
			});
		});

		openScriptBtn.addEventListener('click', () => {
			if (scriptFilePath) {
				vscode.postMessage({
					command: 'openScript',
					data: {
						scriptPath: scriptFilePath
					}
				});
			}
		});

		// Listen for messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			
			if (message.command === 'scriptCreated') {
				scriptFileName = message.scriptFile;
				scriptFilePath = message.scriptPath;
				scriptCreatedSection.style.display = 'block';
				scriptPathDiv.textContent = scriptFilePath;
				updateValidation();
				saveState();
			} else if (message.command === 'scriptCreationFailed') {
				alert('Failed to create script: ' + message.error);
			}
		});

		nameInput.addEventListener('input', () => {
			updateValidation();
			saveState();
		});
		cmdInput.addEventListener('input', () => {
			detectVariables();
			updateValidation();
			saveState();
		});
		descriptionInput.addEventListener('input', saveState);
		execDirInput.addEventListener('input', saveState);
		scopeInput.addEventListener('change', saveState);

		cancelBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'cancel' });
		});

		document.getElementById('buttonForm').addEventListener('submit', (e) => {
			e.preventDefault();
			
			if (submitBtn.disabled) {
				return;
			}
			
			const submitData = {
				scope: scopeInput.value,
				name: nameInput.value.trim(),
				description: descriptionInput.value.trim(),
				execDir: execDirInput.value.trim() || '.'
			};
			
			if (currentMode === 'cmd') {
				// Collect placeholder inputs
				const inputs = [];
				currentVariables.forEach(variable => {
					const varName = variable.slice(1, -1);
					const input = document.getElementById('placeholder_' + varName);
					if (input && input.value.trim()) {
						inputs.push({
							placeholder: input.value.trim(),
							variable: variable
						});
					}
				});
				
				submitData.cmd = cmdInput.value.trim();
				submitData.inputs = inputs;
			} else {
				// Script mode - include both scriptFile and cmd with inputs
				const inputs = [];
				currentVariables.forEach(variable => {
					const varName = variable.slice(1, -1);
					const input = document.getElementById('placeholder_' + varName);
					if (input && input.value.trim()) {
						inputs.push({
							placeholder: input.value.trim(),
							variable: variable
						});
					}
				});
				
				submitData.scriptFile = scriptFileName;
				submitData.cmd = scriptCmdInput.value.trim();
				submitData.inputs = inputs;
			}
			
			vscode.postMessage({
				command: 'submit',
				data: submitData
			});
		});

		// Initial validation and variable detection
		detectVariables();
		updateValidation();
		
		// Focus on name input
		nameInput.focus();
	</script>
</body>
</html>`;
	}
}
