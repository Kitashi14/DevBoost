// Configuration Manager Module - Handles DevBoost settings
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface DevBoostConfig {
	aiModel?: {
		smartCmd?: {
			vendor: string;
			family: string;
			name?: string;
		};
		promptEnhancer?: {
			vendor: string;
			family: string;
			name?: string;
		};
	};
}

/**
 * Get the configuration file path
 */
function getConfigFilePath(globalStoragePath?: string): string | null {
	// Use global config only
	if (globalStoragePath) {
		return path.join(globalStoragePath, 'config.json');
	}
	
	return null;
}

/**
 * Read configuration from file
 */
async function readConfig(globalStoragePath?: string): Promise<DevBoostConfig | null> {
	const configPath = getConfigFilePath(globalStoragePath);
	if (!configPath) {
		return null;
	}
	
	try {
		const content = await fs.readFile(configPath, 'utf-8');
		return JSON.parse(content) as DevBoostConfig;
	} catch (error) {
		// Config file doesn't exist or is invalid
		return null;
	}
}

/**
 * Write configuration to file
 */
async function writeConfig(config: DevBoostConfig, globalStoragePath?: string): Promise<boolean> {
	const configPath = getConfigFilePath(globalStoragePath);
	if (!configPath) {
		return false;
	}
	
	try {
		// Ensure directory exists
		await fs.mkdir(path.dirname(configPath), { recursive: true });
		
		// Write config file with pretty formatting
		await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
		console.log('DevBoost: Configuration saved to', configPath);
		return true;
	} catch (error) {
		console.error('DevBoost: Error writing config:', error);
		return false;
	}
}

/**
 * Show AI model picker with current and recommended indicators
 * @param module - The module requesting the model
 * @param currentConfig - Current model configuration (if any)
 * @param globalStoragePath - Optional global storage path
 */
