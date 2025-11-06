# DevBoost - AI-Powered VS Code Productivity Extension

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](src/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0%2B-blue.svg)](https://code.visualstudio.com/)

## 🎯 Overview

**DevBoost** is a Visual Studio Code extension that supercharges developer productivity through AI-driven automation and intelligent workflow optimization. Powered by GitHub Copilot, DevBoost learns from your development patterns and creates customizable automation buttons for repetitive tasks.

### 🌟 Key Features

- **🤖 AI-Powered SmartCmd**: Analyzes your workflow and creates intelligent one-click automation buttons
- **📜 Script Support**: Generate complex multi-step workflows as executable scripts
- **🔄 Prompt Enhancer**: Improve your AI prompts with tone, clarity, and structure enhancements
- **📊 Enhanced Activity Logging**: Contextual tracking of terminal commands, file operations, and tasks
- **🧠 Smart Workflow Analysis**: AI understands your patterns to suggest optimal automations
- **🎛️ User-Controlled AI**: Review, edit, and confirm all AI-generated suggestions
- **🌐 Cross-Platform**: Full Windows, macOS, and Linux compatibility

## 🚀 Quick Start

### Prerequisites

- **VS Code**: Version 1.105.0 or higher
- **GitHub Copilot**: Active subscription required for AI features
- **Node.js**: 16.x or higher (for development)

### Installation

#### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/Kitashi14/DevBoost.git
cd DevBoost

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Launch Extension Development Host
# Press F5 in VS Code
```

### First-Time Setup

1. **Open DevBoost Sidebar**: Click the 🚀 rocket icon in VS Code's activity bar
2. **Start Working**: Run commands, save files, use Git - DevBoost tracks your patterns
3. **View Activity Log**: Your workflow is logged in `.vscode/devBoost/activity.log`
4. **Create Buttons**: Use AI suggestions or create custom automation buttons

### Basic Usage

**Open the Sidebar**: Click the 🚀 icon in the activity bar to access DevBoost features.

**SmartCmd View**:
- ✨ **Sparkle icon**: Generate AI-suggested buttons from your workflow
- ➕ **Plus icon**: Create custom buttons manually or with AI assistance
- 🔄 **Refresh icon**: Reload all buttons

**Prompt Enhancer View**: Access prompt improvement tools for better AI interactions.

## 📚 Feature Guide

### 🤖 SmartCmd - AI-Powered Automation

**SmartCmd** analyzes your development patterns and creates intelligent automation buttons that you can execute with a single click.

#### How It Works

1. **Activity Tracking**: DevBoost monitors terminal commands, file operations, Git actions, and VS Code tasks
2. **Pattern Analysis**: AI (GitHub Copilot) analyzes your `.vscode/devBoost/activity.log` to understand workflow patterns
3. **Smart Suggestions**: Generates context-aware buttons with proper commands and descriptions
4. **Platform-Aware**: Creates OS-specific commands (Windows/macOS/Linux) based on your environment

#### Creating AI-Suggested Buttons

**Step 1**: Work normally in your project
- Run terminal commands (build, test, deploy)
- Use Git operations (commit, push, branch)
- Perform file operations
- Execute tasks

**Step 2**: Generate buttons
1. Click the **✨ sparkle icon** in the SmartCmd view
2. AI analyzes your activity log (requires at least 5 logged activities)
3. Review AI-generated button suggestions with previews
4. Choose to **Create All** or **Review Individually**

**Step 3**: Manage buttons
- Click any button to execute its command
- Right-click to edit, delete, or copy to global scope
- View AI descriptions and user notes in tooltips

#### Creating Custom Buttons

You can create buttons manually or use AI to generate them from natural language descriptions.

**Method 1: AI-Assisted Creation**
1. Click the **➕ plus icon** in SmartCmd view
2. Choose scope: **Workspace** (project-specific) or **Global** (all projects)
3. Select **Yes** to use AI assistance
4. Describe what you want: *"Create a button that runs tests and generates coverage report"*
5. AI generates the button with proper command structure
6. Review, edit if needed, and save

**Method 2: Manual Creation**
1. Click the **➕ plus icon**
2. Choose scope
3. Select **No** for manual entry
4. Fill in the form:
   - **Name**: Button display name (e.g., "🧪 Run Tests")
   - **Command**: Shell command to execute
   - **Execution Directory**: Where to run the command (optional)
   - **Description**: What the button does
   - **Input Fields**: Dynamic placeholders for runtime input (optional)

#### Script Buttons

For complex multi-step workflows, AI can generate **script buttons** that execute multiple commands with logic:

**Features**:
- Multi-line shell scripts with error handling
- Conditional logic and control flow
- Directory navigation within scripts
- Input variable substitution
- Platform-specific script generation

**Example**: AI might create a deployment script button that:
1. Runs tests
2. Builds the project (only if tests pass)
3. Deploys to specified environment
4. Reports success or failure

**View/Edit Scripts**: Right-click script buttons (marked with 📜) and select **Open Script File**.

### 🔄 Prompt Enhancer

The Prompt Enhancer helps you create better AI prompts with professional refinement options, similar to communication tools' message rewriting features.

#### Enhancement Capabilities

**Improvement Types**:
- **✨ Clarity & Specificity**: Make requests clearer and more precise
- **🔧 Grammar & Spelling**: Fix language errors automatically
- **📐 Structure & Format**: Improve organization and readability
- **� Technical Accuracy**: Enhance technical terminology and context

**Style Controls**:
- **🎭 Tone**: Professional, Casual, Friendly, Assertive, Technical
- **🎩 Formality**: Formal, Informal, Neutral
- **📏 Length**: Shorter, Same, More Detailed

#### Using the Prompt Enhancer

**Standalone Mode**:
1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run command: `DevBoost: Show Prompt Enhancer`
3. Enter your prompt
4. Select enhancement options:
   - Choose tone (Professional, Casual, etc.)
   - Select formality level
   - Adjust length preference
5. Get AI-enhanced version
6. Copy or use the improved prompt

**From Selection**:
1. Select text in any editor
2. Open Command Palette
3. Run `DevBoost: Show Prompt Enhancer`
4. Selected text is automatically used as input
5. Apply enhancements and replace selection

**Quick Enhance**:
- Use `DevBoost: Quick Enhance from Clipboard` for fast clipboard-based enhancement
- Copy text, run command, get enhanced version instantly

**SmartCmd Integration**:
When creating AI-assisted buttons, you can enhance your descriptions before AI processes them for better results.

#### Development & Debugging

The Prompt Enhancer includes comprehensive logging for developers:

- **Log Location**: `.vscode/devBoost/ai_prompts_enhancer.log`
- **Contents**: Complete AI interactions, prompts sent, responses received, and metadata
- **Logged Functions**:
  - `getPromptEnhancementSuggestions` - Analyzes prompts for improvements
  - `applyEnhancements` - Applies selected enhancements
  - `generatePromptFromIntent` - Generates complete prompts from descriptions
  - `quickEnhancePrompt` - Fast enhancement operations
- **Toggle Logging**: Set `ENABLE_PROMPT_LOGGING = false` in `src/promptEnhancer/aiServices.ts`

### 📊 Activity Logging & Analysis

DevBoost intelligently tracks your development activities to understand workflow patterns and generate meaningful automation suggestions.

#### What Gets Logged

**Terminal Commands**:
- All shell commands executed (git, npm, build tools, etc.)
- Exit codes (success/failure tracking)
- Execution duration
- Working directory context
- Shell type (bash, zsh, PowerShell, cmd)

**File Operations**:
- File creation, deletion, and renaming
- Directory context for each operation
- Timestamps

**VS Code Tasks**:
- Task start and completion
- Task source and name
- Execution duration

**Context Information**:
- Terminal ID and name
- Current working directory (tracks `cd` commands)
- Workspace path
- Platform information (Windows/macOS/Linux)

#### Enhanced Context Tracking

DevBoost uses VS Code's shell integration API to accurately track:
- **Current Working Directory**: Knows exactly where each command runs
- **Terminal Context**: Tracks multiple terminals independently
- **Directory Changes**: Monitors `cd` commands and updates context
- **Command Success**: Tracks exit codes to identify reliable patterns

#### Smart Features

**Automatic Cleanup**:
- Runs every 24 hours to optimize log size
- Maintains 5MB maximum file size
- Keeps most recent 500 entries
- Archives old data to 3 rotating backups (`.vscode/devBoost/activity.log.backup.1`, `.backup.2`, `.backup.3`)
- Compresses historical data while preserving patterns

**AI Optimization**:
The log is optimized specifically for AI analysis:
- Structured JSON format for easy parsing
- Command frequency analysis
- Pattern aggregation
- Error correlation with context
- Recent activity prioritization

**Privacy & Security**:
- Only workspace activities are logged
- All data stored locally in `.vscode/devBoost/activity.log`
- No external transmission
- Excluded from SmartCmd-generated commands (prevents feedback loops)

**Smart Filtering**:
- Skips commands with exit code 127 (command not found)
- Skips commands with exit code 126 (command not executable)
- Logs valid commands even if they fail (may be expected behavior)

#### Log Format Example

```json
{
  "timestamp": "2024-11-05T14:30:45.123Z",
  "type": "Command",
  "action": "npm run build",
  "context": {
    "terminalId": "12345",
    "terminalName": "zsh",
    "shellType": "zsh",
    "currentDirectory": "/Users/username/project",
    "exitCode": 0,
    "workspace": {
      "name": "DevBoost",
      "path": "/Users/username/project"
    }
  }
}
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new features
- Update documentation for user-facing changes
- Ensure cross-platform compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **GitHub Copilot**: Powers our AI-driven automation and prompt enhancement
- **VS Code Extension API**: Enables seamless IDE integration
- **TypeScript Community**: For excellent tooling and documentation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Kitashi14/DevBoost/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Kitashi14/DevBoost/discussions)
- **Documentation**: Available in this README and inline code comments

