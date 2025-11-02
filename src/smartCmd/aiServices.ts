// AI Services Module - All LLM-related functions
import * as vscode from 'vscode';
import { smartCmdButton } from './treeProvider';
import * as path from 'path';
import * as fs from 'fs/promises';

// Development mode flag - set to false in production
const ENABLE_PROMPT_LOGGING = true;

/**
 * Log AI prompts to file for development/debugging purposes
 */
async function logPromptToFile(functionName: string, prompt: string, metadata?: any): Promise<void> {
	if (!ENABLE_PROMPT_LOGGING) {
		return;
	}

	try {
		// Get workspace folder for log file
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		const logFilePath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'ai_prompts.log');
		
		// Ensure directory exists
		await fs.mkdir(path.dirname(logFilePath), { recursive: true });

		const timestamp = new Date().toISOString();
		const logEntry = `
${'='.repeat(80)}
TIMESTAMP: ${timestamp}
FUNCTION: ${functionName}
METADATA: ${metadata ? JSON.stringify(metadata, null, 2) : 'N/A'}
${'='.repeat(80)}

${prompt}

${'='.repeat(80)}

`;

		// Append to log file
		await fs.appendFile(logFilePath, logEntry, 'utf-8');
		console.log(`DevBoost: Logged prompt from ${functionName} to ${logFilePath}`);
	} catch (error) {
		console.error('DevBoost: Error logging prompt to file:', error);
	}
}

// Get system information for AI context
function getSystemInfo(): { platform: string; shell: string} {
	// Determine OS
	let platform = 'Unknown';
	if (process.platform === 'win32') {
		platform = 'Windows';
	} else if (process.platform === 'darwin') {
		platform = 'macOS';
	} else if (process.platform === 'linux') {
		platform = 'Linux';
	}

	// Get shell information
	const shell = process.env.SHELL || process.env.COMSPEC || 'Unknown shell';
	const shellName = path.basename(shell).replace(/\.(exe|com|bat)$/i, '');

	return {
		platform,
		shell: shellName
	};
}

/**
 * AI-powered duplicate detection using semantic similarity
 * Returns the existing button if duplicate found, null otherwise
 */
