# DevBoost SmartCmd - Quick Start Guide

## 🚀 Installation & Testing

### 1. Clone and Install
```bash
# Clone the repository
git clone https://github.com/Kitashi14/DevBoost.git
cd DevBoost

# Install dependencies
npm install

# Compile the TypeScript code
npm run compile
```

### 2. Run the Extension
Press `F5` in VS Code to launch the Extension Development Host with DevBoost loaded.

### 3. Open the DevBoost Sidebar
Look for the **🚀 rocket icon** in the left activity bar (same area as Explorer, Search, Git icons).
Click it to open the **DevBoost sidebar** with a hierarchical view:
- **⚡ SmartCmd** - Main section showing total button count
  - **🌐 Global Commands** - Buttons available in all projects
  - **📁 Workspace Commands** - Buttons specific to current workspace

### 4. Test Activity Logging
In the Extension Development Host window:
1. Open a project/workspace folder
2. Perform some actions:
   - Save files (`Cmd+S` or `Ctrl+S`)
   - Create new files
   - Run terminal commands (especially `git` commands)
   - Execute VS Code commands

3. Check the activity log:
   - Navigate to `.vscode/activity.log` in your project
   - You should see logged activities with timestamps

### 5. Create AI-Suggested Buttons
1. After performing various activities, open the **DevBoost sidebar** (🚀 rocket icon)
2. Click the **✨ sparkle icon** on the SmartCmd section (Create AI Buttons)
3. The extension will:
   - Detect your OS (Windows/macOS/Linux) and shell (bash/zsh/PowerShell)
   - Analyze your `.vscode/activity.log`
   - Generate up to 5 OS-compatible button suggestions with GitHub Copilot
   - Check for duplicates using AI-powered semantic detection
   - Display them in the appropriate section (Global or Workspace Commands)

### 6. Create Custom Button with AI
1. Open the **DevBoost sidebar**
2. Click the **➕ plus icon** on the SmartCmd section (Create Custom Button)
3. Follow the prompts:
   - Enter a description in natural language (e.g., "Button to commit changes with a message")
   - Choose scope: "Project Directory" (workspace) or "Global" (all projects)
   - AI will generate:
     * Button name with emoji (e.g., "📝 Git Commit")
     * OS-compatible command (e.g., `git add . && git commit -m '{message}'`)
     * Description and input fields if needed
4. If the button needs user input:
   - The command uses `{variableName}` placeholders
   - When you click the button, you'll be prompted for each input
   - Example: `{message}` → "Enter commit message" prompt
5. The button will appear in the corresponding section (Global or Workspace)!

### 7. Use Buttons
- **Click any button** in the sidebar to execute its command
- **Buttons with input fields** will prompt you for values (e.g., commit message, branch name)
- **Hover** over a button to see:
  - Full description
  - Required input fields (if any)
  - Command that will be executed
- **Hover** over a button to see inline action icons:
  - ✏️ **Edit** - Modify button name and description
  - 🗑️ **Delete** - Remove the button
- **Section indicators**:
  - **🌐 Global Commands** - Available in all projects (stored in VS Code global state)
  - **📁 Workspace Commands** - Only available in current workspace (stored in `.vscode/devboost.json`)

### 8. Edit Buttons
1. **Hover** over any button to see the edit icon (✏️ pencil)
2. **Click the edit icon** to modify:
   - **Button name**: Update the display name (keep emojis for visual appeal!)
   - **Description**: Update the tooltip description
3. **Changes are saved** automatically to the appropriate storage location
4. **Note**: Command and input fields cannot be edited (to prevent breaking functionality)

### 9. Manage Buttons
- Click the **🔄 refresh icon** on the SmartCmd section to reload buttons from disk
- Delete buttons using the trash icon (🗑️) next to each button
- Edit buttons using the pencil icon (✏️) to update name and description
- Buttons persist across VS Code sessions
- **Duplicate Detection**: AI automatically prevents creating similar buttons
  - Compares command structure and functionality
  - Normalizes commands to detect variations (e.g., different variable names)
  - Uses semantic analysis to detect functionally identical buttons

## 📁 File Structure Created

After using SmartCmd, you'll see these files:

```
your-project/
└── .vscode/
    ├── activity.log         # Activity tracking log
    └── devboost.json        # Workspace-specific buttons
```

Global buttons are stored in VS Code's global state (not visible as files).

## 🧪 Example Workflow

1. **Open a Node.js project**
2. **Perform common tasks:**
   ```bash
   npm install
   npm test
   git add .
   git commit -m "update"
   git push
   ```
3. **Save some files** (`Cmd+S` or `Ctrl+S`)
4. **Open DevBoost sidebar:** Click the 🚀 rocket icon in the activity bar
5. **Generate buttons:** Click the ✨ sparkle icon on the SmartCmd section
6. **See hierarchical structure:**
   ```
   ⚡ SmartCmd (5 buttons)
     └── 📁 Workspace Commands (5 buttons)
         ├── 🔨 Build - "Build the project using npm"
         ├── 🧪 Run Tests - "Run all tests in the project"
         ├── 📝 Git Commit - "Stage changes and commit" (with input field)
         ├── 🚀 Git Push - "Push commits to remote repository"
         └── 💾 Save All - "Save all open files"
   ```
7. **Click any button** to execute its command instantly!
   - Buttons with input fields will prompt you first
   - All commands are OS-compatible (works on Windows/macOS/Linux)
8. **Edit any button**: Hover and click the ✏️ icon to update name/description

### Example: Button with Input Fields

When you click the **📝 Git Commit** button:
1. You're prompted: "Enter commit message"
2. You type: "Fix navigation bug"
3. Command executes: `git add . && git commit -m 'Fix navigation bug'`
4. Done! ✅

