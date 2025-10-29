# SmartCmd Context File for DevBoost

## Feature Overview
**Feature Name**: SmartCmd  
**Parent Project**: DevBoost  
**Purpose**: SmartCmd is the flagship feature of the DevBoost VS Code extension, designed to enhance developer productivity by automating repetitive tasks through AI-generated buttons. It logs user terminal commands and file operations in `.vscode/activity.log`. An AI model (GitHub Copilot Language Model API with gpt-4o) analyzes these logs to suggest OS-compatible buttons for frequent tasks, displayed in a hierarchical DevBoost sidebar (SmartCmd → Global Commands / Workspace Commands) for one-click execution. Users can also create custom buttons via natural language prompts. Buttons support dynamic input fields using `{variableName}` placeholders that prompt users at execution time. The system includes intelligent duplicate detection using AI-powered semantic analysis. Buttons store two types of descriptions: user_description (user-provided) and ai_description (AI-generated), with backward compatibility for the legacy description field removed. Buttons can be edited via context menu (right-click) after creation, and workspace buttons can be copied to global scope. Buttons are persisted per project in `.vscode/devboost.json` or globally in a `global-buttons.json` file in VS Code's global storage directory, reloading across sessions. SmartCmd is a core component of DevBoost, a broader productivity suite for developers.

**Target Audience**: Software developers with repetitive tasks (e.g., builds, Git operations, file management) across different operating systems (Windows, macOS, Linux).  

## Feature Details
### 1. Activity Logging
- Tracks:
  - Terminal commands executed in VS Code's integrated terminal (filtered: saves on success, Ctrl+C, undefined exit codes; skips 127/126).
  - File operations (create, delete, rename - save operations excluded due to auto-save).
- **SmartCmd Command Exclusion**: Commands executed by SmartCmd buttons are excluded from activity log to prevent feedback loop
  - Tracks commands per workspace using `Map<workspace_path, Set<executed_commands>>`
  - Workspace-specific tracking prevents cross-workspace command exclusion
  - Empty Sets automatically removed from Map to prevent memory leaks
- Logs stored in `.vscode/activity.log` in the project directory for workspace-specific tracking.
- Format: `<ISO timestamp> | <type>: <detail>` (e.g., `2025-10-27T10:37:41.083Z | Command: git status`).
- Uses `onDidEndTerminalShellExecution` event to capture commands with exit code filtering.
- **Workspace Change Handling**: Activity log path automatically updates when switching workspaces in same VS Code window

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
  4. **User Confirmation**: When single button detected as duplicate, user gets modal confirmation dialog with "Add Anyway" or "Cancel" options
  5. **Batch Handling**: Multiple duplicates (AI-suggested batches) show summary warning without prompting
- Returns button name if duplicate found, displays which existing button it matches.
- Buttons displayed in the hierarchical sidebar under appropriate scope section.

### 4. Custom Button Creation
- Users describe buttons in natural language (e.g., "Button to commit changes with a message").
- AI generates a button with name (with emoji), command, description, and automatically detects input fields.
- Users choose "Project Directory" (workspace) or "Global" scope for persistence.
- **Prompt Input File**: Uses dedicated `prompt-input.md` file in VS Code's global storage for description input
  - File opens automatically when creating custom button
  - User writes description, then closes file to proceed
  - **File Closure Detection**: Uses event-based approach with `vscode.window.tabGroups.onDidChangeTabs` and `vscode.window.onDidChangeVisibleTextEditors`
  - Works for files outside workspace (global storage files)
  - Detects when tab is actually closed (not just switched away)
- **Dynamic Input Fields**: Commands can include `{variableName}` placeholders:
  - Example: `git commit -m '{message}'`
  - AI automatically generates `InputField` objects with placeholder and variable name.
  - User is prompted for each variable when button is clicked.
  - Input validation ensures non-empty values.
- **Manual Input Detection**: If manually creating buttons, regex detects `{variableName}` patterns and prompts for descriptions.

### 5. Button Editing
- Users can edit button name and user description after creation via context menu.
- **Context Menu Access** (right-click on any button):
  - ✏️ **Edit Button** - Available for both global and workspace buttons
  - 🌐 **Add to Global Buttons** - Only visible for workspace buttons
  - 🗑️ **Delete Button** - Available for both global and workspace buttons
- **Edit Process**:
  1. Edit button name (required, validated for non-empty).
  2. Edit user description (optional).
