# SmartCmd Context File for DevBoost

## Feature Overview
**Feature Name**: SmartCmd  
**Parent Project**: DevBoost  
**Purpose**: SmartCmd is the flagship feature of the DevBoost VS Code extension, designed to enhance developer productivity by automating repetitive tasks through AI-generated buttons. It logs all user terminal commands, file operations (save, create, delete, rename), in the project's `.vscode/activity.log`. An AI model (GitHub Copilot Language Model API with gpt-4o) analyzes these logs to suggest OS-compatible buttons for frequent tasks, displayed in a hierarchical DevBoost sidebar (SmartCmd → Global Commands / Workspace Commands) for one-click execution. Users can also create custom buttons via natural language prompts. Buttons support dynamic input fields using `{variableName}` placeholders that prompt users at execution time. The system includes intelligent duplicate detection using AI-powered semantic analysis. Buttons can be edited (name and description) after creation. Buttons are persisted per project in `.vscode/devboost.json` or globally in VS Code's storage, reloading across sessions. SmartCmd is a core component of DevBoost, a broader productivity suite for developers.

**Target Audience**: Software developers with repetitive tasks (e.g., builds, Git operations, file management) across different operating systems (Windows, macOS, Linux).  

## Feature Details
### 1. Activity Logging
- Tracks:
  - All terminal commands executed in VS Code's integrated terminal (no filtering).
  - File operations (save, create, delete, rename).
- Logs stored in `.vscode/activity.log` in the project directory for workspace-specific tracking.
- Format: `<ISO timestamp> | <type>: <detail>` (e.g., `2025-10-27T10:37:41.083Z | Command: git status`).
- Uses `onDidStartTerminalShellExecution` event to capture all commands.

### 2. Hierarchical Sidebar Structure
- **DevBoost Sidebar**: Main container with rocket icon (🚀) in activity bar.
- **Three-Level Hierarchy**:
  1. **DevBoost** (Root level - activity bar)
  2. **⚡ SmartCmd** (Parent section showing total button count)
  3. **🌐 Global Commands** / **📁 Workspace Commands** (Separate sections for scoped buttons)
- **Action Buttons on SmartCmd Section**:
  - ✨ Create AI Suggested Buttons
  - ➕ Create Custom Button
  - 🔄 Refresh Buttons
- Buttons organized by scope with visual indicators and expandable/collapsible sections.
- Uses `TreeDataProvider` with `TreeItemBase` class hierarchy for structure.

### 3. AI-Suggested Buttons
- Analyzes `.vscode/activity.log` to identify frequent tasks.
- **OS Detection**: Automatically detects operating system (Windows/macOS/Linux) using `process.platform` and shell (bash/zsh/PowerShell/cmd) using `process.env.SHELL` or `process.env.COMSPEC`.
- **OS-Aware Commands**: AI generates platform-specific commands compatible with the user's system.
- AI suggests 3-5 buttons with names, commands, descriptions, and optional input fields.
- Uses GitHub Copilot Language Model API (`vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' })`) with streaming responses.
- **Intelligent Duplicate Detection**: Two-layer system prevents creating similar buttons:
  1. **Normalization**: Removes quotes, whitespace, normalizes variable placeholders to `{VAR}`.
  2. **AI Semantic Analysis**: Uses Copilot to detect functionally identical buttons by comparing command purpose and structure.
  3. **Scope-Aware Checking**: Global buttons check only against global buttons; workspace buttons check against both global and workspace.
- Returns button name if duplicate found, displays which existing button it matches.
- Buttons displayed in the hierarchical sidebar under appropriate scope section.

### 4. Custom Button Creation
- Users describe buttons in natural language (e.g., "Button to commit changes with a message").
- AI generates a button with name (with emoji), command, description, and automatically detects input fields.
- Users choose "Project Directory" (workspace) or "Global" scope for persistence.
- **Dynamic Input Fields**: Commands can include `{variableName}` placeholders:
  - Example: `git commit -m '{message}'`
  - AI automatically generates `InputField` objects with placeholder and variable name.
  - User is prompted for each variable when button is clicked.
  - Input validation ensures non-empty values.
