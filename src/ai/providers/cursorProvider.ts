// Cursor IDE Provider
import { BaseAIProvider } from '../aiProvider';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from '../types';

/**
 * Cursor IDE native AI provider
 * Note: This is a placeholder implementation as Cursor's AI API is not publicly documented
 * We detect Cursor environment and provide fallback messaging
 */
export class CursorProvider extends BaseAIProvider {
    readonly id = 'cursor';
    readonly name = 'Cursor IDE';
    readonly requiresApiKey = false;

    async isAvailable(): Promise<ProviderAvailability> {
        // Check if running in Cursor IDE
        // Cursor sets specific environment variables or has specific APIs
        const isCursor = this.detectCursorEnvironment();

        if (!isCursor) {
            return {
                available: false,
                reason: 'Not running in Cursor IDE'
            };
        }

        // Check if Cursor AI API is available
        // Note: This is speculative - Cursor may not expose a public API
        // Users should use other providers (OpenAI, Anthropic, etc.) in Cursor
        return {
            available: false,
            reason: 'Cursor IDE does not currently expose a public API for extensions to access its native LLM features. Please use the GitHub Copilot provider (if installed) or configure a direct API provider like OpenAI/Anthropic.'
        };
    }

    private detectCursorEnvironment(): boolean {
        // Check for Cursor-specific indicators
        // This is speculative and may need adjustment based on actual Cursor environment

        // Check environment variables
        if (process.env.CURSOR_IDE || process.env.CURSOR_VERSION) {
            return true;
        }

        // Check for Cursor-specific global objects (if any)
        // This would need to be updated based on actual Cursor API documentation

        return false;
    }

    async listModels(): Promise<AIModel[]> {
        // Cursor API not available
        return [];
    }

    async getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null> {
        // Cursor doesn't have a public API yet
        return null;
    }

    async sendRequest(request: AIRequest): Promise<AIResponse> {
        throw new Error('Cursor AI API is not publicly available. Please configure another provider (OpenAI, Anthropic, or Ollama).');
    }

    async testConnection(): Promise<boolean> {
        return false;
    }
}