async function showModelPicker(
	module: 'smartCmd' | 'promptEnhancer',
	currentConfig: { vendor: string; family: string; name?: string } | null,
	globalStoragePath?: string
): Promise<vscode.LanguageModelChat | null> {
	const moduleName = module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer';
	
	// Get all available models
	const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
	
	if (allModels.length === 0) {
		vscode.window.showWarningMessage('No GitHub Copilot models available. Please ensure you have GitHub Copilot enabled.');
		return null;
	}
	
	console.log('DevBoost: Available Copilot models:', allModels.map(m => ({ 
		family: m.family, 
		name: m.name, 
		vendor: m.vendor,
		maxTokens: m.maxInputTokens 
	})));
	
	// Determine recommended model based on module-specific needs
	let recommendedModel: vscode.LanguageModelChat;
	
	if (module === 'smartCmd') {
		// SmartCmd: Generates commands/scripts, needs strong code understanding
		// Priority: best claude-sonnet > best gpt-4o > highest token model
		const claudeModels = allModels.filter(m => m.family.includes('claude-sonnet'));
		const gpt4oModels = allModels.filter(m => m.family.includes('gpt-4o') && !m.family.includes('mini'));
		
		if (claudeModels.length > 0) {
			// Pick the latest claude-sonnet by version number in family name
			// e.g., claude-sonnet-4.5 > claude-sonnet-4 > claude-sonnet-3.5
			recommendedModel = claudeModels.reduce((best, current) => {
				// Extract version from family name (e.g., "claude-sonnet-4.5" -> 4.5)
				const bestVersion = parseFloat(best.family.split('-').pop() || '0');
				const currentVersion = parseFloat(current.family.split('-').pop() || '0');
				return currentVersion > bestVersion ? current : best;
			});
		} else if (gpt4oModels.length > 0) {
			// Pick the latest gpt-4o by version number
			recommendedModel = gpt4oModels.reduce((best, current) => {
				const bestVersion = parseFloat(best.family.split('-').pop() || '0');
				const currentVersion = parseFloat(current.family.split('-').pop() || '0');
				return currentVersion > bestVersion ? current : best;
			});
		} else {
			// Fallback: highest token model available
			recommendedModel = allModels.reduce((best, current) => 
				current.maxInputTokens > best.maxInputTokens ? current : best
			);
		}
	} else {
		// Prompt Enhancer: Optimizes natural language prompts
		// Priority: best gpt-4o > best claude-sonnet > highest token model
		const gpt4oModels = allModels.filter(m => m.family.includes('gpt-4o') && !m.family.includes('mini'));
		const claudeModels = allModels.filter(m => m.family.includes('claude-sonnet'));
		
		if (gpt4oModels.length > 0) {
			// Pick the latest gpt-4o by version number
			recommendedModel = gpt4oModels.reduce((best, current) => {
				const bestVersion = parseFloat(best.family.split('-').pop() || '0');
				const currentVersion = parseFloat(current.family.split('-').pop() || '0');
				return currentVersion > bestVersion ? current : best;
			});
		} else if (claudeModels.length > 0) {
			// Pick the latest claude-sonnet by version number in family name
			recommendedModel = claudeModels.reduce((best, current) => {
				const bestVersion = parseFloat(best.family.split('-').pop() || '0');
				const currentVersion = parseFloat(current.family.split('-').pop() || '0');
				return currentVersion > bestVersion ? current : best;
			});
		} else {
			// Fallback: highest token model available
			recommendedModel = allModels.reduce((best, current) => 
				current.maxInputTokens > best.maxInputTokens ? current : best
			);
		}
	}
	
	console.log(`DevBoost: Recommended model for ${module}:`, {
		family: recommendedModel.family,
		name: recommendedModel.name,
		maxTokens: recommendedModel.maxInputTokens
	});
	
	// Create choices with indicators
	const modelChoices = allModels.map(m => {
		const isRecommended = m.family === recommendedModel.family && m.vendor === recommendedModel.vendor;
		const isCurrent = currentConfig && m.family === currentConfig.family && m.vendor === currentConfig.vendor;
		
		let label = m.name || m.family;
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
			description: `Family: ${m.family}, Max Tokens: ${m.maxInputTokens}`,
			model: m
		};
	});
	
	const currentModelInfo = currentConfig 
		? `Currently using: ${currentConfig.name || currentConfig.family}` 
		: 'No model currently configured';
	
	const selectedChoice = await vscode.window.showQuickPick(modelChoices, {
		placeHolder: `${currentModelInfo}. Select AI model for ${moduleName}`,
		title: `Choose GitHub Copilot Model for ${moduleName}`,
		ignoreFocusOut: true
	});
	
	if (!selectedChoice) {
		return null;
	}
	
	return selectedChoice.model;
}

/**
 * Get the AI model to use for language model operations
 * This function will:
 * 1. Check if a model is saved in config for the specific module
 * 2. If not, prompt user to select from available models
 * 3. Save the selection for future use
 * @param module - The module requesting the AI model ('smartCmd' or 'promptEnhancer')
 * @param globalStoragePath - Optional global storage path
 */
