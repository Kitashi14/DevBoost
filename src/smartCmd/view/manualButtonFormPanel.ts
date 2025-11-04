import * as vscode from 'vscode';
import { smartCmdButton, InputField } from '../treeProvider';

export class ButtonFormPanel {
	/**
	 * Show a form to manually create a button
	 * @param scope The scope for the button ('workspace' or 'global')
	 * @returns Promise resolving to smartCmdButton or null if cancelled
	 */
	public static async show(scope: 'workspace' | 'global'): Promise<smartCmdButton | null> {
		return new Promise<smartCmdButton | null>((resolve) => {
			const panel = vscode.window.createWebviewPanel(
				'buttonForm',
				'Create Custom Button',
				{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
				{
					enableScripts: true,
					retainContextWhenHidden: false
				}
			);

			// Get default execDir based on scope
			const defaultExecDir = scope === 'workspace' && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
				? vscode.workspace.workspaceFolders[0].uri.fsPath
				: '.';

			panel.webview.html = this.getHtmlContent(panel.webview, defaultExecDir, scope);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				message => {
					if (message.command === 'submit') {
						// Return the button data with the selected scope
						const button: smartCmdButton & { selectedScope: 'workspace' | 'global' } = {
							name: message.data.name,
							cmd: message.data.cmd,
							user_description: message.data.description || undefined,
							inputs: message.data.inputs && message.data.inputs.length > 0 ? message.data.inputs : undefined,
							execDir: message.data.execDir || '.',
							selectedScope: message.data.scope as 'workspace' | 'global'
						};
						
						// Dispose panel with animation delay
						setTimeout(() => {
							panel.dispose();
						}, 50);
						
						resolve(button);
					} else if (message.command === 'cancel') {
						// Dispose panel with animation delay
						setTimeout(() => {
							panel.dispose();
						}, 50);
						
						resolve(null);
					}
				},
				undefined
			);

			// Handle panel disposal
			panel.onDidDispose(() => {
				resolve(null);
			});
		});
	}

	private static getHtmlContent(webview: vscode.Webview, defaultExecDir: string, scope: 'workspace' | 'global'): string {
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
	</style>
</head>
<body>
	<div class="container">
		<h1>Create Custom Button Manually</h1>
		
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
				<input type="text" id="name" maxlength="50" placeholder="e.g., Deploy to Production">
				<div class="error-message" id="nameError"></div>
			</div>

			<div class="form-group">
				<label for="description">Description</label>
				<input type="text" id="description" placeholder="Brief description of what this button does">
				<div class="hint">Add a description to help identify this button</div>
			</div>

			<div class="form-group">
				<label for="execDir">Execution Directory</label>
				<input type="text" id="execDir" value="${defaultExecDir}" placeholder="e.g., ./src, /usr/local/bin, etc.">
				<div class="hint">Directory where the command will be executed (e.g. ./src, /usr/local/bin, . (current directory), etc.)</div>
			</div>

			<div class="form-group">
				<label for="cmd">Command<span class="required">*</span></label>
				<textarea id="cmd" placeholder="e.g., git commit -m '{message}' or npm test"></textarea>
				<div class="error-message" id="cmdError"></div>
				<div class="hint">Use {variableName} for dynamic inputs</div>
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

		let currentVariables = [];

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

		// Update form validation
		function updateValidation() {
			const nameValid = validateName();
			const cmdValid = validateCmd();
			
			// Check if all placeholder inputs are filled
			let placeholdersValid = true;
			if (currentVariables.length > 0) {
				currentVariables.forEach(variable => {
					const input = document.getElementById('placeholder_' + variable.replace(/[{}]/g, ''));
					if (input && !input.value.trim()) {
						placeholdersValid = false;
					}
				});
			}
			
			submitBtn.disabled = !(nameValid && cmdValid && placeholdersValid);
		}

		// Detect variables in command
		function detectVariables() {
			const cmd = cmdInput.value;
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
		nameInput.addEventListener('input', updateValidation);
		cmdInput.addEventListener('input', () => {
			validateCmd();
			detectVariables();
		});

		cancelBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'cancel' });
		});

		document.getElementById('buttonForm').addEventListener('submit', (e) => {
			e.preventDefault();
			
			if (submitBtn.disabled) {
				return;
			}
			
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
			
			vscode.postMessage({
				command: 'submit',
				data: {
					scope: scopeInput.value,
					name: nameInput.value.trim(),
					description: descriptionInput.value.trim(),
					execDir: execDirInput.value.trim() || '.',
					cmd: cmdInput.value.trim(),
					inputs: inputs
				}
			});
		});

		// Initial validation
		updateValidation();
		
		// Focus on name input
		nameInput.focus();
	</script>
</body>
</html>`;
	}
}
