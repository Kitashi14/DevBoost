// Google Gemini Provider
import { BaseAIProvider } from '../aiProvider';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from '../types';

/**
 * Google Gemini API provider
 */
export class GeminiProvider extends BaseAIProvider {
    readonly id = 'gemini';
    readonly name = 'Google Gemini';
    readonly requiresApiKey = true;

    private endpoint = 'https://generativelanguage.googleapis.com/v1beta';
    private defaultModel = 'gemini-2.5-flash';

    async isAvailable(): Promise<ProviderAvailability> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            return {
                available: false,
                reason: 'Google Gemini API key not configured'
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
            const response = await fetch(
                `${this.endpoint}/models?key=${apiKey}`
            );

            if (!response.ok) {
                return [];
            }

            const data = await response.json() as { models: Array<{ name: string, displayName: string, supportedGenerationMethods: string[] }> };

            // Filter for generateContent models
            return data.models
                .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => {
                    const id = m.name.replace('models/', '');
                    return {
                        id: id,
                        name: m.displayName || id,
                        family: 'gemini',
                        vendor: 'google'
                    };
                });
        } catch (error) {
            console.error('Error listing Gemini models:', error);
            return [];
        }
    }

    async getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null> {
        // Gemini 2.5 Flash is good for both tasks
        return {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            family: 'gemini-2.5',
            vendor: 'google'
        };
    }

    async sendRequest(request: AIRequest): Promise<AIResponse> {
        const apiKey = await this.getApiKey();

        if (!apiKey) {
            throw new Error('Google Gemini API key not configured');
        }

        try {
            const model = request.modelId || this.defaultModel;
            const response = await fetch(
                `${this.endpoint}/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: request.prompt
                                    }
                                ]
                            }
                        ]
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json() as { error?: { message?: string } };
                throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };

            return {
                text: data.candidates[0].content.parts[0].text.trim(),
                model: model
            };
        } catch (error) {
            throw new Error(`Gemini error: ${error}`);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                return false;
            }
            
            // Test with a simple request - use query parameter for API key
            const response = await fetch(
                `${this.endpoint}/models/${this.defaultModel}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Hi' }] }]
                    })
                }
            );

            if (!response.ok) {
                const error = await response.text();
                console.error('Gemini test connection failed:', response.status, error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error testing Gemini connection:', error);
            return false;
        }
    }
}