## 🎯 Features Implemented

✅ **Custom Sidebar View**
- Dedicated DevBoost sidebar with rocket icon (🚀)
- Hierarchical structure with SmartCmd section
- Separate Global and Workspace command sections
- Action buttons on SmartCmd section header
- Clean, organized button display
- Easy access from activity bar
- Enhanced tooltips showing descriptions and input fields

✅ **Activity Logging**
- File operations (save, create, delete, rename)
- All terminal commands (comprehensive logging)
- Automatic log creation in `.vscode/activity.log`
- Timestamped entries for activity tracking

✅ **AI Button Generation with GitHub Copilot**
- **OS-Aware Command Generation**: Detects your OS (Windows/macOS/Linux) and shell
- **Platform-Specific Commands**: Generates Windows, macOS, or Linux compatible commands
- Analyzes activity patterns
- Suggests relevant buttons with descriptions
- Smart fallback when Copilot unavailable

✅ **Custom Button Creation**
- Natural language descriptions (e.g., "button to commit with message")
- **AI-powered generation** using GitHub Copilot Language Model API
- **Dynamic Input Fields**: Support for commands requiring user input
  - Uses `{variableName}` placeholders in commands
  - Prompts user for each input when button is clicked
  - Example: `git commit -m '{message}'` → prompts for commit message
- **Automatic Input Detection**: Detects `{variables}` in manual commands
- Project or global scope
- OS-compatible command suggestions

✅ **Intelligent Duplicate Detection**
- **Two-layer detection system**:
  1. Command normalization (removes quotes, whitespace, normalizes variables)
  2. AI-powered semantic similarity analysis
- Prevents creating functionally identical buttons
- Compares command structure and purpose
- Works across different variable names and syntax variations

✅ **Button Management**
- Execute buttons with single click
- **Interactive input prompts** for dynamic buttons
- **Edit button name and description** (✏️ pencil icon)
- Delete buttons easily (🗑️ trash icon)
- Refresh buttons from disk (🔄 refresh icon)
- Visual scope indicators:
  - **🌐 Global Commands** - Available in all projects
  - **📁 Workspace Commands** - Workspace-specific buttons
- Enhanced tooltips with descriptions and input requirements
- Inline action icons on hover

✅ **Button Persistence**
- Workspace-specific (`.vscode/devboost.json`)
- Global (VS Code state)
- Auto-reload on activation
- Stores descriptions and input field metadata

✅ **Command Execution**
- VS Code commands (single word)
- Terminal commands (multi-word, OS-specific)
- **Variable replacement**: Prompts for input and replaces placeholders
- Git workflow automation
- Multi-step commands with `&&` operators

## 🐛 Troubleshooting

### No buttons appearing?
- Make sure you have a workspace folder open
- Check if `.vscode/activity.log` exists and has content
- Try creating a custom button manually first

### Activity log empty?
- Perform some actions (save files, run commands)
- Wait a moment, then check `.vscode/activity.log`
- Terminal commands are logged when using integrated terminal

### Commands not executing?
- VS Code commands: Check spelling (e.g., `workbench.action.files.save`)
- Terminal commands: Make sure terminal is available
- Check the DevBoost output console for errors

## 📝 Notes

- **GitHub Copilot Integration**: ✅ Fully integrated using VS Code Language Model API (gpt-4o)
  - Requires GitHub Copilot subscription
  - Falls back to smart pattern-based suggestions if unavailable
- **OS Detection**: Automatically detects Windows, macOS, or Linux and generates compatible commands
- **Shell Detection**: Detects your shell (bash, zsh, PowerShell, cmd) for accurate command syntax
- **Activity Logging**: Some VS Code internal commands are not logged to avoid noise
- **Button Limit**: Suggests up to 5 AI-generated buttons per session
- **Duplicate Prevention**: AI analyzes both command structure and semantic meaning to prevent duplicates

## 🎨 Customization

### Button Format
Buttons are stored as JSON with optional descriptions and input fields:
```json
[
  {
    "name": "🔨 Build",
    "cmd": "npm run build",
    "description": "Build the project using npm"
  },
  {
    "name": "🧪 Test",
    "cmd": "npm test",
    "description": "Run all tests in the project"
  },
  {
    "name": "📝 Git Commit",
    "cmd": "git add . && git commit -m '{message}'",
    "description": "Stage all changes and commit with a custom message",
    "inputs": [
      {
        "placeholder": "Enter commit message",
        "variable": "{message}"
      }
    ]
  },
  {
    "name": "🌿 Create Branch",
    "cmd": "git checkout -b '{branchName}'",
    "description": "Create and switch to a new branch",
    "inputs": [
      {
        "placeholder": "Enter branch name",
        "variable": "{branchName}"
      }
    ]
  }
]
```

You can manually edit `.vscode/devboost.json` to customize buttons!

### Creating Buttons with Multiple Inputs
```json
{
  "name": "🔧 Custom Deploy",
  "cmd": "npm run build && scp -r dist/ {user}@{host}:/var/www/",
  "description": "Build and deploy to remote server",
  "inputs": [
    {
      "placeholder": "Enter SSH username",
      "variable": "{user}"
    },
    {
      "placeholder": "Enter server hostname",
      "variable": "{host}"
    }
  ]
}
```

### Adding Emojis
Use emojis in button names for better visual identification:
- 🔨 Build
- 🧪 Test
- 📝 Commit
- 🚀 Deploy
- 💾 Save
- 🔍 Search
- 🐛 Debug

## 🚀 Next Steps

1. Test the extension thoroughly
2. Try different project types (React, Python, etc.)
3. Create custom workflow buttons
4. Provide feedback for improvements!

Enjoy using DevBoost SmartCmd! 🎉