---

**Made with ❤️ for developers who want to work smarter, not harder.**

**Standalone Enhancement:**

- Select text in editor → Run `DevBoost: Enhance Prompt` → Enhanced text replaces selection
- Or use the command palette to enhance any prompt from input

**Enhancement Options:**

- **Tone**: Professional, Casual, Friendly, Assertive, Technical
- **Formality**: Formal, Informal, Neutral  
- **Length**: Shorter, Same, More detailed
- **Improvements**: Fix grammar, improve clarity, better formatting

### 🎛️ Button Management

#### Hierarchical Organization

**🌐 Global Commands**:
- Available across all workspaces and projects
- Stored in VS Code's global storage
- Perfect for general-purpose automation (git workflows, system commands)
- File location: Extension global storage

**📁 Workspace Commands**:
- Specific to the current workspace/project
- Stored in `.vscode/devBoost/smartCmd.json`
- Project-specific automation (build, test, deploy commands)
- Can be version-controlled with your project

#### Button Capabilities

**Dynamic Inputs**:
Buttons can prompt for runtime values using input placeholders:

```json
{
  "name": "📝 Git Commit",
  "cmd": "git add . && git commit -m '{message}'",
  "inputs": [
    {
      "placeholder": "Enter commit message",
      "variable": "{message}"
    }
  ]
}
```