export async function checkDuplicateButton(
	newButton: smartCmdButton,
	existingButtons: smartCmdButton[],
	targetScope: 'workspace' | 'global'
): Promise<smartCmdButton | null> {
	if (existingButtons.length === 0) {
		return null;
	}

	// Filter buttons based on scope
	const buttonsToCheck = targetScope === 'global'
		? existingButtons.filter(b => b.scope === 'global')
		: existingButtons;

	if (buttonsToCheck.length === 0) {
		return null;
	}

	// Normalize command for comparison
	const normalizeCmd = (cmd: string): string => {
		return cmd
			.replace(/\{[^}]+\}/g, '{VAR}')
			.replace(/['"`]/g, '')
			.replace(/\s+/g, ' ')
			.toLowerCase()
			.trim();
	};

	const newCmdNormalized = normalizeCmd(newButton.cmd);

	// Quick exact match check
	for (const existing of buttonsToCheck) {
		const existingCmdNormalized = normalizeCmd(existing.cmd);
		
		if (newCmdNormalized === existingCmdNormalized) {
			console.log(`Duplicate detected: "${newButton.cmd}" matches "${existing.cmd}" (${existing.scope})`);
			return existing;
		}
	}

	// Use AI for semantic similarity check
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-sonnet-4.5' });
		
		if (models.length === 0) {
			return null;
		}

		const model = models[0];

		const existingButtonsInfo = buttonsToCheck.map((b, i) => {
			const desc = b.ai_description || b.user_description || 'N/A';
			return `${i + 1}. Name: "${b.name}", Command: "${b.cmd}", Description: "${desc}", Scope: ${b.scope}`;
		}).join('\n');

		const scopeContext = targetScope === 'global'
			? 'This button will be available globally (in all projects).'
			: 'This button will be available in the current workspace. Checking against both global and workspace buttons.';

		const newButtonDesc = newButton.ai_description || newButton.user_description || 'N/A';

		const prompt = `Compare this new button with existing buttons and determine if it's a duplicate.
		
New Button (Target Scope: ${targetScope}):
- Name: "${newButton.name}"
- Command: "${newButton.cmd}"
- Description: "${newButtonDesc}"

${scopeContext}

Existing Buttons to Check:
${existingButtonsInfo}

Consider buttons as duplicates if they:
1. Execute the same command (even with different variable names)
2. Perform the same action (e.g., "git commit" vs "commit changes")
3. Have the same functionality with minor syntax differences

Don't consider buttons as duplicates if they:
1. Have different commands even if they seem related (e.g., "git commit" vs "git push")
2. Have specific tasks assigned to it even if a similar command exists

If it's a duplicate/similar, respond with JSON containing the existing button's details:
{"name": "🔨 Build Project", "cmd": "npm run build", "scope": "workspace"}

If it's unique, respond with only "UNIQUE".`;

		// Log prompt for development
		await logPromptToFile('checkDuplicateButton', prompt, {
			newButton: { name: newButton.name, cmd: newButton.cmd },
			targetScope,
			existingButtonsCount: buttonsToCheck.length
		});

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        console.log('AI duplicate detection prompt:', prompt);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		console.log('AI duplicate detection response:', fullResponse);
		const answer = fullResponse.trim();
		
		if (answer.toUpperCase() === 'UNIQUE' || answer.toUpperCase().includes('NO')) {
			return null;
		}
		
		// Try to parse JSON response with button details
		try {
			// Clean up the response (remove code blocks if present)
			let cleanedAnswer = answer.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
			
			// Try to find JSON object in the response
			const jsonMatch = cleanedAnswer.match(/\{[^}]+\}/);
			if (jsonMatch) {
				const aiResponse = JSON.parse(jsonMatch[0]);
				
				// Validate that we have the required fields
				if (aiResponse.name && aiResponse.cmd && aiResponse.scope) {
					// Find the button that matches ALL three fields
					const matchingButton = buttonsToCheck.find(b => 
						b.name === aiResponse.name && 
						normalizeCmd(b.cmd) === normalizeCmd(aiResponse.cmd) &&
						b.scope === aiResponse.scope
					);
					
					if (matchingButton) {
						console.log(`AI detected duplicate: "${newButton.name}" is similar to "${matchingButton.name}" (cmd: "${matchingButton.cmd}", scope: ${matchingButton.scope})`);
						return matchingButton;
					} else {
						console.warn(`AI returned button details but couldn't find exact match: ${JSON.stringify(aiResponse)}`);
						return null;
					}
				}
			}
		} catch (parseError) {
			console.warn('Failed to parse AI response as JSON:', parseError);
			console.warn('AI response was:', answer);
		}
		
		// If we couldn't parse the response or validate the match, treat as not a duplicate
		// Better to allow a potential duplicate than to incorrectly match by name alone
		console.log('Could not validate duplicate with full details, treating as unique');
		return null;

	} catch (error) {
		console.error('Error in AI duplicate detection:', error);
		return null;
	}
}

/**
 * Check if a button is safe to add to global scope using AI
 */
