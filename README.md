# DevBoost

## Overview
**DevBoost** is a Visual Studio Code (VS Code) extension built to enhance developer productivity through AI-driven automation and workflow optimization. Designed for the Cisco AI hackathon, DevBoost streamlines repetitive coding tasks and lays the foundation for a suite of intelligent tools to enhance software development. Its current feature, **SmartCmd**, creates one-click buttons for common tasks, making workflows faster and more efficient.

## Key Features
- **SmartCmd**: Logs developer actions (e.g., commands, file operations, Git tasks) in a project’s `.vscode` folder and uses AI to suggest or create custom buttons for the VS Code status bar. Buttons persist per project or globally, enabling seamless task execution.
- **Future Vision**: DevBoost is expandable to include features like AI-driven code snippets, task prioritization, debugging aids, and collaboration tools to optimize development workflows.

## Why DevBoost?
DevBoost empowers developers to focus on coding by automating repetitive tasks and using other different features to enhance productivity. SmartCmd’s AI analyzes your workflow to suggest time-saving buttons, while the project’s modular design supports adding new productivity tools. For the hackathon, we’ll demo SmartCmd’s button generation and showcase DevBoost’s potential to transform coding efficiency.

## SmartCmd
1. Open a project directory and run commands (e.g., `npm test`), file operations, or Git tasks.
2. Use `Ctrl+Shift+P > SmartCmd: Create AI Buttons` to generate buttons based on your activity.
3. Use `Ctrl+Shift+P > SmartCmd: Create Custom Button` to create buttons via natural language (e.g., “Button to run tests”).
4. Buttons persist in `.vscode/devboost.json` or globally, reloading across sessions.