- AI description, command, and input fields preserved (cannot be edited to prevent breaking functionality).
- Changes saved to appropriate storage location (global storage or workspace JSON).
- Tree view refreshes automatically after edit.
- **Context Value System**: Buttons use scope-based contextValues ('globalButton' vs 'workspaceButton') for conditional menu visibility.

### 6. Button Persistence
- **Workspace-Specific**: Saved in `.vscode/devboost.json`, reloading when the project is reopened.
- **Global**: Stored in `global-buttons.json` file in VS Code's global storage directory (`context.globalStorageUri.fsPath`), accessible across all projects.
  - **Location on macOS/Linux**: `~/.vscode/extensions/.../globalStorage/<publisher>.<extension>/global-buttons.json`
  - **Location on Windows**: `%APPDATA%\Code\User\globalStorage\<publisher>.<extension>\global-buttons.json`
- Button data structure: `{ name: string, cmd: string, user_description?: string, ai_description?: string, inputs?: InputField[], scope?: 'workspace' | 'global' }`.
- **Dual Description System**: 
  - `user_description`: User-provided description
  - `ai_description`: AI-generated description
  - Backward compatibility description field removed
- InputField structure: `{ placeholder: string, variable: string }`.

### 7. Button Scope Management
- **Add to Global Feature**: Workspace buttons can be copied to global scope via context menu.
- **Global Scope Validation**: AI validates if button is suitable for global scope
  - **Smart Path Detection**: Absolute paths to system tools (e.g., `/usr/bin/git`, `C:\Windows\System32\cmd.exe`) = SAFE for global scope
  - **Workspace Detection**: Relative paths or project-specific references = UNSAFE for global scope
  - **User Override**: Modal dialog with "Continue Anyway" option when button appears workspace-specific
  - Dialog stays open until user explicitly responds (no auto-dismiss)
- **Context Menu** (right-click):
  - "Add to Global Buttons" option only appears for workspace buttons
  - Checks if button is already global (shows info message if true)
  - Creates copy with scope changed to 'global'
  - Uses existing `addButtons()` method with automatic duplicate detection
  - Saves to `global-buttons.json` file in global storage
  - Shows success message when added, or warning if duplicate detected
- **Conditional Menu Visibility**: Uses `viewItem` context in package.json
  - `viewItem == workspaceButton` → Shows "Add to Global" option
  - `viewItem =~ /Button$/` → Shows Edit and Delete for all buttons

### 8. Execution
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
- **Code Modularization**:
  - **`src/extension.ts`** (1148 lines): Main extension logic, UI, commands, tree view, activity logging
  - **`src/aiServices.ts`** (472 lines): Isolated module for all AI/LLM interactions
  - AI functions: `checkDuplicateButton()`, `checkIfButtonIsGlobalSafe()`, `getAISuggestions()`, `getCustomButtonSuggestion()`, `getFallbackSuggestions()`
  - Imported in extension.ts as `aiServices.*` namespace

- **Logging System**:
  - Uses VS Code APIs: `workspace.onDidCreateFiles`, `workspace.onDidDeleteFiles`, `workspace.onDidRenameFiles`, `window.onDidEndTerminalShellExecution` (for terminal commands with exit code filtering).
  - Logs in `.vscode/activity.log` using `fs.promises.appendFile` with ISO timestamp format.
  - **Exit Code Filtering**: Saves commands with exit code 0 (success), 130 (Ctrl+C), undefined (background); skips 127 (not found), 126 (not executable).
  - **SmartCmd Command Exclusion**: Tracks commands executed by SmartCmd per workspace to exclude from log
    - `smartCmdExecutedCommands = Map<workspace_path, Set<command>>`
    - Commands tracked before execution in `executeButtonCommand()`
    - Excluded in `onDidEndTerminalShellExecution` event handler
    - Workspace-specific to prevent cross-workspace exclusion issues
    - Automatic cleanup of empty Sets to prevent memory leaks
  - **Workspace Change Handling**: `onDidChangeWorkspaceFolders` event listener updates activity log path and reloads buttons
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
  - **checkDuplicateButton()** method in `aiServices.ts` returns `string | null` (button name or null).
  - Normalization function removes quotes, whitespace, converts `{variables}` to `{VAR}`.
  - AI prompt asks to respond with button name if duplicate or "UNIQUE" if not.
  - Scope-aware: filters buttons by target scope before checking.
  - **User Confirmation for Single Duplicates**:
    - Modal dialog: "Button [name] appears similar to [existing]. Add anyway?"
    - Options: "Add Anyway" or "Cancel"
    - Button stored in duplicate array with reference for potential addition
    - Multiple duplicates show summary without prompting
  
