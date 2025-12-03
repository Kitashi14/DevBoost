// Ollama Provider - Local LLM support
import { BaseAIProvider } from '../aiProvider';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from '../types';

/**
 * Ollama provider for local LLM execution
 */
export class OllamaProvider extends BaseAIProvider {
    readonly id = 'ollama';
    readonly name = 'Ollama (Local)';
    readonly requiresApiKey = false;

    private endpoint = 'http://localhost:';
    private defaultModel = 'gemma3:4b';
    public port: number = 11434;

    async isAvailable(): Promise<ProviderAvailability> {
        try {
            // Check if Ollama is running
            const response = await fetch(`${this.endpoint}${this.port}/api/tags`);

            if (!response.ok) {
                return {
                    available: false,
                    reason: 'Ollama is not running. Please start Ollama.'
                };
            }

            const data = await response.json() as { models?: any[] };

            if (!data.models || data.models.length === 0) {
                return {
                    available: false,
                    reason: 'No models installed. Run: ollama run gemma3:4b'
                };
            }

            return { available: true };
        } catch (error) {
            return {
                available: false,
                reason: 'Ollama not found. Install from https://ollama.com'
            };
        }
    }

    async listModels(): Promise<AIModel[]> {
        try {
            const response = await fetch(`${this.endpoint}${this.port}/api/tags`);
            const data = await response.json() as { models?: any[] };

            if (!data.models || data.models.length === 0) {
                return [];
            }

            return data.models.map((m: any) => ({
                id: m.name,
                name: m.name,
                family: m.name.split(':')[0],
                vendor: 'ollama'
            }));
        } catch (error) {
            console.error('Error listing Ollama models:', error);
            return [];
        }
    }

    async getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null> {
        try {
            const response = await fetch(`${this.endpoint}${this.port}/api/tags`);
            const data = await response.json() as { models?: any[] };

            if (!data.models || data.models.length === 0) {
                return null;
            }

            // Prefer code-specific models for code tasks
            if (task === 'code') {
                const codeModel = data.models.find((m: any) =>
                    m.name.includes('gemma3') || m.name.includes('deepseek-coder')
                );
                if (codeModel) {
                    return {
                        id: codeModel.name,
                        name: codeModel.name,
                        family: codeModel.name.split(':')[0],
                        vendor: 'ollama'
                    };
                }
            }

            // Return first available model
            const model = data.models[0];
            return {
                id: model.name,
                name: model.name,
                family: model.name.split(':')[0],
                vendor: 'ollama'
            };
        } catch (error) {
            console.error('Error getting Ollama models:', error);
            return null;
        }
    }

    async sendRequest(request: AIRequest): Promise<AIResponse> {
        try {
            const model = await this.getRecommendedModel('code');
            const modelName = request.modelId || model?.id || this.defaultModel;

            const response = await fetch(`${this.endpoint}${this.port}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelName,
                    prompt: request.prompt,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama request failed: ${response.statusText}`);
            }

            const data = await response.json() as { response: string };

            return {
                text: data.response.trim(),
                model: modelName
            };
        } catch (error) {
            throw new Error(`Ollama error: ${error}`);
        }
    }

    async testConnection(): Promise<boolean> {
        const availability = await this.isAvailable();
        return availability.available;
    }
}