- **Manual Input Detection**: If manually creating buttons, regex detects `{variableName}` patterns and prompts for descriptions.

### 5. Button Editing
- Users can edit button name and description after creation.
- **Edit Icon** (✏️ pencil) appears on hover next to each button (inline action).
- Two-step process:
  1. Edit button name (required, validated for non-empty).
  2. Edit button description (optional).
- Command and input fields preserved (cannot be edited to prevent breaking functionality).
- Changes saved to appropriate storage location (global state or workspace JSON).
- Tree view refreshes automatically after edit.

### 6. Button Persistence
- **Workspace-Specific**: Saved in `.vscode/devboost.json`, reloading when the project is reopened.
- **Global**: Stored in VS Code's global state with key `devboost.globalButtons`, accessible across all projects.
- Button data structure: `{ name: string, cmd: string, description?: string, inputs?: InputField[], scope?: 'workspace' | 'global' }`.
- InputField structure: `{ placeholder: string, variable: string }`.

### 7. Execution
- Single-word VS Code commands (e.g., `workbench.action.files.save`) executed directly via `vscode.commands.executeCommand`.
- Multi-word terminal commands (e.g., `npm test && git commit -m 'update'`) sent to integrated terminal via `terminal.sendText()`.
- **Dynamic Input Handling**:
  - Before execution, iterates through button's `inputs[]` array.
  - Prompts user with `vscode.window.showInputBox` for each `{variable}`.
  - Replaces placeholders using regex: `new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')`.
  - Validates input (non-empty requirement).
  - Cancellation supported at any prompt (aborts command execution).

## Technical Architecture
### Components
- **Logging System**:
  - Uses VS Code APIs: `workspace.onDidSaveTextDocument`, `workspace.onDidCreateFiles`, `workspace.onDidDeleteFiles`, `workspace.onDidRenameFiles`, `window.onDidStartTerminalShellExecution` (for all terminal commands).
  - Logs in `.vscode/activity.log` using `fs.promises.appendFile` with ISO timestamp format.
  - Log parser uses regex: `/\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*\|\s*(.+?)\s*:\s*(.+)$/` to extract type and detail.

- **AI Integration**:
  - Uses GitHub Copilot Language Model API (`vscode.lm`) with gpt-4o model.
  - Accesses via `vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' })`.
  - Streaming responses using `for await (const part of response.text)`.
  - **OS Detection**: `getSystemInfo()` function detects platform and shell for context.
  - Expects JSON like:
    ```json
    [
      {
        "name": "🔨 Build",
        "cmd": "npm run build",
        "description": "Build the project using npm"
      },
      {
        "name": "📝 Git Commit",
        "cmd": "git add . && git commit -m '{message}'",
        "description": "Stage all changes and commit with a message",
        "inputs": [
          { "placeholder": "Enter commit message", "variable": "{message}" }
        ]
      }
    ]
    ```
  - JSON parsing uses `indexOf('{')` and `lastIndexOf('}')` to extract nested objects (fixed from regex issues).

- **Duplicate Detection System**:
  - **checkDuplicate()** method returns `string | null` (button name or null).
  - Normalization function removes quotes, whitespace, converts `{variables}` to `{VAR}`.
  - AI prompt asks to respond with button name if duplicate or "UNIQUE" if not.
  - Scope-aware: filters buttons by target scope before checking.

- **Tree View System**:
  - **Class Hierarchy**:
    - `TreeItemBase`: Base class with `itemType` property ('smartcmd' | 'section' | 'button').
    - `SmartCmdTreeItem`: Parent node showing total buttons (⚡ SmartCmd).
    - `SectionTreeItem`: Section nodes for Global/Workspace (emoji in label, no iconPath for alignment).
    - `ButtonTreeItem`: Individual button items with play icon and command.
  - **ButtonsTreeProvider**: Implements `TreeDataProvider<TreeItemBase>`.
  - **getChildren()** logic:
    - Root → SmartCmdTreeItem
    - SmartCmd → SectionTreeItems (Global/Workspace)
    - Section → ButtonTreeItems filtered by scope
  - Sections use emoji in labels (🌐/📁) instead of `iconPath` for consistent alignment.

