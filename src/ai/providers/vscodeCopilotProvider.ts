// VS Code Copilot Provider - Simplified version
import * as vscode from 'vscode';
import { BaseAIProvider } from '../aiProvider';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from '../types';

/**
 * Simplified VS Code Copilot provider
 */
export class VSCodeCopilotProvider extends BaseAIProvider {
    readonly id = 'vscode-copilot';
    readonly name = 'GitHub Copilot (recommended)';
    readonly requiresApiKey = false;

    private selectedModel?: vscode.LanguageModelChat;

    async isAvailable(): Promise<ProviderAvailability> {
        try {
            if (!vscode.lm) {
                return {
                    available: false,
                    reason: 'VS Code Language Model API not available (requires VS Code 1.105.0+)'
                };
            }

            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });

            if (models.length === 0) {
                return {
                    available: false,
                    reason: 'GitHub Copilot not available. Please ensure GitHub Copilot is enabled.'
                };
            }

            return { available: true };
        } catch (error) {
            return {
                available: false,
                reason: `Error: ${error}`
            };
        }
    }

    async listModels(): Promise<AIModel[]> {
        try {
            const copilotModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });

            return copilotModels.map(m => ({
                id: `${m.vendor}/${m.family}`,
                name: m.name || m.family,
                family: m.family,
                vendor: m.vendor
            }));
        } catch (error) {
            console.error('Error listing Copilot models:', error);
            return [];
        }
    }
    async getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null> {
        try {
            const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });

            if (allModels.length === 0) {
                return null;
            }

            // Determine recommended model based on task-specific needs
            let recommendedModel: vscode.LanguageModelChat;

            if (task === 'code') {
                // SmartCmd (task='code'): Generates commands/scripts, needs strong code understanding
                // Priority: best claude-sonnet > best gpt-4o > highest token model
                const claudeModels = allModels.filter(m => m.family.includes('claude-sonnet'));
                const gpt4oModels = allModels.filter(m => m.family.includes('gpt-4o') && !m.family.includes('mini'));

                if (claudeModels.length > 0) {
                    // Pick the latest claude-sonnet by version number in family name
                    // e.g., claude-sonnet-4.5 > claude-sonnet-4 > claude-sonnet-3.5
                    recommendedModel = claudeModels.reduce((best, current) => {
                        // Extract version from family name (e.g., "claude-sonnet-4.5" -> 4.5)
                        const bestVersion = parseFloat(best.family.split('-').pop() || '0');
                        const currentVersion = parseFloat(current.family.split('-').pop() || '0');
                        return currentVersion > bestVersion ? current : best;
                    });
                } else if (gpt4oModels.length > 0) {
                    // Pick the latest gpt-4o by version number
                    recommendedModel = gpt4oModels.reduce((best, current) => {
                        const bestVersion = parseFloat(best.family.split('-').pop() || '0');
                        const currentVersion = parseFloat(current.family.split('-').pop() || '0');
                        return currentVersion > bestVersion ? current : best;
                    });
                } else {
                    // Fallback: highest token model available
                    recommendedModel = allModels.reduce((best, current) =>
                        current.maxInputTokens > best.maxInputTokens ? current : best
                    );
                }
            } else {
                // Prompt Enhancer (task='text'): Optimizes natural language prompts
                // Priority: best gpt-4o > best claude-sonnet > highest token model
                const gpt4oModels = allModels.filter(m => m.family.includes('gpt-4o') && !m.family.includes('mini'));
                const claudeModels = allModels.filter(m => m.family.includes('claude-sonnet'));

                if (gpt4oModels.length > 0) {
                    // Pick the latest gpt-4o by version number
                    recommendedModel = gpt4oModels.reduce((best, current) => {
                        const bestVersion = parseFloat(best.family.split('-').pop() || '0');
                        const currentVersion = parseFloat(current.family.split('-').pop() || '0');
                        return currentVersion > bestVersion ? current : best;
                    });
                } else if (claudeModels.length > 0) {
                    // Pick the latest claude-sonnet by version number in family name
                    recommendedModel = claudeModels.reduce((best, current) => {
                        const bestVersion = parseFloat(best.family.split('-').pop() || '0');
                        const currentVersion = parseFloat(current.family.split('-').pop() || '0');
                        return currentVersion > bestVersion ? current : best;
                    });
                } else {
                    // Fallback: highest token model available
                    recommendedModel = allModels.reduce((best, current) =>
                        current.maxInputTokens > best.maxInputTokens ? current : best
                    );
                }
            }

            console.log(`DevBoost: Recommended model for ${task}:`, {
                family: recommendedModel.family,
                name: recommendedModel.name,
                maxTokens: recommendedModel.maxInputTokens
            });

            return {
                id: `${recommendedModel.vendor}/${recommendedModel.family}`,
                name: recommendedModel.name || recommendedModel.family,
                family: recommendedModel.family,
                vendor: recommendedModel.vendor
            };

        } catch (error) {
            console.error('Error getting Copilot model:', error);
            return null;
        }
    }

    async sendRequest(request: AIRequest): Promise<AIResponse> {
        try {
            // Get model if not already selected or if specific model requested
            if (request.modelId) {
                // If a specific model is requested, try to find it
                const [vendor, ...familyParts] = request.modelId.split('/');
                const family = familyParts.join('/');

                const models = await vscode.lm.selectChatModels({ vendor, family });
                if (models.length > 0) {
                    this.selectedModel = models[0];
                } else {
                    console.warn(`Requested model ${request.modelId} not found, falling back to default selection`);
                }
            }

            if (!this.selectedModel) {
                const recommendedModelInfo = await this.getRecommendedModel('code');
                if (recommendedModelInfo) {
                    const models = await vscode.lm.selectChatModels({
                        vendor: recommendedModelInfo.vendor,
                        family: recommendedModelInfo.family
                    });
                    if (models.length > 0) {
                        this.selectedModel = models[0];
                    }
                }

                if (!this.selectedModel) {
                    throw new Error('No Copilot model available');
                }
            }

            // Create message
            const messages = [vscode.LanguageModelChatMessage.User(request.prompt)];

            // Send request
            const response = await this.selectedModel.sendRequest(
                messages,
                {},
                new vscode.CancellationTokenSource().token
            );

            // Collect response
            let fullResponse = '';
            for await (const part of response.text) {
                fullResponse += part;
            }

            return {
                text: fullResponse.trim(),
                model: this.selectedModel.family
            };
        } catch (error) {
            if (error instanceof vscode.LanguageModelError) {
                throw new Error(`Copilot error: ${error.message}`);
            }
            throw error;
        }
    }

    async testConnection(): Promise<boolean> {
        const availability = await this.isAvailable();
        return availability.available;
    }
}
