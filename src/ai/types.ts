// Core types for simplified AI provider abstraction layer

/**
 * Request to send to an AI provider
 */
export interface AIRequest {
    /** The prompt/message to send to the AI */
    prompt: string;

    /** System prompt (optional, for providers that support it) */
    systemPrompt?: string;

    /** Specific model ID to use for this request (optional) */
    modelId?: string;
}

/**
 * Response from an AI provider
 */
export interface AIResponse {
    /** The generated text response */
    text: string;

    /** Model that generated the response */
    model?: string;
}

/**
 * AI model information
 */
export interface AIModel {
    /** Unique identifier for the model */
    id: string;

    /** Human-readable name */
    name: string;

    /** Model family (e.g., 'gpt-4', 'claude-3') */
    family: string;

    /** Provider vendor (e.g., 'openai', 'anthropic') */
    vendor: string;
}

/**
 * Module type for provider selection
 */
export type AIModule = 'smartCmd' | 'promptEnhancer';

/**
 * Provider availability status
 */
export interface ProviderAvailability {
    /** Whether the provider is available */
    available: boolean;

    /** Reason if not available */
    reason?: string;
}