- **Global Scope Validation**:
  - **checkIfButtonIsGlobalSafe()** method in `aiServices.ts` validates button compatibility
  - **Smart Logic**:
    - Absolute paths to system tools (e.g., `/usr/bin/git`, `C:\Windows\System32\cmd.exe`) = SAFE
    - Relative paths or project-specific references = UNSAFE
  - Modal warning dialog with "Continue Anyway" option for unsafe buttons
  - Dialog uses `{ modal: true }` to prevent auto-dismiss

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
  - **addButtons()**: Returns number of buttons added, validates and checks duplicates with user confirmation for single duplicates.
  - **editButton()**: Prompts for new name and user description, preserves cmd, ai_description, and inputs.
  - **deleteButton()**: Removes from memory and storage, refreshes tree.
  - **addToGlobal()**: Copies workspace button to global scope with AI validation and duplicate detection, saves to `global-buttons.json`.
  - **executeButtonCommand()**: Handles input prompts, tracks command in workspace-specific Map before execution, and executes command.
  - Persists workspace buttons in `.vscode/devboost.json`, global buttons in `global-buttons.json` file.
  - **saveGlobalButtons()**: Writes global buttons to `global-buttons.json` in `context.globalStorageUri.fsPath`.
  - **saveWorkspaceButtons()**: Writes workspace buttons to `.vscode/devboost.json`.
  - Loads buttons on activation using `loadButtons()` method from both file locations.

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
        "user_description": "My custom build script",
        "ai_description": "Build the project using npm"
      },
      {
        "name": "📝 Git Commit",
        "cmd": "git add . && git commit -m '{message}'",
        "user_description": "Quick commit",
        "ai_description": "Stage all changes and commit with a custom message",
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
        "ai_description": "Save all open files"
      }
    ]
    ```
- **Extension Directory**:
  - `package.json`: Metadata, commands, contributions (views, menus, commands).
    - Commands: `devboost.smartCmdCreateButtons`, `devboost.smartCmdCreateCustomButton`, `devboost.executeButton`, `devboost.deleteButton`, `devboost.editButton`, `devboost.addToGlobal`, `devboost.refreshButtons`, `devboost.openButtonsFile`.
    - Views: `devboost.buttonsView` in activity bar with rocket icon.
    - Menus: Context menu items on buttons (`view/item/context`) with conditional visibility using `viewItem` matching.
  - `src/extension.ts` (1148 lines): Main extension logic - UI, commands, tree view, activity logging, workspace management.
  - `src/aiServices.ts` (472 lines): AI/LLM integration module - all Copilot interactions isolated.
  - No external AI API keys needed - uses built-in VS Code Language Model API.
- **Global Storage**:
  - Global buttons stored in `global-buttons.json` file at `context.globalStorageUri.fsPath`: Array of global buttons accessible across all workspaces.
  - Prompt input file (`prompt-input.md`) for custom button creation stored in global storage.
  - **File Location**:
    - **macOS/Linux**: `~/.vscode/extensions/.../globalStorage/<publisher>.<extension>/global-buttons.json`
    - **Windows**: `%APPDATA%\Code\User\globalStorage\<publisher>.<extension>\global-buttons.json`
  - **Format**:
    ```json
    [
      {
        "name": "🆕 New File Creator",
        "cmd": "workbench.action.files.newUntitledFile",
        "ai_description": "Creates a new untitled file"
      },
      {
        "name": "💾 Save All Files",
        "cmd": "workbench.action.files.saveAll",
        "user_description": "My save all shortcut",
        "ai_description": "Saves all open files in the workspace"
      }
    ]
    ```

### Dependencies
- **VS Code API**: For event listeners, tree view, language model API, storage, workspace management.
- **Node.js `fs.promises`**: For async file operations (activity log, workspace buttons).
- **Node.js `path`**: For cross-platform path handling.
- **VS Code Language Model API** (`vscode.lm`): For GitHub Copilot gpt-4o model access (no separate extension dependency needed).

### Extension Architecture
- **Extension Lifecycle**: Each VS Code window has separate extension instance with separate heap/stack memory
- **Workspace Switching**: Extension persists when switching folders in same window
  - `onDidChangeWorkspaceFolders` event updates activity log path
  - Buttons automatically reload for new workspace
  - Command tracking Map cleaned up for old workspace
- **Memory Management**: Smart cleanup of workspace-specific data structures to prevent leaks

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
  - Creates buttons displayed in tree view sidebar.
  - Persists workspace buttons in `.vscode/devboost.json`, global buttons in `global-buttons.json` file in global storage.
  - Loads buttons on extension activation from both file locations.

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
  - `global-buttons.json` file in global storage directory: e.g., `[{"name":"Open Terminal","cmd":"workbench.action.terminal.toggleTerminal","ai_description":"Opens or closes the integrated terminal"}]`.

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
  - Stored in `.vscode/devboost.json` file in project directory.
  - Loaded/saved using `fs.promises.readFile/writeFile`.
- **Global**:
  - Stored in `global-buttons.json` file in VS Code's global storage directory.
  - File path: `context.globalStorageUri.fsPath + '/global-buttons.json'`.
  - Loaded/saved using `fs.promises.readFile/writeFile`.
  - Directory created automatically if it doesn't exist using `fs.mkdir(path.dirname(globalButtonsPath), { recursive: true })`.
- **Loading**: Loads global and workspace buttons on activation from their respective file locations.

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
1. Activity logging with ISO timestamps and exit code filtering (saves 0, 130, undefined; skips 127, 126)
2. SmartCmd command exclusion from activity log (workspace-specific tracking with Map)
3. Workspace change handling (automatic path updates and button reloading)
4. Hierarchical sidebar structure (DevBoost → SmartCmd → Global/Workspace Commands)
5. OS and shell detection for platform-specific command generation
6. AI-powered button suggestions using GitHub Copilot Language Model API (gpt-4o)
7. Custom button creation with natural language descriptions
8. Prompt input file with event-based closure detection (works for global storage files)
9. Dynamic input fields with `{variableName}` placeholders
10. Intelligent duplicate detection (normalization + AI semantic analysis)
11. User confirmation dialog for single duplicate buttons
12. Scope-aware checking (global vs workspace)
13. Global scope validation with smart absolute/relative path detection
14. Modal dialogs with no auto-dismiss for critical decisions
15. Dual description system (user_description + ai_description)
16. Button editing via context menu (name and user description only)
17. Button deletion via context menu
18. Add to Global feature with AI validation (copy workspace buttons to global scope)
19. Context menu system with conditional visibility based on button scope
20. Button persistence (workspace JSON + global storage file)
21. Command execution with dynamic input prompts and workspace tracking
22. JSON parsing improvements for nested objects
23. Tree view with proper alignment and visual indicators
24. Scope-based contextValues for conditional menu items
25. Code modularization (extension.ts + aiServices.ts)

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
- **`src/extension.ts`** (1148 lines): Main extension logic
  - Interfaces: `InputField`, `Button`, Tree item classes
  - `ButtonsTreeProvider`: Main tree data provider with hierarchical structure
  - Button management methods: `addButtons()`, `editButton()`, `deleteButton()`, `addToGlobal()`
  - Storage methods: `saveGlobalButtons()`, `saveWorkspaceButtons()`, `loadButtons()`
  - Command execution: `executeButtonCommand()` with workspace-specific tracking
  - Workspace management: `onDidChangeWorkspaceFolders` event listener
  - Activity logging: `setupActivityLogging()`, `logActivity()` with SmartCmd exclusion
  - Utility functions: `getSystemInfo()`, `parseActivityLog()`
  - Global variables: `smartCmdExecutedCommands` Map for command tracking
- **`src/aiServices.ts`** (472 lines): AI/LLM integration module
  - `checkDuplicateButton()`: AI-powered duplicate detection with scope filtering
  - `checkIfButtonIsGlobalSafe()`: Validates global scope compatibility with smart path logic
  - `getAISuggestions()`: Generates buttons from activity patterns
  - `getCustomButtonSuggestion()`: Creates button from user description
  - `getFallbackSuggestions()`: Non-AI fallback buttons
  - All Copilot Language Model API interactions isolated in this module
- **`package.json`**: Extension manifest with commands, views, menus (context menu), contributions
- **`.vscode/devboost.json`**: Workspace-specific button storage (per project)
- **`.vscode/activity.log`**: Activity tracking log (per project)
- **`global-buttons.json`**: Global button storage in VS Code's global storage directory (all projects)
- **`prompt-input.md`**: Temporary file for custom button description input (global storage)

