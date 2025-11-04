// Prompt Enhancer Handlers - All prompt enhancement related commands
import * as vscode from 'vscode';
import * as aiServices from './aiServices';
import { copyToClipboard, readFromClipboard, copyWithPreview } from '../utilities/clipboardUtils';
import { createWebviewPanel, setupWebviewMessageHandler, showWebviewLoading, showWebviewError } from '../utilities/webviewUtils';

/**
 * Show the prompt enhancement interface
 */
export async function showPromptEnhancer(): Promise<void> {
	try {
		// Create and show the prompt enhancer webview
		const panel = createWebviewPanel({
			viewType: 'promptEnhancer',
			title: 'Prompt Enhancer',
			enableScripts: true,
			retainContextWhenHidden: true
		});

		// Set the HTML content for the webview
		panel.webview.html = getPromptEnhancerHtml();

		// Handle messages from the webview
		setupWebviewMessageHandler(panel, {
			'analyzePrompt': async (message) => {
				await handleAnalyzePrompt(panel, message.prompt);
			},
			'applyEnhancements': async (message) => {
				await handleApplyEnhancements(panel, message.originalPrompt, message.selectedSuggestions);
			},
			'generateFromIntent': async (message) => {
				await handleGenerateFromIntent(panel, message.intent, message.domain);
			},
			'copyToClipboard': async (message) => {
				await copyToClipboard(message.text);
			}
		});

	} catch (error) {
		console.error('Error showing prompt enhancer:', error);
		vscode.window.showErrorMessage('Failed to open prompt enhancer.');
	}
}

/**
 * Enhance a prompt from external input (used by smartCmd integration)
 */
export async function enhancePromptFromInput(originalPrompt: string): Promise<string | null> {
	try {
		const panel = createWebviewPanel({
			viewType: 'promptEnhancerInput',
			title: 'Enhance Prompt',
			enableScripts: true,
			retainContextWhenHidden: true
		});

		panel.webview.html = getPromptEnhancerHtml();

		// Send the original prompt to the webview
		panel.webview.postMessage({
			command: 'loadPrompt',
			prompt: originalPrompt
		});

		return new Promise((resolve) => {
			panel.webview.onDidReceiveMessage(async (message) => {
				switch (message.command) {
					case 'analyzePrompt':
						await handleAnalyzePrompt(panel, message.prompt);
						break;
					case 'applyEnhancements':
						const enhanced = await handleApplyEnhancements(panel, message.originalPrompt, message.selectedSuggestions);
						if (enhanced) {
							resolve(enhanced);
							panel.dispose();
						}
						break;
					case 'generateFromIntent':
						const generated = await handleGenerateFromIntent(panel, message.intent, message.domain);
						if (generated) {
							resolve(generated);
							panel.dispose();
						}
						break;
					case 'useOriginal':
						resolve(originalPrompt);
						panel.dispose();
						break;
					case 'cancel':
						resolve(null);
						panel.dispose();
						break;
				}
			});

			panel.onDidDispose(() => {
				resolve(null);
			});
		});

	} catch (error) {
		console.error('Error enhancing prompt:', error);
		vscode.window.showErrorMessage('Failed to enhance prompt.');
		return null;
	}
}

/**
 * Quick enhance from clipboard - minimalistic one-click enhancement
 */
export async function quickEnhanceFromClipboard(): Promise<void> {
	try {
		// Get text from clipboard
		const clipboardText = await readFromClipboard();
		
		if (!clipboardText || clipboardText.trim().length === 0) {
			vscode.window.showInformationMessage('Clipboard is empty. Copy a prompt first.');
			return;
		}

		// Show progress while enhancing
		const result = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Quick Enhancing...",
			cancellable: false
		}, async (progress) => {
			progress.report({ message: "Analyzing prompt..." });
			
			// Use AI to quickly enhance the prompt
			const enhanced = await aiServices.quickEnhancePrompt(clipboardText.trim());
			return enhanced;
		});

		if (result) {
			// Copy enhanced prompt back to clipboard with preview
			await copyWithPreview(
				result, 
				100,
				'✨ Prompt enhanced and copied to clipboard!'
			);
			
			// Optional: Show comparison document
			const action = await vscode.window.showInformationMessage(
				'Would you like to see the before and after comparison?',
				'Show Comparison'
			);
			
			if (action === 'Show Comparison') {
				// Open a simple text document with the result
				const doc = await vscode.workspace.openTextDocument({
					content: `Original Prompt:\n${clipboardText}\n\n---\n\nEnhanced Prompt:\n${result}`,
					language: 'plaintext'
				});
				await vscode.window.showTextDocument(doc);
			}
		} else {
			vscode.window.showErrorMessage('Failed to enhance prompt. Please try again.');
		}

	} catch (error) {
		console.error('Error in quick enhance:', error);
		vscode.window.showErrorMessage('Quick enhance failed. Please try again.');
	}
}