- **Button Management**:
  - **addButtons()**: Returns number of buttons added, validates and checks duplicates.
  - **editButton()**: Prompts for new name and description, preserves cmd and inputs.
  - **deleteButton()**: Removes from memory and storage, refreshes tree.
  - **executeButtonCommand()**: Handles input prompts and command execution.
  - Persists workspace buttons in `.vscode/devboost.json`, global buttons in `context.globalState` with key `devboost.globalButtons`.
  - Loads buttons on activation using `loadButtons()` method.
### 1. Activity Logging
  - Loads buttons on activation using `loadButtons()` method.

### File Structure
- **Project Directory** (e.g., `/my-project/`):
  - `.vscode/activity.log`: Logs all terminal commands and file operations for SmartCmd.
    ```
    2025-10-27T10:37:41.083Z | Command: git status
    2025-10-27T10:39:10.978Z | Command: npm --version
    2025-10-27T10:40:05Z | Save: /my-project/index.js
    2025-10-27T10:41:15Z | Create: /my-project/utils.js
    ```
  - `.vscode/devboost.json`: Stores workspace-specific buttons with full metadata.
    ```json
    [
      {
        "name": "🔨 Build",
        "cmd": "npm run build",
        "description": "Build the project using npm"
      },
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
      },
      {
        "name": "💾 Save All",
        "cmd": "workbench.action.files.saveAll",
        "description": "Save all open files"
      }
    ]
    ```
- **Extension Directory**:
  - `package.json`: Metadata, commands, contributions (views, menus, commands).
    - Commands: `devboost.smartCmdCreateButtons`, `devboost.smartCmdCreateCustomButton`, `devboost.executeButton`, `devboost.deleteButton`, `devboost.editButton`, `devboost.refreshButtons`.
    - Views: `devboost.buttonsView` in `devboost-sidebar` container.
    - Menus: Action buttons on SmartCmd section, edit/delete buttons on individual buttons.
  - `extension.ts`: Main logic for SmartCmd (TypeScript).
  - No external AI API keys needed - uses built-in VS Code Language Model API.
- **Global Storage**:
  - `context.globalState.get('devboost.globalButtons')`: Array of global buttons accessible across all workspaces.
    ```typescript
    [
      {
        "name": "🆕 New File Creator",
        "cmd": "workbench.action.files.newUntitledFile",
        "description": "Creates a new file with prompt for file name"
      }
    ]
    ```

### Dependencies
- **VS Code API**: For event listeners, tree view, language model API, storage.
- **Node.js `fs.promises`**: For async file operations (activity log, workspace buttons).
- **Node.js `path`**: For cross-platform path handling.
- **VS Code Language Model API** (`vscode.lm`): For GitHub Copilot gpt-4o model access (no separate extension dependency needed).

### 2. AI-Suggested Buttons
- Analyzes `.vscode/activity.log` to identify frequent tasks.
- AI suggests up to 5 buttons with names and commands (e.g., `{"name":"Build","cmd":"npm run build"}`).
- Buttons displayed in the VS Code status bar for one-click execution.

### 3. Custom Button Creation
- Users describe buttons in natural language (e.g., “Button to run tests and commit code”).
- AI generates a button with a name and command, added to the status bar.
- Users choose “Project Directory” or “Global” scope for persistence.

### 4. Button Persistence
- **Workspace-Specific**: Saved in `.vscode/devboost.json`, reloading when the project is reopened.
- **Global**: Stored in VS Code’s global state, accessible across projects.

### 5. Execution
- Single-word commands (e.g., `git.commit`) executed directly via VS Code.
- Multi-word commands (e.g., `npm test && git commit -m 'update'`) sent to the terminal.

