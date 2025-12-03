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
    vsCodeCopilotProvider.initialize(context);
    if((await vsCodeCopilotProvider.isAvailable()).available) {
        manager.registerProvider(vsCodeCopilotProvider);
    }
    // manager.registerProvider(new CursorProvider());
    manager.registerProvider(new OpenAIProvider());
    manager.registerProvider(new AnthropicProvider());

    const ollamaProvider = new OllamaProvider();
    await ollamaProvider.initialize(context);
    const port = await context.secrets.get(`devboost.${ollamaProvider.id}.port`);
    console.warn('Ollama port from secrets:', port);
    ollamaProvider.port = port ? Number(port) : 11434;
    console.log('Ollama provider port set to:', ollamaProvider.port);
    manager.registerProvider(ollamaProvider);
    manager.registerProvider(new GeminiProvider());

    // Initialize the manager
    await manager.initialize();

    console.log('DevBoost: AI provider system initialized');

    return manager;
}