When clicked, the button prompts for a commit message before executing.

**Smart Execution**:
- Commands run in the correct directory context (uses `execDir` field)
- Automatic terminal creation and management
- Exit code tracking for success/failure detection
- Activity logging for future AI suggestions

**Edit Functionality**:
- Right-click any button → **Edit Button**
- Modify name and descriptions without recreating
- Original command and structure preserved
- Changes saved immediately

**Scope Management**:
- Copy workspace buttons to global scope with **Add to Global Buttons**
- AI validates commands work across projects
- Script files are copied to global storage
- Maintains button functionality across scopes

**OS Compatibility**:
- AI generates platform-specific commands
- Detects your OS (Windows/macOS/Linux)
- Uses appropriate shell syntax (bash/zsh/PowerShell/cmd)
- Path handling adapted to platform

#### Button Actions

**Execute**: Click button or use play icon (▶)
**Edit**: Right-click → Edit Button
**Delete**: Right-click → Delete Button  
**View Script**: Right-click script button (📜) → Open Script File
**Copy to Global**: Right-click workspace button → Add to Global Buttons
**View JSON**: Right-click section header → Open Buttons File

#### Button Storage Format

**Workspace Buttons** (`.vscode/devBoost/smartCmd.json`):
```json
[
  {
    "name": "🧪 Run Tests",
    "cmd": "npm test",
    "user_prompt": "Run all unit tests",
    "description": "Executes the test suite using npm test command",
    "execDir": ".",
    "inputs": []
  }
]
```

**Script Buttons**:
```json
{
  "name": "� Full Deploy",
  "execDir": ".",
  "cmd": "<path-to-scripts>/deploy-production.sh",
  "scriptFile": "deploy-production.sh",
  "user_prompt": "Deploy to production",
  "description": "Builds, tests, and deploys application to production environment",
  "inputs": [
    {
      "placeholder": "Enter environment (staging/production)",
      "variable": "{env}"
    }
  ]
}
```

Scripts are stored separately in:
- **Workspace**: `.vscode/devBoost/scripts/`
- **Global**: Extension global storage `<extension-path>/scripts/`


### VS Code Extension Commands

All commands are accessible via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

**SmartCmd Commands**:
- `devboost.smartCmdCreateButtons` - Generate AI-suggested buttons
- `devboost.smartCmdCreateCustomButton` - Create custom button
- `devboost.executeButton` - Execute a button command
- `devboost.editButton` - Edit button properties
- `devboost.deleteButton` - Delete a button
- `devboost.addToGlobal` - Copy workspace button to global scope
- `devboost.refreshButtons` - Reload all buttons
- `devboost.openButtonsFile` - Open buttons JSON file
- `devboost.openScriptFile` - Open script file in editor

**Prompt Enhancer Commands**:
- `devboost.showPromptEnhancer` - Show prompt enhancer interface
- `devboost.quickEnhance` - Quick enhance from clipboard
- `devboost.enhancePromptFromInput` - Enhance prompt programmatically

**Test Commands**:
- `DevBoost.helloWorld` - Test command

### Configuration

Currently, DevBoost works with default settings. Configuration options can be added to `package.json` under `contributes.configuration` for future customization.

-----
