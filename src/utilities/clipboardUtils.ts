// Clipboard Utilities - Common clipboard operations
import * as vscode from 'vscode';

/**
 * Copy text to clipboard with user feedback
 */
export async function copyToClipboard(text: string, showMessage: boolean = true): Promise<void> {
	try {
		await vscode.env.clipboard.writeText(text);
		if (showMessage) {
			vscode.window.showInformationMessage('Copied to clipboard!');
		}
	} catch (error) {
		console.error('Error copying to clipboard:', error);
		vscode.window.showErrorMessage('Failed to copy to clipboard.');
	}
}

/**
 * Read text from clipboard
 */
export async function readFromClipboard(): Promise<string> {
	try {
		return await vscode.env.clipboard.readText();
	} catch (error) {
		console.error('Error reading from clipboard:', error);
		return '';
	}
}

/**
 * Copy text to clipboard and show preview in notification
 */
export async function copyWithPreview(
	text: string, 
	previewLength: number = 100,
	title: string = 'Copied to clipboard!'
): Promise<void> {
	try {
		await vscode.env.clipboard.writeText(text);
		
		const preview = text.length > previewLength 
			? text.substring(0, previewLength) + '...' 
			: text;
		
		const action = await vscode.window.showInformationMessage(
			`${title}\n\nPreview: "${preview}"`,
			'Show Full Content'
		);
		
		if (action === 'Show Full Content') {
			// Open a simple text document with the full content
			const doc = await vscode.workspace.openTextDocument({
				content: text,
				language: 'plaintext'
			});
			await vscode.window.showTextDocument(doc);
		}
	} catch (error) {
		console.error('Error copying to clipboard:', error);
		vscode.window.showErrorMessage('Failed to copy to clipboard.');
	}
}

/**
 * Check if clipboard has content
 */
export async function isClipboardEmpty(): Promise<boolean> {
	try {
		const content = await vscode.env.clipboard.readText();
		return !content || content.trim().length === 0;
	} catch (error) {
		console.error('Error checking clipboard:', error);
		return true;
	}
}

/**
 * Show clipboard content in a new document
 */
export async function showClipboardInDocument(): Promise<void> {
	try {
		const content = await vscode.env.clipboard.readText();
		
		if (!content || content.trim().length === 0) {
			vscode.window.showInformationMessage('Clipboard is empty.');
			return;
		}

		const doc = await vscode.workspace.openTextDocument({
			content: content,
			language: 'plaintext'
		});
		await vscode.window.showTextDocument(doc);
	} catch (error) {
		console.error('Error showing clipboard content:', error);
		vscode.window.showErrorMessage('Failed to show clipboard content.');
	}
}