/**
 * Handle prompt analysis request
 */
async function handleAnalyzePrompt(panel: vscode.WebviewPanel, prompt: string): Promise<void> {
	try {
		showWebviewLoading(panel, 'Analyzing prompt...');

		const suggestions = await aiServices.getPromptEnhancementSuggestions(prompt);

		panel.webview.postMessage({
			command: 'showSuggestions',
			suggestions: suggestions
		});

	} catch (error) {
		console.error('Error analyzing prompt:', error);
		showWebviewError(panel, 'Failed to analyze prompt. Please try again.');
	}
}

/**
 * Handle applying enhancements
 */
async function handleApplyEnhancements(
	panel: vscode.WebviewPanel, 
	originalPrompt: string, 
	selectedSuggestions: any[]
): Promise<string | null> {
	try {
		showWebviewLoading(panel, 'Applying enhancements...');

		const enhancedPrompt = await aiServices.applyEnhancements(originalPrompt, selectedSuggestions);

		panel.webview.postMessage({
			command: 'showEnhancedPrompt',
			originalPrompt: originalPrompt,
			enhancedPrompt: enhancedPrompt
		});

		return enhancedPrompt;

	} catch (error) {
		console.error('Error applying enhancements:', error);
		showWebviewError(panel, 'Failed to apply enhancements. Please try again.');
		return null;
	}
}

/**
 * Handle generating prompt from intent
 */
async function handleGenerateFromIntent(
	panel: vscode.WebviewPanel, 
	intent: string, 
	domain?: string
): Promise<string | null> {
	try {
		showWebviewLoading(panel, 'Generating prompt...');

		const generatedPrompt = await aiServices.generatePromptFromIntent(intent, domain);

		panel.webview.postMessage({
			command: 'showGeneratedPrompt',
			prompt: generatedPrompt
		});

		return generatedPrompt;

	} catch (error) {
		console.error('Error generating prompt:', error);
		showWebviewError(panel, 'Failed to generate prompt. Please try again.');
		return null;
	}
}

/**
 * Get the HTML content for the prompt enhancer webview
 */
