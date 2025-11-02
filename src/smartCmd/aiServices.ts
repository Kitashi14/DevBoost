// AI Services Module - All LLM-related functions
import * as vscode from 'vscode';
import { smartCmdButton } from './treeProvider';
import * as path from 'path';

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
1. Execute the same command (even with different variable names)
2. Perform the same action (e.g., "git commit" vs "commit changes")
3. Have the same functionality with minor syntax differences

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
	topActivities: string[],
	detailedContext?: any
): Promise<smartCmdButton[]> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			vscode.window.showWarningMessage('GitHub Copilot models not available. Using fallback suggestions.');
			return getFallbackSuggestions(topActivities);
		}

		const model = models[0];
		const { platform, shell } = getSystemInfo();
		
	// Build enhanced context information for better AI suggestions
	let contextualInfo = '';
	let projectStructureInfo = '';
	let intelligentSuggestions = '';
	let workflowInsights = '';
	
	if (detailedContext) {
		// Advanced project structure analysis
		const directories = detailedContext.frequentDirectories || [];
		const workspaceName = detailedContext.workspaceInfo.names[0] || 'project';
		
		// Detect technology patterns
		const hasBackendFrontend = directories.some((d: string) => d.includes('/backend') || d.includes('/frontend'));
		const hasReactNext = directories.some((d: string) => d.includes('node_modules') || d.includes('src') || d.includes('pages'));
		const hasNodeProject = Object.keys(detailedContext.commandPatterns).some((cmd: string) => 
			cmd.includes('npm') || cmd.includes('yarn') || cmd.includes('node') || cmd.includes('📦'));
		const hasGitUsage = Object.keys(detailedContext.commandPatterns).some((cmd: string) => 
			cmd.includes('git') || cmd.includes('🌿'));
		const hasBuildCommands = Object.keys(detailedContext.commandPatterns).some((cmd: string) => 
			cmd.includes('build') || cmd.includes('compile') || cmd.includes('🔨'));
		const hasTestCommands = Object.keys(detailedContext.commandPatterns).some((cmd: string) => 
			cmd.includes('test') || cmd.includes('spec') || cmd.includes('🧪'));
		const failedCommands = Object.keys(detailedContext.errorPatterns || {});
		
		// Analyze workflow patterns
		const topCommands = Object.entries(detailedContext.commandPatterns).slice(0, 5);
		const isDevWorkflow = topCommands.some(([cmd]) => cmd.includes('start') || cmd.includes('dev') || cmd.includes('serve'));
		const isGitHeavy = topCommands.some(([cmd]) => cmd.includes('git') || cmd.includes('🌿'));
		const isMultiDirectory = directories.length > 2;
		
		// Generate detailed project analysis
		projectStructureInfo = '\nPROJECT INTELLIGENCE ANALYSIS:';
		if (hasBackendFrontend) {
			projectStructureInfo += '\n• 🏗️  Multi-tier architecture detected (backend/frontend separation)';
		}
		if (hasNodeProject) {
			projectStructureInfo += '\n• 📦 Node.js/npm ecosystem detected';
		}
		if (hasReactNext) {
			projectStructureInfo += '\n• ⚛️  Frontend framework usage patterns detected';
		}
		if (hasGitUsage) {
			projectStructureInfo += '\n• 🌿 Active Git version control workflow';
		}
		if (hasBuildCommands) {
			projectStructureInfo += '\n• 🔨 Build/compilation pipeline detected';
		}
		if (hasTestCommands) {
			projectStructureInfo += '\n• 🧪 Testing workflow present';
		}
		
		// Generate workflow insights
		workflowInsights = '\nWORKFLOW PATTERN INSIGHTS:';
		if (isDevWorkflow) {
			workflowInsights += '\n• 🚀 Active development workflow - prioritize dev server commands';
		}
		if (isGitHeavy) {
			workflowInsights += '\n• 🔄 Git-centric workflow - suggest branch/commit helpers';
		}
		if (isMultiDirectory) {
			workflowInsights += '\n• 📂 Multi-directory navigation - commands MUST include directory changes';
		}
		if (failedCommands.length > 0) {
			workflowInsights += '\n• ⚠️  Error patterns detected - prioritize fixing failed commands';
		}
		
		// Generate highly specific intelligent suggestions
		intelligentSuggestions = `
🧠 CONTEXT-DRIVEN BUTTON STRATEGY:
${hasBackendFrontend ? '🎯 PRIORITY: Create directory-specific commands for backend/frontend workflows' : ''}
${hasNodeProject ? '🎯 PRIORITY: npm/yarn commands with correct directory context (cd dir && npm action)' : ''}
${failedCommands.length > 0 ? '🎯 CRITICAL: Address these failures - ' + failedCommands.slice(0, 2).join(', ') : ''}
${hasGitUsage ? '🎯 ENHANCE: Git workflow automation (branch management, smart commits)' : ''}
${isDevWorkflow ? '🎯 OPTIMIZE: Development server management and hot-reload workflows' : ''}

MANDATORY COMMAND PATTERNS:
• Always include "cd [directory] &&" before actions that need specific locations
• Chain related actions (install + start, build + deploy, etc.)
• Use relative paths that work from any starting directory
• Include error handling for common failure points`;
		contextualInfo = `
🔍 ENHANCED WORKFLOW INTELLIGENCE:
${detailedContext.summary}
${projectStructureInfo}
${workflowInsights}

📊 Workspace Context:
- Project: ${workspaceName}
- Active workspaces: ${detailedContext.workspaceInfo.count}
- Directory complexity: ${directories.length} frequent locations

⚡ Terminal Intelligence:
- Primary shell: ${detailedContext.terminalPatterns.mostUsed}
- Usage patterns: ${Object.entries(detailedContext.terminalPatterns.shells).map(([shell, count]) => `${shell}(${count}x)`).join(', ')}

📍 Critical Directory Mapping (USE THESE FOR NAVIGATION):
${detailedContext.frequentDirectories.map((dir: string, i: number) => {
			const shortPath = dir.split('/').slice(-2).join('/');
			return `${i + 1}. ${shortPath} → Full: ${dir}`;
		}).join('\n')}

📈 Command Usage Intelligence:
${Object.entries(detailedContext.commandPatterns).slice(0, 6).map(([cmd, count]) => 
			`• ${cmd}: ${count}x${cmd.includes('npm') ? ' (Node.js)' : ''}${cmd.includes('git') ? ' (Git)' : ''}${cmd.includes('cd') ? ' (Navigation)' : ''}`
		).join('\n')}

${Object.keys(detailedContext.errorPatterns).length > 0 ? `
🚨 FAILURE ANALYSIS (CREATE BETTER ALTERNATIVES):
${Object.entries(detailedContext.errorPatterns).slice(0, 3).map(([error, count]) => `• ${error} (${count}x failures)`).join('\n')}
` : ''}${intelligentSuggestions}`;
	}
	
	const prompt = 
	`You are an elite DevOps automation expert creating intelligent command buttons for a developer's specific workflow.

🖥️  SYSTEM ENVIRONMENT:
- OS: ${platform} | Shell: ${shell}
${contextualInfo}

📋 USER ACTIVITY ANALYSIS:
${topActivities.map((activity, i) => `${i + 1}. ${activity}`).join('\n')}

🎯 CRITICAL SUCCESS CRITERIA:
1. **DIRECTORY-FIRST THINKING**: Every command MUST consider WHERE it should run
2. **CONTEXT-AWARE CHAINING**: Combine navigation + action in single commands
3. **FAILURE-PROOF DESIGN**: Address known error patterns with robust alternatives
4. **WORKFLOW-SPECIFIC**: Tailor to detected patterns (dev/git/build/test)
5. **MULTI-STEP INTELLIGENCE**: Chain related actions for efficiency

🧠 INTELLIGENT COMMAND DESIGN PRINCIPLES:

❌ AVOID (Generic/Dumb):
- "npm install" (location-blind)
- "npm start" (will fail in wrong dir)
- "git status" (too basic)
- Single-purpose commands that ignore context

✅ CREATE (Smart/Contextual):
- "cd backend && npm install && npm run dev" (location + action + goal)
- "cd frontend && npm ci && npm start" (faster install + start)
- "git status && git branch -v && git log --oneline -5" (comprehensive git overview)
- Multi-step workflows that solve complete tasks

🔧 ${platform} COMMAND REQUIREMENTS:
${platform === 'Windows' ? '• Use && for chaining, handle Windows paths, use npm.cmd if needed' : ''}
${platform === 'macOS' || platform === 'Linux' ? '• Use && for chaining, Unix paths, proper shell escaping' : ''}
• All commands must work reliably in ${detailedContext?.terminalPatterns?.mostUsed || shell}
• Include error handling where appropriate (|| echo "Error occurred")

📝 RESPONSE FORMAT (JSON only):
[
    {
        "name": "🚀 [Action] [Context]",
        "cmd": "cd [specific-dir] && [primary-action] && [secondary-action]",
        "ai_description": "Contextual explanation of WHY this command is intelligent for this workflow"
    }
]

🎯 QUALITY CHECKLIST:
- Each command includes proper directory navigation
- Commands solve complete workflows, not just single actions
- Names clearly indicate the smart action being performed
- Descriptions explain the intelligent reasoning behind the command
- All commands are tailored to the detected project structure

Generate 3-5 buttons that demonstrate sophisticated understanding of this specific workflow.
RESPOND WITH JSON ARRAY ONLY - NO OTHER TEXT:`;

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
		return getFallbackSuggestions(topActivities);

	} catch (err) {
		if (err instanceof vscode.LanguageModelError) {
			console.log('Language Model Error:', err.message, err.code);
			vscode.window.showWarningMessage(`AI suggestion failed: ${err.message}. Using fallback suggestions.`);
		} else {
			console.error('Unexpected error getting AI suggestions:', err);
			vscode.window.showWarningMessage('AI suggestion failed. Using fallback suggestions.');
		}
		return getFallbackSuggestions(topActivities);
	}
}

