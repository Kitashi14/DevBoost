// AI Services Module - SmartCmd LLM-related functions
import * as vscode from 'vscode';
import { smartCmdButton } from './treeProvider';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';

// Development mode flag - set to false in production
const ENABLE_PROMPT_LOGGING = true;

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
 * Returns the name of the existing button if duplicate found, null otherwise
 */
export async function checkDuplicateButton(
	newButton: smartCmdButton,
	existingButtons: smartCmdButton[],
	targetScope: 'workspace' | 'global'
): Promise<string | null> {
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
			return existing.name;
		}
	}

	// Use AI for semantic similarity check
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
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
1. VERY IMPORTANT: Have any similarity in their name or description which can confuse users
2. Execute the same command (even with different variable names)
3. Perform the same action (e.g., "git commit" vs "commit changes")
4. Have the same functionality with minor syntax differences

Don't consider buttons as duplicates if they:
1. Have different commands even if they seem related (e.g., "git commit" vs "git push")
2. Have specific tasks assigned to it even if a similar command exists

If it's a duplicate/similar, respond with ONLY the NAME of the most similar existing button (e.g., "🔨 Build Project").
If it's unique, respond with only "UNIQUE".`;

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
		
		console.log(`AI detected duplicate: "${newButton.name}" is similar to "${answer}"`);
		return answer;

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
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			console.log('DevBoost: No AI model available for global safety check');
			return true;
		}

		const model = models[0];

		const prompt = `Analyze this VS Code button command to determine if it's safe to use globally across all projects, or if it's workspace-specific.

Button Details:
- Name: "${button.name}"
- Exec Dir: "${button.execDir && button.execDir.trim() !== '' ? button.execDir : '.'}"
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
3. Uses <workspace> as a placeholder for the workspace directory
4. Uses current directory (.) or home directory (~) as path references
5. Uses VS Code built-in commands (e.g., workbench.action.files.save)
6. Runs standard tooling commands available globally (e.g., prettier, eslint, tsc, docker)
7. General utility commands that don't depend on project structure
8. System-level scripts or applications with absolute paths that exist across projects

IMPORTANT: Absolute paths to system tools are SAFE (they're global). Relative paths to project files are UNSAFE (they're workspace-specific).

Respond with ONLY one word:
- "SAFE" if the button can be used globally across all projects
- "UNSAFE" if the button is workspace-specific and shouldn't be global`;

		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        console.log('DevBoost: Global safety check prompt:', prompt);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		console.log('DevBoost: Global safety check response:', fullResponse);
		const answer = fullResponse.trim().toUpperCase();
		
		// Log prompt for development
		await logPromptToFile('checkIfButtonIsGlobalSafe', prompt, fullResponse, {
			button: { name: button.name, execDir: button.execDir, cmd: button.cmd },
			currentScope: button.scope
		});
		
		return answer.includes('SAFE') && !answer.includes('UNSAFE');

	} catch (error) {
		console.error('Error in global safety check:', error);
		return true;
	}
}

/**
 * Enhanced context analysis for deeper workflow understanding
 */
