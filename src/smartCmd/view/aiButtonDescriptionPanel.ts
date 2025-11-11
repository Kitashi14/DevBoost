import * as vscode from 'vscode';

export interface AIButtonDescriptionResult {
	description: string;
	scope: 'workspace' | 'global';
	panel: vscode.WebviewPanel;
}

export class AIButtonDescriptionPanel {
	/**
	 * Show a form to get AI button description from user
	 * @param defaultScope The default scope ('workspace' or 'global')
	 * @param globalStoragePath The global storage path for the extension
	 * @returns Promise resolving to description, scope and panel or null if cancelled
	 */
	public static async show(defaultScope: 'workspace' | 'global' = 'workspace', globalStoragePath?: string): Promise<AIButtonDescriptionResult | null> {
		return new Promise<AIButtonDescriptionResult | null>((resolve) => {
			const panel = vscode.window.createWebviewPanel(
				'aiButtonDescription',
				'Describe Your Custom Button',
				{ viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			panel.webview.html = this.getHtmlContent(panel.webview, defaultScope);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(
				async message => {
					if (message.command === 'submit') {
						const result: AIButtonDescriptionResult = {
							description: message.data.description,
							scope: message.data.scope as 'workspace' | 'global',
							panel: panel
						};
						
						resolve(result);
					} else if (message.command === 'cancel') {
						// Dispose panel with animation delay
						setTimeout(() => {
							panel.dispose();
							vscode.window.showInformationMessage('Button creation cancelled.');
						}, 50);
						
						resolve(null);
					} else if (message.command === 'enhancePrompt') {
						// Import the AI service function
						const { enhancePrompt } = await import('../aiServices.js');
						const enhanced = await enhancePrompt(message.data.originalPrompt, message.data.scope, globalStoragePath);

						if(!enhanced) {
							panel.webview.postMessage({
								command: 'enhanceError',
								error: 'Failed to enhance prompt. Please try again.'
							});
							return;
						}

						// Validate the response
						if (enhanced.length < 10) {
							panel.webview.postMessage({
								command: 'enhanceError',
								error: 'Enhanced prompt too short. Please try again.'
							});
							return;
						}

						// Don't allow responses that are too similar to original (AI didn't enhance)
						if (enhanced.toLowerCase() === message.data.originalPrompt.toLowerCase()) {
							panel.webview.postMessage({
								command: 'enhanceError',
								error: 'Enhanced prompt is identical to the original. Please try again with a different description.'
							});
							return;
						}
						
						panel.webview.postMessage({
							command: 'enhancedPrompt',
							enhancedPrompt: enhanced
						});
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
	 * Show loading state in the webview
	 */
	public static showLoading(panel: vscode.WebviewPanel) {
		panel.webview.postMessage({ command: 'showLoading' });
	}

	/**
	 * Show error in the webview
	 */
	public static showError(panel: vscode.WebviewPanel, errorMessage: string) {
		panel.webview.postMessage({ command: 'showError', error: errorMessage });
	}

	/**
	 * Close the panel
	 */
	public static close(panel: vscode.WebviewPanel) {
		setTimeout(() => {
			panel.dispose();
		}, 50);
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
			margin-top: 12px;
			margin-bottom: 12px;
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

		textarea:disabled {
		    opacity: 0.6;
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

		/* Textarea actions row */
		.textarea-actions {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-top: 6px;
		}

		.sparkle-btn {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			padding: 5px 12px;
			font-size: 13px;
			cursor: pointer;
			transition: all 0.15s ease;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.sparkle-btn:hover:not(:disabled) {
			background-color: var(--vscode-button-secondaryHoverBackground);
			transform: scale(1.02);
		}

		.sparkle-btn:active:not(:disabled) {
			transform: scale(0.98);
		}

		.sparkle-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			transform: none;
		}

		.sparkle-btn.enhancing {
			animation: pulse 1.5s ease-in-out infinite;
		}

		@keyframes pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.5; }
		}

		.sparkle-btn .icon {
			font-size: 14px;
		}

		.sparkle-btn .text {
			font-size: 12px;
			font-weight: 500;
		}

		/* Prompt History */
		.prompt-history {
			background-color: var(--vscode-editorWidget-background);
			border: 1px solid var(--vscode-editorWidget-border);
			border-radius: 4px;
			padding: 12px;
			margin-bottom: 12px;
			display: none;
			animation: slideUp 0.3s ease-out;
		}

		.prompt-history.show {
			display: block;
		}

		.prompt-history-header {
			font-size: 12px;
			font-weight: 600;
			color: var(--vscode-foreground);
			margin-bottom: 8px;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.prompt-history-items {
			max-height: 250px;
			overflow-y: auto;
		}

		.prompt-history-item {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 3px;
			padding: 8px;
			margin-bottom: 6px;
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			cursor: pointer;
			transition: all 0.15s ease;
			position: relative;
			padding-right: 30px;
		}

		.prompt-history-item:hover {
			border-color: var(--vscode-focusBorder);
			background-color: var(--vscode-list-hoverBackground);
			color: var(--vscode-foreground);
		}

		.prompt-history-item:last-child {
			margin-bottom: 0;
		}

		.prompt-history-item .restore-icon {
			position: absolute;
			right: 8px;
			top: 50%;
			transform: translateY(-50%);
			font-size: 14px;
			opacity: 0.6;
		}

		.prompt-history-item:hover .restore-icon {
			opacity: 1;
		}

		/* Loader Overlay */
		.loader-overlay {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0, 0, 0, 0.7);
			display: none;
			justify-content: center;
			align-items: center;
			z-index: 9999;
			animation: fadeIn 0.2s ease-in;
		}

		.loader-overlay.show {
			display: flex;
		}

		.loader-content {
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			padding: 32px 48px;
			text-align: center;
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
			animation: slideUp 0.3s ease-out;
		}

		.loader-spinner {
			width: 48px;
			height: 48px;
			border: 4px solid var(--vscode-input-border);
			border-top-color: var(--vscode-button-background);
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
			margin: 0 auto 16px;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.loader-text {
			font-size: 14px;
			color: var(--vscode-foreground);
			margin-bottom: 8px;
			font-weight: 500;
		}

		.loader-subtext {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
		}

		.error-overlay {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0, 0, 0, 0.7);
			display: none;
			justify-content: center;
			align-items: center;
			z-index: 9999;
			animation: fadeIn 0.2s ease-in;
		}

		.error-overlay.show {
			display: flex;
		}

		.error-content {
			background-color: var(--vscode-editor-background);
			border: 2px solid var(--vscode-errorForeground);
			border-radius: 4px;
			padding: 24px 32px;
			text-align: center;
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
			animation: slideUp 0.3s ease-out;
			max-width: 500px;
		}

		.error-icon {
			font-size: 48px;
			margin-bottom: 16px;
		}

		.error-title {
			font-size: 16px;
			color: var(--vscode-errorForeground);
			margin-bottom: 12px;
			font-weight: 600;
		}

		.error-message {
			font-size: 13px;
			color: var(--vscode-foreground);
			margin-bottom: 20px;
			line-height: 1.5;
		}

		.error-button {
			padding: 8px 20px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-family: var(--vscode-font-family);
			font-size: 13px;
		}

		.error-button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
	</style>
</head>
<body>
	<!-- Loader Overlay -->
	<div class="loader-overlay" id="loaderOverlay">
		<div class="loader-content">
			<div class="loader-spinner"></div>
			<div class="loader-text">Generating button with AI...</div>
			<div class="loader-subtext">This may take a few seconds</div>
		</div>
	</div>

	<!-- Error Overlay -->
	<div class="error-overlay" id="errorOverlay">
		<div class="error-content">
			<div class="error-icon">⚠️</div>
			<div class="error-title">Failed to Generate Button</div>
			<div class="error-message" id="errorMessage">An error occurred while generating the button.</div>
			<button class="error-button" id="errorCloseBtn">Close</button>
		</div>
	</div>

	<div class="container">
		<h1>🤖 Describe Your Custom Button</h1>
		<p class="subtitle">AI will generate a button based on your description</p>

		<div class="info-section">
			<h3>ℹ️ How It Works</h3>
			<p>Describe what you want your button to do in plain English. The AI will generate:</p>
			<p>• A descriptive name with an emoji</p>
			<p>• The appropriate command or shell/batch script</p>
			<p>• Execution directory (where the command runs)</p>
			<p>• Input fields if user interaction is needed</p>
		</div>

		<form id="descriptionForm">
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
				<label for="scope">Scope<span class="required">*</span></label>
				<select id="scope">
					<option value="workspace" ${scopeLabel === 'Workspace' ? 'selected' : ''}>Workspace (This project only)</option>
					<option value="global" ${scopeLabel === 'Global' ? 'selected' : ''}>Global (All projects)</option>
				</select>
				<div class="hint">Workspace buttons are project-specific. Global buttons work everywhere.</div>
			</div>
			<div class="form-group">
				<label for="description">Prompt (Your despcription)<span class="required">*</span></label>
				
				<!-- Prompt History Section -->
				<div class="prompt-history" id="promptHistory">
					<div class="prompt-history-header">
						<span>📜</span>
						<span>Previous Versions</span>
					</div>
					<div class="prompt-history-items" id="promptHistoryItems">
						<!-- Will be populated dynamically -->
					</div>
				</div>

				<textarea 
					id="description" 
					placeholder="e.g., Button to add changes and commit code using git with a custom message"
					rows="4"
				></textarea>
				
				<div class="textarea-actions">
					<button type="button" class="sparkle-btn" id="sparkleBtn" title="Enhance prompt with AI" disabled>
						<span class="icon">✨</span>
						<span class="text">Enhance</span>
					</button>
					<div class="char-count"><span id="charCount">0</span> characters</div>
				</div>
				
				<div class="error-message" id="descriptionError"></div>
			</div>
			<div class="button-group">
				<button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
				<button type="submit" class="btn-primary" id="submitBtn" disabled>Generate Button with AI</button>
			</div>

			<div class="tips-section">
				<h4>💡 Tips for Better Results</h4>
				<ul>
					<li><strong>Be specific:</strong> Mention the tools or commands you want to use (e.g., "using npm", "with git")</li>
					<li><strong>Mention inputs:</strong> If you need user input, describe it (e.g., "with a custom message", "ask for environment name")</li>
					<li><strong>Describe workflow:</strong> For complex tasks, explain the sequence (e.g., "first build, then deploy")</li>
					<li><strong>Specify scope:</strong> For workspace buttons, mention project-specific paths or files</li>
					<li><strong>For shell/batch scripts:</strong> Use phrases like "create a script" for multi-step complex workflows</li>
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
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Exports detailed file listing to files_list.txt"</span>
  <span class="json-punctuation">},</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"<span class="json-emoji">🧹</span> Clear Terminal"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"."</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"clear"</span><span class="json-punctuation">,</span>
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Clears the terminal screen"</span><span class="json-punctuation">,</span>
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Button to clear terminal"</span>
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
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Create a new file"</span>
  <span class="json-punctuation">},</span>
  <span class="json-punctuation">{</span>
    <span class="json-key">"name"</span><span class="json-punctuation">:</span> <span class="json-string">"<span class="json-emoji">🐛</span> Run Tests"</span><span class="json-punctuation">,</span>
    <span class="json-key">"execDir"</span><span class="json-punctuation">:</span> <span class="json-string">"&lt;workspace&gt;/tests"</span><span class="json-punctuation">,</span>
    <span class="json-key">"scriptFile"</span><span class="json-punctuation">:</span> <span class="json-string">"_run_tests.sh"</span><span class="json-punctuation">,</span>
    <span class="json-key">"cmd"</span><span class="json-punctuation">:</span> <span class="json-string">"\\"&lt;workspace&gt;/.vscode/devBoost/scripts/_run_tests.sh\\""</span><span class="json-punctuation">,</span>
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Runs test suite using custom script"</span><span class="json-punctuation">,</span>
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Button to run tests with custom script"</span>
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
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Deploys application to specified environment"</span><span class="json-punctuation">,</span>
    <span class="json-key">"description"</span><span class="json-punctuation">:</span> <span class="json-string">"Deploy with environment and version inputs"</span>
  <span class="json-punctuation">}</span>
<span class="json-punctuation">]</span></code></pre>
				</div>
			</div>
		</form>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		
		const scopeSelect = document.getElementById('scope');
		const descriptionTextarea = document.getElementById('description');
		const submitBtn = document.getElementById('submitBtn');
		const cancelBtn = document.getElementById('cancelBtn');
		const sparkleBtn = document.getElementById('sparkleBtn');
		const descriptionError = document.getElementById('descriptionError');
		const charCount = document.getElementById('charCount');
		const examples = document.querySelectorAll('.example');
		const loaderOverlay = document.getElementById('loaderOverlay');
		const errorOverlay = document.getElementById('errorOverlay');
		const errorMessage = document.getElementById('errorMessage');
		const errorCloseBtn = document.getElementById('errorCloseBtn');
		const promptHistory = document.getElementById('promptHistory');
		const promptHistoryItems = document.getElementById('promptHistoryItems');

		let promptHistoryStack = []; // Stack to store previous prompts
		let isEnhancing = false;

		// Restore saved state if available
		const vscodeState = vscode.getState();
		if (vscodeState) {
			if (vscodeState.description !== undefined) {
				descriptionTextarea.value = vscodeState.description;
				updateCharCount();
				validateDescription();
			}
			if (vscodeState.scope !== undefined) {
				scopeSelect.value = vscodeState.scope;
			}
			if (vscodeState.promptHistoryStack !== undefined) {
				promptHistoryStack = vscodeState.promptHistoryStack;
				updatePromptHistoryUI();
			}
		}

		// Save state whenever form values change
		function saveState() {
			vscode.setState({
				description: descriptionTextarea.value,
				scope: scopeSelect.value,
				promptHistoryStack: promptHistoryStack
			});
		}

		// Listen for messages from VS Code
		window.addEventListener('message', event => {
			const message = event.data;
			
			if (message.command === 'showLoading') {
				loaderOverlay.classList.add('show');
				submitBtn.disabled = true;
				cancelBtn.disabled = true;
			} else if (message.command === 'showError') {
				loaderOverlay.classList.remove('show');
				errorMessage.textContent = message.error || 'An error occurred while generating the button.';
				errorOverlay.classList.add('show');
				submitBtn.disabled = false;
				cancelBtn.disabled = false;
			} else if (message.command === 'enhancedPrompt') {
				// Store current prompt in history before replacing
				const currentPrompt = descriptionTextarea.value.trim();
				if (currentPrompt && !promptHistoryStack.includes(currentPrompt)) {
					promptHistoryStack.push(currentPrompt);
					if (promptHistoryStack.length > 5) {
						promptHistoryStack.shift(); // Keep only last 5
					}
				}

				// Replace with enhanced prompt
				descriptionTextarea.value = message.enhancedPrompt;
				validateDescription();
				updateCharCount();
				updatePromptHistoryUI();
				saveState();

				// Reset sparkle button
				isEnhancing = false;
				descriptionTextarea.disabled = false;
				sparkleBtn.classList.remove('enhancing');
				sparkleBtn.disabled = false;
				sparkleBtn.innerHTML = '<span class="icon">✨</span><span class="text">Enhance</span>';
			} else if (message.command === 'enhanceError') {
				// Show error message
				descriptionError.textContent = message.error || 'Failed to enhance prompt. Please try again.';
				descriptionTextarea.classList.add('error');
				
				// Reset sparkle button
				isEnhancing = false;
				descriptionTextarea.disabled = false;
				sparkleBtn.classList.remove('enhancing');
				sparkleBtn.disabled = false;
				sparkleBtn.innerHTML = '<span class="icon">✨</span><span class="text">Enhance</span>';
			}
		});

		// Handle error close button
		errorCloseBtn.addEventListener('click', () => {
			errorOverlay.classList.remove('show');
			// Close the webview panel
			vscode.postMessage({ command: 'cancel' });
		});

		// Update prompt history UI
		function updatePromptHistoryUI() {
			if (promptHistoryStack.length === 0) {
				promptHistory.classList.remove('show');
				return;
			}

			promptHistory.classList.add('show');
			promptHistoryItems.innerHTML = '';

			// Show in reverse order (most recent first)
			for (let i = promptHistoryStack.length - 1; i >= 0; i--) {
				const prompt = promptHistoryStack[i];
				const item = document.createElement('div');
				item.className = 'prompt-history-item';
				item.title = 'Click to restore this version';
				
				// Truncate if too long
				const displayText = prompt;
				item.innerHTML = displayText + '<span class="restore-icon">↻</span>';
				
				item.addEventListener('click', () => {
					descriptionTextarea.value = prompt;
					validateDescription();
					updateCharCount();
					descriptionTextarea.focus();
				});

				promptHistoryItems.appendChild(item);
			}
		}

		// Handle sparkle button click
		sparkleBtn.addEventListener('click', () => {
			if (isEnhancing) {
				return;
			}

			const currentPrompt = descriptionTextarea.value.trim();
			if (!currentPrompt || currentPrompt.length < 10) {
				descriptionError.textContent = 'Please enter a description first (at least 10 characters)';
				descriptionTextarea.classList.add('error');
				return;
			}

			// Set enhancing state
			isEnhancing = true;
			descriptionTextarea.disabled = true;
			sparkleBtn.classList.add('enhancing');
			sparkleBtn.disabled = true;
			sparkleBtn.innerHTML = '<span class="icon">✨</span><span class="text">Enhancing...</span>';

			// Send message to extension
			vscode.postMessage({
				command: 'enhancePrompt',
				data: {
					originalPrompt: currentPrompt,
					scope: scopeSelect.value
				}
			});
		});

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
				descriptionError.textContent = '';
				descriptionTextarea.classList.remove('error');
				submitBtn.disabled = true;
				sparkleBtn.disabled = true;
				return false;
			}
			
			if (value.length < 10) {
				descriptionError.textContent = 'Description is too short. Please be more specific (at least 10 characters)';
				descriptionTextarea.classList.add('error');
				submitBtn.disabled = true;
				sparkleBtn.disabled = true;
				return false;
			}

			if (value.length > 500) {
				descriptionError.textContent = 'Description is too long (max 500 characters)';
				descriptionTextarea.classList.add('error');
				submitBtn.disabled = true;
				sparkleBtn.disabled = value.length > 500;
				return false;
			}
			
			descriptionError.textContent = '';
			descriptionTextarea.classList.remove('error');
			submitBtn.disabled = false;
			sparkleBtn.disabled = isEnhancing;
			return true;
		}

		// Event listeners
		descriptionTextarea.addEventListener('input', () => {
			validateDescription();
			updateCharCount();
			saveState();
		});

		scopeSelect.addEventListener('change', saveState);

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
