// Prompt Enhancer AI Services - Handles AI interactions for prompt enhancement
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logPromptToFile } from '../utilities/aiLogger';
import { getFirstCopilotModel, sendAIRequest, createUserMessage } from '../utilities/aiModelUtils';

export interface EnhancementSuggestion {
	type: 'clarity' | 'specificity' | 'context' | 'structure' | 'examples';
	suggestion: string;
	priority: 'high' | 'medium' | 'low';
	preview?: string;
}

/**
 * Get AI-powered suggestions for improving a prompt
 */
export async function getPromptEnhancementSuggestions(prompt: string): Promise<EnhancementSuggestion[]> {
	try {
		const model = await getFirstCopilotModel('gpt-4o');
		
		if (!model) {
			vscode.window.showInformationMessage('GitHub Copilot not available for prompt enhancement.');
			return [];
		}
		
		const enhancementPrompt = `Analyze this prompt and suggest specific improvements:

PROMPT TO ANALYZE:
"${prompt}"

Provide 3-5 actionable suggestions to improve this prompt. Focus on:
1. Clarity - making the request clearer
2. Specificity - adding specific details or constraints
3. Context - providing better background information
4. Structure - organizing the request better
5. Examples - adding helpful examples

For each suggestion, provide:
- Type (clarity/specificity/context/structure/examples)
- The specific suggestion
- Priority (high/medium/low)
- A brief preview of how it would improve the prompt

RESPOND WITH JSON ARRAY ONLY:
[
  {
    "type": "clarity",
    "suggestion": "Specific suggestion text",
    "priority": "high",
    "preview": "Brief preview of improvement"
  }
]`;

		const messages = [createUserMessage(enhancementPrompt)];
		const fullResponse = await sendAIRequest(model, messages);

		try {
			// Clean up the response to extract JSON
			let cleanedResponse = fullResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
			const firstBracket = cleanedResponse.indexOf('[');
			const lastBracket = cleanedResponse.lastIndexOf(']');
			
			if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
				const jsonString = cleanedResponse.substring(firstBracket, lastBracket + 1);
				const suggestions = JSON.parse(jsonString) as EnhancementSuggestion[];
				const filteredSuggestions = suggestions.filter(s => s.type && s.suggestion && s.priority);
				
				// Log the AI interaction
				await logPromptToFile('getPromptEnhancementSuggestions', enhancementPrompt, fullResponse, {
					originalPrompt: prompt,
					suggestionsCount: filteredSuggestions.length,
					rawResponseLength: fullResponse.length
				}, 'ai_prompts_enhancer.log');
				
				return filteredSuggestions;
			}
		} catch (parseError) {
			console.error('Error parsing enhancement suggestions:', parseError);
			
			// Log the failed AI interaction
			await logPromptToFile('getPromptEnhancementSuggestions', enhancementPrompt, fullResponse, {
				originalPrompt: prompt,
				error: 'Parse error',
				parseError: parseError instanceof Error ? parseError.message : String(parseError)
			});
		}

		return [];
	} catch (error) {
		console.error('Error getting prompt enhancement suggestions:', error);
		return [];
	}
}

/**
 * Apply suggested enhancements to create an improved prompt
 */
export async function applyEnhancements(
	originalPrompt: string, 
	selectedSuggestions: EnhancementSuggestion[]
): Promise<string> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			return originalPrompt;
		}

		const model = models[0];
		
		const enhancementDetails = selectedSuggestions.map(s => 
			`- ${s.type.toUpperCase()}: ${s.suggestion}`
		).join('\n');

		const applyPrompt = `Take this original prompt and apply the specified enhancements:

ORIGINAL PROMPT:
"${originalPrompt}"

ENHANCEMENTS TO APPLY:
${enhancementDetails}

Create an improved version of the prompt that incorporates these enhancements while maintaining the original intent. Make the improvements natural and well-integrated.

RESPOND WITH ONLY THE ENHANCED PROMPT - NO ADDITIONAL TEXT:`;

		const messages = [vscode.LanguageModelChatMessage.User(applyPrompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let enhancedPrompt = '';
		for await (const part of response.text) {
			enhancedPrompt += part;
		}

		const finalResult = enhancedPrompt.trim() || originalPrompt;
		
		// Log the AI interaction
		await logPromptToFile('applyEnhancements', applyPrompt, enhancedPrompt, {
			originalPrompt,
			selectedSuggestions,
			enhancementDetails,
			enhancedPromptLength: finalResult.length,
			wasEnhanced: finalResult !== originalPrompt
		});

		return finalResult;
	} catch (error) {
		console.error('Error applying enhancements:', error);
		
		// Log the failed AI interaction
		await logPromptToFile('applyEnhancements', 'N/A - Error occurred', 'N/A - Error occurred', {
			originalPrompt,
			selectedSuggestions,
			error: error instanceof Error ? error.message : String(error),
			fallbackToOriginal: true
		});
		
		return originalPrompt;
	}
}

