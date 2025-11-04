// Webview Utilities - Common webview creation and message handling patterns
import * as vscode from 'vscode';

export interface WebviewOptions {
	title: string;
	viewType: string;
	enableScripts?: boolean;
	retainContextWhenHidden?: boolean;
	column?: vscode.ViewColumn;
}

export interface WebviewMessage {
	command: string;
	[key: string]: any;
}

/**
 * Create a standardized webview panel
 */
export function createWebviewPanel(options: WebviewOptions): vscode.WebviewPanel {
	const panel = vscode.window.createWebviewPanel(
		options.viewType,
		options.title,
		options.column || vscode.ViewColumn.One,
		{
			enableScripts: options.enableScripts ?? true,
			retainContextWhenHidden: options.retainContextWhenHidden ?? true
		}
	);

	return panel;
}

/**
 * Setup common webview message handling patterns
 */
export function setupWebviewMessageHandler(
	panel: vscode.WebviewPanel,
	messageHandlers: { [command: string]: (message: WebviewMessage) => void | Promise<void> }
): vscode.Disposable {
	return panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
		const handler = messageHandlers[message.command];
		if (handler) {
			try {
				await handler(message);
			} catch (error) {
				console.error(`Error handling webview message '${message.command}':`, error);
				panel.webview.postMessage({
					command: 'showError',
					message: `Error processing ${message.command}. Please try again.`
				});
			}
		} else {
			console.warn(`Unknown webview command: ${message.command}`);
		}
	});
}

/**
 * Send a message to webview with error handling
 */
export function sendWebviewMessage(panel: vscode.WebviewPanel, message: WebviewMessage): void {
	try {
		panel.webview.postMessage(message);
	} catch (error) {
		console.error('Error sending webview message:', error);
	}
}

/**
 * Show loading state in webview
 */
export function showWebviewLoading(panel: vscode.WebviewPanel, message: string = 'Loading...'): void {
	sendWebviewMessage(panel, {
		command: 'showLoading',
		message
	});
}

/**
 * Show error state in webview
 */
export function showWebviewError(panel: vscode.WebviewPanel, message: string = 'An error occurred'): void {
	sendWebviewMessage(panel, {
		command: 'showError',
		message
	});
}

/**
 * Hide loading state in webview
 */
export function hideWebviewLoading(panel: vscode.WebviewPanel): void {
	sendWebviewMessage(panel, {
		command: 'hideLoading'
	});
}

/**
 * Get common webview CSS styles
 */
export function getCommonWebviewStyles(): string {
	return `
		body {
			font-family: var(--vscode-font-family);
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 20px;
			margin: 0;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
		}
		.section {
			margin-bottom: 30px;
			padding: 20px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 8px;
			background-color: var(--vscode-panel-background);
		}
		.section h2 {
			margin-top: 0;
			color: var(--vscode-textPreformat-foreground);
		}
		button {
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 8px 16px;
			border-radius: 4px;
			cursor: pointer;
			margin-right: 8px;
			margin-bottom: 8px;
		}
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		button.secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		button.secondary:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		textarea, input {
			width: 100%;
			box-sizing: border-box;
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			border-radius: 4px;
			padding: 8px;
			margin-bottom: 10px;
			font-family: var(--vscode-font-family);
		}
		textarea {
			min-height: 100px;
			resize: vertical;
		}
		.loading {
			text-align: center;
			padding: 20px;
			color: var(--vscode-foreground);
		}
		.error {
			color: var(--vscode-errorForeground);
			background-color: var(--vscode-inputValidation-errorBackground);
			border: 1px solid var(--vscode-inputValidation-errorBorder);
			padding: 10px;
			border-radius: 4px;
			margin: 10px 0;
		}
		.success {
			color: var(--vscode-terminal-ansiGreen);
			background-color: var(--vscode-inputValidation-infoBackground);
			border: 1px solid var(--vscode-inputValidation-infoBorder);
			padding: 10px;
			border-radius: 4px;
			margin: 10px 0;
		}
	`;
}

/**
 * Create a promise that resolves when webview is disposed or a specific message is received
 */
export function createWebviewPromise<T>(
	panel: vscode.WebviewPanel,
	resolveCommands: string[],
	timeout?: number
): Promise<T | null> {
	return new Promise((resolve) => {
		let isResolved = false;

		const messageDisposable = panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
			if (!isResolved && resolveCommands.includes(message.command)) {
				isResolved = true;
				messageDisposable.dispose();
				resolve(message as T);
			}
		});

		const disposeDisposable = panel.onDidDispose(() => {
			if (!isResolved) {
				isResolved = true;
				messageDisposable.dispose();
				resolve(null);
			}
		});

		// Optional timeout
		if (timeout) {
			setTimeout(() => {
				if (!isResolved) {
					isResolved = true;
					messageDisposable.dispose();
					disposeDisposable.dispose();
					resolve(null);
				}
			}, timeout);
		}
	});
}