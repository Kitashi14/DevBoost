# DevBoost

Create interactive buttons that execute specific command chains or script files. Enhance any prompt or text with one click or provide more context for detailed enhancement.

## SmartCmd Features

- **Automation Buttons**
  - Create one-click buttons for your most-used commands
  - AI analyzes your workflow to suggest useful automations
  - Manually create custom buttons without AI if you prefer
  - Add dynamic input fields for runtime variables (e.g., commit messages, environment names)
  - Supports both simple commands and complex multi-step scripts
  - Buttons can be workspace-specific or global across all projects

- **AI-Powered Button Creation**
  - Describe what you want in natural language, enhance the prompt and AI generates the button
  - AI suggests buttons based on your recent development activity
  - Review, edit, and approve all AI suggestions before saving
  - AI handles platform-specific command syntax automatically

- **Manual Button Creation**
  - Create buttons without AI assistance for full control
  - Define button name, command, execution directory, and description
  - Add input placeholders for dynamic values at execution time
  - Choose between workspace-only or global availability

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

## Prompt Enhancer Features

- **Quick Enhance**
  - One-click enhancement from clipboard text
  - Instantly improves clarity, specificity, and effectiveness
  - Enhanced prompt automatically copied back to clipboard
  - Preview results or view full comparison in editor
  - Fast refinement without manual configuration

- **Prompt Enhancer Interface**
  - Analyze prompts and get AI-powered improvement suggestions
  - Apply selected enhancements to refine your prompts
  - Generate new prompts from high-level intent descriptions
  - Interactive webview with real-time feedback
  - Copy enhanced results directly to clipboard

## Quick Actions

**SmartCmd:**
- **Open DevBoost Sidebar** - Click the 🚀 rocket icon in VS Code's activity bar
- **Generate AI-Suggested Buttons** - Click ✨ sparkle icon to analyze your workflow and create automation buttons
- **Create Custom Button** - Click ➕ plus icon to manually create buttons or use AI assistance
- **Execute Buttons** - Single-click any button to run commands instantly
- **Edit & Manage Buttons** - Right-click buttons to edit, delete, or copy to global scope
- **View Scripts** - Right-click script buttons (📜) to view and edit script files
- **Bulk Edit Buttons** - Click 🖌️ to select multiple buttons for bulk edit
- **Refresh Buttons** - Click 🔄 refresh icon to reload all buttons

**Prompt Enhancer:**
- **Quick Enhance** - Copy text to clipboard, run command from Command Palette (`DevBoost: Quick Enhance`), get enhanced result instantly
- **Open Prompt Enhancer** - Use Command Palette (`DevBoost: Show Prompt Enhancer`) to access full interface
- **Analyze & Improve** - Paste your prompt, get AI suggestions, select improvements to apply
- **Generate from Intent** - Describe what you want, AI generates a complete prompt for you


## Notes
 1. Use extension's UI to manage buttons instead of editing related JSON files directly.
 2. Use 'Enable Tracking Non-VScode Terminal Session' feature under SmartCmd menu for tracking commands run in sessions like screen, tmux, ssh etc.
 3. Configure different AI model for SmartCmd and Prompt Enhancer from their menu button.

## Feedback & Feature Requests

Help us improve DevBoost by sharing your thoughts, suggestions, or reporting issues.

**[Submit Form](https://forms.gle/f5yhuX2UxUsgdXpu6)**

----