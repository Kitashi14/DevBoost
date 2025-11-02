# DevBoost - AI-Powered VS Code Productivity Extension

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](src/)
[![Tests](https://img.shields.io/badge/tests-passing-green.svg)](#%EF%B8%8F-development--testing)

## 🎯 Overview

**DevBoost** is a Visual Studio Code extension that supercharges developer productivity through AI-driven automation and intelligent workflow optimization. Built for modern development workflows, DevBoost streamlines repetitive coding tasks and provides intelligent tools to enhance software development efficiency.

### 🌟 Key Features

- **🤖 AI-Powered SmartCmd**: Creates intelligent one-click buttons for common tasks
- **🔍 Enhanced Activity Logging**: Contextual logging with terminal information and directory tracking
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
```

### Basic Usage

1. **Open DevBoost Sidebar**: Click the 🚀 rocket icon in the activity bar
2. **Work Normally**: Run commands, save files, use Git - DevBoost learns your patterns
3. **Generate AI Buttons**: Click ✨ to create AI-suggested automation buttons
4. **Create Custom Buttons**: Click ➕ to create buttons from natural language descriptions
5. **Manage & Execute**: Right-click to edit, click buttons to run commands

## 📖 SmartCmd Feature Guide

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
```

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
```

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
```

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

## 🛠️ Development & Testing

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
```

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
- `devboost.smartCmdCreateCustomButton` - Create custom button from description
- `devboost.executeButton` - Execute a button command
- `devboost.editButton` - Edit button properties
- `devboost.deleteButton` - Remove a button
- `devboost.addToGlobal` - Copy workspace button to global scope

## 📊 Recent Updates (v0.1.0)

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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **GitHub Copilot** for AI-powered suggestions and analysis
- **VS Code Extension API** for the robust development platform
- **TypeScript** for type-safe development
- **Cisco AI Hackathon** for inspiring this productivity-focused solution

---

**DevBoost** - Transforming developer productivity through intelligent automation! 🚀
