// Simplified AI Provider Manager
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AIProvider } from './aiProvider';
import { AIRequest, AIResponse, AIModule } from './types';

/**
 * Simplified configuration structure
 */
interface DevBoostAIConfig {
    activeProvider: {
        smartCmd?: {
            providerId: string;
            modelId?: string;
        };
        promptEnhancer?: {
            providerId: string;
            modelId?: string;
        };
    };
}

/**
 * Simplified provider manager
 */
export class AIProviderManager {
    private providers: Map<string, AIProvider> = new Map();
    private activeProviders: Map<AIModule, { providerId: string; modelId?: string }> = new Map();
    private config?: DevBoostAIConfig;
    private configPath: string;

    constructor(
        private context: vscode.ExtensionContext,
        globalStoragePath: string
    ) {
        this.configPath = path.join(globalStoragePath, 'config.json');
    }

    /**
     * Initialize the manager
     */
    async initialize(): Promise<void> {
        await this.loadConfig();

        // Initialize all providers
        for (const provider of this.providers.values()) {
            try {
                await provider.initialize(this.context);
                console.log(`DevBoost: Initialized provider: ${provider.id}`);
            } catch (error) {
                console.error(`DevBoost: Failed to initialize ${provider.id}:`, error);
            }
        }

        // Load active providers from config
        if (this.config?.activeProvider) {
            for (const module of ['smartCmd', 'promptEnhancer'] as AIModule[]) {
                const providerInfo = this.config.activeProvider[module];
                if (providerInfo) {
                    await this.setActiveProvider(module, providerInfo.providerId, providerInfo?.modelId, true);
                }
            }
        }
    }

    /**
     * Register a provider
     */
    registerProvider(provider: AIProvider): void {
        this.providers.set(provider.id, provider);
        console.log(`DevBoost: Registered provider: ${provider.name}`);
    }

    /**
     * Get all available providers
     */
    async getAvailableProviders(): Promise<AIProvider[]> {
        const available: AIProvider[] = [];

        for (const provider of this.providers.values()) {
            const availability = await provider.isAvailable();
            if (availability.available) {
                available.push(provider);
            }
        }

        return available;
    }

    /**
     * Get the active provider for a module
     */
    getActiveProvider(module: AIModule): AIProvider | undefined {
        const providerInfo = this.activeProviders.get(module);
        if (!providerInfo) {
            return undefined;
        }
        return this.providers.get(providerInfo.providerId);
    }

    /**
     * Get the active provider info (including model) for a module
     */
    getActiveProviderInfo(module: AIModule): { providerId: string; modelId?: string } | undefined {
        return this.activeProviders.get(module);
    }

    /**
     * Send a request using the active provider for a module
     */
    async sendRequest(module: AIModule, request: AIRequest): Promise<AIResponse> {
        const provider = await this.getOrSelectProvider(module);

        // Get the specific model ID for this module if configured
        const providerInfo = this.activeProviders.get(module);
        if (providerInfo?.modelId) {
            request.modelId = providerInfo.modelId;
        }

        return await provider.sendRequest(request);
    }

    /**
     * Get or select a provider for a module
     */
    private async getOrSelectProvider(module: AIModule): Promise<AIProvider> {
        // Check if we have an active provider configured
        const providerInfo = this.activeProviders.get(module);

        if (providerInfo) {
            const provider = this.providers.get(providerInfo.providerId);
            if (provider) {
                const availability = await provider.isAvailable();
                if (availability.available) {
                    return provider;
                }
            }
            console.warn(`DevBoost: Active provider ${providerInfo.providerId} is no longer available`);
        }

        // No active provider or unavailable - select one
        const provider = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Configuring AI Provider and Model for  ${module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer'}... `,
        }, async () => await this.selectProviderAndModel(module));

        if (!provider) {
            throw new Error('No AI provider configured. Please configure a provider to use AI features.');
        }