export async function checkIfButtonIsGlobalSafe(button: smartCmdButton): Promise<boolean> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-sonnet-4.5' });
		
		if (models.length === 0) {
			console.log('DevBoost: No AI model available for global safety check');
			return true;
		}

		const model = models[0];

		const prompt = `Analyze this VS Code button command to determine if it's safe to use globally across all projects, or if it's workspace-specific.

Button Details:
- Name: "${button.name}"
- Command: "${button.cmd}"
- User Description: "${button.user_description || 'N/A'}"
- AI Description: "${button.ai_description || 'N/A'}"

A button is WORKSPACE-SPECIFIC if it:
1. Uses RELATIVE paths that reference project structure (e.g., ./src/build.sh, ../config/setup.js, npm run custom-script)
2. References project-specific directories/files (e.g., ./node_modules, ./package.json, ./src, ./config)
3. Uses workspace-specific configuration files in project root (e.g., .env, config.json, settings.json)
4. Runs project-specific npm/yarn scripts that may not exist in other projects (e.g., npm run deploy-prod)
5. References workspace settings or workspace-only VS Code commands
6. Contains project-specific variable names, database names, or project identifiers
7. Uses paths like "node scripts/build.js" which assumes project structure

A button is GLOBAL-SAFE if it:
1. Uses generic commands that work anywhere (e.g., git status, npm install, npm test, ls, cd)
2. Uses ABSOLUTE paths to system-wide tools (e.g., /usr/local/bin/deploy-script.sh, C:\\Tools\\build.exe)
3. Uses VS Code built-in commands (e.g., workbench.action.files.save)
4. Runs standard tooling commands available globally (e.g., prettier, eslint, tsc, docker)
5. General utility commands that don't depend on project structure
6. System-level scripts or applications with absolute paths that exist across projects

IMPORTANT: Absolute paths to system tools are SAFE (they're global). Relative paths to project files are UNSAFE (they're workspace-specific).

Respond with ONLY one word:
- "SAFE" if the button can be used globally across all projects
- "UNSAFE" if the button is workspace-specific and shouldn't be global`;

		// Log prompt for development
		await logPromptToFile('checkIfButtonIsGlobalSafe', prompt, {
			button: { name: button.name, cmd: button.cmd },
			currentScope: button.scope
		});

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        console.log('DevBoost: Global safety check prompt:', prompt);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		console.log('DevBoost: Global safety check response:', fullResponse);
		const answer = fullResponse.trim().toUpperCase();
		
		return answer.includes('SAFE') && !answer.includes('UNSAFE');

	} catch (error) {
		console.error('Error in global safety check:', error);
		return true;
	}
}

/**
 * Get AI suggestions for buttons based on activity patterns
 */