/**
 * Generate a completely new prompt based on user intent
 */
export async function generatePromptFromIntent(intent: string, domain?: string): Promise<string> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			vscode.window.showInformationMessage('GitHub Copilot not available for prompt generation.');
			return intent;
		}

		const model = models[0];
		
		const domainContext = domain ? `\nDOMAIN CONTEXT: ${domain}` : '';
		
		const generationPrompt = `Create a well-structured, effective prompt based on this user intent:

USER INTENT: "${intent}"${domainContext}

Create a clear, specific, and actionable prompt that will get the best results from an AI assistant. Include:
- Clear objective
- Specific requirements
- Necessary context
- Expected output format
- Any relevant constraints

RESPOND WITH ONLY THE GENERATED PROMPT - NO ADDITIONAL TEXT:`;

		const messages = [vscode.LanguageModelChatMessage.User(generationPrompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let generatedPrompt = '';
		for await (const part of response.text) {
			generatedPrompt += part;
		}

		const finalResult = generatedPrompt.trim() || intent;
		
		// Log the AI interaction
		await logPromptToFile('generatePromptFromIntent', generationPrompt, generatedPrompt, {
			userIntent: intent,
			domain,
			domainContext,
			generatedPromptLength: finalResult.length,
			wasGenerated: finalResult !== intent
		});

		return finalResult;
	} catch (error) {
		console.error('Error generating prompt from intent:', error);
		
		// Log the failed AI interaction
		await logPromptToFile('generatePromptFromIntent', 'N/A - Error occurred', 'N/A - Error occurred', {
			userIntent: intent,
			domain,
			error: error instanceof Error ? error.message : String(error),
			fallbackToIntent: true
		});
		
		return intent;
	}
}

/**
 * Quick enhance prompt - minimalistic one-step enhancement
 */
export async function quickEnhancePrompt(originalPrompt: string): Promise<string | null> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			return null;
		}

		const model = models[0];
		
		const quickEnhancePrompt = `Quickly improve this prompt to make it clearer, more specific, and more effective. 
Keep the original intent but enhance clarity, add helpful context, and improve structure.

ORIGINAL PROMPT:
"${originalPrompt}"

RULES:
- Keep the same core request
- Make it more specific and actionable
- Add relevant context if needed
- Improve clarity and structure
- Don't change the fundamental ask
- Be concise but comprehensive

RESPOND WITH ONLY THE ENHANCED PROMPT - NO EXPLANATION:`;

		const messages = [vscode.LanguageModelChatMessage.User(quickEnhancePrompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let enhancedPrompt = '';
		for await (const part of response.text) {
			enhancedPrompt += part;
		}

		const finalResult = enhancedPrompt.trim() || originalPrompt;
		
		// Log the AI interaction
		await logPromptToFile('quickEnhancePrompt', quickEnhancePrompt, enhancedPrompt, {
			originalPrompt,
			enhancedPromptLength: finalResult.length,
			wasEnhanced: finalResult !== originalPrompt
		});

		return finalResult;
	} catch (error) {
		console.error('Error in quick enhance:', error);
		
		// Log the failed AI interaction
		await logPromptToFile('quickEnhancePrompt', 'N/A - Error occurred', 'N/A - Error occurred', {
			originalPrompt,
			error: error instanceof Error ? error.message : String(error),
			returnedNull: true
		});
		
		return null;
	}
}