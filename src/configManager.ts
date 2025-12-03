// Configuration Manager Module - Handles DevBoost settings
// Now acts as a wrapper around the AIProviderManager
import * as vscode from 'vscode';
import { getAIProviderManager } from './extension';
import { AIModule, AIRequest, AIResponse } from './ai/types';

/**
 * Send an AI request using the configured provider
 * @param module The module making the request
 * @param prompt The prompt to send
 * @param systemPrompt Optional system prompt
 */
export async function sendAIRequest(
	module: AIModule,
	prompt: string,
	systemPrompt?: string
): Promise<AIResponse> {
	const manager = getAIProviderManager();
	if (!manager) {
		throw new Error('AI Provider Manager not initialized');
	}

	const request: AIRequest = {
		prompt,
		systemPrompt
	};

	try {
		return await manager.sendRequest(module, request);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`DevBoost AI Error (${module}): ${errorMessage}`);
		throw error; // Re-throw so caller can handle it too if needed
	}
}

/**
 * Configure the AI provider for a module
 * @param module The module to configure
 */
export async function configureAI(module: AIModule): Promise<void> {
	const manager = getAIProviderManager();
	if (!manager) {
		throw new Error('AI Provider Manager not initialized');
	}

	try {
		await manager.configureProvider(module);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		vscode.window.showErrorMessage(`DevBoost Configuration Error: ${errorMessage}`);
	}
}