export async function getAISuggestions(
	optimizedLog: { summary: string; recentLogs: string[] }
): Promise<smartCmdButton[]> {
	try {
		// Log ALL available Copilot models first
		const allModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
		console.log('DevBoost: ALL available Copilot models:', allModels.map(m => ({ family: m.family, name: m.name, maxTokens: m.maxInputTokens })));
		
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-sonnet-4.5' });
		
		// Log selected model
		console.log('DevBoost: Selected copilot models:', models.map(m => ({ family: m.family, name: m.name, maxTokens: m.maxInputTokens })));
		
		if (models.length === 0) {
			vscode.window.showWarningMessage('GitHub Copilot models not available. Using fallback suggestions.');
			return getFallbackSuggestions([]);
		}

		const model = models[0];
		const { platform, shell } = getSystemInfo();
	
	const prompt = 
	`You are an elite DevOps automation expert creating intelligent command buttons for a developer's specific workflow.

🖥️  SYSTEM ENVIRONMENT:
- OS: ${platform} | Shell: ${shell}

📊 STATISTICAL OVERVIEW:
${optimizedLog.summary}

RECENT ACTIVITY LOG (Last ${optimizedLog.recentLogs.length} Commands in Sequential Order):
${optimizedLog.recentLogs.join('\n')}

🎯 CRITICAL SUCCESS CRITERIA:
1. **SEQUENTIAL ANALYSIS**: Study the command sequences above to understand the developer's actual workflow
2. **TERMINAL-AWARE WORKFLOWS**: Each log entry has Context.terminal.id - group commands by terminal ID to understand parallel workflows
   • Terminal A running dev server while Terminal B handles git operations = separate workflows
   • Same terminal ID with repeated sequences = workflow pattern to automate
3. **WORKFLOW RECOGNITION**: Identify repetitive multi-step patterns by analyzing the sequential logs
4. **DIRECTORY-AWARE**: Notice which directories commands are executed in (from Context.terminal.cwd)
5. **FAILURE-PROOF DESIGN**: Address commands that failed (non-zero exit codes)
6. **CHAIN INTELLIGENCE**: Create buttons that automate entire workflows, not just single commands


EXAMPLES OF SMART BUTTONS FROM SEQUENTIAL ANALYSIS:
• If you see: "npm install" → "npm run build" → "npm test" repeatedly IN SAME TERMINAL
  Create: "cd project && npm install && npm run build && npm test"
  
• If you see PARALLEL WORKFLOWS (different terminal IDs):
  Terminal 12345: "cd /frontend && npm run dev" (long-running)
  Terminal 67890: "git add . && git commit && git push" (repeated)
  Create separate buttons for each workflow
  
• If you see: "git add ." → "git commit -m ..." → "git push" pattern
  Create: "git add . && git commit -m '{message}' && git push"
  With inputs: [{"placeholder": "Enter commit message", "variable": "{message}"}]
  
• If you see frequent directory changes before commands
  Include: "cd [detected-dir] && [command]"
  
• If command needs user input, use {variableName} placeholders:
  Command: "docker exec -it {container} bash"
  With inputs: [{"placeholder": "Container name", "variable": "{container}"}]

🔧 ${platform} COMMAND REQUIREMENTS:
${platform === 'Windows' ? '• Use && for chaining, handle Windows paths, use npm.cmd if needed' : ''}
${platform === 'macOS' || platform === 'Linux' ? '• Use && for chaining, Unix paths, proper shell escaping' : ''}
• All commands must work reliably in ${shell}
• Include error handling where appropriate (|| echo "Error occurred")

🚨 IMPORTANT RULE - EMOJIS:
• ONLY use emoji/icon in the "name" field at the beginning (e.g., "🚀 Build Project")
• NEVER use emojis, icons, or special characters in the "cmd" field - it must be plain terminal command text only
• NEVER use emojis, icons, or special characters in the "ai_description" field

📝 RESPONSE FORMAT (JSON only):

WITHOUT INPUT FIELDS - CORRECT FORMAT:
[
    {
        "name": "🚀 Build and Deploy",
        "cmd": "cd /path/to/project && npm run build && npm run deploy",
        "ai_description": "Automates the build and deploy workflow pattern"
    }
]

WITH INPUT FIELDS - CORRECT FORMAT:
[
    {
        "name": "📝 Git Commit & Push",
        "cmd": "git add . && git commit -m '{message}' && git push",
        "ai_description": "Stages changes, commits with custom message, and pushes to remote",
        "inputs": [
            {
                "placeholder": "Enter commit message",
                "variable": "{message}"
            }
        ]
    },
    {
        "name": "🐳 Docker Execute",
        "cmd": "docker exec -it {container} {command}",
        "ai_description": "Execute command inside a Docker container",
        "inputs": [
            {
                "placeholder": "Container name",
                "variable": "{container}"
            },
            {
                "placeholder": "Command to run",
                "variable": "{command}"
            }
        ]
    }
]

WRONG FORMAT (DO NOT DO THIS):
[
    {
        "name": "Build Project",
        "cmd": "cd project && make msim_main || echo '❌ Build failed'",  ❌ NO EMOJIS IN CMD!
        "ai_description": "Builds the project ✅"  ❌ NO EMOJIS IN DESCRIPTION!
    }
]

Analyze the sequential logs carefully and generate 3-5 buttons that automate the ACTUAL workflows you observe.
RESPOND WITH JSON ARRAY ONLY - NO OTHER TEXT:`;

		// Log prompt for development
		await logPromptToFile('getAISuggestions', prompt, {
			platform,
			shell,
			recentLogsCount: optimizedLog.recentLogs.length,
		});

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		console.log('AI button suggestions prompt:', prompt);
		
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		console.log('AI response for button suggestions:', fullResponse);

		const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const buttons = JSON.parse(jsonMatch[0]) as smartCmdButton[];
			console.log('Parsed buttons from AI response:', buttons);
			return buttons.filter(b => b.name && b.cmd);
		}

		vscode.window.showWarningMessage('Could not parse AI response. Using fallback suggestions.');
		return getFallbackSuggestions([]);

	} catch (err) {
		if (err instanceof vscode.LanguageModelError) {
			console.log('Language Model Error:', err.message, err.code);
			vscode.window.showWarningMessage(`AI suggestion failed: ${err.message}. Using fallback suggestions.`);
		} else {
			console.error('Unexpected error getting AI suggestions:', err);
			vscode.window.showWarningMessage('AI suggestion failed. Using fallback suggestions.');
		}
		return getFallbackSuggestions([]);
	}
}

