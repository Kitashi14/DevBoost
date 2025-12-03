// Anthropic Provider
import { BaseAIProvider } from '../aiProvider';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from '../types';

/**
 * Anthropic Claude API provider
 */
export class AnthropicProvider extends BaseAIProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic Claude';
    readonly requiresApiKey = true;

    private endpoint = 'https://api.anthropic.com/v1';
    private defaultModel = 'claude-3-5-sonnet-20241022';
    private apiVersion = '2023-06-01';

    async isAvailable(): Promise<ProviderAvailability> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            return {
                available: false,
                reason: 'Anthropic API key not configured'
            };
        }

        return { available: true };
    }

    async listModels(): Promise<AIModel[]> {
        // Anthropic doesn't have a simple public list models endpoint that returns all models
        // Returning a static list of known supported models
        return [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', family: 'claude-3-5-sonnet', vendor: 'anthropic' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', family: 'claude-3-opus', vendor: 'anthropic' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', family: 'claude-3-sonnet', vendor: 'anthropic' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', family: 'claude-3-haiku', vendor: 'anthropic' }
        ];
    }

    async getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null> {
        // Claude 3.5 Sonnet is excellent for both code and text
        return {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            family: 'claude-3-5-sonnet',
            vendor: 'anthropic'
        };
    }

    async sendRequest(request: AIRequest): Promise<AIResponse> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            throw new Error('Anthropic API key not configured');
        }

        try {
            const model = request.modelId || this.defaultModel;
            const response = await fetch(`${this.endpoint}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': this.apiVersion
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 4096,
                    messages: [
                        {
                            role: 'user',
                            content: request.prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const error = await response.json() as { error?: { message?: string } };
                throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json() as { content: Array<{ text: string }>; model: string };

            return {
                text: data.content[0].text.trim(),
                model: data.model
            };
        } catch (error) {
            throw new Error(`Anthropic error: ${error}`);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                return false;
            }

            // Test with a minimal request
            const response = await fetch(`${this.endpoint}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': this.apiVersion
                },
                body: JSON.stringify({
                    model: this.defaultModel,
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }
}
