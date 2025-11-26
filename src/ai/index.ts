// AI System Initialization
import * as vscode from 'vscode';
import { AIProviderManager } from './providerManager';
import {
    VSCodeCopilotProvider,
    CursorProvider,
    OpenAIProvider,
    AnthropicProvider,
    OllamaProvider,
    GeminiProvider
} from './providers';

/**
 * Initialize the AI provider system
 */
export async function initializeAISystem(
    context: vscode.ExtensionContext,
    globalStoragePath: string
): Promise<AIProviderManager> {
    // Create provider manager
    const manager = new AIProviderManager(context, globalStoragePath);

    // Register all providers
    const vsCodeCopilotProvider = new VSCodeCopilotProvider();
    if(await vsCodeCopilotProvider.isAvailable()) {
        manager.registerProvider(vsCodeCopilotProvider);
    }
    // manager.registerProvider(new CursorProvider());
    manager.registerProvider(new OpenAIProvider());
    manager.registerProvider(new AnthropicProvider());
    manager.registerProvider(new OllamaProvider());
    manager.registerProvider(new GeminiProvider());

    // Initialize the manager
    await manager.initialize();

    console.log('DevBoost: AI provider system initialized');

    return manager;
}