/**
 * Get custom button suggestion from user description
 */
export async function getCustomButtonSuggestion(
	description: string,
	scope: 'workspace' | 'global' = 'workspace'
): Promise<smartCmdButton | null> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-sonnet-4.5' });
		
		if (models.length === 0) {
			vscode.window.showInformationMessage('GitHub Copilot not available. Please enter button details manually.');
			return null;
		}

		const model = models[0];
		const { platform, shell } = getSystemInfo();
		
		// Get workspace context if scope is workspace
		let workspaceContext = '';
		if (scope === 'workspace') {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const workspaceName = workspaceFolder.name;
				const workspacePath = workspaceFolder.uri.fsPath;
				workspaceContext = `
WORKSPACE CONTEXT:
- Workspace Name: ${workspaceName}
- Workspace Path: ${workspacePath}
- Button Scope: Workspace-specific (will only be available in this project)

IMPORTANT: Since this button is workspace-specific, you can:
- Use relative paths if told in description (e.g., ./src, ./scripts, npm run custom-script)
- Reference project-specific files and directories if provided (e.g., ./package.json, ./config)
`;
			}
		} else {
			workspaceContext = `
BUTTON SCOPE: Global (will be available across all projects)

IMPORTANT: Since this button is global, you should:
- Use generic commands that work anywhere (e.g., git status, npm install)
- Avoid relative paths or project-specific references
- Use only standard tooling commands available globally
- Do NOT assume any specific project structure
`;
		}
		
		const prompt = `Create a VS Code button based on this description: "${description}"

SYSTEM INFORMATION:
- Operating System: ${platform}
- Shell: ${shell}
${workspaceContext}

IMPORTANT: Generate commands that are compatible with ${platform} and ${shell}.
${platform === 'Windows' ? '- Use Windows-compatible commands (e.g., PowerShell or cmd syntax)' : ''}
${platform === 'macOS' || platform === 'Linux' ? '- Use Unix/Linux-compatible commands (bash/zsh syntax)' : ''}
🚨 CRITICAL RULE - EMOJIS:
• ONLY use emoji/icon in the "name" field at the beginning (e.g., "🚀 Build Project")
• NEVER use emojis, icons, or special characters in the "cmd" field - it must be plain terminal command text only
• NEVER use emojis, icons, or special characters in the "ai_description" field
• The "cmd" field will be executed directly in the terminal - any emoji will cause execution failure

Provide:
1. A short descriptive name (with an emoji prefix, max 30 characters)
2. The exact command to execute (terminal command or VS Code command like "workbench.action.files.saveAll") - MUST be compatible with ${platform}
3. A brief description of what the button does (this will be stored as ai_description) - NO EMOJIS
4. If the command needs user input, include input fields with placeholders (use {variableName} format in cmd)

The user provided this description: "${description}" (this will be stored as user_description)

CORRECT FORMAT:
{
    "name": "🔨 Build Project",
    "cmd": "npm run build",
    "ai_description": "Builds the project using npm"
}

Or with inputs:
{
    "name": "📝 Git Commit",
    "cmd": "git add . && git commit -m '{message}'",
    "ai_description": "Stage all changes and commit with a custom message",
    "inputs": [
        {
            "placeholder": "Enter commit message",
            "variable": "{message}"
        }
    ]
}

WRONG FORMAT (DO NOT DO THIS):
{
    "name": "Build Project",  ❌ Missing emoji in name
    "cmd": "npm run build || echo '❌ Failed'",  ❌ NO EMOJIS IN CMD!
    "ai_description": "Builds the project ✅"  ❌ NO EMOJIS IN DESCRIPTION!
}

Only respond with the JSON object, no additional text.`;

		// Log prompt for development
		await logPromptToFile('getCustomButtonSuggestion', prompt, {
			description,
			scope,
			platform,
			shell,
			workspaceName: vscode.workspace.workspaceFolders?.[0]?.name
		});

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		console.log('Custom button prompt:', prompt);

		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		console.log('AI response for custom button:', fullResponse);

		try {
			let cleanedResponse = fullResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
			
			const firstBrace = cleanedResponse.indexOf('{');
			const lastBrace = cleanedResponse.lastIndexOf('}');
			
			if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
				const jsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
				const button = JSON.parse(jsonString) as smartCmdButton;
				
				if (button.name && button.cmd && button.ai_description) {
					button.user_description = description;
					console.log('Successfully parsed button:', button);
					return button;
				}
			}
		} catch (parseError) {
			console.error('JSON parsing error:', parseError);
		}

		vscode.window.showInformationMessage('Could not parse AI response. Please enter button details manually.');
		return null;

	} catch (err) {
		if (err instanceof vscode.LanguageModelError) {
			console.log('Language Model Error:', err.message, err.code);
			vscode.window.showInformationMessage(`AI suggestion failed: ${err.message}. Please enter manually.`);
		} else {
			console.error('Unexpected error getting custom button suggestion:', err);
			vscode.window.showInformationMessage('AI suggestion failed. Please enter button details manually.');
		}
		return null;
	}
}