/**
 * Get custom button suggestion from user description
 */
export async function getCustomButtonSuggestion(
	description: string,
): Promise<smartCmdButton | null> {
	try {
		const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
		
		if (models.length === 0) {
			vscode.window.showInformationMessage('GitHub Copilot not available. Please enter button details manually.');
			return null;
		}

		const model = models[0];
		const { platform, shell } = getSystemInfo();
		
		const prompt = `Create a VS Code button based on this description: "${description}"

SYSTEM INFORMATION:
- Operating System: ${platform}
- Shell: ${shell}

IMPORTANT: Generate commands that are compatible with ${platform} and ${shell}.
${platform === 'Windows' ? '- Use Windows-compatible commands (e.g., PowerShell or cmd syntax)' : ''}
${platform === 'macOS' || platform === 'Linux' ? '- Use Unix/Linux-compatible commands (bash/zsh syntax)' : ''}

Provide:
1. A short descriptive name (with an emoji prefix, max 30 characters)
2. The exact command to execute (terminal command or VS Code command like "workbench.action.files.saveAll") - MUST be compatible with ${platform}
3. A brief description of what the button does (this will be stored as ai_description)
4. If the command needs user input, include input fields with placeholders (use {variableName} format in cmd)

The user provided this description: "${description}" (this will be stored as user_description)

Format your response as JSON:
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

Only respond with the JSON object, no additional text.`;

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