## Technical Architecture
### Components
- **Logging System**:
  - Uses VS Code APIs: `commands.onDidExecuteCommand`, `workspace.onDidSaveTextDocument`, `onDidCreateFiles`, `onDidDeleteFiles`, `onDidRenameFiles`, `window.onDidExecuteTerminalCommand` (for Git).
  - Logs in `.vscode/activity.log` using `fs.promises.appendFile`.

- **AI Integration**:
  - Uses GitHub Copilot Extension API through VS Code's extension system for button suggestions.
  - Accesses Copilot via `vscode.extensions.getExtension('GitHub.copilot')` and `vscode.commands.executeCommand`.
  - Expects JSON like `[{"name":"Build","cmd":"npm run build"}]`.

- **Button Management**:
  - Creates buttons using `window.createStatusBarItem`.
  - Persists workspace buttons in `.vscode/devboost.json`, global buttons in `context.globalState` with key `devboost.globalButtons`.
  - Loads buttons on extension activation.

### File Structure
- **Project Directory** (e.g., `/my-project/`):
  - `.vscode/activity.log`: Logs activities for SmartCmd.
    ```
    2025-10-27T11:40:00Z | Command: npm.run.build
    2025-10-27T11:40:05Z | Save: /my-project/index.js
    2025-10-27T11:40:10Z | Git: git commit -m 'update'
    ```
  - `.vscode/devboost.json`: Stores workspace-specific buttons.
    ```json
    [
      {"name": "Build", "cmd": "npm run build"},
      {"name": "Git Commit", "cmd": "git commit -m 'update'"},
      {"name": "Save File", "cmd": "workbench.action.files.save"}
    ]
    ```
- **Extension Directory**:
  - `package.json`: Metadata, commands (`devboost.smartCmdCreateButtons`, `devboost.smartCmdCreateCustomButton`), GitHub Copilot extension dependency.
  - `extension.js`: Main logic for SmartCmd.
  - No additional AI dependencies needed (uses existing GitHub Copilot extension).
- **Global Storage**:
  - `globalState[devboost.globalButtons]`: e.g., `[{"name":"Open Terminal","cmd":"workbench.action.terminal.toggleTerminal"}]`.

### Dependencies
- **VS Code API**: For event listeners and status bar management.
- **Node.js `fs.promises`**: For async file operations.
- **Node.js `path`**: For cross-platform path handling.
- **GitHub Copilot Extension**: Uses existing VS Code GitHub Copilot extension for AI suggestions.

## GitHub Copilot Integration Details
### Implementation Approach
- **Extension Detection**: Check if GitHub Copilot extension is installed and active using `vscode.extensions.getExtension('GitHub.copilot')`.
- **Command Execution**: Use `vscode.commands.executeCommand` to interact with Copilot's completion API.
- **Prompt Structure**: Send structured prompts that request JSON responses for button suggestions.

### Code Implementation Pattern
```typescript
// Check if GitHub Copilot is available
const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
if (!copilotExtension || !copilotExtension.isActive) {
    vscode.window.showErrorMessage('GitHub Copilot extension is not installed or active.');
    return;
}

// Use Copilot for AI suggestions
async function getCopilotSuggestion(prompt: string): Promise<string> {
    try {
        const result = await vscode.commands.executeCommand(
            'github.copilot.generate',
            {
                prompt: prompt,
                language: 'json'
            }
        );
        return result;
    } catch (error) {
        console.error('GitHub Copilot request failed:', error);
        throw error;
    }
}
```

### Prompt Engineering for JSON Responses
- **Structured Prompts**: Use clear instructions for JSON format requirements.
- **Context Inclusion**: Provide activity log context and specific formatting examples.
- **Fallback Handling**: Implement graceful degradation if Copilot responses are malformed.

### Error Handling
- **Extension Not Found**: Graceful error message with installation instructions.
- **Authentication Issues**: Handle Copilot authentication problems.
- **Rate Limiting**: Implement appropriate delays and retry logic.
- **Malformed Responses**: Parse and validate JSON responses with error recovery.