function analyzeWorkflowPatterns(optimizedLog: any): any {
	const activities = optimizedLog.activities || new Map();
	const recentLogs = optimizedLog.recentLogs || [];
	
	// Parse recent logs for sequential patterns
	const commandSequences: string[][] = [];
	let currentSequence: string[] = [];
	let lastTimestamp = '';
	
	for (const logLine of recentLogs) {
		const match = logLine.match(/(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*\|\s*Command:\s*(.+?)\s*\|\s*Context:\s*(.+)$/);
		if (match) {
			const timestamp = match[1];
			const command = match[2].trim();
			const contextStr = match[3];
			
			try {
				const context = JSON.parse(contextStr);
				const workingDir = context.terminal?.cwd || '';
				const fullCommand = `${command} [${path.basename(workingDir)}]`;
				
				// If commands are within 2 minutes, consider them part of same workflow
				const timeDiff = lastTimestamp ? new Date(timestamp).getTime() - new Date(lastTimestamp).getTime() : 0;
				if (timeDiff < 120000 && currentSequence.length < 5) { // 2 minutes, max 5 commands
					currentSequence.push(fullCommand);
				} else {
					if (currentSequence.length >= 2) {
						commandSequences.push([...currentSequence]);
					}
					currentSequence = [fullCommand];
				}
				lastTimestamp = timestamp;
			} catch (error) {
				// Skip malformed entries
			}
		}
	}
	
	// Add final sequence if it has multiple commands
	if (currentSequence.length >= 2) {
		commandSequences.push(currentSequence);
	}
	
	// Analyze directory patterns
	const directoryUsage = new Map<string, number>();
	const directoryCommands = new Map<string, string[]>();
	
	for (const logLine of recentLogs) {
		const match = logLine.match(/Context:\s*(.+)$/);
		if (match) {
			try {
				const context = JSON.parse(match[1]);
				const cwd = context.terminal?.cwd;
				const command = logLine.match(/Command:\s*(.+?)\s*\|/)?.[1];
				
				if (cwd && command) {
					const relativeDir = cwd.replace(context.workspace?.path || '', '').replace(/^\//, '') || 'root';
					directoryUsage.set(relativeDir, (directoryUsage.get(relativeDir) || 0) + 1);
					
					if (!directoryCommands.has(relativeDir)) {
						directoryCommands.set(relativeDir, []);
					}
					directoryCommands.get(relativeDir)!.push(command);
				}
			} catch (error) {
				// Skip malformed entries
			}
		}
	}
	
	// Identify common workflow patterns
	const workflowPatterns = {
		frontendDevFlow: commandSequences.some(seq => 
			seq.some(cmd => cmd.includes('cd frontend') || cmd.includes('[frontend]')) &&
			seq.some(cmd => cmd.includes('npm') && (cmd.includes('install') || cmd.includes('dev') || cmd.includes('start')))
		),
		backendDevFlow: commandSequences.some(seq => 
			seq.some(cmd => cmd.includes('cd backend') || cmd.includes('[backend]')) &&
			seq.some(cmd => cmd.includes('npm') && (cmd.includes('install') || cmd.includes('start') || cmd.includes('dev')))
		),
		gitWorkflow: commandSequences.some(seq => 
			seq.filter(cmd => cmd.includes('git')).length >= 2
		),
		testingWorkflow: commandSequences.some(seq => 
			seq.some(cmd => cmd.includes('test') || cmd.includes('lint') || cmd.includes('format'))
		),
		buildDeployFlow: commandSequences.some(seq => 
			seq.some(cmd => cmd.includes('build')) &&
			seq.some(cmd => cmd.includes('docker') || cmd.includes('deploy') || cmd.includes('push'))
		)
	};
	
	// Calculate workflow complexity scores
	const complexityMetrics = {
		multiDirectory: directoryUsage.size > 2,
		chainedCommands: commandSequences.filter(seq => seq.length >= 3).length > 0,
		repeatPatterns: commandSequences.filter(seq => 
			seq.filter((cmd, i, arr) => arr.indexOf(cmd) !== i).length > 0
		).length > 0
	};
	
	return {
		commandSequences,
		directoryUsage: Array.from(directoryUsage.entries()).sort((a, b) => b[1] - a[1]),
		directoryCommands: Object.fromEntries(directoryCommands),
		workflowPatterns,
		complexityMetrics,
		topDirectories: Array.from(directoryUsage.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([dir, count]) => ({ dir, count }))
	};
}

/**
 * Get AI suggestions for buttons based on activity patterns with enhanced workflow analysis
 */
export async function getAISuggestions(
	topActivities: string[],
	optimizedLogData?: any
): Promise<smartCmdButton[]> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			vscode.window.showWarningMessage('GitHub Copilot models not available. Using fallback suggestions.');
			return getFallbackSuggestions(topActivities);
		}

		const model = models[0];
		const { platform, shell } = getSystemInfo();
		const model = models[0];
		const { platform, shell } = getSystemInfo();
		let workspaceName = 'N/A';
		let workspacePath = 'N/A';
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			workspaceName = workspaceFolder.name;
			workspacePath = workspaceFolder.uri.fsPath;
		}

	
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
• NEVER use emojis, icons, or special characters in the "ai_description" field
• These fields are executed directly in the terminal - any emoji will cause execution failure

