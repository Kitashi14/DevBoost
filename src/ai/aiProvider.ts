// AI Provider Interface - Simplified version
import * as vscode from 'vscode';
import { AIRequest, AIResponse, AIModel, ProviderAvailability } from './types';

/**
 * Simplified interface that all AI providers must implement
 */
export interface AIProvider {
    /** Unique identifier for the provider */
    readonly id: string;

    /** Human-readable name */
    readonly name: string;

    /** Whether this provider requires an API key */
    readonly requiresApiKey: boolean;

    /**
 * Initialize the provider
 * @param context VS Code extension context for accessing secrets
 * @param apiKey Optional API key (if required)
 */
    initialize(context: vscode.ExtensionContext, apiKey?: string): Promise<void>;

    /**
     * Check if the provider is available
     */
    isAvailable(): Promise<ProviderAvailability>;

    /**
     * List available models from this provider
     */
    listModels(): Promise<AIModel[]>;

    /**
     * Get the recommended model for a specific task type
     * @param task Task type ('code' for SmartCmd, 'text' for Prompt Enhancer)
     */
    getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null>;

    /**
     * Send a request to the AI provider
     */
    sendRequest(request: AIRequest): Promise<AIResponse>;

    /**
     * Test the connection to the provider
     */
    testConnection(): Promise<boolean>;

    /**
     * Remove the stored API key
     */
    removeApiKey(): Promise<void>;

    /**
     * Clean up resources
     */
    dispose(): void;
}

/**
 * Base abstract class for common functionality
 */
export abstract class BaseAIProvider implements AIProvider {
    protected context?: vscode.ExtensionContext;
    protected apiKey?: string;

    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly requiresApiKey: boolean;

    async initialize(context: vscode.ExtensionContext, apiKey?: string): Promise<void> {
        this.context = context;

        // Load API key from secret storage if not provided
        if (this.requiresApiKey) {
            if (apiKey) {
                this.apiKey = apiKey;
                // Save to secret storage
                await context.secrets.store(`devboost.${this.id}.apiKey`, apiKey);
            } else {
                // Try to load from secret storage
                this.apiKey = await context.secrets.get(`devboost.${this.id}.apiKey`);
            }
        }
    }
    async removeApiKey(): Promise<void> {
        if (this.context && this.requiresApiKey && this.apiKey) {
            await this.context.secrets.delete(`devboost.${this.id}.apiKey`);
            this.apiKey = undefined;
        }
    }

    abstract isAvailable(): Promise<ProviderAvailability>;
    abstract listModels(): Promise<AIModel[]>;
    abstract getRecommendedModel(task: 'code' | 'text'): Promise<AIModel | null>;
    abstract sendRequest(request: AIRequest): Promise<AIResponse>;
    abstract testConnection(): Promise<boolean>;

    dispose(): void {
        this.context = undefined;
        this.apiKey = undefined;
    }

    /**
     * Helper to get API key
     */
    protected async getApiKey(): Promise<string | undefined> {
        if (!this.context) {
            return undefined;
        }
        return await this.context.secrets.get(`devboost.${this.id}.apiKey`);
    }
}
