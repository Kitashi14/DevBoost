// Prompt Enhancer Module - Enhanced prompt optimization system
import * as vscode from 'vscode';
import * as handlers from './handlers';
import * as configManager from '../configManager';

/**
 * Register all prompt enhancer commands
 */
export function registerPromptEnhancerCommands(context: vscode.ExtensionContext, globalStoragePath: string): void {
	// Main prompt enhancer command
	const showPromptEnhancerCmd = vscode.commands.registerCommand(
		'devboost.showPromptEnhancer',
		async () => {
			await handlers.showPromptEnhancer(globalStoragePath);
		}
	);

	// Quick enhance command - minimalistic one-click enhancement
	const quickEnhanceCmd = vscode.commands.registerCommand(
		'devboost.quickEnhance',
		async () => {
			await handlers.quickEnhanceFromClipboard(globalStoragePath);
		}
	);

	// Command to enhance a prompt from external input (used by smartCmd integration)
	const enhancePromptFromInputCmd = vscode.commands.registerCommand(
		'devboost.enhancePromptFromInput',
		async (originalPrompt: string) => {
			return await handlers.enhancePromptFromInput(originalPrompt, globalStoragePath);
		}
	);

	// Change AI model command for Prompt Enhancer
	const changePromptEnhancerAIModelCmd = vscode.commands.registerCommand(
		'devboost.changePromptEnhancerAIModel',
		async () => {
			await configManager.changeAIModel('promptEnhancer', globalStoragePath);
		}
	);

	// Add commands to subscriptions
	context.subscriptions.push(showPromptEnhancerCmd);
	context.subscriptions.push(quickEnhanceCmd);
	context.subscriptions.push(enhancePromptFromInputCmd);
	context.subscriptions.push(changePromptEnhancerAIModelCmd);

	console.log('DevBoost: Prompt Enhancer commands registered successfully');
}