export async function getAIModel(module: 'smartCmd' | 'promptEnhancer', globalStoragePath?: string): Promise<vscode.LanguageModelChat | null> {
	// Read existing config
	const config = await readConfig(globalStoragePath);
	
	// Get all available Copilot models
	const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
	
	if (allModels.length === 0) {
		vscode.window.showWarningMessage('No GitHub Copilot models available. Please ensure you have GitHub Copilot enabled.');
		return null;
	}
	
	// Check if we have a saved model preference for this module
	const moduleConfig = config?.aiModel?.[module];
	if (moduleConfig?.family) {
		// Try to find the saved model
		const savedModel = allModels.find(m => 
			m.family === moduleConfig.family && 
			m.vendor === moduleConfig.vendor
		);
		
		if (savedModel) {
			console.log(`DevBoost: Using saved AI model for ${module}:`, { 
				family: savedModel.family, 
				name: savedModel.name,
				vendor: savedModel.vendor
			});
			return savedModel;
		} else {
			console.log(`DevBoost: Saved model for ${module} not available, prompting user to select new model`);
		}
	}
	
	// No saved model or saved model not available - prompt user to select
	const moduleName = module === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer';
	const selectedModel = await showModelPicker(module, moduleConfig || null, globalStoragePath);
	
	if (!selectedModel) {
		vscode.window.showInformationMessage(`No AI model selected for ${moduleName}.`);
		return null;
	}
	
	// Save the selection for this module
	const newConfig: DevBoostConfig = {
		...config,
		aiModel: {
			...config?.aiModel,
			[module]: {
				vendor: selectedModel.vendor,
				family: selectedModel.family,
				name: selectedModel.name
			}
		}
	};
	
	const saved = await writeConfig(newConfig, globalStoragePath);
	
	if (saved) {
		vscode.window.showInformationMessage(
			`${moduleName} AI Model set to: ${selectedModel.name || selectedModel.family}`
		);
	}
	
	console.log(`DevBoost: Selected and saved AI model for ${module}:`, { 
		family: selectedModel.family, 
		name: selectedModel.name,
		vendor: selectedModel.vendor
	});
	
	return selectedModel;
}

/**
 * Clear the saved AI model configuration
 * @param module - Optional module to clear. If not provided, clears all models
 * @param globalStoragePath - Optional global storage path
 */
export async function clearAIModelConfig(module?: 'smartCmd' | 'promptEnhancer', globalStoragePath?: string): Promise<void> {
	const config = await readConfig(globalStoragePath);
	if (config?.aiModel) {
		if (module) {
			// Clear specific module's model
			delete config.aiModel[module];
		} else {
			// Clear all models
			delete config.aiModel;
		}
		await writeConfig(config, globalStoragePath);
		console.log(`DevBoost: AI model configuration cleared${module ? ` for ${module}` : ''}`);
	}
}

/**
 * Get current AI model configuration
 * @param module - Optional module to get config for. If not provided, returns all models
 * @param globalStoragePath - Optional global storage path
 */
export async function getAIModelConfig(module?: 'smartCmd' | 'promptEnhancer', globalStoragePath?: string): Promise<any> {
	const config = await readConfig(globalStoragePath);
	if (module) {
		return config?.aiModel?.[module] || null;
	}
	return config?.aiModel || null;
}

/**
 * Change the AI model - prompts user to select a new model
 * @param module - Optional module to change model for. If not provided, prompts for which module
 * @param globalStoragePath - Optional global storage path
 */
export async function changeAIModel(module: 'smartCmd' | 'promptEnhancer', globalStoragePath?: string): Promise<void> {
	let targetModule = module;
	const moduleName = targetModule === 'smartCmd' ? 'SmartCmd' : 'Prompt Enhancer';
	
	// Get current model config
	const currentConfig = await getAIModelConfig(targetModule, globalStoragePath);
	
	// Show model picker with current and recommended indicators
	const selectedModel = await showModelPicker(targetModule, currentConfig, globalStoragePath);
	
	if (!selectedModel) {
		return;
	}
	
	// Clear the current model config and save new selection
	await clearAIModelConfig(targetModule, globalStoragePath);
	
	// Save the new model
	const config = await readConfig(globalStoragePath);
	const newConfig: DevBoostConfig = {
		...config,
		aiModel: {
			...config?.aiModel,
			[targetModule]: {
				vendor: selectedModel.vendor,
				family: selectedModel.family,
				name: selectedModel.name
			}
		}
	};
	
	const saved = await writeConfig(newConfig, globalStoragePath);
	
	if (saved) {
		vscode.window.showInformationMessage(
			`${moduleName} AI Model changed to: ${selectedModel.name || selectedModel.family}`
		);
	}
	
	console.log(`DevBoost: Changed AI model for ${targetModule}:`, { 
		family: selectedModel.family, 
		name: selectedModel.name,
		vendor: selectedModel.vendor
	});
}
