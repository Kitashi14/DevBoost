"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDuplicateButton = checkDuplicateButton;
exports.checkIfButtonIsGlobalSafe = checkIfButtonIsGlobalSafe;
exports.getAISuggestions = getAISuggestions;
exports.getCustomButtonSuggestion = getCustomButtonSuggestion;
exports.getFallbackSuggestions = getFallbackSuggestions;
// AI Services Module - All LLM-related functions
const vscode = __importStar(require("vscode"));
/**
 * AI-powered duplicate detection using semantic similarity
 * Returns the name of the existing button if duplicate found, null otherwise
 */
async function checkDuplicateButton(newButton, existingButtons, targetScope) {
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
    const normalizeCmd = (cmd) => {
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
    }
    catch (error) {
        console.error('Error in AI duplicate detection:', error);
        return null;
    }
}
/**
 * Check if a button is safe to add to global scope using AI
 */
async function checkIfButtonIsGlobalSafe(button) {
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
    }
    catch (error) {
        console.error('Error in global safety check:', error);
        return true;
    }
}
/**
 * Get AI suggestions for buttons based on activity patterns
 */
async function getAISuggestions(topActivities, platform, shell) {
    try {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        if (models.length === 0) {
            vscode.window.showWarningMessage('GitHub Copilot models not available. Using fallback suggestions.');
            return getFallbackSuggestions(topActivities);
        }
        const model = models[0];
        const prompt = `Based on the following user activities in VS Code, suggest 3-5 one-click command buttons that would be helpful.

SYSTEM INFORMATION:
- Operating System: ${platform}
- Shell: ${shell}

Activities:
${topActivities.map((activity, i) => `${i + 1}. ${activity}`).join('\n')}

IMPORTANT: Generate commands that are compatible with ${platform} and ${shell}.
${platform === 'Windows' ? '- Use Windows-compatible commands (e.g., "dir" instead of "ls", proper path separators)' : ''}
${platform === 'macOS' || platform === 'Linux' ? '- Use Unix/Linux-compatible commands' : ''}

For each button, provide:
1. A short descriptive name (with an emoji prefix)
2. The exact command to execute (terminal command or VS Code command) - MUST be compatible with ${platform}
3. A brief description of what the button does (this will be stored as ai_description)
4. Optional input fields if the command needs user input (use {variableName} as placeholder in cmd)

Format your response as JSON array:
[
    {
        "name": "🔨 Build Project",
        "cmd": "npm run build",
        "ai_description": "Builds the project using npm"
    },
    {
        "name": "📝 Git Commit",
        "cmd": "git add . && git commit -m '{message}'",
        "ai_description": "Stage all changes and commit with a message",
        "inputs": [
            {
                "placeholder": "Enter commit message",
                "variable": "{message}"
            }
        ]
    }
]

Only respond with the JSON array, no additional text.`;
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
            const buttons = JSON.parse(jsonMatch[0]);
            console.log('Parsed buttons from AI response:', buttons);
            return buttons.filter(b => b.name && b.cmd);
        }
        vscode.window.showWarningMessage('Could not parse AI response. Using fallback suggestions.');
        return getFallbackSuggestions(topActivities);
    }
    catch (err) {
        if (err instanceof vscode.LanguageModelError) {
            console.log('Language Model Error:', err.message, err.code);
            vscode.window.showWarningMessage(`AI suggestion failed: ${err.message}. Using fallback suggestions.`);
        }
        else {
            console.error('Unexpected error getting AI suggestions:', err);
            vscode.window.showWarningMessage('AI suggestion failed. Using fallback suggestions.');
        }
        return getFallbackSuggestions(topActivities);
    }
}
/**
 * Get custom button suggestion from user description
 */
async function getCustomButtonSuggestion(description, platform, shell) {
    try {
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        if (models.length === 0) {
            vscode.window.showInformationMessage('GitHub Copilot not available. Please enter button details manually.');
            return null;
        }
        const model = models[0];
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
                const button = JSON.parse(jsonString);
                if (button.name && button.cmd && button.ai_description) {
                    button.user_description = description;
                    console.log('Successfully parsed button:', button);
                    return button;
                }
            }
        }
        catch (parseError) {
            console.error('JSON parsing error:', parseError);
        }
        vscode.window.showInformationMessage('Could not parse AI response. Please enter button details manually.');
        return null;
    }
    catch (err) {
        if (err instanceof vscode.LanguageModelError) {
            console.log('Language Model Error:', err.message, err.code);
            vscode.window.showInformationMessage(`AI suggestion failed: ${err.message}. Please enter manually.`);
        }
        else {
            console.error('Unexpected error getting custom button suggestion:', err);
            vscode.window.showInformationMessage('AI suggestion failed. Please enter button details manually.');
        }
        return null;
    }
}
/**
 * Fallback suggestions based on common patterns
 */
function getFallbackSuggestions(topActivities) {
    const buttons = [];
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
        buttons.push({
            name: '🔨 Build',
            cmd: 'npm run build',
            ai_description: 'Build the project'
        }, {
            name: '🧪 Test',
            cmd: 'npm test',
            ai_description: 'Run tests'
        }, {
            name: '📝 Commit',
            cmd: 'git add . && git commit -m \'{message}\'',
            ai_description: 'Commit changes with a message',
            inputs: [
                {
                    placeholder: 'Enter commit message',
                    variable: '{message}'
                }
            ]
        });
    }
    return buttons.slice(0, 5);
}
//# sourceMappingURL=aiServices.js.map