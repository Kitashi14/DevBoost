# Changelog

All notable changes to the DevBoost extension will be documented in this file.

## [0.9.0] - 2026-01-20

### Added
- **Button Groups**: Organize buttons into custom groups for better navigation
  - Create groups within Global or Workspace scope
  - Add buttons to multiple groups simultaneously
  - Dedicated Group Edit Panel (🗂️ icon) for bulk operations
- **Import/Export SmartCmds**: Backup and share buttons, groups, and scripts
  - Export to zip file with choice of Global, Workspace, or both scopes
  - Import with automatic scope preservation
  - Scripts automatically organized by scope in exports
- New commands for group management (`createGroup`, `deleteGroup`, `renameGroup`, `addButtonToGroup`, `removeButtonFromGroup`, `editGroups`)
- New commands for import/export (`exportSmartCmds`, `importSmartCmds`)
- Dependencies: `adm-zip` 


## [0.8.4] - Previous Release

### Initial Features
- SmartCmd automation buttons (global and workspace scopes)
- AI-powered button creation and suggestions
- Manual button creation with custom commands
- Script support for multi-step commands
- Input fields for dynamic command variables
- Bulk edit operations
- Activity logging and command tracking
- Prompt Enhancer for improving AI prompts
- Multi-provider AI support (Copilot, Gemini, OpenAI, Anthropic, Ollama)

---