/**
 * Fallback suggestions based on common patterns
 */
export function getFallbackSuggestions(topActivities: string[]): smartCmdButton[] {
	const buttons: smartCmdButton[] = [];
	const activityString = topActivities.join(' ').toLowerCase();

	if (activityString.includes('git') || activityString.includes('commit')) {
		buttons.push({
			name: '📝 Git Commit',
			cmd: 'git add . && git commit -m \'{message}\'',
			ai_description: 'Stage all changes and commit with a custom message',
			inputs: [
				{
					placeholder: 'Enter commit message',
					variable: '{message}'
				}
			]
		});
		buttons.push({
			name: '🚀 Git Push',
			cmd: 'git push',
			ai_description: 'Push commits to remote repository'
		});
	}

	if (activityString.includes('npm') || activityString.includes('build')) {
		buttons.push({
			name: '🔨 Build',
			cmd: 'npm run build',
			ai_description: 'Build the project using npm'
		});
	}

	if (activityString.includes('test')) {
		buttons.push({
			name: '🧪 Run Tests',
			cmd: 'npm test',
			ai_description: 'Run all tests in the project'
		});
	}

	if (activityString.includes('save')) {
		buttons.push({
			name: '💾 Save All',
			cmd: 'workbench.action.files.saveAll',
			ai_description: 'Save all open files'
		});
	}

	if (buttons.length === 0) {
		buttons.push(
			{
				name: '🔨 Build',
				cmd: 'npm run build',
				ai_description: 'Build the project'
			},
			{
				name: '🧪 Test',
				cmd: 'npm test',
				ai_description: 'Run tests'
			},
			{
				name: '📝 Commit',
				cmd: 'git add . && git commit -m \'{message}\'',
				ai_description: 'Commit changes with a message',
				inputs: [
					{
						placeholder: 'Enter commit message',
						variable: '{message}'
					}
				]
			}
		);
	}

	return buttons.slice(0, 5);
}
