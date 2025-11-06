// Custom Dialog Module - Scrollable webview-based dialogs to replace modal showInformationMessage
import * as vscode from 'vscode';

export interface DialogButton {
	label: string;
	id: string;
	isPrimary?: boolean;
}

export interface DialogOptions {
	title: string;
	message: string;
	buttons: DialogButton[];
	markdown?: boolean; // Enable markdown rendering
}

export class CustomDialog {
	private static currentPanel: vscode.WebviewPanel | undefined;

	/**
	 * Show a custom scrollable dialog
	 * @param options Dialog configuration
	 * @returns Promise that resolves to the button ID clicked, or undefined if closed
	 */
	public static async show(options: DialogOptions): Promise<string | undefined> {
		return new Promise((resolve) => {
			// Close any existing panel
			if (CustomDialog.currentPanel) {
				CustomDialog.currentPanel.dispose();
			}

			// Create webview panel
			CustomDialog.currentPanel = vscode.window.createWebviewPanel(
				'customDialog',
				options.title,
				{ viewColumn: vscode.ViewColumn.Two, preserveFocus: false },
				{
					enableScripts: true,
					retainContextWhenHidden: false
				}
			);

			// Set HTML content
			CustomDialog.currentPanel.webview.html = CustomDialog.getHtmlContent(options);

			// Handle messages from webview
			CustomDialog.currentPanel.webview.onDidReceiveMessage(
				(message) => {
					if (message.command === 'buttonClicked') {
						// Small delay to allow animation to complete before disposing
						setTimeout(() => {
                            resolve(message.buttonId);
							CustomDialog.currentPanel?.dispose();
							CustomDialog.currentPanel = undefined;
						}, 150);
					}
				},
				undefined,
				[]
			);

			// Handle panel disposal
			CustomDialog.currentPanel.onDidDispose(
				() => {
					CustomDialog.currentPanel = undefined;
					resolve(undefined);
				},
				undefined,
				[]
			);
		});
	}

	/**
	 * Generate HTML content for the dialog
	 */
	private static getHtmlContent(options: DialogOptions): string {
		// Process message for display
		let messageContent: string;
		if (options.markdown) {
			// Convert markdown-style formatting to HTML
			messageContent = options.message
				.replace(/\n/g, '<br>')
				.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
				.replace(/\*(.*?)\*/g, '<em>$1</em>')
				.replace(/`(.*?)`/g, '<code>$1</code>');
		} else {
			// Preserve whitespace and line breaks
			messageContent = options.message
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/\n/g, '<br>');
		}

