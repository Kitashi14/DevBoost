// AI Logger Utility - Centralized prompt logging for development and debugging
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Enable prompt logging for development/debugging
const ENABLE_PROMPT_LOGGING = true;

/**
 * Log AI prompts to file for development/debugging purposes
 */
export async function logPromptToFile(
	functionName: string, 
	prompt: string, 
	response: string, 
	logFileName: string,
	metadata?: any,
): Promise<void> {
	if (!ENABLE_PROMPT_LOGGING) {
		return;
	}

	try {
		// Get workspace folder for log file
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		const logFilePath = path.join(workspaceFolder.uri.fsPath, '.vscode', logFileName);
		
		// Ensure directory exists
		await fs.mkdir(path.dirname(logFilePath), { recursive: true });

		const timestamp = new Date().toISOString();
		const logEntry = `
${'='.repeat(80)}
TIMESTAMP: ${timestamp}
FUNCTION: ${functionName}
METADATA: ${metadata ? JSON.stringify(metadata, null, 2) : 'N/A'}

${'='.repeat(80)}
PROMPT:
${prompt}

${'='.repeat(80)}
RESPONSE:
${response}
${'='.repeat(80)}
${'='.repeat(80)}

`;

		// Append to log file
		await fs.appendFile(logFilePath, logEntry, 'utf-8');
		console.log(`DevBoost: Logged AI prompt from ${functionName} to ${logFilePath}`);

	} catch (error) {
		console.error('DevBoost: Failed to log AI prompt:', error);
		// Don't throw error to avoid breaking the main functionality
	}
}

/**
 * Enable or disable prompt logging
 */
export function setPromptLoggingEnabled(enabled: boolean): void {
	// In a real implementation, this could update a configuration setting
	console.log(`DevBoost: Prompt logging ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get the current logging status
 */
export function isPromptLoggingEnabled(): boolean {
	return ENABLE_PROMPT_LOGGING;
}

/**
 * Log AI prompts specifically for SmartCmd module
 */
export async function logSmartCmdPrompt(
	functionName: string,
	prompt: string,
	response: string,
	metadata?: any
): Promise<void> {
	return logPromptToFile(functionName, prompt, response, 'ai_prompts_smartcmd.log', metadata);
}

/**
 * Log AI prompts specifically for PromptEnhancer module
 */
export async function logPromptEnhancerPrompt(
	functionName: string,
	prompt: string,
	response: string,
	metadata?: any
): Promise<void> {
	return logPromptToFile(functionName, prompt, response, 'ai_prompts_enhancer.log', metadata);
}