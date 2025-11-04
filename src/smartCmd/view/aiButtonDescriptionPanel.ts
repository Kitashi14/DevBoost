import * as vscode from 'vscode';

export interface AIButtonDescriptionResult {
	description: string;
	scope: 'workspace' | 'global';
}

export class AIButtonDescriptionPanel {
	/**
	 * Show a form to get AI button description from user
	 * @param defaultScope The default scope ('workspace' or 'global')
	 * @returns Promise resolving to description and scope or null if cancelled
	 */
	public static async show(defaultScope: 'workspace' | 'global' = 'workspace'): Promise<AIButtonDescriptionResult | null> {
		return new Promise<AIButtonDescriptionResult | null>((resolve) => {
			const panel = vscode.window.createWebviewPanel(
				'aiButtonDescription',
				'Describe Your Custom Button',
				{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
				{
					enableScripts: true,
					retainContextWhenHidden: false
				}
			);

			panel.webview.html = this.getHtmlContent(panel.webview, defaultScope);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				message => {
					if (message.command === 'submit') {
						const result: AIButtonDescriptionResult = {
							description: message.data.description,
							scope: message.data.scope as 'workspace' | 'global'
						};
						
						// Dispose panel with animation delay
						setTimeout(() => {
							panel.dispose();
						}, 50);
						
						resolve(result);
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

	private static getHtmlContent(webview: vscode.Webview, defaultScope: 'workspace' | 'global'): string {
		const scopeLabel = defaultScope === 'workspace' ? 'Workspace' : 'Global';
		
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Describe Your Custom Button</title>
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
			max-width: 800px;
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
			font-size: 20px;
			font-weight: 600;
			margin-bottom: 8px;
			color: var(--vscode-foreground);
			animation: slideUp 0.3s ease-out;
		}

		.subtitle {
			font-size: 13px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 24px;
			animation: slideUp 0.3s ease-out;
		}

		.form-group {
			margin-bottom: 20px;
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

		select,
		textarea {
			width: 100%;
			padding: 10px;
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			transition: border-color 0.15s ease;
		}

		select {
			cursor: pointer;
		}

		textarea {
			resize: vertical;
			min-height: 100px;
			font-family: var(--vscode-editor-font-family);
			line-height: 1.5;
		}

		textarea:focus,
		select:focus {
			outline: none;
			border-color: var(--vscode-focusBorder);
		}

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

		.hint {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			margin-top: 4px;
			line-height: 1.4;
		}

		.info-section {
			background-color: var(--vscode-textBlockQuote-background);
			border-left: 3px solid var(--vscode-textLink-foreground);
			padding: 16px;
			margin-bottom: 20px;
			border-radius: 2px;
			animation: slideUp 0.3s ease-out;
		}

		.info-section h3 {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 10px;
			color: var(--vscode-foreground);
		}

		.info-section p {
			font-size: 13px;
			line-height: 1.5;
			margin-bottom: 8px;
			color: var(--vscode-descriptionForeground);
		}

		.info-section p:last-child {
			margin-bottom: 0;
		}

		.examples-section {
			background-color: var(--vscode-editor-inactiveSelectionBackground);
			padding: 16px;
			margin-bottom: 20px;
			border-radius: 2px;
			animation: slideUp 0.3s ease-out;
		}

		.examples-section h3 {
			font-size: 14px;
			font-weight: 600;
			margin-bottom: 12px;
			color: var(--vscode-foreground);
		}

		.example {
			background-color: var(--vscode-editor-background);
			padding: 10px;
			margin-bottom: 10px;
			border-radius: 2px;
			border: 1px solid var(--vscode-input-border);
			cursor: pointer;
			transition: all 0.15s ease;
		}

		.example:hover {
			border-color: var(--vscode-focusBorder);
			background-color: var(--vscode-list-hoverBackground);
		}

		.example:last-child {
			margin-bottom: 0;
		}

		.example-title {
			font-weight: 500;
			font-size: 13px;
			margin-bottom: 4px;
			color: var(--vscode-foreground);
		}

		.example-text {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}

		.tips-section {
			background-color: var(--vscode-editorWidget-background);
			border: 1px solid var(--vscode-editorWidget-border);
			padding: 14px;
			margin-bottom: 20px;
			border-radius: 2px;
			animation: slideUp 0.3s ease-out;
		}

		.tips-section h4 {
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 8px;
			color: var(--vscode-foreground);
		}

		.tips-section ul {
			margin-left: 18px;
			color: var(--vscode-descriptionForeground);
		}

		.tips-section li {
			font-size: 12px;
			line-height: 1.6;
			margin-bottom: 4px;
		}

		.json-section {
			background-color: var(--vscode-editorWidget-background);
			border: 1px solid var(--vscode-editorWidget-border);
			padding: 14px;
			margin-bottom: 20px;
			border-radius: 2px;
			animation: slideUp 0.3s ease-out;
		}

		.json-section h4 {
			font-size: 13px;
			font-weight: 600;
			margin-bottom: 10px;
			color: var(--vscode-foreground);
		}

		.json-container {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 2px;
			overflow-x: auto;
			max-height: 350px;
			overflow-y: auto;
		}

		.json-container pre {
			margin: 0;
			padding: 14px;
			background: transparent;
		}

		.json-container code {
			font-family: var(--vscode-editor-font-family);
			font-size: 12px;
			line-height: 1.6;
			color: var(--vscode-editor-foreground);
			white-space: pre;
			display: block;
			background: transparent;
		}

		/* Remove any default highlighting/selection colors */
		.json-container code * {
			background: transparent !important;
		}

		/* JSON Syntax Highlighting */
		.json-key {
			color: var(--vscode-symbolIcon-keyForeground, #9CDCFE);
		}

		.json-string {
			color: var(--vscode-debugTokenExpression-string, #CE9178);
		}

		.json-emoji {
			font-size: 13px;
		}

		.json-punctuation {
			color: var(--vscode-editor-foreground);
		}

		.json-comment {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
			opacity: 0.8;
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

		.char-count {
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			text-align: right;
			margin-top: 4px;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🤖 Describe Your Custom Button</h1>
		<p class="subtitle">AI will generate a button based on your description</p>

		<div class="info-section">
			<h3>ℹ️ How It Works</h3>
			<p>Describe what you want your button to do in plain English. The AI will generate:</p>
			<p>• A descriptive name with an emoji</p>
			<p>• The appropriate command or script</p>
			<p>• Execution directory (where the command runs)</p>
			<p>• Input fields if user interaction is needed</p>
		</div>

		<form id="descriptionForm">
			<div class="form-group">
				<label for="scope">Scope<span class="required">*</span></label>
				<select id="scope">
					<option value="workspace" ${scopeLabel === 'Workspace' ? 'selected' : ''}>Workspace (This project only)</option>
					<option value="global" ${scopeLabel === 'Global' ? 'selected' : ''}>Global (All projects)</option>
				</select>
				<div class="hint">Workspace buttons are project-specific. Global buttons work everywhere.</div>
			</div>

			<div class="examples-section">
				<h3>📝 Example Descriptions</h3>
				<div class="example" data-text="Button to add all changes and commit code using git with a custom message">
					<div class="example-title">Git Commit</div>
					<div class="example-text">"Button to add all changes and commit code using git with a custom message"</div>
				</div>
				<div class="example" data-text="Create a button that runs npm install and then starts the development server">
					<div class="example-title">Install & Start Dev Server</div>
					<div class="example-text">"Create a button that runs npm install and then starts the development server"</div>
				</div>
				<div class="example" data-text="Button to run all tests and generate a coverage report">
					<div class="example-title">Test with Coverage</div>
					<div class="example-text">"Button to run all tests and generate a coverage report"</div>
				</div>
				<div class="example" data-text="Deploy to production environment with confirmation">
					<div class="example-title">Production Deployment</div>
					<div class="example-text">"Deploy to production environment with confirmation"</div>
				</div>
				<div class="example" data-text="Create a backup script that archives the current project with timestamp">
					<div class="example-title">Project Backup Script</div>
					<div class="example-text">"Create a backup script that archives the current project with timestamp"</div>
				</div>
			</div>

			<div class="form-group">
				<label for="description">Your Description<span class="required">*</span></label>
				<textarea 
					id="description" 
					placeholder="e.g., Button to add changes and commit code using git with a custom message"
					rows="4"
				></textarea>
				<div class="error-message" id="descriptionError"></div>
				<div class="char-count"><span id="charCount">0</span> characters</div>
			</div>

			<div class="tips-section">
				<h4>💡 Tips for Better Results</h4>
				<ul>
					<li><strong>Be specific:</strong> Mention the tools or commands you want to use (e.g., "using npm", "with git")</li>
					<li><strong>Mention inputs:</strong> If you need user input, describe it (e.g., "with a custom message", "ask for environment name")</li>
					<li><strong>Describe workflow:</strong> For complex tasks, explain the sequence (e.g., "first build, then deploy")</li>
					<li><strong>Specify scope:</strong> For workspace buttons, mention project-specific paths or files</li>
					<li><strong>For scripts:</strong> Use phrases like "create a script" for multi-step complex workflows</li>
				</ul>
			</div>

			<div class="json-section">
				<h4>📄 How Buttons Are Saved (JSON Format)</h4>
				<div class="json-container">
					<pre><code><span class="json-punctuation">[</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"<span class="json-emoji">📋</span> Export File List"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"&lt;workspace&gt;"</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"ls -la > files_list.txt"</span><span class="json-punctuation">,</span>
    <span class="json-key">"ai_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Exports detailed file listing to files_list.txt"</span>
  <span class="json-punctuation">},</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"<span class="json-emoji">🧹</span> Clear Terminal"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"."</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"clear"</span><span class="json-punctuation">,</span>
    <span class="json-key">"ai_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Clears the terminal screen"</span><span class="json-punctuation">,</span>
    <span class="json-key">"user_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Button to clear terminal"</span>
  <span class="json-punctuation">},</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"Create File"</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"touch {file}"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"."</span><span class="json-punctuation">,</span>
    <span class="json-key">"inputs"</span><span class="json-punctuation">:</span> <span class="json-punctuation">[</span>
      <span class="json-punctuation">{</span>
        <span class="json-key">"placeholder"</span><span class="json-punctuation">:</span> <span class="json-string">"Enter file name"</span><span class="json-punctuation">,</span>
        <span class="json-key">"variable"</span><span class="json-punctuation">:</span> <span class="json-string">"{file}"</span>
      <span class="json-punctuation">}</span>
    <span class="json-punctuation">]</span><span class="json-punctuation">,</span>
    <span class="json-key">"user_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Create a new file"</span>
  <span class="json-punctuation">},</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"<span class="json-emoji">🐛</span> Run Tests"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"&lt;workspace&gt;/tests"</span><span class="json-punctuation">,</span>
    <span class="json-key">"scriptFile"</span><span class="json-punctuation">:</span> <span class="json-string">"_run_tests.sh"</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"\"&lt;workspace&gt;/.vscode/scripts/_run_tests.sh\""</span><span class="json-punctuation">,</span>
    <span class="json-key">"ai_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Runs test suite using custom script"</span><span class="json-punctuation">,</span>
    <span class="json-key">"user_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Button to run tests with custom script"</span>
  <span class="json-punctuation">},</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"<span class="json-emoji">🚀</span> Deploy with Params"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"."</span><span class="json-punctuation">,</span>
    <span class="json-key">"scriptFile"</span><span class="json-punctuation">:</span> <span class="json-string">"_deploy.sh"</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"\"&lt;globalScripts&gt;/_deploy.sh\" {environment} {version}"</span><span class="json-punctuation">,</span>
    <span class="json-key">"inputs"</span><span class="json-punctuation">:</span> <span class="json-punctuation">[</span>
      <span class="json-punctuation">{</span>
        <span class="json-key">"placeholder"</span><span class="json-punctuation">:</span> <span class="json-string">"Environment (dev/staging/prod)"</span><span class="json-punctuation">,</span>
        <span class="json-key">"variable"</span><span class="json-punctuation">:</span> <span class="json-string">"{environment}"</span>
      <span class="json-punctuation">}</span><span class="json-punctuation">,</span>
      <span class="json-punctuation">{</span>
        <span class="json-key">"placeholder"</span><span class="json-punctuation">:</span> <span class="json-string">"Version number"</span><span class="json-punctuation">,</span>
        <span class="json-key">"variable"</span><span class="json-punctuation">:</span> <span class="json-string">"{version}"</span>
      <span class="json-punctuation">}</span>
    <span class="json-punctuation">]</span><span class="json-punctuation">,</span>
    <span class="json-key">"ai_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Deploys application to specified environment"</span><span class="json-punctuation">,</span>
    <span class="json-key">"user_description"</span><span class="json-punctuation">:</span> <span class="json-string">"Deploy with environment and version inputs"</span>
  <span class="json-punctuation">}</span>
<span class="json-punctuation">]</span></code></pre>
				</div>
			</div>

			<div class="button-group">
				<button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
				<button type="submit" class="btn-primary" id="submitBtn" disabled>Generate Button with AI</button>
			</div>
		</form>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		const scopeSelect = document.getElementById('scope');
		const descriptionTextarea = document.getElementById('description');
		const submitBtn = document.getElementById('submitBtn');
		const cancelBtn = document.getElementById('cancelBtn');
		const descriptionError = document.getElementById('descriptionError');
		const charCount = document.getElementById('charCount');
		const examples = document.querySelectorAll('.example');

		// Handle example clicks
		examples.forEach(example => {
			example.addEventListener('click', () => {
				const text = example.getAttribute('data-text');
				descriptionTextarea.value = text;
				descriptionTextarea.focus();
				validateDescription();
				updateCharCount();
			});
		});

		// Update character count
		function updateCharCount() {
			const count = descriptionTextarea.value.length;
			charCount.textContent = count;
		}

		// Validate description
		function validateDescription() {
			const value = descriptionTextarea.value.trim();
			
			if (!value) {
				descriptionError.textContent = 'Please describe what you want your button to do';
				descriptionTextarea.classList.add('error');
				submitBtn.disabled = true;
				return false;
			}
			
			if (value.length < 10) {
				descriptionError.textContent = 'Description is too short. Please be more specific (at least 10 characters)';
				descriptionTextarea.classList.add('error');
				submitBtn.disabled = true;
				return false;
			}

			if (value.length > 500) {
				descriptionError.textContent = 'Description is too long (max 500 characters)';
				descriptionTextarea.classList.add('error');
				submitBtn.disabled = true;
				return false;
			}
			
			descriptionError.textContent = '';
			descriptionTextarea.classList.remove('error');
			submitBtn.disabled = false;
			return true;
		}

		// Event listeners
		descriptionTextarea.addEventListener('input', () => {
			validateDescription();
			updateCharCount();
		});

		cancelBtn.addEventListener('click', () => {
			vscode.postMessage({ command: 'cancel' });
		});

		document.getElementById('descriptionForm').addEventListener('submit', (e) => {
			e.preventDefault();
			
			if (!validateDescription()) {
				return;
			}

			vscode.postMessage({
				command: 'submit',
				data: {
					description: descriptionTextarea.value.trim(),
					scope: scopeSelect.value
				}
			});
		});

		// Initial setup
		updateCharCount();
		descriptionTextarea.focus();
	</script>
</body>
</html>`;
	}
}
