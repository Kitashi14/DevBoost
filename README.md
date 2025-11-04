# DevBoost - AI-Powered VS Code Productivity Extension

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](src/)
![Tests](https://img.shields.io/badge/tests-passing-green.svg)

## 🎯 Overview

**DevBoost** is a Visual Studio Code extension that supercharges developer productivity through AI-driven automation and intelligent workflow optimization. Built for modern development workflows, DevBoost streamlines repetitive coding tasks and provides intelligent tools to enhance software development efficiency.

### 🌟 Key Features

- **🤖 AI-Powered SmartCmd**: Creates intelligent one-click buttons for common tasks
- **🔄 Prompt Enhancer**: Improve your prompts before sending to AI (like Webex rewrite message)
- **� Enhanced Activity Logging**: Contextual logging with terminal information and directory tracking
- **🧠 Smart Workflow Analysis**: AI analyzes your patterns to suggest optimal automations
- **🎛️ User-Controlled AI**: Confirmation dialogs for all AI-generated suggestions
- **🧹 Intelligent Log Management**: Automatic cleanup and optimization for AI context
- **🌐 Cross-Platform**: Full Windows, macOS, and Linux compatibility

## 🚀 Quick Start

### Installation & Setup

```bash
# Clone and install
git clone https://github.com/Kitashi14/DevBoost.git
cd DevBoost
npm install
npm run compile

# Test the extension
# Press F5 in VS Code to launch Extension Development Host
```bash

### Basic Usage

1. **Open DevBoost Sidebar**: Click the 🚀 rocket icon in the activity bar
2. **Work Normally**: Run commands, save files, use Git - DevBoost learns your patterns
3. **Generate AI Buttons**: Click ✨ to create AI-suggested automation buttons
4. **Create Custom Buttons**: Click ➕ to create buttons from natural language descriptions
5. **Enhance Prompts**: Use the Prompt Enhancer to improve text before sending to AI
6. **Manage & Execute**: Right-click to edit, click buttons to run commands

## 📚 Feature Guide

### 🤖 SmartCmd - AI-Powered Automation

**SmartCmd** analyzes your development patterns and creates intelligent one-click buttons for repetitive tasks.

#### How It Works

1. **Activity Detection**: Tracks terminal commands, file operations, and Git actions
2. **Pattern Analysis**: AI analyzes your workflow patterns using GitHub Copilot
3. **Smart Suggestions**: Generates contextual automation buttons for your specific workflow
4. **OS-Aware**: Creates platform-specific commands (Windows/macOS/Linux)

#### Creating AI Buttons

1. Work normally in your project (run commands, save files, use Git)
2. Click the **✨ sparkle icon** in the DevBoost sidebar
3. AI analyzes your `.vscode/activity.log` and suggests relevant buttons
4. Review and confirm the suggestions
5. Click generated buttons to execute commands instantly

#### Custom Buttons from Natural Language

1. Click the **➕ plus icon** in DevBoost sidebar
2. Describe what you want: "Create a button that builds and deploys my React app"
3. AI generates the appropriate command structure
4. Customize if needed and save

### 🔄 Prompt Enhancer

Transform your prompts before sending them to AI, similar to Webex's rewrite message feature.

#### Enhancement Options

- **✨ Clarity & Specificity**: Make requests clearer and more specific
- **🔧 Grammar & Spelling**: Fix language mistakes
- **📐 Structure & Format**: Improve organization and readability
- **🎭 Tone Control**: Professional, Casual, Friendly, Assertive, Technical
- **🎩 Formality Level**: Formal, Informal, Neutral
- **📏 Length Adjustment**: Shorter, Same, More detailed

#### How to Use

1. **Standalone**: Use `DevBoost: Show Prompt Enhancer` command
2. **From Selection**: Select text and enhance via command palette
3. **Integrated**: Available during AI button creation for better results

#### Access Methods

- **Command Palette**: `Ctrl+Shift+P` → "DevBoost: Show Prompt Enhancer"
- **Context Menu**: Right-click selected text
- **SmartCmd Integration**: Automatic option during AI interactions

### 📊 Activity Logging & Analysis

DevBoost intelligently tracks your development activities to understand your workflow patterns.

#### What Gets Logged

- **Terminal Commands**: Git operations, build commands, test runs
- **File Operations**: Save, create, rename, delete
- **VS Code Actions**: Editor commands and workspace changes
- **Context Information**: Working directories, shell types, timestamps

#### Smart Features

- **Automatic Cleanup**: Maintains optimal log size for AI processing
- **Cross-Platform**: Adapts to your OS and shell (bash/zsh/PowerShell/cmd)
- **Privacy-Focused**: Only logs workspace activities, stored locally
- **Loop Prevention**: Excludes SmartCmd-generated commands to avoid feedback

## 🛠️ Development & Testing

### Prerequisites

- VS Code 1.74.0 or higher
- Node.js 16.x or higher
- TypeScript 4.x or higher

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/Kitashi14/DevBoost.git
cd DevBoost

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Watch mode (for development)
npm run watch
```bash

### Testing the Extension

1. **Launch Extension Host**: Press `F5` in VS Code
2. **Open Test Project**: Create or open a workspace in the Extension Development Host
3. **Perform Activities**: Run terminal commands, save files, use Git
4. **Test Features**:
   - Generate AI buttons with ✨
   - Create custom buttons with ➕
   - Enhance prompts via command palette
   - Verify activity logging in `.vscode/activity.log`

### Extension Structure

```text
src/
├── extension.ts              # Main extension entry point
├── activityLogging.ts        # Activity tracking and log management
├── smartCmd/                 # SmartCmd automation system
│   ├── activateExt.ts       # SmartCmd activation and setup
│   ├── aiServices.ts        # AI integration for button generation
│   ├── handlers.ts          # Button creation and execution handlers
│   └── treeProvider.ts      # Sidebar tree view provider
└── promptEnhancer/          # Prompt enhancement system
    ├── promptEnhancer.ts    # Main prompt enhancer module
    ├── aiServices.ts        # AI services for prompt enhancement
    └── handlers.ts          # Prompt enhancement handlers
```text

## 🔧 Configuration

DevBoost works out-of-the-box but can be customized through VS Code settings:

```json
{
  "devboost.activityLogging.enabled": true,
  "devboost.activityLogging.maxFileSize": 5242880,
  "devboost.smartCmd.confirmExecution": true,
  "devboost.promptEnhancer.defaultTone": "professional"
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

**During AI Operations:**

- Choose "Enhanced AI Suggestions" (second ✨ icon) for improved button generation
- Select "✨ Use AI (Enhanced)" when creating custom buttons
- System will offer to enhance your prompts before AI processing

**Enhancement Options:**

- **Tone**: Professional, Casual, Friendly, Assertive, Technical
- **Formality**: Formal, Informal, Neutral  
- **Length**: Shorter, Same, More detailed
- **Improvements**: Fix grammar, improve clarity, better formatting

### Creating AI-Suggested Buttons

The SmartCmd system analyzes your workflow and suggests intelligent automations:

```text
# After working in your project:
1. Click the ✨ sparkle icon in DevBoost sidebar
2. AI analyzes your .vscode/activity.log with enhanced context:
   - Terminal usage patterns and shell preferences  
   - Working directory context and frequent locations
   - Command patterns and success/failure rates
   - Error patterns for intelligent suggestions
3. Review and confirm AI suggestions with full control
4. Buttons are created and ready to use!

### Enhanced Logging System

DevBoost features an intelligent logging system that provides rich context for AI analysis:

#### **Contextual Information Captured:**

- Terminal ID, name, and shell type (zsh, bash, PowerShell)
- Working directory where commands were executed
- Execution duration and exit codes
- Session tracking and workspace correlation
- Command vs VS Code action differentiation

#### **Sample Enhanced Log Entry:**

```json
{
  "timestamp": "2024-11-01T18:21:00.000Z",
  "command": "npm run build", 
  "context": {
    "workspace": {"name": "DevBoost", "path": "/Users/user/project"},
    "terminal": {"shell": "zsh", "cwd": "/Users/user/project"},
    "execution": {"exitCode": 0, "duration": 5420}
  }
}
```json

#### **Smart Log Management:**

- **Automatic Cleanup**: Runs every 24 hours with 5MB size limits
- **AI Optimization**: Compresses old entries while preserving recent detail
- **Backup System**: Maintains 3 rotating backups for safety
- **Context Preservation**: Keeps workflow patterns for better AI suggestions

### AI Confirmation System

All AI-generated content includes user confirmation and editing capabilities:

#### **For AI-Suggested Buttons:**

- Preview all suggestions before creation
- Individual review and edit capability
- Accept, modify, or skip any suggestion
- Full transparency in AI decision-making

#### **For Custom Buttons:**

- Review AI-generated names, commands, and descriptions
- Edit AI descriptions before saving
- Complete control over final button creation

### Button Management

#### **Hierarchical Organization:**

- **🌐 Global Commands**: Available across all projects
- **📁 Workspace Commands**: Specific to current workspace

#### **Button Capabilities:**

- **Dynamic Inputs**: Buttons can prompt for user input (commit messages, branch names)
- **Smart Execution**: Commands run in correct directory context
- **Edit Functionality**: Modify names and descriptions without recreating
- **Scope Management**: Copy workspace buttons to global scope with AI validation
- **OS Compatibility**: Commands automatically adapted for your platform

#### **Button Format Example:**

```json
{
  "name": "📝 Git Commit",
  "cmd": "git add . && git commit -m '{message}'",
  "user_description": "Quick commit workflow",
  "ai_description": "Stage all changes and commit with custom message",
  "inputs": [
    {
      "placeholder": "Enter commit message",
      "variable": "{message}"
    }
  ]
}
```json

## 🔧 Advanced Features

### Workflow Analysis

DevBoost's AI provides intelligent insights from your activity patterns:

- **Command Frequency Analysis**: Identifies your most-used commands
- **Directory Pattern Recognition**: Understands your workspace structure
- **Error Pattern Learning**: Suggests fixes for commonly failing commands
- **Shell-Specific Optimization**: Adapts to your preferred terminal environment
- **Multi-Workspace Correlation**: Learns patterns across different projects

### Log Optimization for AI

The logging system is specifically optimized for AI consumption:

- **Structured JSON Format**: Easy parsing and analysis
- **Context Aggregation**: Summarizes patterns and frequencies
- **Error Correlation**: Links failures with environmental context
- **Performance Tracking**: Monitors command execution times
- **Session Management**: Groups related activities together

### Project Structure

```text
DevBoost/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── activityLogging.ts        # Enhanced logging system
│   └── smartCmd/
│       ├── activateExt.ts        # SmartCmd activation
│       ├── handlers.ts           # Command handlers with AI confirmation
│       ├── aiServices.ts         # AI integration and LLM services  
│       └── treeProvider.ts       # UI tree view management
├── .vscode/
│   ├── devboost.json            # Workspace button storage
│   └── activity.log             # Enhanced activity logging
└── README.md                    # This comprehensive guide
```text

### Running Tests

```bash
npm test                    # Run all tests
npm run compile            # Compile TypeScript
npm run lint              # Run ESLint
npm run watch             # Watch mode for development
```

### Extension Commands

- `DevBoost.helloWorld` - Hello World test command
- `devboost.smartCmdCreateButtons` - Create AI-suggested buttons
- `devboost.smartCmdCreateButtonsEnhanced` - Create AI-suggested buttons with prompt enhancement
- `devboost.smartCmdCreateCustomButton` - Create custom button from description
- `devboost.enhancePrompt` - Enhance any prompt before sending to AI
- `devboost.enhancePromptFromInput` - Programmatic prompt enhancement interface
- `devboost.executeButton` - Execute a button command
- `devboost.editButton` - Edit button properties
- `devboost.deleteButton` - Remove a button
- `devboost.addToGlobal` - Copy workspace button to global scope

## 📊 Recent Updates (v0.1.0)

### ✅ New Prompt Enhancer Feature

- **Webex-style Enhancement**: Improve prompts before sending to AI with tone, formality, and length controls
- **Seamless Integration**: Available in AI button creation and as standalone command
- **Smart Enhancement Options**: Professional tone, grammar fixes, clarity improvements, and more
- **Real-time Preview**: See enhanced prompts before applying them

### ✅ Enhanced AI System

- **User Confirmation**: All AI suggestions now require user review and approval
- **Edit Capability**: Users can modify AI-generated descriptions before saving
- **Intelligent Preview**: Comprehensive button previews with full context

### ✅ Smart Log Management

- **Automatic Cleanup**: 24-hour rotation with size limits and backup management
- **AI Optimization**: Intelligent compression maintaining workflow insights
- **Context Preservation**: Rich terminal and directory information for better AI analysis

### ✅ Updated Dependencies

- All npm packages updated to latest versions
- Node.js types upgraded to v24 for better compatibility
- Enhanced security with latest ESLint and test frameworks

## 🎯 Future Roadmap

### Planned Features

- **Script Generation**: Convert log patterns into reusable shell scripts
- **Usage Analytics**: Button performance metrics and optimization suggestions  
- **Framework Templates**: Pre-built button sets for React, Node.js, Python
- **Error Learning**: AI-powered failure analysis and fix suggestions
- **Collaborative Workflows**: Team button sharing and workspace templates

### Enhancement Areas

- **Advanced Context**: Git branch awareness and project state correlation
- **Performance Optimization**: Command execution benchmarking and suggestions
- **Integration Expansion**: Support for more development tools and workflows
- **UI Improvements**: Enhanced visual indicators and analytics displays

## � License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**DevBoost** - Transforming developer productivity through intelligent automation! 🚀
