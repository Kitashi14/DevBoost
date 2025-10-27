# SmartCmd Context File for DevBoost

## Feature Overview
**Feature Name**: SmartCmd  
**Parent Project**: DevBoost  
**Purpose**: SmartCmd is the flagship feature of the DevBoost VS Code extension, designed to enhance developer productivity by automating repetitive tasks through AI-generated buttons. It logs user activities—commands (e.g., `npm.run.build`), file operations (e.g., save, create, delete, rename), and Git actions (e.g., `git commit -m 'update'`)—in the project’s `.vscode/activity.log`. An AI model analyzes these logs to suggest buttons for frequent tasks, displayed in the VS Code status bar for one-click execution. Users can also create custom buttons via natural language prompts. Buttons are persisted per project in `.vscode/devboost.json` or globally in VS Code’s storage, reloading across sessions. SmartCmd is a core component of DevBoost, a broader productivity suite for developers.

**Target Audience**: Software developers with repetitive tasks (e.g., builds, Git operations, file management).  

## Feature Details
### 1. Activity Logging
- Tracks:
  - VS Code commands (e.g., `npm.run.build`, `git.commit`).
  - File operations (save, create, delete, rename).
  - Git terminal commands (e.g., `git commit -m 'update'`).
- Logs stored in `.vscode/activity.log` in the project directory for workspace-specific tracking.
- Format: `<timestamp> | <type>: <detail>` (e.g., `2025-10-27T11:40:00Z | Git: git push`).

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


## Enhancements
1. **Button Management**:
   - Add `devboost.smartCmdRemoveButton` to delete buttons via QuickPick.
2. **Advanced Logging**:
   - Log file content changes (`workspace.onDidChangeTextDocument`).
   - Parse Git events with `simple-git`.
3. **AI Refinements**:
   - Enforce strict JSON output from GitHub Copilot.
   - Add fallback to other LLMs if Copilot is unavailable.
   - Implement prompt optimization for better Copilot responses.
4. **UI**:
   - Use Webview for button management dashboard.
5. **GitHub Copilot Enhancements**:
   - Cache Copilot responses to reduce API calls.
   - Implement smart prompt templates based on project type.
   - Add context-aware suggestions based on file types and frameworks.

## Edge Cases
- **No Workspace**: Skip logging/buttons, show message.
- **GitHub Copilot Unavailable**: Show message suggesting Copilot installation/activation, provide fallback options.
- **Invalid AI Response**: Handle bad JSON with error message.
- **File Conflicts**: Use async `fs.promises`, create `.vscode` if missing.
- **Empty Log**: Suggest custom button creation.