## Implementation Details
### 1. Logging Activities
- **Commands**: `vscode.commands.onDidExecuteCommand(event => logActivity('Command', event.command))`.
- **File Operations**:
  - Save: `workspace.onDidSaveTextDocument(doc => logActivity('Save', doc.fileName))`.
  - Create: `workspace.onDidCreateFiles(event => event.files.forEach(file => logActivity('Create', file.fsPath)))`.
  - Delete: `workspace.onDidDeleteFiles(event => event.files.forEach(file => logActivity('Delete', file.fsPath)))`.
  - Rename: `workspace.onDidRenameFiles(event => event.files.forEach(rename => logActivity('Rename', `${rename.oldUri.fsPath} to ${rename.newUri.fsPath}`)))`.
- **Git Actions**: `window.onDidExecuteTerminalCommand(event => { if (event.commandLine.startsWith('git ')) logActivity('Git', event.commandLine.trim()) })`.
- **Storage**: Logs appended to `.vscode/activity.log` using `fs.promises.appendFile`.

### 2. AI-Suggested Buttons
- **Command**: `devboost.smartCmdCreateButtons` (via `Ctrl+Shift+P > SmartCmd: Create AI Buttons`).
- **Process**:
  1. Read `.vscode/activity.log`.
  2. Extract activities, count frequencies, select top 5.
  3. Send to GitHub Copilot with prompt:
     ```
     User often performs: <top activities>. Suggest 5 button names and associated VS Code commands or terminal commands (including git commands like "git commit -m 'update'" or "git push") for them, in a JSON array like: [{"name":"Build","cmd":"npm run build"},{"name":"Git Commit","cmd":"git commit -m 'update'"},{"name":"Save Index","cmd":"workbench.action.files.save"}]
     ```
  4. Parse JSON, create status bar items, save to `.vscode/devboost.json`.
- **Error Handling**: Messages for no workspace, empty log, Copilot unavailable, or invalid JSON.

### 3. Custom Button Creation
- **Command**: `devboost.smartCmdCreateCustomButton` (via `Ctrl+Shift+P > SmartCmd: Create Custom Button`).
- **Process**:
  1. Prompt for natural language description (e.g., "Button to run tests and commit code").
  2. Prompt for scope: "Project Directory" or "Global".
  3. Send to GitHub Copilot with prompt:
     ```
     Based on this description: "<user input>". Suggest a single button with name and associated VS Code command or terminal command (e.g., "npm test; git commit -m 'test'"), in JSON like: {"name":"Test and Commit","cmd":"npm test && git commit -m 'update'"}
     ```
  4. Parse JSON, create status bar item, save to `.vscode/devboost.json` or `context.globalState`.
- **Error Handling**: Handles cancelled prompts, invalid scope, Copilot unavailable, or bad JSON.

### 4. Button Persistence
- **Workspace-Specific**:
  - Stored in `.vscode/devboost.json`.
  - Loaded/saved using `fs.promises.readFile/writeFile`.
- **Global**:
  - Stored in `context.globalState` with key `devboost.globalButtons`.
  - Loaded on activation.
- **Loading**: Loads global and workspace buttons on activation.

### 5. Button Execution
- **Single-Word Commands**: Executed directly (e.g., `git.commit`).
- **Multi-Word Commands**: Sent to terminal via `workbench.action.terminal.sendSequence`.
- **Status Bar**: Buttons use `window.createStatusBarItem`, play icon (`$(play)`), aligned left.

## Setup Instructions
1. **Initialize**:
   - Create extension folder, run `npm init -y`.
   - Add `package.json` and `extension.js` with commands `devboost.smartCmdCreateButtons`, `devboost.smartCmdCreateCustomButton`.
   - Ensure GitHub Copilot extension is installed and active in VS Code.

