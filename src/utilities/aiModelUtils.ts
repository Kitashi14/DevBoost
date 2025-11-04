// AI Model Utilities - Common AI model selection and request handling
import * as vscode from 'vscode';

/**
 * Get available GitHub Copilot models
 */
export async function getCopilotModels(family: string = 'gpt-4o'): Promise<vscode.LanguageModelChat[]> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family });
		return models;
	} catch (error) {
		console.error('Error getting Copilot models:', error);
		return [];
	}
}

/**
 * Get the first available Copilot model
 */
export async function getFirstCopilotModel(family: string = 'gpt-4o'): Promise<vscode.LanguageModelChat | null> {
	const models = await getCopilotModels(family);
	return models.length > 0 ? models[0] : null;
}

/**
 * Send a request to the AI model with proper error handling
 */
export async function sendAIRequest(
	model: vscode.LanguageModelChat,
	messages: vscode.LanguageModelChatMessage[],
	options: object = {},
	cancellationToken?: vscode.CancellationToken
): Promise<string> {
	try {
		const token = cancellationToken || new vscode.CancellationTokenSource().token;
		const response = await model.sendRequest(messages, options, token);

		let result = '';
		for await (const part of response.text) {
			result += part;
		}

		return result.trim();
	} catch (error) {
		console.error('Error sending AI request:', error);
		throw error;
	}
}

/**
 * Create a user message for AI requests
 */
export function createUserMessage(content: string): vscode.LanguageModelChatMessage {
	return vscode.LanguageModelChatMessage.User(content);
}

/**
 * Create a system message for AI requests (if supported)
 */
export function createSystemMessage(content: string): vscode.LanguageModelChatMessage {
	// Note: System messages may not be supported by all models
	return vscode.LanguageModelChatMessage.User(content);
}

/**
 * Check if AI models are available
 */
export async function areAIModelsAvailable(): Promise<boolean> {
	const models = await getCopilotModels();
	return models.length > 0;
}