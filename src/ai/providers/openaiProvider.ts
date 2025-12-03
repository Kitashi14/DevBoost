// OpenAI Provider
import { BaseAIProvider } from '../aiProvider';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from '../types';

/**
 * OpenAI API provider
 */
export class OpenAIProvider extends BaseAIProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI';
    readonly requiresApiKey = true;

    private endpoint = 'https://api.openai.com/v1';
    private defaultModel = 'gpt-4o';

    async isAvailable(): Promise<ProviderAvailability> {
        // Check if API key is available
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            return {
                available: false,
                reason: 'OpenAI API key not configured'
            };
        }

        return { available: true };
    }

    async listModels(): Promise<AIModel[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            return [];
        }

        try {
            const response = await fetch(`${this.endpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            if (!response.ok) {
                return [];
            }

            const data = await response.json() as { data: Array<{ id: string }> };

            // Filter for chat models (gpt-*)
            return data.data
                .filter(m => m.id.startsWith('gpt-'))
                .map(m => ({
                    id: m.id,
                    name: m.id,
                    family: m.id.split('-')[0],
                    vendor: 'openai'
                }))
                .sort((a, b) => b.id.localeCompare(a.id)); // Newest first
        } catch (error) {
            console.error('Error listing OpenAI models:', error);
            return [];
        }
    }

    async getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null> {
        // Use GPT-4o for both tasks (it's the best current model)
        return {
            id: 'gpt-4o',
            name: 'GPT-4o',
            family: 'gpt-4o',
            vendor: 'openai'
        };
    }

    async sendRequest(request: AIRequest): Promise<AIResponse> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const response = await fetch(`${this.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: request.modelId || this.defaultModel,
                    messages: [
                        {
                            role: 'user',
                            content: request.prompt
                        }
                    ],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const error = await response.json() as { error?: { message?: string } };
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json() as { choices: Array<{ message: { content: string } }>; model: string };

            return {
                text: data.choices[0].message.content.trim(),
                model: data.model
            };
        } catch (error) {
            throw new Error(`OpenAI error: ${error}`);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                return false;
            }

            // Test with a simple request
            const response = await fetch(`${this.endpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            console.log('Testing OpenAI connection, response status:', response, response.status, response.ok);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}