		// Generate button HTML
		const buttonsHtml = options.buttons.map(btn => {
			const className = btn.isPrimary ? 'button primary' : 'button';
			return `<button class="${className}" onclick="handleButtonClick('${btn.id}')">${btn.label}</button>`;
		}).join('');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${options.title}</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
			padding: 20px;
			line-height: 1.6;
			animation: fadeIn 0.2s ease-out;
		}

		@keyframes fadeIn {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}

		@keyframes slideUp {
			from {
				transform: translateY(20px);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}

		@keyframes fadeOut {
			from {
				opacity: 1;
			}
			to {
				opacity: 0;
			}
		}

		body.closing {
			animation: fadeOut 0.15s ease-in forwards;
		}

		.dialog-container {
			max-width: 800px;
			margin: 0 auto;
			animation: slideUp 0.3s ease-out;
		}

		.dialog-container.closing {
			animation: fadeOut 0.15s ease-in forwards;
		}

		.dialog-title {
			font-size: 1.3em;
			font-weight: 600;
			margin-bottom: 20px;
			color: var(--vscode-foreground);
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 10px;
		}

		.dialog-message {
			margin-bottom: 24px;
			white-space: pre-wrap;
			overflow-wrap: break-word;
			max-height: calc(100vh - 200px);
			overflow-y: auto;
			padding: 12px;
			background-color: var(--vscode-editor-background);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
		}

		.dialog-message code {
			background-color: var(--vscode-textCodeBlock-background);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
			font-size: 0.9em;
		}

		.dialog-message strong {
			font-weight: 600;
			color: var(--vscode-textPreformat-foreground);
		}

		.dialog-buttons {
			display: flex;
			gap: 10px;
			justify-content: flex-end;
			flex-wrap: wrap;
		}

		.button {
			padding: 8px 16px;
			border: 1px solid var(--vscode-button-border);
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			cursor: pointer;
			border-radius: 2px;
			font-size: var(--vscode-font-size);
			font-family: var(--vscode-font-family);
			transition: all 0.15s ease;
			transform: scale(1);
		}

		.button:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
			transform: scale(1.02);
		}

		.button:active {
			transform: scale(0.98);
		}

		.button.primary {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		.button.primary:hover {
			background-color: var(--vscode-button-hoverBackground);
		}

		.button:focus {
			outline: 1px solid var(--vscode-focusBorder);
			outline-offset: 2px;
		}

		/* Scrollbar styling */
		.dialog-message::-webkit-scrollbar {
			width: 10px;
		}

		.dialog-message::-webkit-scrollbar-track {
			background: var(--vscode-scrollbarSlider-background);
		}

		.dialog-message::-webkit-scrollbar-thumb {
			background: var(--vscode-scrollbarSlider-hoverBackground);
			border-radius: 5px;
		}

		.dialog-message::-webkit-scrollbar-thumb:hover {
			background: var(--vscode-scrollbarSlider-activeBackground);
		}
	</style>
</head>
<body>
	<div class="dialog-container">
		<div class="dialog-title">${options.title}</div>
		<div class="dialog-message">${messageContent}</div>
		<div class="dialog-buttons">
			${buttonsHtml}
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function handleButtonClick(buttonId) {
			// Add closing animation
			document.body.classList.add('closing');
			document.querySelector('.dialog-container').classList.add('closing');
			
			// Wait for animation to complete before sending message
			setTimeout(() => {
				vscode.postMessage({
					command: 'buttonClicked',
					buttonId: buttonId
				});
			}, 150);
		}

		// Handle keyboard shortcuts
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				// Add closing animation
				document.body.classList.add('closing');
				document.querySelector('.dialog-container').classList.add('closing');
				
				// Wait for animation to complete before sending message
				setTimeout(() => {
					vscode.postMessage({
						command: 'buttonClicked',
						buttonId: undefined
					});
				}, 150);
			}
		});

		// Focus first primary button or first button
		window.addEventListener('load', () => {
			const primaryButton = document.querySelector('.button.primary');
			if (primaryButton) {
				primaryButton.focus();
			} else {
				const firstButton = document.querySelector('.button');
				if (firstButton) {
					firstButton.focus();
				}
			}
		});
	</script>
</body>
</html>`;
	}

	/**
	 * Helper method: Show information dialog (similar to showInformationMessage)
	 */
	public static async showInfo(
		message: string,
		...buttons: string[]
	): Promise<string | undefined> {
		const dialogButtons: DialogButton[] = buttons.map((label, index) => ({
			label,
			id: label,
			isPrimary: index === 0
		}));

		return await CustomDialog.show({
			title: 'Information',
			message,
			buttons: dialogButtons,
			markdown: false
		});
	}

	/**
	 * Helper method: Show warning dialog (similar to showWarningMessage)
	 */
	public static async showWarning(
		message: string,
		...buttons: string[]
	): Promise<string | undefined> {
		const dialogButtons: DialogButton[] = buttons.map((label, index) => ({
			label,
			id: label,
			isPrimary: index === 0
		}));

		return await CustomDialog.show({
			title: '⚠️ Warning',
			message,
			buttons: dialogButtons,
			markdown: false
		});
	}

	/**
	 * Helper method: Show error dialog (similar to showErrorMessage)
	 */
	public static async showError(
		message: string,
		...buttons: string[]
	): Promise<string | undefined> {
		const dialogButtons: DialogButton[] = buttons.map((label, index) => ({
			label,
			id: label,
			isPrimary: index === 0
		}));

		return await CustomDialog.show({
			title: '❌ Error',
			message,
			buttons: dialogButtons,
			markdown: false
		});
	}
}
