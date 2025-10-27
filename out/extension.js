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
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Global variables
let activityLogPath;
let buttonsProvider;
// Tree item base class
class TreeItemBase extends vscode.TreeItem {
    itemType;
    constructor(label, collapsibleState, itemType) {
        super(label, collapsibleState);
        this.itemType = itemType;
    }
}
// SmartCmd parent tree item
class SmartCmdTreeItem extends TreeItemBase {
    totalButtons;
    constructor(totalButtons) {
        super('SmartCmd', vscode.TreeItemCollapsibleState.Expanded, 'smartcmd');
        this.totalButtons = totalButtons;
        this.description = `${totalButtons} button${totalButtons !== 1 ? 's' : ''}`;
        this.contextValue = 'smartcmd';
    }
}
// Section tree item (parent nodes for Global/Workspace)
class SectionTreeItem extends TreeItemBase {
    section;
    buttonCount;
    constructor(section, buttonCount) {
        super(section === 'global' ? 'Global Commands' : 'Workspace Commands', vscode.TreeItemCollapsibleState.Expanded, 'section');
        this.section = section;
        this.buttonCount = buttonCount;
        this.description = `${buttonCount} button${buttonCount !== 1 ? 's' : ''}`;
        this.contextValue = 'section';
        this.iconPath = new vscode.ThemeIcon(section === 'global' ? 'globe' : 'window');
    }
}
// Tree item for buttons
class ButtonTreeItem extends TreeItemBase {
    button;
    collapsibleState;
    constructor(button, collapsibleState) {
        super(button.name, collapsibleState, 'button');
        this.button = button;
        this.collapsibleState = collapsibleState;
        // Enhanced tooltip with description and input fields info
        const inputInfo = button.inputs && button.inputs.length > 0
            ? `\nInputs: ${button.inputs.map(i => i.placeholder).join(', ')}`
            : '';
        this.tooltip = `${button.description || button.cmd}${inputInfo}`;
        this.description = button.description || '';
        this.iconPath = new vscode.ThemeIcon('play');
        this.contextValue = 'button';
        // Make it clickable - pass the entire button object for input handling
        this.command = {
            command: 'devboost.executeButton',
            title: 'Execute Button',
            arguments: [button]
        };
    }
}
// Tree data provider for buttons with hierarchical structure
class ButtonsTreeProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    buttons = [];
    constructor(context) {
        this.context = context;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async loadButtons() {
        this.buttons = [];
        // Load global buttons
        const globalButtons = this.context.globalState.get('devboost.globalButtons') || [];
        this.buttons.push(...globalButtons.map(b => ({ ...b, scope: 'global' })));
        // Load workspace buttons
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const buttonsFilePath = path.join(workspaceRoot, '.vscode', 'devboost.json');
            try {
                const content = await fs.readFile(buttonsFilePath, 'utf-8');
                const workspaceButtons = JSON.parse(content);
                this.buttons.push(...workspaceButtons.map((b) => ({ ...b, scope: 'workspace' })));
            }
            catch {
                // File doesn't exist, no workspace buttons to load
            }
        }
        this.refresh();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        // Root level: show SmartCmd parent
        if (!element) {
            const totalButtons = this.buttons.length;
            if (totalButtons === 0) {
                return Promise.resolve([]);
            }
            return Promise.resolve([new SmartCmdTreeItem(totalButtons)]);
        }
        // If element is SmartCmd, return sections (Global and Workspace)
        if (element instanceof SmartCmdTreeItem) {
            const globalButtons = this.buttons.filter(b => b.scope === 'global');
            const workspaceButtons = this.buttons.filter(b => b.scope === 'workspace');
            const sections = [];
            // Add Global section if there are global buttons
            if (globalButtons.length > 0) {
                sections.push(new SectionTreeItem('global', globalButtons.length));
            }
            // Add Workspace section if there are workspace buttons
            if (workspaceButtons.length > 0) {
                sections.push(new SectionTreeItem('workspace', workspaceButtons.length));
            }
            return Promise.resolve(sections);
        }
        // If element is a section, return its buttons
        if (element instanceof SectionTreeItem) {
            const sectionButtons = this.buttons
                .filter(b => b.scope === element.section)
                .map(button => new ButtonTreeItem(button, vscode.TreeItemCollapsibleState.None));
            return Promise.resolve(sectionButtons);
        }
        // If element is a button, it has no children
        return Promise.resolve([]);
    }
    async addButtons(buttons, scope) {
        if (!buttons || buttons.length === 0) {
            vscode.window.showWarningMessage('DevBoost: No buttons to add.');
            return 0;
        }
        // Validate buttons and check for duplicates
        const validButtons = [];
        const duplicateButtons = [];
        const invalidButtons = [];
        for (let i = 0; i < buttons.length; i++) {
            const b = buttons[i];
            // Check if button is valid
            if (!b.name || !b.cmd || b.name.trim().length === 0 || b.cmd.trim().length === 0) {
                console.warn('DevBoost: Skipping invalid button:', b);
                invalidButtons.push(i);
                continue;
            }
            // Check for duplicates using AI-powered semantic comparison
            const duplicateInfo = await this.checkDuplicate(b, scope);
            if (duplicateInfo) {
                duplicateButtons.push({ newName: b.name, existingName: duplicateInfo });
                console.warn('DevBoost: Skipping duplicate/similar button:', b.name, '(similar to:', duplicateInfo + ')');
            }
            else {
                validButtons.push(b);
            }
        }
        // Show feedback about duplicates
        if (duplicateButtons.length > 0) {
            if (duplicateButtons.length === 1) {
                const dup = duplicateButtons[0];
                vscode.window.showWarningMessage(`DevBoost: Skipping suggested new button "${dup.newName}" as it's similar to existing button "${dup.existingName}".`);
            }
            else {
                const dupMsg = `Suggested new ${duplicateButtons.length} buttons are similar to existing ones: ${duplicateButtons.slice(0, 3).map(d => `"${d.newName}"`).join(', ')}${duplicateButtons.length > 3 ? '...' : ''}`;
                vscode.window.showWarningMessage(`DevBoost: ${dupMsg}`);
            }
        }
        if (validButtons.length === 0) {
            if (duplicateButtons.length > 0 && invalidButtons.length === 0) {
                vscode.window.showInformationMessage('All buttons are similar to existing ones. No new buttons added.');
            }
            else {
                vscode.window.showWarningMessage('DevBoost: No valid buttons to add.');
            }
            return 0;
        }
        // Add valid, non-duplicate buttons
        const newButtons = validButtons.map(b => ({ ...b, scope }));
        this.buttons.push(...newButtons);
        await this.saveButtons(validButtons, scope);
        this.refresh();
        // Show summary message
        const messages = [];
        if (validButtons.length > 0) {
            messages.push(`Added ${validButtons.length} button${validButtons.length > 1 ? 's' : ''}`);
        }
        if (duplicateButtons.length > 0) {
            messages.push(`${duplicateButtons.length} similar button${duplicateButtons.length > 1 ? 's' : ''} skipped`);
        }
        if (invalidButtons.length > 0) {
            messages.push(`${invalidButtons.length} invalid button${invalidButtons.length > 1 ? 's' : ''} skipped`);
        }
        vscode.window.showInformationMessage(`DevBoost: ${messages.join(', ')}.`);
        return validButtons.length;
    }
    // AI-powered duplicate detection using semantic similarity
    // Returns the name of the existing button if duplicate found, null otherwise
    async checkDuplicate(newButton, targetScope) {
        if (this.buttons.length === 0) {
            return null;
        }
        // Filter buttons based on scope:
        // - Global scope: check only against global buttons
        // - Workspace scope: check against both global and workspace buttons
        const buttonsToCheck = targetScope === 'global'
            ? this.buttons.filter(b => b.scope === 'global')
            : this.buttons; // Workspace checks against all buttons
        if (buttonsToCheck.length === 0) {
            return null;
        }
        // Normalize command for comparison (remove variable placeholders)
        const normalizeCmd = (cmd) => {
            return cmd
                .replace(/\{[^}]+\}/g, '{VAR}') // Replace all {variables} with {VAR}
                .replace(/['"`]/g, '') // Remove quotes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .toLowerCase()
                .trim();
        };
        const newCmdNormalized = normalizeCmd(newButton.cmd);
        // First, do quick exact match check on normalized commands
        for (const existing of buttonsToCheck) {
            const existingCmdNormalized = normalizeCmd(existing.cmd);
            // Exact match after normalization
            if (newCmdNormalized === existingCmdNormalized) {
                console.log(`Duplicate detected: "${newButton.cmd}" matches "${existing.cmd}" (${existing.scope})`);
                return existing.name; // Return the existing button name
            }
        }
        // If no exact match, use AI for semantic similarity check
        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
            if (models.length === 0) {
                // Fallback: just use normalized string comparison
                return null;
            }
            const model = models[0];
            // Create comparison list of buttons to check (based on scope)
            const existingButtonsInfo = buttonsToCheck.map((b, i) => `${i + 1}. Name: "${b.name}", Command: "${b.cmd}", Description: "${b.description || 'N/A'}", Scope: ${b.scope}`).join('\n');
            const scopeContext = targetScope === 'global'
                ? 'This button will be available globally (in all projects).'
                : 'This button will be available in the current workspace. Checking against both global and workspace buttons.';
            const prompt = `Compare this new button with existing buttons and determine if it's a duplicate or very similar.
			
			New Button (Target Scope: ${targetScope}):
			- Name: "${newButton.name}"
			- Command: "${newButton.cmd}"
			- Description: "${newButton.description || 'N/A'}"
			
			${scopeContext}

			Existing Buttons to Check:
			${existingButtonsInfo}

			Consider buttons as duplicates if they:
			1. Execute the same command (even with different variable names)
			2. Perform the same action (e.g., "git commit" vs "commit changes")
			3. Have the same functionality with minor syntax differences

			If it's a duplicate/similar, respond with ONLY the NAME of the most similar existing button (e.g., "🔨 Build Project").
			If it's unique, respond with only "UNIQUE".`;
            const messages = [vscode.LanguageModelChatMessage.User(prompt)];
            const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            console.log(prompt);
            let fullResponse = '';
            for await (const part of response.text) {
                fullResponse += part;
            }
            console.log('AI duplicate detection response:', fullResponse);
            const answer = fullResponse.trim();
            // Check if response is UNIQUE
            if (answer.toUpperCase() === 'UNIQUE' || answer.toUpperCase().includes('NO')) {
                return null;
            }
            // Otherwise, return the existing button name
            console.log(`AI detected duplicate: "${newButton.name}" is similar to "${answer}"`);
            return answer;
        }
        catch (error) {
            console.error('Error in AI duplicate detection:', error);
            // On error, allow the button (better to have duplicates than miss new ones)
            return null;
        }
    }
    async deleteButton(item) {
        if (!item || !item.button) {
            vscode.window.showWarningMessage('DevBoost: Invalid button item.');
            return;
        }
        const index = this.buttons.findIndex(b => b.name === item.button.name && b.cmd === item.button.cmd);
        if (index === -1) {
            vscode.window.showWarningMessage(`DevBoost: Button "${item.button.name}" not found.`);
            return;
        }
        const button = this.buttons[index];
        this.buttons.splice(index, 1);
        // Remove from storage
        try {
            if (button.scope === 'global') {
                await this.context.globalState.update('devboost.globalButtons', this.buttons.filter(b => b.scope === 'global').map(({ scope, ...b }) => b));
            }
            else {
                await this.saveWorkspaceButtons();
            }
            this.refresh();
            vscode.window.showInformationMessage(`Deleted button: ${button.name}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to delete button: ${button.name}`);
            console.error('Delete button error:', error);
        }
    }
    async editButton(item) {
        if (!item || !item.button) {
            vscode.window.showWarningMessage('DevBoost: Invalid button item.');
            return;
        }
        const index = this.buttons.findIndex(b => b.name === item.button.name && b.cmd === item.button.cmd);
        if (index === -1) {
            vscode.window.showWarningMessage(`DevBoost: Button "${item.button.name}" not found.`);
            return;
        }
        const button = this.buttons[index];
        // Get new name
        const newName = await vscode.window.showInputBox({
            prompt: 'Edit button name',
            value: button.name,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Button name cannot be empty';
                }
                return null;
            }
        });
        if (!newName) {
            vscode.window.showInformationMessage('Edit cancelled.');
            return;
        }
        // Get new description
        const newDescription = await vscode.window.showInputBox({
            prompt: 'Edit button description (optional)',
            value: button.description || '',
            placeHolder: 'Brief description of what this button does'
        });
        // Update button
        this.buttons[index] = {
            ...button,
            name: newName.trim(),
            description: newDescription?.trim() || button.description
        };
        // Save to storage
        try {
            if (button.scope === 'global') {
                await this.context.globalState.update('devboost.globalButtons', this.buttons.filter(b => b.scope === 'global').map(({ scope, ...b }) => b));
            }
            else {
                await this.saveWorkspaceButtons();
            }
            this.refresh();
            vscode.window.showInformationMessage(`Updated button: ${newName}`);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to update button: ${button.name}`);
            console.error('Edit button error:', error);
        }
    }
    async saveButtons(buttons, scope) {
        if (scope === 'global') {
            const existingButtons = this.context.globalState.get('devboost.globalButtons') || [];
            const updatedButtons = [...existingButtons, ...buttons.map(({ scope, ...b }) => b)];
            await this.context.globalState.update('devboost.globalButtons', updatedButtons);
        }
        else {
            await this.saveWorkspaceButtons();
        }
    }
    async saveWorkspaceButtons() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const buttonsFilePath = path.join(workspaceRoot, '.vscode', 'devboost.json');
        try {
            await fs.mkdir(path.dirname(buttonsFilePath), { recursive: true });
            const workspaceButtons = this.buttons
                .filter(b => b.scope === 'workspace')
                .map(({ scope, ...b }) => b);
            await fs.writeFile(buttonsFilePath, JSON.stringify(workspaceButtons, null, 2));
        }
        catch (error) {
            console.error('Error saving workspace buttons:', error);
        }
    }
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('DevBoost extension is now active!');
    // Initialize activity log path
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        activityLogPath = path.join(workspaceRoot, '.vscode', 'activity.log');
    }
    // Setup activity logging
    setupActivityLogging(context);
    // Create and register the tree view provider
    buttonsProvider = new ButtonsTreeProvider(context);
    const treeView = vscode.window.createTreeView('devboost.buttonsView', {
        treeDataProvider: buttonsProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);
    // Load existing buttons
    buttonsProvider.loadButtons();
    // Register commands
    const helloWorldDisposable = vscode.commands.registerCommand('DevBoost.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from DevBoost!');
    });
    const createButtonsDisposable = vscode.commands.registerCommand('devboost.smartCmdCreateButtons', async () => {
        await createAIButtons(context);
    });
    const createCustomButtonDisposable = vscode.commands.registerCommand('devboost.smartCmdCreateCustomButton', async (sectionObj) => {
        if (sectionObj && typeof sectionObj === 'object' && 'section' in sectionObj) {
            if (sectionObj.section == 'global')
                await createCustomButton(context, 'Global');
            else
                await createCustomButton(context, 'Workspace');
        }
        else {
            await createCustomButton(context);
        }
    });
    const executeButtonDisposable = vscode.commands.registerCommand('devboost.executeButton', async (buttonOrCmd) => {
        // Handle different argument types
        let button;
        if (typeof buttonOrCmd === 'string') {
            // Legacy: just a command string
            button = { name: 'Command', cmd: buttonOrCmd };
        }
        else if (buttonOrCmd && typeof buttonOrCmd === 'object' && 'cmd' in buttonOrCmd && 'name' in buttonOrCmd) {
            // New: Button object
            button = buttonOrCmd;
        }
        else if (buttonOrCmd && typeof buttonOrCmd === 'object' && 'button' in buttonOrCmd) {
            // TreeItem wrapper
            button = buttonOrCmd.button;
        }
        else {
            vscode.window.showWarningMessage('DevBoost: No command provided to execute.');
            return;
        }
        await executeButtonCommand(button);
    });
    const deleteButtonDisposable = vscode.commands.registerCommand('devboost.deleteButton', async (item) => {
        if (!item) {
            vscode.window.showWarningMessage('DevBoost: No button selected to delete.');
            return;
        }
        await buttonsProvider.deleteButton(item);
    });
    const editButtonDisposable = vscode.commands.registerCommand('devboost.editButton', async (item) => {
        if (!item) {
            vscode.window.showWarningMessage('DevBoost: No button selected to edit.');
            return;
        }
        await buttonsProvider.editButton(item);
    });
    const refreshButtonsDisposable = vscode.commands.registerCommand('devboost.refreshButtons', async () => {
        await buttonsProvider.loadButtons();
        vscode.window.showInformationMessage('Buttons refreshed!');
    });
    context.subscriptions.push(helloWorldDisposable, createButtonsDisposable, createCustomButtonDisposable, executeButtonDisposable, deleteButtonDisposable, editButtonDisposable, refreshButtonsDisposable);
}
// Setup activity logging system
function setupActivityLogging(context) {
    // Note: VS Code doesn't have onDidExecuteCommand for all commands
    // We'll log specific commands we care about through our own tracking
    // Log file save operations
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (doc) => {
        await logActivity('Save', doc.fileName);
    }));
    // Log file create operations
    context.subscriptions.push(vscode.workspace.onDidCreateFiles(async (event) => {
        for (const file of event.files) {
            await logActivity('Create', file.fsPath);
        }
    }));
    // Log file delete operations
    context.subscriptions.push(vscode.workspace.onDidDeleteFiles(async (event) => {
        for (const file of event.files) {
            await logActivity('Delete', file.fsPath);
        }
    }));
    // Log file rename operations
    context.subscriptions.push(vscode.workspace.onDidRenameFiles(async (event) => {
        for (const rename of event.files) {
            await logActivity('Rename', `${rename.oldUri.fsPath} to ${rename.newUri.fsPath}`);
        }
    }));
    // Log when terminal commands are executed
    context.subscriptions.push(vscode.window.onDidStartTerminalShellExecution(async (event) => {
        const commandLine = event.execution.commandLine.value;
        // Log all terminal commands without filtering
        await logActivity('Command', commandLine.trim());
    }));
}
// Log activity to .vscode/activity.log
async function logActivity(type, detail) {
    // Validate parameters
    if (!type || !detail || type.trim().length === 0 || detail.trim().length === 0) {
        console.log('DevBoost: Skipping log entry - invalid type or detail');
        return;
    }
    if (!activityLogPath) {
        console.log('DevBoost: Activity log path not initialized');
        return;
    }
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} | ${type.trim()}: ${detail.trim()}\n`;
        // Create .vscode directory if it doesn't exist
        const vscodeDirPath = path.dirname(activityLogPath);
        await fs.mkdir(vscodeDirPath, { recursive: true });
        // Append to activity log
        await fs.appendFile(activityLogPath, logEntry);
    }
    catch (error) {
        console.error('DevBoost: Error logging activity:', error);
    }
}
// Create AI-suggested buttons based on activity log
async function createAIButtons(context) {
    // Check if workspace is open
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Please open a workspace to use SmartCmd.');
        return;
    }
    if (!activityLogPath) {
        vscode.window.showErrorMessage('Activity log path not initialized.');
        return;
    }
    try {
        // Read activity log
        const logContent = await fs.readFile(activityLogPath, 'utf-8');
        if (!logContent || logContent.trim().length === 0) {
            vscode.window.showInformationMessage('Activity log is empty. Try creating a custom button instead.');
            return;
        }
        // Parse and analyze activities
        const activities = parseActivityLog(logContent);
        console.log('Parsed activities:', activities);
        const topActivities = getTopActivities(activities, 5);
        console.log('Top activities:', topActivities);
        if (topActivities.length === 0) {
            vscode.window.showInformationMessage('No significant activities found. Try creating a custom button instead.');
            return;
        }
        // Get AI suggestions from GitHub Copilot
        vscode.window.showInformationMessage('Analyzing your workflow patterns...');
        const buttons = await getAISuggestions(topActivities);
        if (buttons.length === 0) {
            vscode.window.showWarningMessage('Could not generate button suggestions. Please try again.');
            return;
        }
        // Add buttons to tree view
        const addedCount = await buttonsProvider.addButtons(buttons, 'workspace');
        if (addedCount > 0) {
            vscode.window.showInformationMessage(`✨ Created ${addedCount} AI-suggested button${addedCount > 1 ? 's' : ''}!`);
        }
    }
    catch (error) {
        console.error('Error creating AI buttons:', error);
        vscode.window.showErrorMessage('Failed to create AI buttons. Please check the output console for details.');
    }
}
// Create custom button from user description
async function createCustomButton(context, scopeInput) {
    // Get scope
    const scope = scopeInput || await vscode.window.showQuickPick(['Workspace', 'Global'], {
        placeHolder: 'Where should this button be available?'
    });
    if (!scope || scope.trim().length === 0 || (scope !== 'Workspace' && scope !== 'Global')) {
        vscode.window.showInformationMessage('Invalid scope selected. Please choose either "Workspace" or "Global".');
        return;
    }
    // Get user description
    const description = await vscode.window.showInputBox({
        prompt: 'Describe the button you want to create',
        placeHolder: 'e.g., Button to run tests and commit code'
    });
    if (!description) {
        return;
    }
    // Get user input whether use AI or manual
    const useAI = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Use AI to generate the button?'
    });
    if (!useAI) {
        return;
    }
    if (useAI === 'No') {
        try {
            const button = await getManualButtonInput(description);
            if (!button) {
                vscode.window.showWarningMessage('Could not generate button. Please try again.');
                return;
            }
            // Add button to tree view
            const scopeType = scope === 'Global' ? 'global' : 'workspace';
            const addedCount = await buttonsProvider.addButtons([button], scopeType);
            if (addedCount > 0) {
                vscode.window.showInformationMessage(`✅ Created custom button: ${button.name}`);
            }
        }
        catch (error) {
            console.error('Error creating custom button:', error);
            vscode.window.showErrorMessage('Failed to create custom button.');
        }
        return;
    }
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Creating custom button...",
            cancellable: false
        }, async (progress) => {
            // Get AI suggestion from GitHub Copilot
            const button = await getCustomButtonSuggestion(description);
            if (!button) {
                vscode.window.showWarningMessage('Could not generate button. Please try again.');
                return;
            }
            // Add button to tree view
            const scopeType = scope === 'Global' ? 'global' : 'workspace';
            const addedCount = await buttonsProvider.addButtons([button], scopeType);
            if (addedCount > 0) {
                vscode.window.showInformationMessage(`✅ Created custom button: ${button.name}`);
            }
        });
    }
    catch (error) {
        console.error('Error creating custom button:', error);
        vscode.window.showErrorMessage('Failed to create custom button.');
    }
}
// Parse activity log and count frequencies
function parseActivityLog(logContent) {
    const activities = new Map();
    const lines = logContent.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines) {
        // Match format: 2025-10-27T10:37:41.083Z | Type: detail
        const match = line.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*\|\s*(.+?)\s*:\s*(.+)$/);
        if (match) {
            const type = match[1].trim();
            const detail = match[2].trim();
            const activity = `${type}: ${detail}`;
            activities.set(activity, (activities.get(activity) || 0) + 1);
        }
    }
    return activities;
}
// Get top N activities by frequency
function getTopActivities(activities, count) {
    return Array.from(activities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([activity]) => activity);
}
// Execute button command with input field support
async function executeButtonCommand(button) {
    if (!button || !button.cmd || button.cmd.trim().length === 0) {
        vscode.window.showWarningMessage('No command specified. Please provide a valid command to execute.');
        return;
    }
    let finalCommand = button.cmd.trim();
    // Handle input fields if present
    if (button.inputs && button.inputs.length > 0) {
        for (const input of button.inputs) {
            const userInput = await vscode.window.showInputBox({
                prompt: input.placeholder,
                placeHolder: input.placeholder,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Input cannot be empty';
                    }
                    return null;
                }
            });
            if (!userInput) {
                vscode.window.showInformationMessage('Command execution cancelled.');
                return;
            }
            // Replace variable placeholder with user input
            finalCommand = finalCommand.replace(new RegExp(input.variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), userInput.trim());
        }
    }
    // Check if it's a single-word VS Code command
    if (!finalCommand.includes(' ') && !finalCommand.includes('&&') && !finalCommand.includes('||') && !finalCommand.includes(';')) {
        try {
            await vscode.commands.executeCommand(finalCommand);
            vscode.window.showInformationMessage(`Executed VS Code command: ${finalCommand}`);
            return;
        }
        catch (error) {
            // Not a VS Code command, fall through to terminal execution
            console.log(`Not a VS Code command, executing in terminal: ${finalCommand}`);
        }
    }
    // Execute as terminal command
    try {
        const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('DevBoost');
        terminal.show();
        terminal.sendText(finalCommand);
        vscode.window.setStatusBarMessage(`⚡ Executed: ${button.name}`, 3000);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to execute command: ${button.name}`);
        console.error('Command execution error:', error);
    }
}
// Get system information for AI context
function getSystemInfo() {
    // Determine OS
    let platform = 'Unknown';
    if (process.platform === 'win32') {
        platform = 'Windows';
    }
    else if (process.platform === 'darwin') {
        platform = 'macOS';
    }
    else if (process.platform === 'linux') {
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
// Get AI suggestions from GitHub Copilot
async function getAISuggestions(topActivities) {
    try {
        // Select GitHub Copilot models using the Language Model API
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        if (models.length === 0) {
            vscode.window.showWarningMessage('GitHub Copilot models not available. Using fallback suggestions.');
            return getFallbackSuggestions(topActivities);
        }
        const model = models[0];
        // Get system information
        const osInfo = getSystemInfo();
        // Craft the prompt for button suggestions
        const prompt = `Based on the following user activities in VS Code, suggest 3-5 one-click command buttons that would be helpful.

		SYSTEM INFORMATION:
		- Operating System: ${osInfo.platform}
		- Shell: ${osInfo.shell}
		
		Activities:
		${topActivities.map((activity, i) => `${i + 1}. ${activity}`).join('\n')}
		
		IMPORTANT: Generate commands that are compatible with ${osInfo.platform} and ${osInfo.shell}.
		${osInfo.platform === 'Windows' ? '- Use Windows-compatible commands (e.g., "dir" instead of "ls", proper path separators)' : ''}
		${osInfo.platform === 'macOS' || osInfo.platform === 'Linux' ? '- Use Unix/Linux-compatible commands' : ''}
		
		For each button, provide:
		1. A short descriptive name (with an emoji prefix)
		2. The exact command to execute (terminal command or VS Code command) - MUST be compatible with ${osInfo.platform}
		3. A brief description of what the button does
		4. Optional input fields if the command needs user input (use {variableName} as placeholder in cmd)		Format your response as JSON array:
		[
			{
				"name": "🔨 Build Project",
				"cmd": "npm run build",
				"description": "Builds the project using npm"
			},
			{
				"name": "📝 Git Commit",
				"cmd": "git add . && git commit -m '{message}'",
				"description": "Stage all changes and commit with a message",
				"inputs": [
					{
						"placeholder": "Enter commit message",
						"variable": "{message}"
					}
				]
			}
		]
		
		Only respond with the JSON array, no additional text.`;
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];
        console.log('AI button suggestions prompt:', prompt);
        // Send request to the model
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        // Collect the response
        let fullResponse = '';
        for await (const part of response.text) {
            fullResponse += part;
        }
        console.log('AI response for button suggestions:', fullResponse);
        // Parse the JSON response
        const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const buttons = JSON.parse(jsonMatch[0]);
            console.log('Parsed buttons from AI response:', buttons);
            return buttons.filter(b => b.name && b.cmd);
        }
        // Fallback if parsing fails
        vscode.window.showWarningMessage('Could not parse AI response. Using fallback suggestions.');
        return getFallbackSuggestions(topActivities);
    }
    catch (err) {
        // Handle errors
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
// Get custom button suggestion from GitHub Copilot
async function getCustomButtonSuggestion(description) {
    try {
        // Select GitHub Copilot models
        const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
        if (models.length === 0) {
            vscode.window.showInformationMessage('GitHub Copilot not available. Please enter button details manually.');
            return await getManualButtonInput(description);
        }
        const model = models[0];
        // Get system information
        const osInfo = getSystemInfo();
        // Craft the prompt for custom button
        const prompt = `Create a VS Code button based on this description: "${description}"

		SYSTEM INFORMATION:
		- Operating System: ${osInfo.platform}
		- Shell: ${osInfo.shell}

		IMPORTANT: Generate commands that are compatible with ${osInfo.platform} and ${osInfo.shell}.
		${osInfo.platform === 'Windows' ? '- Use Windows-compatible commands (e.g., PowerShell or cmd syntax)' : ''}
		${osInfo.platform === 'macOS' || osInfo.platform === 'Linux' ? '- Use Unix/Linux-compatible commands (bash/zsh syntax)' : ''}

		Provide:
		1. A short descriptive name (with an emoji prefix, max 30 characters)
		2. The exact command to execute (terminal command or VS Code command like "workbench.action.files.saveAll") - MUST be compatible with ${osInfo.platform}
		3. A brief description of what the button does
		4. If the command needs user input, include input fields with placeholders (use {variableName} format in cmd)

		Format your response as JSON:
		{
			"name": "🔨 Build Project",
			"cmd": "npm run build",
			"description": "Builds the project using npm"
		}

		Or with inputs:
		{
			"name": "📝 Git Commit",
			"cmd": "git add . && git commit -m '{message}'",
			"description": "Stage all changes and commit with a custom message",
			"inputs": [
				{
					"placeholder": "Enter commit message",
					"variable": "{message}"
				}
			]
		}

		Only respond with the JSON object, no additional text.`;
        const messages = [
            vscode.LanguageModelChatMessage.User(prompt)
        ];
        console.log('Custom button prompt:', prompt);
        // Send request to the model
        const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        // Collect the response
        let fullResponse = '';
        for await (const part of response.text) {
            fullResponse += part;
        }
        console.log('AI response for custom button:', fullResponse);
        // Parse the JSON response - find the outermost JSON object
        try {
            // Remove markdown code blocks if present
            let cleanedResponse = fullResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            // Find the first { and last } to get complete JSON object
            const firstBrace = cleanedResponse.indexOf('{');
            const lastBrace = cleanedResponse.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                const jsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
                const button = JSON.parse(jsonString);
                if (button.name && button.cmd) {
                    console.log('Successfully parsed button:', button);
                    return button;
                }
            }
        }
        catch (parseError) {
            console.error('JSON parsing error:', parseError);
        }
        // Fallback to manual input if parsing fails
        vscode.window.showInformationMessage('Could not parse AI response. Please enter button details manually.');
        return await getManualButtonInput(description);
    }
    catch (err) {
        // Handle errors
        if (err instanceof vscode.LanguageModelError) {
            console.log('Language Model Error:', err.message, err.code);
            vscode.window.showInformationMessage(`AI suggestion failed: ${err.message}. Please enter manually.`);
        }
        else {
            console.error('Unexpected error getting custom button suggestion:', err);
            vscode.window.showInformationMessage('AI suggestion failed. Please enter button details manually.');
        }
        return await getManualButtonInput(description);
    }
}
// Fallback suggestions based on common patterns
function getFallbackSuggestions(topActivities) {
    const buttons = [];
    const activityString = topActivities.join(' ').toLowerCase();
    // Analyze activities and suggest common buttons with descriptions and inputs
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
    // Add default buttons if none matched
    if (buttons.length === 0) {
        buttons.push({
            name: '🔨 Build',
            cmd: 'npm run build',
            description: 'Build the project'
        }, {
            name: '🧪 Test',
            cmd: 'npm test',
            description: 'Run tests'
        }, {
            name: '📝 Commit',
            cmd: 'git add . && git commit -m \'{message}\'',
            description: 'Commit changes with a message',
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
// Manual button input as fallback
async function getManualButtonInput(description) {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter button name',
        value: description.substring(0, 15),
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Button name cannot be empty';
            }
            if (value.length > 50) {
                return 'Button name is too long (max 50 characters)';
            }
            return null;
        }
    });
    if (!name) {
        vscode.window.showInformationMessage('Button creation cancelled.');
        return null;
    }
    const cmd = await vscode.window.showInputBox({
        prompt: 'Enter command to execute (use {variableName} for inputs)',
        placeHolder: 'e.g., git commit -m \'{message}\' or npm test',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Command cannot be empty';
            }
            return null;
        }
    });
    if (!cmd) {
        vscode.window.showInformationMessage('Button creation cancelled.');
        return null;
    }
    const desc = await vscode.window.showInputBox({
        prompt: 'Enter button description (optional)',
        placeHolder: 'Brief description of what this button does',
        value: description
    });
    // Check if command has input placeholders
    const inputMatches = cmd.match(/\{(\w+)\}/g);
    const inputs = [];
    if (inputMatches && inputMatches.length > 0) {
        for (const match of inputMatches) {
            const variable = match;
            const varName = match.slice(1, -1); // Remove { and }
            const placeholder = await vscode.window.showInputBox({
                prompt: `Enter placeholder text for ${variable}`,
                placeHolder: `e.g., Enter ${varName}`
            });
            if (placeholder) {
                inputs.push({
                    placeholder: placeholder.trim(),
                    variable: variable
                });
            }
        }
    }
    return {
        name: name.trim(),
        cmd: cmd.trim(),
        description: desc?.trim(),
        inputs: inputs.length > 0 ? inputs : undefined
    };
}
// This method is called when your extension is deactivated
function deactivate() {
    // Cleanup handled by context.subscriptions
}
//# sourceMappingURL=extension.js.map