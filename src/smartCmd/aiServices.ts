// AI Services Module - All LLM-related functions
import * as vscode from 'vscode';
import { smartCmdButton } from './treeProvider';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as activityLogging from '../activityLogging';
import * as configManager from '../configManager';

// Development mode flag - set to false in production
const ENABLE_PROMPT_LOGGING = false;

/**
 * Log AI prompts to file for development/debugging purposes
 */
async function logPromptToFile(functionName: string, prompt: string, response: string, metadata?: any): Promise<void> {
	if (!ENABLE_PROMPT_LOGGING) {
		return;
	}

	try {
		// Get workspace folder for log file
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		const logFilePath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'devBoost', 'ai_services_smartCmd.log');
		
		// Ensure directory exists
		await fs.mkdir(path.dirname(logFilePath), { recursive: true });

		const timestamp = new Date().toISOString();
		const logEntry = `
${'='.repeat(80)}
TIMESTAMP: ${timestamp}
FUNCTION: ${functionName}
METADATA: ${metadata ? JSON.stringify(metadata, null, 2) : 'N/A'}

${'='.repeat(80)}
PROMPT:
${prompt}

${'='.repeat(80)}
RESPONSE:
${response}
${'='.repeat(80)}
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
export function getSystemInfo(): { platform: string; shell: string} {
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
	targetScope: 'workspace' | 'global',
	globalStoragePath?: string
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
		const model = await configManager.getAIModel('smartCmd', globalStoragePath);
		
		if (!model) {
			return null;
		}

		const existingButtonsInfo = buttonsToCheck.map((b, i) => {
			const desc = b.description || 'N/A';
			const user_prompt = b.user_prompt || 'N/A';
			return `${i + 1}. Name: "${b.name}", Exec Dir: "${b.execDir}", Command: "${b.cmd}", Description: "${desc}", User Prompt: "${user_prompt}", Scope: ${b.scope}, ID: ${b.id}`;
		}).join('\n');

		const scopeContext = targetScope === 'global'
			? 'This button will be available globally (in all projects).'
			: 'This button will be available in the current workspace. Checking against both global and workspace buttons.';

		const newButtonDesc = newButton.description || 'N/A';
		const newUserPrompt = newButton.user_prompt || 'N/A';

		const prompt = `Compare this new button with existing buttons and determine if it's a duplicate.
		
New Button (Target Scope: ${targetScope}):
- Name: "${newButton.name}"
- Exec Dir: "${newButton.execDir && newButton.execDir.trim() !== '' ? newButton.execDir : '.'}"
- Command: "${newButton.cmd}"
- Description: "${newButtonDesc}"
- User Prompt: "${newUserPrompt}"

${scopeContext}

Existing Buttons to Check:
${existingButtonsInfo}

Consider buttons as duplicates if they:
1. VERY IMPORTANT: Have any similarity in their name or description which can confuse users
2. Execute the same command (even with different variable names)
3. Perform the same action (e.g., "git commit" vs "commit changes")
4. Have the same functionality with minor syntax differences

Don't consider buttons as duplicates if they:
1. Have different commands even if they seem related (e.g., "git commit" vs "git push")
2. Have specific tasks assigned to it even if a similar command exists
3. Execute commands in different directories that change their context significantly

NOTE:
If it's a duplicate/similar, respond with only JSON object containing the existing button's details.
Eg:
{"ID": "provided-uuid"}

If it's unique, respond with only "UNIQUE".`;

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        console.log('AI duplicate detection prompt:', prompt);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		// Log prompt for development
		await logPromptToFile('checkDuplicateButton', prompt, fullResponse, {
			newButton: { name: newButton.name, execDir: newButton.execDir, cmd: newButton.cmd },
			targetScope,
			existingButtonsCount: buttonsToCheck.length,
			model: model.family
		});

		console.log('AI duplicate detection response:', fullResponse);
		const answer = fullResponse.trim();
		
		if (answer.toUpperCase() === 'UNIQUE' || answer.toUpperCase().includes('NO')) {
			return null;
		}
		
		// Try to parse JSON response with button details
		try {
			// Clean up the response (remove code blocks if present)
			let cleanedAnswer = answer.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
			
			// Try to parse the entire cleaned answer as JSON
			// If that fails, try to find JSON object using a more robust regex
			let aiResponse;
			try {
				aiResponse = JSON.parse(cleanedAnswer);
			} catch (directParseError) {
				// Try to find JSON object in the response using balanced braces
				const jsonMatch = cleanedAnswer.match(/\{(?:[^{}]|\{[^{}]*\})*\}/);
				if (jsonMatch) {
					aiResponse = JSON.parse(jsonMatch[0]);
				} else {
					throw new Error('No valid JSON found in response');
				}
			}
			
			if (aiResponse) {
				// Validate that we have the required fields
				if ( aiResponse.ID) {
					// Find the button that matches ALL three fields
					const matchingButton = buttonsToCheck.find(b => 
						b.id === aiResponse.ID
					);
					
					if (matchingButton) {
						console.log(`AI detected duplicate: "${newButton.name}" is similar to "${matchingButton.name}" (cmd: "${matchingButton.cmd}", description: "${matchingButton.description}", scope: ${matchingButton.scope}, execDir: ${matchingButton.execDir})`);
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
 * Returns an object with isSafe boolean and reason string
 */
export async function checkIfButtonIsGlobalSafe(button: smartCmdButton, globalStoragePath?: string): Promise<{ isSafe: boolean; reason?: string }> {
	try {
		const model = await configManager.getAIModel('smartCmd', globalStoragePath);
		
		if (!model) {
			console.log('DevBoost: No AI model available for global safety check');
			return { isSafe: true };
		}

		const prompt = `Analyze this VS Code button command to determine if it's safe to use globally across all projects, or if it's workspace-specific.

Button Details:
- Name: "${button.name}"
- Exec Dir: "${button.execDir && button.execDir.trim() !== '' ? button.execDir : '.'}"
- Command: "${button.cmd}"
- Description: "${button.description || 'N/A'}"
- User Prompt: "${button.user_prompt || 'N/A'}"

A button is WORKSPACE-SPECIFIC if it:
1. Uses RELATIVE paths that is not generic directory like current directory and reference project structure (e.g., ./src/build.sh, ../config/setup.js, npm run custom-script)
2. Uses workspace-specific configuration files in project root (e.g., .env, config.json, settings.json)
3. Runs project-specific npm/yarn scripts that may not exist in other projects (e.g., npm run deploy-prod)
4. References workspace settings or workspace-only VS Code commands
5. Contains workspace-specific variable names, database names, or project identifiers
6. Uses paths like "node scripts/build.js" which assumes workspace structure
7. Name or description indicates workspace-specific context

A button is GLOBAL-SAFE if it:
1. Uses generic commands that work anywhere (e.g., git status, npm install, npm test, ls, cd)
2. Uses ABSOLUTE paths to system-wide tools (e.g., /usr/local/bin/deploy-script.sh, C:\\Tools\\build.exe)
3. Uses <workspace> as a placeholder for the workspace directory
4. Uses current directory (.) or home directory (~) as path references
5. Uses VS Code built-in commands (e.g., workbench.action.files.save)
6. Runs standard tooling commands available globally (e.g., prettier, eslint, tsc, docker)
7. General utility commands that don't depend on project structure
8. System-level scripts or applications with absolute paths that exist across projects

IMPORTANT: Absolute paths to system tools are SAFE (they're global). Relative paths to workspace files are UNSAFE (they're workspace-specific).

Response format:
- If SAFE: Respond with only "SAFE"
- If UNSAFE: Respond with JSON: {"status": "UNSAFE", "reason": "Brief explanation why it's workspace-specific"}

Examples:
SAFE
{"status": "UNSAFE", "reason": "Uses relative path ./src which assumes specific project structure"}
{"status": "UNSAFE", "reason": "Runs npm script 'deploy-prod' which may not exist in other projects"}`;

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        console.log('DevBoost: Global safety check prompt:', prompt);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		// Log prompt for development
		await logPromptToFile('checkIfButtonIsGlobalSafe', prompt, fullResponse, {
			button: { name: button.name, execDir: button.execDir, cmd: button.cmd },
			currentScope: button.scope,
			model: model.family
		});

		console.log('DevBoost: Global safety check response:', fullResponse);
		const answer = fullResponse.trim();
		
		// Check if response is simply "SAFE"
		if (answer.toUpperCase() === 'SAFE' || (answer.toUpperCase().includes('SAFE') && !answer.toUpperCase().includes('UNSAFE'))) {
			return { isSafe: true };
		}
		
		// Try to parse JSON response with reason
		try {
			const jsonMatch = answer.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]);
				if (parsed.status === 'UNSAFE' && parsed.reason) {
					return { isSafe: false, reason: parsed.reason };
				}
			}
		} catch (parseError) {
			console.warn('Failed to parse AI safety check response as JSON:', parseError);
		}
		
		// Default to unsafe if we couldn't determine
		return { isSafe: false, reason: 'Could not determine safety. Button may contain workspace-specific elements.' };

	} catch (error) {
		console.error('Error in global safety check:', error);
		return { isSafe: true };
	}
}

/**
 * Get AI suggestions for buttons based on activity patterns
 */
export async function getAISuggestions(
	optimizedLog: { summary: string; recentLogs: string[] },
	existingButtons: smartCmdButton[] = [],
	globalStoragePath?: string
): Promise<smartCmdButton[]> {
	try {
		const model = await configManager.getAIModel('smartCmd', globalStoragePath);
		
		if (!model) {
			vscode.window.showWarningMessage('No AI model configured. Using fallback suggestions.');
			return getFallbackSuggestions([]);
		}
		const { platform, shell } = getSystemInfo();
		let workspaceName = 'N/A';
		let workspacePath = 'N/A';
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			workspaceName = workspaceFolder.name;
			workspacePath = workspaceFolder.uri.fsPath;
		}

		const existingButtonsInfo = existingButtons.map((b, i) => {
			const desc = b.description || 'N/A';
			const user_prompt = b.user_prompt || 'N/A';
			return `${i + 1}. Name: "${b.name}", Exec Dir: "${b.execDir}", Command: "${b.cmd}", Description: "${desc}", User Prompt: "${user_prompt}", Scope: ${b.scope}`;
		}).join('\n');

	
	const prompt = 
	`You are an elite DevOps automation expert creating intelligent command buttons for a developer's specific workflow.

🖥️  SYSTEM ENVIRONMENT:
- OS: ${platform} | Shell: ${shell}

WORKSPACE CONTEXT:
- Workspace Name: ${workspaceName}
- Workspace Path: ${workspacePath}
- Button Scope: Workspace-specific (will only be available in this project)

IMPORTANT: For workspace buttons, use <workspace> keyword in execDir to make buttons portable:
- Use "<workspace>" to refer to the workspace root directory
- Use "<workspace>/frontend" for workspace subdirectories
- This makes buttons work across different machines and workspace locations
- Example: "execDir": "<workspace>/backend" instead of "/absolute/path/to/backend"

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
7. **SCRIPT VS COMMAND CHAIN**: For complex workflows, generate scripts instead of command chains

🔄 WHEN TO USE SCRIPTS VS COMMAND CHAINS:

USE SCRIPT (scriptContent field) when workflow requires:
• Multiple directory changes between commands
• Complex error handling and conditional logic
• Loops, variables, or advanced shell features
• More than 5 chained commands
• Need for intermediate checks or validation
• File manipulation between steps
• Environment variable setup and cleanup

USE COMMAND CHAIN (cmd field) when workflow is:
• Simple commands chained with &&
• Linear execution without conditions
• Single directory context
• No complex error handling needed

EXAMPLES OF SMART BUTTONS FROM SEQUENTIAL ANALYSIS:

SIMPLE COMMAND CHAIN:
• If you see: "npm install" → "npm run build" → "npm test" repeatedly IN SAME TERMINAL
  Create: "npm install && npm run build && npm test"
  
• If you see: "git add ." → "git commit -m ..." → "git push" pattern
  Create: "git add . && git commit -m '{message}' && git push"
  With inputs: [{"placeholder": "Enter commit message", "variable": "{message}"}]

• If you see frequent directory changes before commands
  Create: 
  	execDir: "<workspace>/[subdirectory]" or "<workspace>",
  	cmd: "[command]"
  Use <workspace> keyword to make it portable across different machines

• If command needs user input, use {variableName} placeholders:
  Command: "docker exec -it {container} bash"
  With inputs: [{"placeholder": "Container name", "variable": "{container}"}]

COMPLEX SCRIPT:
• If you see: "cd frontend && npm install" → "cd ../backend && npm install" → "cd .. && docker-compose up"
  Use scriptContent with proper directory management and error handling

🔧 ${platform} COMMAND REQUIREMENTS:
${platform === 'Windows' ? '• Use && for chaining, handle Windows paths, use npm.cmd if needed\n• Scripts: Use batch script syntax (.bat)' : ''}
${platform === 'macOS' || platform === 'Linux' ? '• Use && for chaining, Unix paths, proper shell escaping\n• Scripts: Use bash/sh syntax (.sh)' : ''}
• All commands must work reliably in ${shell}
• Include error handling where appropriate (|| echo "Error occurred")

🚨 CRITICAL RULE - EMOJIS:
• ONLY use emoji/icon in the "name" field at the beginning (e.g., "🚀 Build Project")
• NEVER use emojis, icons, or special characters in the "cmd" or "scriptContent" fields - plain text only
• NEVER use emojis, icons, or special characters in the "description" field
• These fields are executed directly in the terminal - any emoji will cause execution failure

Provide:
1. A short descriptive name (with an emoji prefix, max 30 characters)
2. EITHER "cmd" (for simple commands) OR "scriptContent" (for complex workflows) - NEVER both
3. A brief description of what the button does (this will be stored as description) - NO EMOJIS
4. If the command needs user input, include input fields with placeholders (use {variableName} format)
5. execDir: where to run from (applies to both cmd and scriptContent)

Existing Buttons to Check (for duplication avoidance):
${existingButtonsInfo}

📝 RESPONSE FORMAT (JSON only):

SIMPLE COMMAND CHAIN FORMAT:
[
    {
        "name": "🚀 Build and Deploy",
        "execDir": "<workspace>/subdirectory",
        "cmd": "npm run build && npm run deploy && cd /path/to/other && ./deploy.sh",
        "description": "Automates the build and deploy workflow pattern"
    },
	{
        "name": "🚀 List all files in current directory",
        "execDir": ".",
        "cmd": "ls -la",
        "description": "Lists all files in the current directory"
    }
]

SCRIPT FORMAT (for complex workflows):
[
    {
        "name": "🚀 Multi-Service Setup",
        "execDir": "<workspace>",
        "scriptContent": "cd frontend && npm install && npm run build\\ncd ../backend && npm install\\ncd .. && docker-compose up -d\\necho Setup complete",
        "description": "Sets up frontend, backend, and starts Docker services"
    }
]

WITH INPUT FIELDS - COMMAND FORMAT:
[
    {
        "name": "📝 Git Commit & Push",
        "execDir": "<workspace>",
        "cmd": "git add . && git commit -m '{message}' && git push",
        "description": "Stages changes, commits with custom message, and pushes to remote",
        "inputs": [
            {
                "placeholder": "Enter commit message",
                "variable": "{message}"
            }
        ]
    },
    {
        "name": "🐳 Docker Execute",
        "execDir": "<workspace>/path/to/context",
        "cmd": "docker exec -it {container} {command}",
        "description": "Execute command inside a Docker container",
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

WITH INPUT FIELDS - SCRIPT FORMAT:
[
    {
        "name": "🚀 Deploy to Environment",
        "execDir": "<workspace>",
        "scriptContent": "echo Deploying to {env}\\nnpm run build\\nif [ $? -eq 0 ]; then\\n  npm run deploy:{env}\\nelse\\n  echo Build failed, aborting deployment\\n  exit 1\\nfi",
        "description": "Builds project and deploys to specified environment with error checking",
        "inputs": [
            {
                "placeholder": "Environment (dev/staging/prod)",
                "variable": "{env}"
            }
        ]
    }
]

WRONG FORMAT (DO NOT DO THIS):
[
    {
        "name": "Build Project",	  ❌ Missing emoji in name
        "execDir": "cd /path/to/project",  ❌ ExecDir should be just the path, no commands
        OR "execDir": "/absolute/path/to/workspace",  ❌ Use <workspace> instead of absolute paths
        "cmd": "cd project && make msim_main || echo '❌ Build failed'",  ❌ NO EMOJIS IN CMD!
        "description": "Builds the project ✅"  ❌ NO EMOJIS IN DESCRIPTION!
    },
	{
		"name": "🚀 Deploy to Environment",
        "execDir": "<workspace>",
        "scriptContent": "echo "\Deploying to {env} at <workspace>"\\\nnpm run build\\nif [ $? -eq 0 ]; then\\n  npm run deploy:{env}\\nelse\\n  echo Build failed, aborting deployment\\n  exit 1\\nfi", ❌ <workspace> can only be used in execDir field, get the workspace from pwd or other way to use in script
        "description": "Builds project and deploys to specified environment with error checking",		
        "inputs": [
            {
                "placeholder": "Environment (dev/staging/prod)",
                "variable": "{env}"
            }
        ]
	}
]

Analyze the sequential logs carefully and generate 3-5 buttons that automate the ACTUAL workflows you observe.
Choose between cmd and scriptContent based on workflow complexity.
RESPOND WITH JSON ARRAY ONLY - NO OTHER TEXT:`;

		// Log prompt for development
		

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		console.log('AI button suggestions prompt:', prompt);
		
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		await logPromptToFile('getAISuggestions', prompt, fullResponse, {
			platform,
			shell,
			recentLogsCount: optimizedLog.recentLogs.length,
			model: model.family
		});

		console.log('AI response for button suggestions:', fullResponse);

		const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const buttons = JSON.parse(jsonMatch[0]) as smartCmdButton[];
			console.log('Parsed buttons from AI response:', buttons);
			// remove cmd if scriptContent exists
			buttons.forEach(b => {
				if (b.scriptContent?.trim().length) {
					b.cmd = '';
				}
				else {
					b.scriptContent = undefined;
				}
				b.modelUsed = model.family;
			});
			return buttons.filter(b => b.name && (b.cmd || b.scriptContent));
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
	scope: 'workspace' | 'global' = 'workspace',
	activityLogPath?: string,
	globalStoragePath?: string,
	existingButtons: smartCmdButton[] = []
): Promise<smartCmdButton | null> {
	try {
		const model = await configManager.getAIModel('smartCmd', globalStoragePath);
		
		if (!model) {
			vscode.window.showInformationMessage('No AI model configured. Please enter button details manually.');
			return null;
		}
		const { platform, shell } = getSystemInfo();

		const buttonsToCheck = scope === 'global'
			? existingButtons.filter(b => b.scope === 'global')
			: existingButtons;

		const existingButtonsInfo = buttonsToCheck.map((b, i) => {
			const desc = b.description || 'N/A';
			const user_prompt = b.user_prompt || 'N/A';
			return `${i + 1}. Name: "${b.name}", Exec Dir: "${b.execDir}", Command: "${b.cmd}", Description: "${desc}", User Prompt: "${user_prompt}", Scope: ${b.scope}`;
		}).join('\n');
		
		// Get workspace context if scope is workspace
		let workspaceContext = '';
		if (scope === 'workspace') {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const workspaceName = workspaceFolder.name;
				const workspacePath = workspaceFolder.uri.fsPath;
				let workspaceLogContext = '';
				// Optimize log for AI consumption using intelligent sampling
				if (activityLogPath) {
					const optimizedLog = await activityLogging.optimizeLogForAI(activityLogPath);
					workspaceLogContext = `
WORKSPACE LOG CONTEXT:
- This workspace has the following activity patterns. 
- Analyze these to understand the developer's workflow.
- Recent commands include file edits, terminal commands, and debugging sessions.
- Suggest button according to the description and try to align it with the actual workflow patterns below.

WORKSPACE ACTIVITY LOG SUMMARY:
${optimizedLog.summary}


RECENT ACTIVITY LOG (Last ${optimizedLog.recentLogs.length} Commands in Sequential Order):
${optimizedLog.recentLogs.join('\n')}
`;
				}
				workspaceContext = `
BUTTON SCOPE: Workspace-specific (will only be available in this project)

WORKSPACE CONTEXT:
- Workspace Name: ${workspaceName}
- Workspace Path: ${workspacePath}
- Workspace script dir path: ${path.join(workspacePath, '.vscode', 'devBoost', 'scripts')}
- Global extenstion Path: ${globalStoragePath}
- Global script dir path: ${globalStoragePath ? path.join(globalStoragePath, 'scripts') : 'N/A'}

IMPORTANT: Since this button is workspace-specific, you can
- Use <workspace> as a placeholder for the workspace path (e.g., <workspace>/scripts/deploy.sh, <workspace>/src, <workspace>/scripts)
- Use current directory (.) or home directory (~) as path references when told in description
- Use absolute paths of system-wide tools (e.g., /usr/local/bin/tool.sh, C:\\Tools\\build.exe)
- Reference project-specific files and directories if provided (e.g., ./package.json, ./config)

${workspaceLogContext}`;
			}
		} else {
			workspaceContext = `
BUTTON SCOPE: Global (will be available across all projects)
- Global extenstion Path: ${globalStoragePath}
- Global script dir path: ${globalStoragePath ? path.join(globalStoragePath, 'scripts') : 'N/A'}

IMPORTANT: Since this button is global, you should:
- Use generic commands that work anywhere (e.g., git status, npm install)
- Use VS Code built-in commands (e.g., workbench.action.files.save)
- Use only standard tooling commands available globally
- Use absolute paths to system-wide tools if needed (e.g., /usr/local/bin/tool.sh, C:\\Tools\\build.exe)
- Use relative paths ONLY if they refer to generic locations or when told in description using <workspace>
- Do NOT assume any specific project structure
`;
		}

		
		const prompt = `Create a VS Code button based on this description: "${description}"

SYSTEM INFORMATION:
- Operating System: ${platform}
- Shell: ${shell}
${workspaceContext}

IMPORTANT: Generate commands that are compatible with ${platform} and ${shell}.
${platform === 'Windows' ? '- Use Windows-compatible commands (e.g., PowerShell or cmd syntax)\n- Scripts: Use batch script syntax (.bat)' : ''}
${platform === 'macOS' || platform === 'Linux' ? '- Use Unix/Linux-compatible commands (bash/zsh syntax)\n- Scripts: Use bash/sh syntax (.sh)' : ''}

🔄 WHEN TO USE SCRIPTS VS COMMAND CHAINS:

USE SCRIPT (scriptContent field) when the task requires:
• When asked to generate or create script
• When asked to generate or create script **file** then don't create a script to generate a seperate script file rather create the actual script directly in scriptContent
• Multiple directory changes between commands
• Complex error handling and conditional logic
• Loops, variables, or advanced shell features
• More than 5 chained commands
• Need for intermediate checks or validation
• File manipulation between steps
• Environment variable setup and cleanup

USE COMMAND CHAIN (cmd field) when the task is:
• Simple 1-3 commands chained with &&
• Linear execution without conditions
• Single directory context
• No complex error handling needed

🚨 CRITICAL RULE - EMOJIS:
• ONLY use emoji/icon in the "name" field at the beginning (e.g., "🚀 Build Project")
• NEVER use emojis, icons, or special characters in the "cmd" or "scriptContent" fields - plain text only
• NEVER use emojis, icons, or special characters in the "description" field
• These fields are executed directly in the terminal - any emoji will cause execution failure

Provide:
1. A short descriptive name (with an emoji prefix, max 30 characters)
2. EITHER "cmd" (for simple commands) OR "scriptContent" (for complex workflows) - NEVER both
3. A brief description of what the button does (this will be stored as description) - NO EMOJIS
4. If the command needs user input, include input fields with placeholders (use {variableName} format)

Existing Buttons to Check (for duplication avoidance):
${existingButtonsInfo}


The user provided this description: "${description}" (this will be stored as user_prompt)

CORRECT FORMAT:
WITHOUT INPUT FIELDS WITH GENERIC EXECUTION PATH - COMMAND:
{
    "name": "🔨 Build Project",
    "execDir": "<workspace>",
    "cmd": "npm run build",
    "description": "Builds the project using npm"
}

WITHOUT INPUT FIELDS WITH ANY POSSIBLE EXECUTION PATH - COMMAND:
{
    "name": "🚀 List all files in current directory",
	"execDir": ".",
    "cmd": "ls -la",
    "description": "Lists all files in the current directory"
}

WITH INPUT FIELDS - COMMAND:
{
    "name": "📝 Git Commit",
	"execDir": "<workspace>",
    "cmd": "git add . && git commit -m '{message}'",
    "description": "Stage all changes and commit with a custom message",
    "inputs": [
        {
            "placeholder": "Enter commit message",
            "variable": "{message}"
        }
    ]
}
COMPLEX SCRIPT FORMAT (use scriptContent for multi-step workflows):
{
    "name": "🔧 Multi-Service Setup",
	"execDir": "<workspace>",
    "scriptContent": "cd frontend && npm install && npm run build\\ncd ../backend && npm install\\ncd .. && docker-compose up -d\\necho Setup complete",
    "description": "Sets up frontend, backend, and starts Docker services"
}

WITH INPUT FIELDS - SCRIPT:
{
    "name": "🚀 Deploy to Environment",
	"execDir": "<workspace>",
    "scriptContent": "echo Deploying to {env}\\nnpm run build\\nif [ $? -eq 0 ]; then\\n  npm run deploy:{env}\\nelse\\n  echo Build failed\\n  exit 1\\nfi",
    "description": "Builds and deploys to specified environment with error checking",
    "inputs": [{"placeholder": "Environment (dev/staging/prod)", "variable": "{env}"}]
}

WRONG FORMAT - COMMAND (DO NOT DO THIS):
{
    "name": "Build Project",  ❌ Missing emoji in name
	"execDir": "cd /path",  ❌ ExecDir should be just the path, no commands
    "cmd": "npm run build || echo '❌ Failed'",  ❌ NO EMOJIS IN CMD!
    "description": "Builds the project ✅"  ❌ NO EMOJIS IN DESCRIPTION!
}

WRONG FORMAT - SCRIPT
{
	"name": "🚀 Deploy to Environment",
	"execDir": "<workspace>",
	"scriptContent": "echo "\Deploying to {env} at <workspace>"\\\nnpm run build\\nif [ $? -eq 0 ]; then\\n  npm run deploy:{env}\\nelse\\n  echo Build failed, aborting deployment\\n  exit 1\\nfi", ❌ <workspace> can only be used in execDir field, get the workspace from pwd or other way to use in script
	"description": "Builds project and deploys to specified environment with error checking",		
	"inputs": [
		{
			"placeholder": "Environment (dev/staging/prod)",
			"variable": "{env}"
		}
	]
}

Only respond with the JSON object, no additional text.`;


		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		console.log('Custom button prompt:', prompt);

		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		// Log prompt for development
		await logPromptToFile('getCustomButtonSuggestion', prompt, fullResponse, {
			description,
			scope,
			platform,
			shell,
			workspaceName: vscode.workspace.workspaceFolders?.[0]?.name,
			model: model.family
		});

		console.log('AI response for custom button:', fullResponse);

		try {
			let cleanedResponse = fullResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
			
			const firstBrace = cleanedResponse.indexOf('{');
			const lastBrace = cleanedResponse.lastIndexOf('}');
			
			if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
				const jsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
				const button = JSON.parse(jsonString) as smartCmdButton;
				
				if (button.name && (button.cmd || button.scriptContent) && button.description) {
					button.user_prompt = description;
					button.execDir = button.execDir && button.execDir.trim() !== '' ? button.execDir : '.';
					if(button.scriptContent?.trim().length) {
						button.cmd = '';
					}
					else {
						button.scriptContent = undefined;
					}
					button.modelUsed = model.family;
					console.log('Successfully parsed button:', button);
					return button;
				}
			}
		} catch (parseError) {
			console.error('JSON parsing error:', parseError);
		}

		throw new Error('Could not parse AI response into a valid button format. Please enter button details manually.');

	} catch (err) {
		if (err instanceof vscode.LanguageModelError) {
			console.log('Language Model Error:', err.message, err.code);
		} else {
			console.error('Unexpected error getting custom button suggestion:', err);
		}
		throw new Error('AI suggestion failed. \n' + (err instanceof Error ? err.message : 'Unknown error') + ' \nYou can also create button manually.');
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
			description: 'Stage all changes and commit with a custom message',
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
			description: 'Push commits to remote repository'
		});
	}

	if (activityString.includes('npm') || activityString.includes('build')) {
		buttons.push({
			name: '🔨 Build',
			cmd: 'npm run build',
			description: 'Build the project using npm'
		});
	}

	if (activityString.includes('test')) {
		buttons.push({
			name: '🧪 Run Tests',
			cmd: 'npm test',
			description: 'Run all tests in the project'
		});
	}

	if (activityString.includes('save')) {
		buttons.push({
			name: '💾 Save All',
			cmd: 'workbench.action.files.saveAll',
			description: 'Save all open files'
		});
	}

	if (buttons.length === 0) {
		buttons.push(
			{
				name: '🔨 Build',
				cmd: 'npm run build',
				description: 'Build the project'
			},
			{
				name: '🧪 Test',
				cmd: 'npm test',
				description: 'Run tests'
			},
			{
				name: '📝 Commit',
				cmd: 'git add . && git commit -m \'{message}\'',
				description: 'Commit changes with a message',
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