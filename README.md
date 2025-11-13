# DevBoost Extension Features

DevBoost is a Visual Studio Code extension designed to supercharge developer productivity with AI-powered automation and workflow enhancements. Here are the key features:

## Main Features

- **SmartCmd Automation Buttons**
  - Create one-click buttons for your most-used commands
  - AI analyzes your workflow to suggest useful automations
  - Manually create custom buttons without AI if you prefer
  - Add dynamic input fields for runtime variables (e.g., commit messages, environment names)
  - Supports both simple commands and complex multi-step scripts
  - Buttons can be workspace-specific or global across all projects

- **AI-Powered Button Creation**
  - Describe what you want in natural language, and AI generates the button
  - AI suggests buttons based on your recent development activity
  - Review, edit, and approve all AI suggestions before saving
  - AI handles platform-specific command syntax automatically

- **Manual Button Creation**
  - Create buttons without AI assistance for full control
  - Define button name, command, execution directory, and description
  - Add input placeholders for dynamic values at execution time
  - Choose between workspace-only or global availability
  - Edit existing buttons to align with what you want

- **Prompt Enhancer**
  - Improve your AI prompts for clarity, tone, and structure
  - Choose from multiple enhancement options (tone, formality, length)
  - Enhance prompts from editor selection or clipboard
  - Apply different styles: Professional, Casual, Technical, Friendly, Assertive
  - Adjust formality and length to match your needs

- **Script Support**
  - Generate and run multi-step scripts from a single button
  - AI creates scripts with error handling and conditional logic
  - View and edit script files directly in VS Code
  - Supports platform-specific commands (Windows, macOS, Linux)
  - Input fields work with scripts for dynamic variables

- **Button Management**
  - Copy workspace buttons to global scope for reuse across projects
  - Delete, edit, and reorganize buttons easily
  - Execute buttons with a single click
  - View button commands and descriptions in tooltips
  - Open and edit button configuration files directly

- **Cross-Platform Compatibility**
  - Works seamlessly on Windows, macOS, and Linux
  - Adapts commands and scripts to your shell environment (bash, zsh, PowerShell, cmd)
  - Platform-aware command generation

## Quick Actions

- **Open DevBoost Sidebar** - Click the 🚀 rocket icon in VS Code's activity bar
- **Generate AI-Suggested Buttons** - Click ✨ sparkle icon to analyze your workflow and create automation buttons
- **Create Custom Button** - Click ➕ plus icon to manually create buttons or use AI assistance
- **Execute Buttons** - Single-click any button to run commands instantly
- **Enhance Prompts** - Use Command Palette to improve AI prompts with professional refinement
- **Edit & Manage Buttons** - Right-click buttons to edit, delete, or copy to global scope
- **View Scripts** - Right-click script buttons (📜) to view and edit script files
- **Refresh Buttons** - Click 🔄 refresh icon to reload all buttons
- **Bulk Edit Buttons** - Click 🖌️ to select multiple buttons for bulk edit

## Notes
 1. Use extension's UI to manage buttons instead of editing related JSON files directly.
 2. Use 'Enable Tracking Non-VScode Terminal Session' feature under SmartCmd menu for tracking commands run in sessions like screen, tmux, ssh etc.


## Feedback & Feature Requests

Help us improve DevBoost by sharing your thoughts, suggestions, or reporting issues.

**[Submit Form](https://forms.gle/f5yhuX2UxUsgdXpu6)**

----