2. **GitHub Copilot Integration**:
   - No API keys needed - uses existing GitHub Copilot extension.
   - Extension automatically detects if GitHub Copilot is available.
   - Fallback handling if Copilot is not installed/active.

3. **Run**:
   - Open extension in VS Code, press `F5` to debug.
   - Open a project directory, run commands (e.g., `npm test`), file ops, or Git commands.
   - Use `Ctrl+Shift+P > SmartCmd: Create AI Buttons` to generate buttons.
   - Use `Ctrl+Shift+P > SmartCmd: Create Custom Button`, enter prompt, choose scope.
   - Verify `.vscode/activity.log` and `.vscode/devboost.json`.

4. **Verify Persistence**:
   - Close/reopen project; buttons reload from `.vscode/devboost.json`.
   - Global buttons appear in any project.


## Current Implementation Status
✅ **Completed Features**:
1. Activity logging with ISO timestamps for all terminal commands
2. Hierarchical sidebar structure (DevBoost → SmartCmd → Global/Workspace Commands)
3. OS and shell detection for platform-specific command generation
4. AI-powered button suggestions using GitHub Copilot Language Model API (gpt-4o)
5. Custom button creation with natural language descriptions
6. Dynamic input fields with `{variableName}` placeholders
7. Intelligent duplicate detection (normalization + AI semantic analysis)
8. Scope-aware checking (global vs workspace)
9. Button editing (name and description)
10. Button deletion with inline actions
11. Button persistence (workspace JSON + global state)
12. Command execution with dynamic input prompts
13. JSON parsing improvements for nested objects
14. Tree view with proper alignment and visual indicators

## Future Enhancements
1. **Button Management**:
   - Add command editing capability (currently only name/description)
   - Bulk operations (delete multiple, export/import button sets)
   - Button reordering/sorting options
   - Button categories/tags for organization
2. **Advanced Logging**:
   - Log file content changes (`workspace.onDidChangeTextDocument`)
   - Parse Git events with `simple-git` for more detailed tracking
   - Activity analytics dashboard
3. **AI Refinements**:
   - Context-aware suggestions based on file types and frameworks
   - Learning from user's button usage patterns
   - Multi-step command workflows (button chains)
4. **UI Enhancements**:
   - Webview for button management dashboard
   - Drag-and-drop button organization
   - Button preview/test mode
   - Search/filter buttons
5. **Collaboration**:
   - Share button configurations across team
   - Button marketplace/templates
   - Project-specific button recommendations

## Edge Cases
- **No Workspace**: Skip logging/buttons, show informational message to open a workspace.
- **GitHub Copilot Unavailable**: Shows warning message, provides fallback pattern-based suggestions.
- **Invalid AI Response**: Handles malformed JSON with regex extraction and manual input fallback.
- **File Conflicts**: Uses async `fs.promises`, creates `.vscode` directory if missing.
- **Empty Log**: Suggests creating custom button instead of AI-suggested buttons.
- **Duplicate Button Names**: Allowed across different scopes, prevented within same functional group by AI.
- **Missing Input Values**: Validates non-empty, cancels execution if user cancels any input prompt.
- **Long Commands**: No length limit, handles complex multi-line commands.
- **Special Characters in Variables**: Regex escaping ensures proper replacement of `{variables}` with special chars.

## Key Implementation Files
- **`src/extension.ts`** (~1200 lines): Main extension logic with all features
  - Interfaces: `InputField`, `Button`, Tree item classes
  - `ButtonsTreeProvider`: Main tree data provider with hierarchical structure
  - Button management methods: `addButtons()`, `editButton()`, `deleteButton()`, `checkDuplicate()`
  - AI integration: `getAISuggestions()`, `getCustomButtonSuggestion()`
  - Utility functions: `getSystemInfo()`, `parseActivityLog()`, `executeButtonCommand()`
- **`package.json`**: Extension manifest with commands, views, menus, contributions
- **`.vscode/devboost.json`**: Workspace-specific button storage (per project)
- **`.vscode/activity.log`**: Activity tracking log (per project)

