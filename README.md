# DevBoost

## Overview
**DevBoost** is a Visual Studio Code (VS Code) extension built to enhance developer productivity through AI-driven automation and workflow optimization. Designed for the Cisco AI hackathon, DevBoost streamlines repetitive coding tasks and lays the foundation for a suite of intelligent tools to enhance software development. Its current feature, **SmartCmd**, creates one-click buttons for common tasks, making workflows faster and more efficient.

## Key Features
- **SmartCmd**: Logs developer actions (e.g., commands, file operations, Git tasks) in a project's `.vscode` folder and uses AI (GitHub Copilot) to suggest or create custom buttons in the DevBoost sidebar. Features include:
  - **Hierarchical Organization**: Dedicated SmartCmd section with separate Global and Workspace command groups
  - **AI-Powered Button Generation**: OS-aware command suggestions compatible with Windows, macOS, and Linux
  - **Smart Activity Tracking**: Automatically excludes SmartCmd-executed commands from logs to keep insights clean
  - **Dynamic Input Fields**: Buttons can prompt for user input (e.g., commit messages, branch names)
  - **Intelligent Duplicate Detection**: AI prevents creating similar buttons with user confirmation for edge cases
  - **Edit Functionality**: Modify button names and descriptions without recreating them
  - **Scope Management**: Copy workspace buttons to global scope with AI validation for compatibility
  - **Workspace Awareness**: Automatically adapts when switching between projects
- **Future Vision**: DevBoost is expandable to include features like AI-driven code snippets, task prioritization, debugging aids, and collaboration tools to optimize development workflows.

## Why DevBoost?
DevBoost empowers developers to focus on coding by automating repetitive tasks and providing intelligent workflow enhancements. SmartCmd's AI (powered by GitHub Copilot) analyzes your workflow patterns to suggest time-saving, OS-compatible buttons with smart duplicate prevention and user confirmation when needed. The intuitive hierarchical sidebar organizes commands by scope, while the edit functionality and AI validation help you refine buttons safely. DevBoost automatically adapts when you switch projects and keeps your activity insights clean by filtering out its own commands. The modular design supports adding new productivity tools, making it a comprehensive solution for modern development workflows. For the hackathon, we'll demo SmartCmd's intelligent button generation, dynamic input handling, workspace awareness, and showcase DevBoost's potential to transform coding efficiency.

## SmartCmd
1. **Open DevBoost Sidebar**: Click the 🚀 rocket icon in the activity bar to access the hierarchical view with SmartCmd section.
2. **Perform Actions**: Run commands (e.g., `npm test`, `git commit`), file operations, or Git tasks in your project.
3. **Generate AI Buttons**: Click the ✨ sparkle icon on the SmartCmd section or use `Ctrl+Shift+P > SmartCmd: Create AI Suggested Buttons` to generate OS-compatible buttons based on your activity patterns.
4. **Create Custom Buttons**: Click the ➕ plus icon on the SmartCmd section or use `Ctrl+Shift+P > SmartCmd: Create Custom Button` to create buttons via natural language (e.g., "Button to run tests and commit with message"). A file will open for your description—close it when done.
5. **Manage Buttons**: Right-click any button to edit its name/description, copy workspace buttons to global scope (with AI compatibility checks), or delete it.
6. **Choose Scope**: Buttons can be workspace-specific (📁 Workspace Commands) or global (🌐 Global Commands), persisting in `.vscode/devboost.json` or globally across all projects.
7. **Execute**: Click buttons to run commands, with automatic prompts for dynamic inputs. Switch projects seamlessly—DevBoost adapts automatically!