Provide:
1. A short descriptive name (with an emoji prefix, max 30 characters)
2. EITHER "cmd" (for simple commands) OR "scriptContent" (for complex workflows) - NEVER both
3. A brief description of what the button does (this will be stored as ai_description) - NO EMOJIS
4. If the command needs user input, include input fields with placeholders (use {variableName} format)
5. execDir: where to run from (applies to both cmd and scriptContent)

📝 RESPONSE FORMAT (JSON only):

SIMPLE COMMAND CHAIN FORMAT:
[
    {
        "name": "🚀 Build and Deploy",
        "execDir": "<workspace>/subdirectory",
        "cmd": "npm run build && npm run deploy && cd /path/to/other && ./deploy.sh",
        "ai_description": "Automates the build and deploy workflow pattern"
    },
	{
        "name": "🚀 List all files in current directory",
        "execDir": ".",
        "cmd": "ls -la",
        "ai_description": "Lists all files in the current directory"
    }
]

SCRIPT FORMAT (for complex workflows):
[
    {
        "name": "🚀 Multi-Service Setup",
        "execDir": "<workspace>",
        "scriptContent": "cd frontend && npm install && npm run build\\ncd ../backend && npm install\\ncd .. && docker-compose up -d\\necho Setup complete",
        "ai_description": "Sets up frontend, backend, and starts Docker services"
    }
]

