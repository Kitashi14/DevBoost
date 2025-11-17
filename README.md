# DevBoost

[![Version](https://img.shields.io/badge/version-0.7.2-blue.svg)](https://open-vsx.org/extension/DevBoost/devboostextension)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.105.0%2B-blue.svg)](https://code.visualstudio.com/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

> AI-powered VS Code extension for creating custom command buttons and enhancing prompts with GitHub Copilot.

**DevBoost** automates repetitive development tasks by learning from your workflow patterns and creating one-click command buttons. It also helps you write better AI prompts with built-in enhancement tools.

## ✨ Features

### 🤖 SmartCmd - Custom Command Buttons

Create reusable command buttons for your frequent terminal operations:

- **Activity Tracking**: Logs terminal commands, tasks, debug session with execution context and exit codes.
- **AI-Generated Buttons**: Analyzes your activity log to suggest smart automation buttons
- **Manual Creation**: Create custom buttons with or without AI assistance  
- **Script Support**: Generate multi-step shell scripts for complex workflows
- **Scope Management**: Global buttons (all workspaces) or workspace-specific buttons
- **Bulk Operations**: Edit, delete, or reorder multiple buttons at once with drag-and-drop
- **Dynamic Inputs**: Add runtime prompts for flexible command execution

### 🔄 Prompt Enhancer

Improve your AI prompts before sending them:

- **Quick Enhancement**: Refine prompts for clarity, grammar, and structure
- **Tone Control**: Adjust formality and style (Professional, Casual, Technical, etc.)
- **Length Adjustment**: Make prompts shorter or more detailed
- **Selection Support**: Enhance selected text directly in the editor

## Quick Start

### Prerequisites

- **VS Code**: 1.105.0 or higher
- **GitHub Copilot**: Required for AI features (active subscription)
- **Node.js**: 16.x or higher (for development)

### Installation

#### From VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"DevBoost"**
4. Click **Install**

Or install directly:
- **VS Code Marketplace**: [DevBoost Extension](https://marketplace.visualstudio.com/items?itemName=DevBoost.devboostextension)
- **Open VSX Registry**: [DevBoost on Open VSX](https://open-vsx.org/extension/DevBoost/devboostextension)

#### From Source

```bash
git clone https://github.com/Kitashi14/DevBoost.git
cd DevBoost
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

### Basic Usage

1. **Open DevBoost**: Click the 🚀 rocket icon in VS Code's activity bar
2. **Create Your First Button**:
   - Click ➕ in SmartCmd view
   - Choose **Global** or **Workspace** scope
   - Use AI assistance or create manually
   - Add command, name, and description
3. **Execute**: Click any button to run its command
4. **Manage**: Right-click buttons to edit, delete, or view scripts

## Documentation

### SmartCmd Commands

**Available Commands** (Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P`):

- `DevBoost: Create AI Buttons` - Generate buttons from activity log
- `DevBoost: Create Custom Button` - Manual or AI-assisted button creation
- `DevBoost: Bulk Edit Buttons` - Multi-select operations and drag-drop reordering
- `DevBoost: Configure AI Model` - Choose AI model for SmartCmd

**Button Features**:

- **Input Fields**: Add `{variable}` placeholders for runtime values
- **Execution Directory**: Specify where commands run (e.g., `<workspace>`, `.`, or custom path)
- **Scripts**: Complex workflows stored as executable shell scripts
- **Cross-Platform**: Auto-detects OS for platform-specific commands

**Bulk Edit Panel** (`DevBoost: Bulk Edit Buttons`):
- Drag-and-drop to reorder buttons (within same scope)
- Multi-select with scope-level checkboxes
- Bulk actions: Set execution directory, delete multiple buttons
- Filter by type (scripts vs commands)

### Prompt Enhancer Commands

- `DevBoost: Show Prompt Enhancer` - Open enhancement UI
- `DevBoost: Quick Enhance from Clipboard` - Fast enhancement from clipboard
- `DevBoost: Configure AI Model` - Choose AI model for enhancements

### File Locations

**Workspace Files** (`.vscode/devBoost/`):
- `smartCmd.json` - Workspace button definitions
- `scripts/` - Workspace-specific script files
- `activity.log` - Development activity tracking (auto-cleanup enabled)
- `ai_prompts_enhancer.log` - AI interaction logs for debugging, disabled in release version.

**Global Files** (Extension Storage):
- Global button definitions
- Global script files
- AI model configuration file

## 🛠️ Development

### Project Structure

```
src/
├── extension.ts              # Main extension entry
├── activityLogging.ts        # Activity tracking system
├── configManager.ts          # Configuration management
├── smartCmd/
│   ├── handlers.ts           # Button execution & management
│   ├── aiServices.ts         # AI integration for SmartCmd
│   ├── treeProvider.ts       # VS Code tree view provider
│   ├── scriptManager.ts      # Script generation & storage
│   └── view/
│       ├── bulkEditPanel.ts  # Bulk operations UI
│       ├── manualButtonFormPanel.ts
│       └── editButtonFormPanel.ts
└── promptEnhancer/
    ├── promptEnhancer.ts     # Prompt enhancement logic
    ├── aiServices.ts         # AI integration for prompts
    ├── handlers.ts           # Enhancement handlers
    └── treeProvider.ts       # Tree view provider
```

### Build & Test

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on save)
npm run watch

# Run extension in debug mode
# Press F5 in VS Code

# Package extension
npm run package
```

### Contributing

Contributions are welcome! We appreciate any improvements or new features. Here's how to get started:

1. **Fork the Repository**
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Your Changes**:
   - Follow TypeScript best practices
   - Test your changes thoroughly
   - Ensure cross-platform compatibility (Windows/macOS/Linux)
4. **Commit** with clear messages:
   ```bash
   git commit -m "feat: add bulk delete with confirmation"
   ```
5. **Push and Open a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

**Contribution Guidelines**:
- Use descriptive commit messages (conventional commits format preferred)
- Update README if adding user-facing features

### Reporting Issues

Found a bug? Have a feature request? [Open an issue](https://github.com/Kitashi14/DevBoost/issues) with:


## Privacy & Security

- All data is stored locally in `.vscode/devBoost/` and extension storage
- No telemetry or external data transmission
- AI interactions use your GitHub Copilot subscription only

## License

This project is licensed under the GNU General Public License v3.0 - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **GitHub Copilot** - Powers AI features
- **VS Code Extension API** - Seamless IDE integration
- **Open Source Community** - For inspiration and support

## Support

- **Issues**: [GitHub Issues](https://github.com/Kitashi14/DevBoost/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Kitashi14/DevBoost/discussions)
- **Repository**: [github.com/Kitashi14/DevBoost](https://github.com/Kitashi14/DevBoost)

---

Made with ❤️ by developers, for developers. Star ⭐ if you find this useful!
