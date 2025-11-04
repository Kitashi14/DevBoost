import * as vscode from 'vscode';

export interface InputFieldConfig {
	id: string;
	label: string;
	placeholder?: string;
	defaultValue?: string;
	required?: boolean;
	multiline?: boolean;
	validation?: (value: string) => string | null; // Returns error message or null
	password?: boolean;
}

export interface InputFormResult {
	[key: string]: string; // field id -> value
}

export class InputFormPanel {
	/**
	 * Show a form with one or more input fields
	 * @param title Title of the form
	 * @param fields Array of input field configurations
	 * @param submitLabel Label for submit button (default: "Submit")
	 * @returns Promise resolving to object with field values or null if cancelled
	 */
	public static async show(
		title: string,
		fields: InputFieldConfig[],
		submitLabel: string = 'Submit'
	): Promise<InputFormResult | null> {
		return new Promise<InputFormResult | null>((resolve) => {
			const panel = vscode.window.createWebviewPanel(
				'inputForm',
				title,
				{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
				{
					enableScripts: true,
					retainContextWhenHidden: false
				}
			);

			panel.webview.html = this.getHtmlContent(panel.webview, title, fields, submitLabel);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				message => {
					if (message.command === 'submit') {
						// Validate on backend as well
						let isValid = true;
						for (const field of fields) {
							if (field.validation) {
								const value = message.data[field.id] || '';
								const error = field.validation(value);
								if (error) {
									isValid = false;
									break;
								}
							}
						}

						if (isValid) {
							// Dispose panel with animation delay
							setTimeout(() => {
								panel.dispose();
							}, 50);
							
							resolve(message.data);
						}
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

	/**
	 * Convenience method for single input (replaces showInputBox)
	 */
	public static async showSingle(
		prompt: string,
		options?: {
			placeholder?: string;
			value?: string;
			password?: boolean;
            multiline?: boolean;
			validateInput?: (value: string) => string | null;
		}
	): Promise<string | null> {
		const result = await this.show(
			prompt,
			[{
				id: 'input',
				label: prompt,
				placeholder: options?.placeholder,
				defaultValue: options?.value,
				required: true,
				password: options?.password,
                multiline: options?.multiline,
				validation: options?.validateInput
			}],
			'OK'
		);

		return result ? result.input : null;
	}

	private static getHtmlContent(
		webview: vscode.Webview,
		title: string,
		fields: InputFieldConfig[],
		submitLabel: string
	): string {
		// Escape HTML
		const escapeHtml = (text: string) => {
			return text
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		};

		// Prepare validation functions as JSON
		const validationRules: { [key: string]: { required: boolean } } = {};
		fields.forEach(field => {
			validationRules[field.id] = {
				required: field.required !== false // default to true
			};
		});

		// Generate field HTML
		const fieldsHtml = fields.map(field => {
			const inputType = field.password ? 'password' : 'text';
			const requiredMark = (field.required !== false) ? '<span class="required">*</span>' : '';
			const defaultValue = field.defaultValue ? escapeHtml(field.defaultValue) : '';
			const placeholder = field.placeholder ? escapeHtml(field.placeholder) : '';

			if (field.multiline) {
				return `
					<div class="form-group">
						<label for="${field.id}">${escapeHtml(field.label)}${requiredMark}</label>
						<textarea 
							id="${field.id}" 
							placeholder="${placeholder}"
							data-required="${field.required !== false}"
						>${defaultValue}</textarea>
						<div class="error-message" id="${field.id}_error"></div>
					</div>
				`;
			} else {
				return `
					<div class="form-group">
						<label for="${field.id}">${escapeHtml(field.label)}${requiredMark}</label>
						<input 
							type="${inputType}" 
							id="${field.id}" 
							value="${defaultValue}"
							placeholder="${placeholder}"
							data-required="${field.required !== false}"
						/>
						<div class="error-message" id="${field.id}_error"></div>
					</div>
				`;
			}
		}).join('\n');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)}</title>
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
			max-width: 600px;
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
		input[type="password"],
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
		input[type="password"]:focus,
		textarea:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

		input.error,
		textarea.error {
			border-color: var(--vscode-inputValidation-errorBorder);
			background-color: var(--vscode-inputValidation-errorBackground);
		}

		.error-message {
			color: var(--vscode-errorForeground);
			font-size: 12px;
			margin-top: 4px;
			min-height: 16px;
		}

		textarea {
			resize: vertical;
			min-height: 80px;
			font-family: var(--vscode-editor-font-family);
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
	</style>
</head>
<body>
	<div class="container">
		<h1>${escapeHtml(title)}</h1>
		
		<form id="inputForm">
			${fieldsHtml}

			<div class="button-group">
				<button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
				<button type="submit" class="btn-primary" id="submitBtn">${escapeHtml(submitLabel)}</button>
			</div>
		</form>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const form = document.getElementById('inputForm');
		const submitBtn = document.getElementById('submitBtn');
		const cancelBtn = document.getElementById('cancelBtn');
		const validationRules = ${JSON.stringify(validationRules)};

		// Get all input fields
		const fieldIds = ${JSON.stringify(fields.map(f => f.id))};
		const inputs = {};
		fieldIds.forEach(id => {
			inputs[id] = document.getElementById(id);
		});

		// Validate a single field
		function validateField(fieldId) {
			const input = inputs[fieldId];
			const errorEl = document.getElementById(fieldId + '_error');
			const value = input.value.trim();
			const rules = validationRules[fieldId];

			if (rules.required && !value) {
				errorEl.textContent = 'This field is required';
				input.classList.add('error');
				return false;
			}

			errorEl.textContent = '';
			input.classList.remove('error');
			return true;
		}

		// Validate all fields
		function validateAll() {
			let isValid = true;
			fieldIds.forEach(id => {
				if (!validateField(id)) {
					isValid = false;
				}
			});
			return isValid;
		}

		// Update submit button state
		function updateSubmitButton() {
			submitBtn.disabled = !validateAll();
		}

		// Add input listeners
		fieldIds.forEach(id => {
			inputs[id].addEventListener('input', () => {
				validateField(id);
				updateSubmitButton();
			});
		});

		// Cancel button
		cancelBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'cancel' });
		});

		// Form submission
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			
			if (!validateAll()) {
				return;
			}

			// Collect all values
			const data = {};
			fieldIds.forEach(id => {
				data[id] = inputs[id].value.trim();
			});

			vscode.postMessage({
				command: 'submit',
				data: data
			});
		});

		// Initial validation
		updateSubmitButton();

		// Focus first input
		if (fieldIds.length > 0) {
			inputs[fieldIds[0]].focus();
			inputs[fieldIds[0]].select();
		}
	</script>
</body>
</html>`;
	}
}