WITH INPUT FIELDS - COMMAND FORMAT:
[
    {
        "name": "📝 Git Commit & Push",
        "execDir": "<workspace>",
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
        "execDir": "<workspace>/path/to/context",
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

WITH INPUT FIELDS - SCRIPT FORMAT:
[
    {
        "name": "🚀 Deploy to Environment",
        "execDir": "<workspace>",
        "scriptContent": "echo Deploying to {env}\\nnpm run build\\nif [ $? -eq 0 ]; then\\n  npm run deploy:{env}\\nelse\\n  echo Build failed, aborting deployment\\n  exit 1\\nfi",
        "ai_description": "Builds project and deploys to specified environment with error checking",
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
        "ai_description": "Builds the project ✅"  ❌ NO EMOJIS IN DESCRIPTION!
    }
]

Analyze the sequential logs carefully and generate 3-5 buttons that automate the ACTUAL workflows you observe.
Choose between cmd and scriptContent based on workflow complexity.
RESPOND WITH JSON ARRAY ONLY - NO OTHER TEXT:`;

		// Log prompt for development
		
		// Enhanced workflow analysis
		const workflowAnalysis = optimizedLogData ? analyzeWorkflowPatterns(optimizedLogData) : null;
		
		// Build comprehensive context prompt
		let contextPrompt = `
🎯 WORKFLOW INTELLIGENCE ANALYSIS

📊 ACTIVITY SUMMARY:
${topActivities.slice(0, 10).map((activity, i) => `${i + 1}. ${activity}`).join('\n')}

`;

		if (workflowAnalysis) {
			contextPrompt += `
🔄 DETECTED WORKFLOW PATTERNS:
${Object.entries(workflowAnalysis.workflowPatterns)
	.filter(([_, detected]) => detected)
	.map(([pattern, _]) => `✓ ${pattern.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
	.join('\n')}

📂 DIRECTORY USAGE PATTERNS:
${workflowAnalysis.topDirectories.map(({dir, count}: any) => `• ${dir === 'root' ? 'project root' : dir}: ${count} commands`).join('\n')}

🔗 COMMAND SEQUENCES (Recent Workflows):
${workflowAnalysis.commandSequences.slice(0, 3).map((sequence: any, i: number) => 
	`${i + 1}. ${sequence.join(' → ')}`
).join('\n')}

🧠 COMPLEXITY INDICATORS:
${workflowAnalysis.complexityMetrics.multiDirectory ? '• Multi-directory navigation required' : ''}
${workflowAnalysis.complexityMetrics.chainedCommands ? '• Complex command chaining detected' : ''}
${workflowAnalysis.complexityMetrics.repeatPatterns ? '• Repeated workflow patterns found' : ''}
`;
		}

		const intelligentPrompt = `${contextPrompt}

🎯 SMART BUTTON GENERATION STRATEGY:

Create intelligent automation buttons that solve COMPLETE workflows, not just individual commands.

PRINCIPLES:
1. **WORKFLOW COMPLETENESS**: Each button should handle an entire workflow from start to finish
2. **CONTEXT AWARENESS**: Include proper directory navigation and environment setup
3. **ERROR RESILIENCE**: Handle common failure points with fallbacks
4. **EFFICIENCY**: Combine related actions to minimize user intervention
5. **SPECIFICITY**: Tailor to the detected patterns and directory structure

BUTTON DESIGN REQUIREMENTS:
• Include explicit directory navigation (cd commands)
• Chain multiple related actions with &&
• Add error handling where appropriate (|| echo "Error")
• Use project-specific patterns detected in the logs
• Consider cross-platform compatibility for ${platform}
• Optimize for ${shell} shell

🚀 GENERATE 4-6 BUTTONS that represent:
1. Most frequent workflow automation
2. Cross-directory development patterns  
3. Git workflow optimization
4. Build/test/deploy automation
5. Environment setup/maintenance
6. Error recovery/debugging helpers

FORMAT: Return ONLY valid JSON array, no markdown or extra text:

[
  {
    "name": "🚀 [Descriptive Action Name]",
    "cmd": "cd [dir] && [action1] && [action2] && [action3]",
    "ai_description": "Intelligent explanation of why this workflow automation is valuable"
  }
]

Make each button solve a real workflow problem detected in the activity patterns.`;

		const messages = [vscode.LanguageModelChatMessage.User(intelligentPrompt)];
		console.log('Enhanced AI button suggestions prompt:', intelligentPrompt);
		
		const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

		let fullResponse = '';
		for await (const part of response.text) {
			fullResponse += part;
		}

		console.log('AI suggestions response:', fullResponse);

		try {
			// Clean up response - remove any markdown formatting
			const cleanResponse = fullResponse.replace(/```json\s*|\s*```/g, '').trim();
			
			// Handle case where AI might return explanation before JSON
			const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
			const jsonStr = jsonMatch ? jsonMatch[0] : cleanResponse;
			
			const suggestions = JSON.parse(jsonStr);
			
			if (!Array.isArray(suggestions)) {
				throw new Error('Response is not an array');
			}

			// Convert to smartCmdButton format and validate
			const buttons: smartCmdButton[] = suggestions
				.filter(suggestion => suggestion.name && (suggestion.cmd || suggestion.scriptContent))
				.map(suggestion => ({
					name: suggestion.name,
					cmd: suggestion.cmd,
					scriptContent: suggestion.scriptContent,
					execDir: suggestion.execDir,
					ai_description: suggestion.ai_description || suggestion.description || 'AI-generated command',
					inputs: suggestion.inputs
				}));

			console.log('DevBoost: Generated AI button suggestions:', buttons);
			return buttons;

		} catch (parseError) {
			console.error('Error parsing AI response:', parseError);
			console.error('Raw response:', fullResponse);
			vscode.window.showWarningMessage('AI generated invalid response. Using fallback suggestions.');
			return getFallbackSuggestions(topActivities);
		}

	} catch (error) {
		console.error('Error getting AI suggestions:', error);
		vscode.window.showErrorMessage('Failed to get AI suggestions. Using fallback suggestions.');
		return getFallbackSuggestions(topActivities);
	}
}

/**
 * Get custom button suggestion from AI based on user description
 */
export async function getCustomButtonSuggestion(
	description: string,
	scope: 'workspace' | 'global' = 'workspace'
): Promise<smartCmdButton | null> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
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

IMPORTANT: Since this button is workspace-specific, you can
- Use <workspace> as a placeholder for the workspace path (e.g., <workspace>/scripts/deploy.sh, <workspace>/src, <workspace>/scripts)
- Use current directory (.) or home directory (~) as path references when told in description
- Use absolute paths of system-wide tools (e.g., /usr/local/bin/tool.sh, C:\\Tools\\build.exe)
- Reference project-specific files and directories if provided (e.g., ./package.json, ./config)
`;
			}
		} else {
			workspaceContext = `
BUTTON SCOPE: Global (will be available across all projects)

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
• When asked to generate script
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
• NEVER use emojis, icons, or special characters in the "ai_description" field
• These fields are executed directly in the terminal - any emoji will cause execution failure

Provide:
1. A short descriptive name (with an emoji prefix, max 30 characters)
2. EITHER "cmd" (for simple commands) OR "scriptContent" (for complex workflows) - NEVER both
3. A brief description of what the button does (this will be stored as ai_description) - NO EMOJIS
4. If the command needs user input, include input fields with placeholders (use {variableName} format)

The user provided this description: "${description}" (this will be stored as user_description)

CORRECT FORMAT:
WITHOUT INPUT FIELDS WITH GENERIC EXECUTION PATH - COMMAND:
{
    "name": "🔨 Build Project",
    "execDir": "<workspace>",
    "cmd": "npm run build",
    "ai_description": "Builds the project using npm"
}

WITHOUT INPUT FIELDS WITH ANY POSSIBLE EXECUTION PATH - COMMAND:
{
    "name": "🚀 List all files in current directory",
	"execDir": ".",
    "cmd": "ls -la",
    "ai_description": "Lists all files in the current directory"
}

WITH INPUT FIELDS - COMMAND:
{
    "name": "📝 Git Commit",
	"execDir": "<workspace>",
    "cmd": "git add . && git commit -m '{message}'",
    "ai_description": "Stage all changes and commit with a custom message",
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
    "ai_description": "Sets up frontend, backend, and starts Docker services"
}

WITH INPUT FIELDS - SCRIPT:
{
    "name": "🚀 Deploy to Environment",
	"execDir": "<workspace>",
    "scriptContent": "echo Deploying to {env}\\nnpm run build\\nif [ $? -eq 0 ]; then\\n  npm run deploy:{env}\\nelse\\n  echo Build failed\\n  exit 1\\nfi",
    "ai_description": "Builds and deploys to specified environment with error checking",
    "inputs": [{"placeholder": "Environment (dev/staging/prod)", "variable": "{env}"}]
}

WRONG FORMAT (DO NOT DO THIS):
{
    "name": "Build Project",  ❌ Missing emoji in name
	"execDir": "cd /path",  ❌ ExecDir should be just the path, no commands
    "cmd": "npm run build || echo '❌ Failed'",  ❌ NO EMOJIS IN CMD!
    "ai_description": "Builds the project ✅"  ❌ NO EMOJIS IN DESCRIPTION!
}

Only respond with the JSON object, no additional text.`;

		// Use the prompt directly for smartCmd AI services
		const finalPrompt = prompt;

		const messages = [vscode.LanguageModelChatMessage.User(finalPrompt)];
		console.log('Custom button prompt:', finalPrompt);

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
				
				if (button.name && (button.cmd || button.scriptContent) && button.ai_description) {
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