function getPromptEnhancerHtml(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Enhancer</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background-color: var(--vscode-panel-background);
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-textPreformat-foreground);
        }
        textarea {
            width: 100%;
            height: 120px;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-family: inherit;
            resize: vertical;
        }
        input[type="text"] {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-family: inherit;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
            margin-top: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .suggestions {
            margin-top: 20px;
        }
        .suggestion {
            padding: 15px;
            margin: 10px 0;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background-color: var(--vscode-editor-background);
        }
        .suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .suggestion-type {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            text-transform: uppercase;
        }
        .suggestion-priority {
            font-size: 0.8em;
            opacity: 0.8;
        }
        .suggestion.high { border-left: 4px solid #f14c4c; }
        .suggestion.medium { border-left: 4px solid #ffcc02; }
        .suggestion.low { border-left: 4px solid #89d185; }
        .enhanced-prompt {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .loading {
            text-align: center;
            padding: 20px;
            opacity: 0.7;
        }
        .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .checkbox-group {
            margin: 10px 0;
        }
        .checkbox-group label {
            display: flex;
            align-items: center;
            font-weight: normal;
            margin-bottom: 8px;
        }
        .checkbox-group input[type="checkbox"] {
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Prompt Enhancer</h1>
        
        <div class="section">
            <h2>✨ Analyze & Enhance Existing Prompt</h2>
            <label for="promptInput">Enter your prompt:</label>
            <textarea id="promptInput" placeholder="Enter the prompt you want to enhance..."></textarea>
            <button onclick="analyzePrompt()">Analyze Prompt</button>
            <button onclick="copyPrompt()" class="secondary">Copy Prompt</button>
        </div>

        <div class="section">
            <h2>🚀 Generate from Intent</h2>
            <label for="intentInput">Describe what you want to achieve:</label>
            <input type="text" id="intentInput" placeholder="I want to create a script that..." />
            <label for="domainInput">Domain/Context (optional):</label>
            <input type="text" id="domainInput" placeholder="e.g., web development, data analysis..." />
            <button onclick="generateFromIntent()">Generate Prompt</button>
        </div>

        <div id="results" style="display: none;">
            <div class="section">
                <h2>💡 Enhancement Suggestions</h2>
                <div id="suggestions"></div>
                <button onclick="applySelectedEnhancements()" id="applyBtn" style="display: none;">Apply Selected Enhancements</button>
            </div>
        </div>

        <div id="enhanced" style="display: none;">
            <div class="section">
                <h2>✅ Enhanced Prompt</h2>
                <div id="enhancedContent"></div>
                <button onclick="copyEnhanced()">Copy Enhanced Prompt</button>
                <button onclick="useEnhanced()" class="secondary">Use This Prompt</button>
            </div>
        </div>

        <div id="loading" class="loading" style="display: none;">
            <p id="loadingMessage">Processing...</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentPrompt = '';
        let currentSuggestions = [];

        function analyzePrompt() {
            const prompt = document.getElementById('promptInput').value.trim();
            if (!prompt) {
                alert('Please enter a prompt to analyze.');
                return;
            }
            currentPrompt = prompt;
            vscode.postMessage({
                command: 'analyzePrompt',
                prompt: prompt
            });
        }

        function generateFromIntent() {
            const intent = document.getElementById('intentInput').value.trim();
            const domain = document.getElementById('domainInput').value.trim();
            if (!intent) {
                alert('Please describe what you want to achieve.');
                return;
            }
            vscode.postMessage({
                command: 'generateFromIntent',
                intent: intent,
                domain: domain || undefined
            });
        }

        function copyPrompt() {
            const prompt = document.getElementById('promptInput').value;
            vscode.postMessage({
                command: 'copyToClipboard',
                text: prompt
            });
        }

        function copyEnhanced() {
            const enhanced = document.querySelector('#enhancedContent textarea');
            if (enhanced) {
                vscode.postMessage({
                    command: 'copyToClipboard',
                    text: enhanced.value
                });
            }
        }

        function useEnhanced() {
            const enhanced = document.querySelector('#enhancedContent textarea');
            if (enhanced) {
                vscode.postMessage({
                    command: 'useEnhanced',
                    prompt: enhanced.value
                });
            }
        }

        function applySelectedEnhancements() {
            const selected = Array.from(document.querySelectorAll('input[name="suggestion"]:checked'))
                .map(cb => currentSuggestions[parseInt(cb.value)]);
            
            if (selected.length === 0) {
                alert('Please select at least one enhancement suggestion.');
                return;
            }

            vscode.postMessage({
                command: 'applyEnhancements',
                originalPrompt: currentPrompt,
                selectedSuggestions: selected
            });
        }

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'loadPrompt':
                    document.getElementById('promptInput').value = message.prompt;
                    break;
                    
                case 'showLoading':
                    document.getElementById('loading').style.display = 'block';
                    document.getElementById('loadingMessage').textContent = message.message;
                    document.getElementById('results').style.display = 'none';
                    document.getElementById('enhanced').style.display = 'none';
                    break;
                    
                case 'showSuggestions':
                    document.getElementById('loading').style.display = 'none';
                    showSuggestions(message.suggestions);
                    break;
                    
                case 'showEnhancedPrompt':
                    document.getElementById('loading').style.display = 'none';
                    showEnhancedPrompt(message.enhancedPrompt);
                    break;
                    
                case 'showGeneratedPrompt':
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('promptInput').value = message.prompt;
                    break;
                    
                case 'showError':
                    document.getElementById('loading').style.display = 'none';
                    showError(message.message);
                    break;
            }
        });

        function showSuggestions(suggestions) {
            currentSuggestions = suggestions;
            const container = document.getElementById('suggestions');
            const results = document.getElementById('results');
            const applyBtn = document.getElementById('applyBtn');
            
            if (suggestions.length === 0) {
                container.innerHTML = '<p>No suggestions available. Your prompt looks good!</p>';
                applyBtn.style.display = 'none';
            } else {
                container.innerHTML = suggestions.map((suggestion, index) => \`
                    <div class="suggestion \${suggestion.priority}">
                        <div class="suggestion-header">
                            <span class="suggestion-type">\${suggestion.type}</span>
                            <span class="suggestion-priority">\${suggestion.priority} priority</span>
                        </div>
                        <p><strong>\${suggestion.suggestion}</strong></p>
                        \${suggestion.preview ? \`<p><em>Preview: \${suggestion.preview}</em></p>\` : ''}
                        <label>
                            <input type="checkbox" name="suggestion" value="\${index}">
                            Apply this enhancement
                        </label>
                    </div>
                \`).join('');
                applyBtn.style.display = 'block';
            }
            
            results.style.display = 'block';
        }

        function showEnhancedPrompt(enhancedPrompt) {
            const container = document.getElementById('enhancedContent');
            container.innerHTML = \`
                <div class="enhanced-prompt">
                    <h3>Original Prompt:</h3>
                    <textarea readonly style="height: 80px;">\${currentPrompt}</textarea>
                    <h3>Enhanced Prompt:</h3>
                    <textarea style="height: 120px;">\${enhancedPrompt}</textarea>
                </div>
            \`;
            document.getElementById('enhanced').style.display = 'block';
        }

        function showError(message) {
            const container = document.getElementById('suggestions');
            container.innerHTML = \`<div class="error">\${message}</div>\`;
            document.getElementById('results').style.display = 'block';
        }
    </script>
</body>
</html>`;
}