        return provider;
    }

    /**
     * Explicitly configure a provider for a module
     */
    async configureProvider(module: AIModule): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Configuring AI Provider and Model for  ${module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer'}... `,
        }, async () => await this.selectProviderAndModel(module));
    }

    /**
     * Prompt user to select a provider and optionally a model
     */
    private async selectProviderAndModel(module: AIModule): Promise<AIProvider | undefined> {
        // Get available providers
        const available = await this.getAvailableProviders();

        // Multiple providers available or explicit config - let user choose
        const moduleName = module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer';
        const currentInfo = this.activeProviders.get(module);

        const choices: vscode.QuickPickItem[] = available.map(p => ({
            label: p.name,
            description: currentInfo?.providerId === p.id ? '(Current)' : p.id,
            // Store provider in a way we can retrieve it (using a map or casting)
            // Since QuickPickItem doesn't allow custom properties easily without casting, 
            // we'll match by label/description or use a custom type if we cast
        }));

        // Add option to configure new provider
        const configureNewOption = {
            label: '$(plus) Configure New Provider...',
            description: 'Set up a new AI provider'
        };
        choices.push(configureNewOption);

        const selected = await vscode.window.showQuickPick(choices, {
            placeHolder: `Select AI provider for ${moduleName}`,
            title: 'Choose AI Provider'
        });

        if (selected) {
            if (selected === configureNewOption) {
                return await this.configureNewProvider(module);
            }

            // Find the selected provider
            const selectedProvider = available.find(p => p.name === selected.label);

            if (selectedProvider) {
                // Try to select a model if provider supports it
                const modelId = await this.selectModelForProvider(selectedProvider, module);

                await this.setActiveProvider(module, selectedProvider.id, modelId);
                return selectedProvider;
            }
        }

        return undefined;
    }

    /**
     * Select a model for a provider (if it supports multiple models)
     */
    private async selectModelForProvider(provider: AIProvider, module: AIModule): Promise<string | undefined> {
        try {
            const models = await provider.listModels();

            if (models.length === 0) {
                return undefined;
            }

            if (models.length === 1) {
                return models[0].id;
            }

            // Get recommended model
            const task = module === 'smartCmd' ? 'code' : 'text';
            const recommendedModel = await provider.getRecommendedModel(task);

            // Get current model if any
            const currentInfo = this.activeProviders.get(module);
            const currentModelId = currentInfo?.modelId;

            // Create choices with indicators
            const modelChoices = models.map(m => {
                const isRecommended = recommendedModel && m.id === recommendedModel.id;
                const isCurrent = currentModelId && m.id === currentModelId;

                let label = m.name;
                const indicators: string[] = [];

                if (isCurrent) {
                    indicators.push('Current');
                }
                if (isRecommended) {
                    indicators.push('Recommended');
                }

                if (indicators.length > 0) {
                    label = `${label} (${indicators.join(', ')})`;
                }

                return {
                    label,
                    description: `Family: ${m.family}`,
                    model: m
                };
            });

            const moduleName = module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer';
            const currentModelInfo = currentModelId
                ? `Currently using: ${models.find(m => m.id === currentModelId)?.name || currentModelId}`
                : 'No model currently configured';

            const selectedChoice = await vscode.window.showQuickPick(modelChoices, {
                placeHolder: `${currentModelInfo}. Select AI model for ${moduleName}`,
                title: `Choose ${provider.name} Model for ${moduleName}`,
                ignoreFocusOut: true
            });

            if (!selectedChoice) {
                // User cancelled - use recommended model as fallback
                return recommendedModel?.id;
            }

            return selectedChoice.model.id;
        } catch (error) {
            console.error('Error selecting model:', error);
            return undefined;
        }
    }

    /**
     * Configure a new provider (prompt for API key if needed)
     */
    private async configureNewProvider(module: AIModule): Promise<AIProvider | undefined> {
        const available = await this.getAvailableProviders();
        // Show all providers (including unavailable ones that need API keys)
        const allProviders = Array.from(this.providers.values()).filter(p => !available.includes(p));

        const choices = allProviders.map(p => ({
            label: p.name,
            description: p.requiresApiKey ? 'Requires API key' : 'Ready to use',
            provider: p
        }));

        const selected = await vscode.window.showQuickPick(choices, {
            placeHolder: 'Select AI provider to configure',
            title: 'Configure AI Provider'
        });

        if (!selected) {
            return undefined;
        }

        const provider = selected.provider;

        // If provider requires API key, prompt for it
        if (provider.requiresApiKey) {
            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter API key for ${provider.name}`,
                password: true,
                placeHolder: 'API key',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'API key is required';
                    }
                    return null;
                }
            });

            if (!apiKey) {
                return undefined;
            }

            // Initialize provider with API key
            await provider.initialize(this.context, apiKey);

            // Test connection
            const connected = await provider.testConnection();
            if (!connected) {
                vscode.window.showErrorMessage(`Failed to connect to ${provider.name}. Please check your API key.`);
                await provider.removeApiKey();
                return undefined;
            }

            vscode.window.showInformationMessage(`Successfully configured ${provider.name}`);
        }

        // Set as active provider
        const modelId = await this.selectModelForProvider(provider, module);
        await this.setActiveProvider(module, provider.id, modelId);

        return provider;
    }

    /**
     * Set the active provider for a module
     */
    async setActiveProvider(module: AIModule, providerId: string, modelId?: string, initial?: boolean): Promise<void> {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider not found: ${providerId}`);
        }

        // Check if provider is available
        const availability = await provider.isAvailable();
        if (!availability.available) {
            vscode.window.showErrorMessage(`Provider ${provider.name} is not available: ${availability.reason || 'Unknown reason'}`);
            // Clear active provider if it was set to this unavailable one
            this.activeProviders.delete(module);
            if (this.config?.activeProvider) {
                delete this.config.activeProvider[module];
                await this.saveConfig();
            }
            return undefined
        }

        // Test connection
        const connected = await provider.testConnection();
        if (!connected) {
            vscode.window.showErrorMessage(`Failed to connect to ${provider.name}. ${ provider.requiresApiKey ? "Reset API key if needed." : ""}`);
            await provider.removeApiKey();
            return undefined;
        }

        this.activeProviders.set(module, { providerId, modelId });

        // Update config
        if (!this.config) {
            this.config = { activeProvider: {} };
        }

        this.config.activeProvider[module] = { providerId, modelId };
        await this.saveConfig();

        console.log(`DevBoost: Set active provider for ${module}: ${providerId}${modelId ? ` (model: ${modelId})` : ''}`);
        if(!initial)
            vscode.window.showInformationMessage(`DevBoost: Set active provider for ${module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer'} to ${provider.name}(${modelId || 'default'})`);
    }

    /**
     * Load configuration
     */
    private async loadConfig(): Promise<void> {
        try {
            const content = await fs.readFile(this.configPath, 'utf-8');
            const parsed = JSON.parse(content);
            
            // Validate the config structure
            if (!this.isValidConfig(parsed)) {
                console.warn('DevBoost: Invalid configuration structure, using defaults');
                this.config = { activeProvider: {} };
                return;
            }
            
            this.config = parsed;
            console.log('DevBoost: Loaded AI provider configuration');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                console.log('DevBoost: No existing configuration, using defaults');
            } else {
                console.error('DevBoost: Failed to load configuration:', error);
            }
            this.config = {
                activeProvider: {}
            };
        }
    }

    /**
     * Validate configuration structure
     */
    private isValidConfig(config: any): config is DevBoostAIConfig {
        if (!config || typeof config !== 'object') {
            return false;
        }

        if (!config.activeProvider || typeof config.activeProvider !== 'object') {
            return false;
        }

        // Validate each module's provider info
        for (const module of ['smartCmd', 'promptEnhancer'] as const) {
            const providerInfo = config.activeProvider[module];
            if (providerInfo !== undefined) {
                if (typeof providerInfo !== 'object' || !providerInfo.providerId || typeof providerInfo.providerId !== 'string') {
                    return false;
                }
                if (providerInfo.modelId !== undefined && typeof providerInfo.modelId !== 'string') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Save configuration
     */
    private async saveConfig(): Promise<void> {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
            console.log('DevBoost: Saved AI provider configuration');
        } catch (error) {
            console.error('DevBoost: Failed to save configuration:', error);
        }
    }

    /**
     * Manage API keys - allow users to delete stored API keys
     */
    async manageApiKeys(): Promise<void> {
        // Get all providers that require API keys
        const providersWithKeys: AIProvider[] = [];
        
        for (const provider of this.providers.values()) {
            if (provider.requiresApiKey) {
                // Check if API key exists in secret storage
                const apiKey = await this.context.secrets.get(`devboost.${provider.id}.apiKey`);
                console.log(provider.id, apiKey);
                await provider.isAvailable();
                if (apiKey) {
                    providersWithKeys.push(provider);
                }
            }
        }

        if (providersWithKeys.length === 0) {
            vscode.window.showInformationMessage('No API keys are currently stored.');
            return;
        }

        // Create quick pick items
        interface ProviderQuickPickItem extends vscode.QuickPickItem {
            provider: AIProvider;
        }

        const items: ProviderQuickPickItem[] = providersWithKeys.map(p => ({
            label: `$(key) ${p.name}`,
            description: p.id,
            detail: 'Click to delete this API key',
            provider: p
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an API key to delete',
            title: 'Manage API Keys',
            ignoreFocusOut: true
        });

        if (!selected) {
            return;
        }

        // Confirm deletion
        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the API key for ${selected.provider.name}?`,
            { modal: true },
            'Delete'
        );

        if (confirmation !== 'Delete') {
            return;
        }

        // Delete the API key
        await selected.provider.removeApiKey();

        // Check if this provider is active for any module and clear it
        for (const [module, info] of this.activeProviders.entries()) {
            if (info.providerId === selected.provider.id) {
                this.activeProviders.delete(module);
                
                // Update config
                if (this.config?.activeProvider) {
                    delete this.config.activeProvider[module];
                    await this.saveConfig();
                }

                console.log(`DevBoost: Cleared active provider for ${module} after API key deletion`);
            }
        }

        vscode.window.showInformationMessage(
            `API key for ${selected.provider.name} has been deleted successfully.`
        );
    }

    /**
     * Dispose all providers
     */
    dispose(): void {
        for (const provider of this.providers.values()) {
            provider.dispose();
        }
        this.providers.clear();
        this.activeProviders.clear();
    }
}
