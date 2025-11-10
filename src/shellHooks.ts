// Shell Hooks Module - Install shell hooks for advanced terminal tracking
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CustomDialog } from './commonView/customDialog';

/**
 * Detect which shell the user is using
 */
async function detectShell(): Promise<{ shell: string; configFile: string } | null> {
	const shellPath = process.env.SHELL || '';
	const shellName = path.basename(shellPath).toLowerCase();

	const homeDir = os.homedir();
	
	if (shellName.includes('zsh')) {
		const configFile = path.join(homeDir, '.zshrc');
		return { shell: 'zsh', configFile };
	} else if (shellName.includes('bash')) {
		// Check for .bashrc first, then .bash_profile
		const bashrc = path.join(homeDir, '.bashrc');
		const bashProfile = path.join(homeDir, '.bash_profile');
		
		try {
			await fs.access(bashrc);
			return { shell: 'bash', configFile: bashrc };
		} catch {
			return { shell: 'bash', configFile: bashProfile };
		}
	} else if (process.platform === 'win32') {
		// Windows PowerShell
		const profilePath = path.join(homeDir, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
		return { shell: 'powershell', configFile: profilePath };
	}

	return null;
}

/**
 * Generate shell hook code based on shell type
 */
function generateHookCode(shell: string, workspaceFolder: string): string {
	const logPath = path.join(workspaceFolder, '.vscode', 'devBoost', 'activity.log');
	const workspaceName = path.basename(workspaceFolder);
	
	if (shell === 'zsh') {
		// Using string concatenation to avoid TypeScript linter issues with shell script syntax
		let code = '\n';
		code += '# DevBoost Activity Tracking (Auto-generated - Do not edit manually)\n';
		code += '# This tracks commands in screen/tmux/SSH sessions (NOT in VS Code integrated terminals)\n';
		code += '# Activate if in screen/tmux/SSH, even if VSCODE_INJECTION is inherited\n';
		code += 'if [[ -n "${STY:-}${TMUX:-}" || -n "${SSH_CONNECTION:-}" ]]; then\n';
		code += `  export DEVBOOST_LOG="${logPath}"\n`;
		code += `  export DEVBOOST_WORKSPACE="${workspaceFolder}"\n`;
		code += '  \n';
		code += '  # Function to log commands after execution\n';
		code += '  devboost_log_command() {\n';
		code += '    local exit_code=$?\n';
		code += '    local cmd=$(fc -ln -1 2>/dev/null | xargs 2>/dev/null)\n';
		code += '    \n';
		code += '    # Skip empty commands and devboost\'s own logging\n';
		code += '    if [[ -n "$cmd" ]] && [[ ! "$cmd" =~ ^devboost_ ]]; then\n';
		code += '      local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")\n';
		code += '      local shell_type="${SHELL##*/}"\n';
		code += '      # Detect terminal type and extract ID/name\n';
		code += '      local terminal_id="" terminal_name=""\n';
		code += '      if [[ -n "${STY:-}" ]]; then\n';
		code += '        terminal_id="${STY}"\n';
		code += '        terminal_name="screen"\n';
		code += '      elif [[ -n "${TMUX:-}" ]]; then\n';
		code += '        terminal_id="${TMUX##*,}"\n';
		code += '        terminal_name="tmux"\n';
		code += '      elif [[ -n "${SSH_CONNECTION:-}" ]]; then\n';
		code += '        terminal_id="${SSH_TTY##*/}"\n';
		code += '        terminal_name="ssh"\n';
		code += '      fi\n';
		code += `      local context_json=$(printf '{"workspace":{"path":"%s","name":"${workspaceName}"},"terminal":{"id":"%s","name":"%s","shell":"%s","cwd":"%s"},"execution":{"exitCode":%d}}' "$DEVBOOST_WORKSPACE" "$terminal_id" "$terminal_name" "$shell_type" "$PWD" $exit_code)\n`;
		code += '      \n';
		code += '      printf "%s | Command: %s | Context: %s\\n" "$timestamp" "$cmd" "$context_json" >> "$DEVBOOST_LOG" 2>/dev/null\n';
		code += '    fi\n';
		code += '    \n';
		code += '    return $exit_code\n';
		code += '  }\n';
		code += '  \n';
		code += '  # Hook into precmd (runs before each prompt)\n';
		code += '  precmd_functions+=(devboost_log_command)\n';
		code += 'fi\n';
		code += '# End DevBoost Activity Tracking\n';
		return code;
	} else if (shell === 'bash') {
		let code = '\n';
		code += '# DevBoost Activity Tracking (Auto-generated - Do not edit manually)\n';
		code += '# This tracks commands in screen/tmux/SSH sessions (NOT in VS Code integrated terminals)\n';
		code += '# Activate if in screen/tmux/SSH, even if VSCODE_INJECTION is inherited\n';
		code += 'if [[ -n "${STY:-}${TMUX:-}" || -n "${SSH_CONNECTION:-}" ]]; then\n';
		code += `  export DEVBOOST_LOG="${logPath}"\n`;
		code += `  export DEVBOOST_WORKSPACE="${workspaceFolder}"\n`;
		code += '  \n';
		code += '  # Function to log commands after execution\n';
		code += '  devboost_log_command() {\n';
		code += '    local exit_code=$?\n';
		code += '    local cmd=$(history 1 2>/dev/null | sed \'s/^[ ]*[0-9]*[ ]*//\')\n';
		code += '    \n';
		code += '    # Skip empty commands and devboost\'s own logging\n';
		code += '    if [[ -n "$cmd" ]] && [[ ! "$cmd" =~ ^devboost_ ]]; then\n';
		code += '      local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")\n';
		code += '      local shell_type="${SHELL##*/}"\n';
		code += '      # Detect terminal type and extract ID/name\n';
		code += '      local terminal_id="" terminal_name=""\n';
		code += '      if [[ -n "${STY:-}" ]]; then\n';
		code += '        terminal_id="${STY}"\n';
		code += '        terminal_name="screen"\n';
		code += '      elif [[ -n "${TMUX:-}" ]]; then\n';
		code += '        terminal_id="${TMUX##*,}"\n';
		code += '        terminal_name="tmux"\n';
		code += '      elif [[ -n "${SSH_CONNECTION:-}" ]]; then\n';
		code += '        terminal_id="${SSH_TTY##*/}"\n';
		code += '        terminal_name="ssh"\n';
		code += '      fi\n';
		code += `      local context_json=$(printf '{"workspace":{"path":"%s","name":"${workspaceName}"},"terminal":{"id":"%s","name":"%s","shell":"%s","cwd":"%s"},"execution":{"exitCode":%d}}' "$DEVBOOST_WORKSPACE" "$terminal_id" "$terminal_name" "$shell_type" "$PWD" $exit_code)\n`;
		code += '      \n';
		code += '      printf "%s | Command: %s | Context: %s\\n" "$timestamp" "$cmd" "$context_json" >> "$DEVBOOST_LOG" 2>/dev/null\n';
		code += '    fi\n';
		code += '    \n';
		code += '    return $exit_code\n';
		code += '  }\n';
		code += '  \n';
		code += '  # Hook into PROMPT_COMMAND (runs before each prompt)\n';
		code += '  if [[ ! "${PROMPT_COMMAND:-}" =~ devboost_log_command ]]; then\n';
		code += '    PROMPT_COMMAND="devboost_log_command;${PROMPT_COMMAND:+;$PROMPT_COMMAND}"\n';
		code += '  fi\n';
		code += 'fi\n';
		code += '# End DevBoost Activity Tracking\n';
		return code;
	} else if (shell === 'powershell') {
		let code = '\n';
		code += '# DevBoost Activity Tracking (Auto-generated - Do not edit manually)\n';
		code += '# This tracks commands in PowerShell\n';
		code += '# Only activates when DEVBOOST_TRACKING is set (not in VS Code integrated terminals)\n';
		code += 'if ($env:DEVBOOST_TRACKING) {\n';
		code += `    $env:DEVBOOST_LOG = "${logPath}"\n`;
		code += `    $env:DEVBOOST_WORKSPACE = "${workspaceFolder}"\n`;
		code += '    \n';
		code += '    function DevBoost_LogCommand {\n';
		code += '        $exit_code = $LASTEXITCODE\n';
		code += '        $cmd = (Get-History -Count 1).CommandLine\n';
		code += '        \n';
		code += '        if ($cmd -and $cmd -notmatch "^DevBoost_") {\n';
		code += '            $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")\n';
		code += '            $workspace_name = Split-Path -Leaf $env:DEVBOOST_WORKSPACE\n';
		code += '            # Detect terminal type\n';
		code += '            $terminal_id = "temp"\n';
		code += '            $terminal_name = "temp-session"\n';
		code += '            if ($env:SSH_CONNECTION) {\n';
		code += '                $terminal_id = $env:SSH_TTY -replace \'.*/\', \'\'\n';
		code += '                $terminal_name = "ssh"\n';
		code += '            } elseif ($PSSenderInfo) {\n';
		code += '                $terminal_id = $PSSenderInfo.ConnectionString\n';
		code += '                $terminal_name = "remote-ps"\n';
		code += '            }\n';
		code += '            $context = "{`"workspace`":{`"path`":`"$($env:DEVBOOST_WORKSPACE -replace \'\\\\\\\\\',\'\\\\\\\\\')`",`"name`":`"$workspace_name`"},`"terminal`":{`"id`":`"$terminal_id`",`"name`":`"$terminal_name`",`"shell`":`"powershell`",`"cwd`":`"$($PWD.Path -replace \'\\\\\\\\\',\'\\\\\\\\\')`"},`"execution`":{`"exitCode`":$exit_code}}"\n';
		code += '            \n';
		code += '            "$timestamp | Command: $cmd | Context: $context" | Out-File -Append -FilePath $env:DEVBOOST_LOG -Encoding UTF8 -ErrorAction SilentlyContinue\n';
		code += '        }\n';
		code += '    }\n';
		code += '    \n';
		code += '    # Add to prompt\n';
		code += '    $null = Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock {\n';
		code += '        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()\n';
		code += '        DevBoost_LogCommand\n';
		code += '    }\n';
		code += '}\n';
		code += '# End DevBoost Activity Tracking\n';
		return code;
	}

	return '';
}

/**
 * Check if hooks are already installed
 */
async function areHooksInstalled(configFile: string): Promise<boolean> {
	try {
		const content = await fs.readFile(configFile, 'utf-8');
		return content.includes('# DevBoost Activity Tracking');
	} catch (error) {
		return false;
	}
}

/**
 * Install shell hooks into shell configuration file
 */
export async function installShellHooks(): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder open. Please open a workspace first.');
		return;
	}

	const shellInfo = await detectShell();
	
	if (!shellInfo) {
		vscode.window.showErrorMessage('Could not detect your shell. Supported shells: bash, zsh, PowerShell');
		return;
	}

	// Check if already installed
	const alreadyInstalled = await areHooksInstalled(shellInfo.configFile);
	
	if (alreadyInstalled) {
		const choice = await vscode.window.showInformationMessage(
			'DevBoost shell hooks are already installed. Would you like to reinstall them?',
			'Reinstall', 'Cancel'
		);
		
		if (choice !== 'Reinstall') {
			return;
		}
		
		// Remove old hooks before reinstalling
		await uninstallShellHooks();
	}

	// Show confirmation dialog
	const choice = await vscode.window.showInformationMessage(
		`Install DevBoost shell hooks to ${shellInfo.configFile}?\n\nThis will enable command tracking in screen/tmux/SSH sessions for the current workspace.`,
		'Install', 'Cancel'
	);

	if (choice !== 'Install') {
		return;
	}

	try {
		const hookCode = generateHookCode(shellInfo.shell, workspaceFolder.uri.fsPath);
		
		// Ensure config file exists
		try {
			await fs.access(shellInfo.configFile);
		} catch {
			// Create empty config file if it doesn't exist
			await fs.mkdir(path.dirname(shellInfo.configFile), { recursive: true });
			await fs.writeFile(shellInfo.configFile, '', 'utf-8');
		}

		// Append hooks to config file (hookCode already starts with \n)
		await fs.appendFile(shellInfo.configFile, hookCode, 'utf-8');
		
		vscode.window.showInformationMessage(
			`✅ Shell hooks installed successfully!\n\n` +
			`Hooks will automatically activate in new:\n` +
			`  • screen sessions (STY environment variable detected)\n` +
			`  • tmux sessions (TMUX environment variable detected)\n` +
			`  • SSH sessions (SSH_CONNECTION detected)\n\n` +
			`⚠️ For already running screen/tmux sessions:\n` +
			`   • Restart the session, OR\n` +
			`   • Inside that session, use: "SmartCmd: Enable Tracking in Current Session"`,
			'Open Config File'
		).then(selection => {
			if (selection === 'Open Config File') {
				vscode.window.showTextDocument(vscode.Uri.file(shellInfo.configFile));
			}
		});

		console.log(`DevBoost: Shell hooks installed to ${shellInfo.configFile}`);
		
	} catch (error) {
		console.error('DevBoost: Error installing shell hooks:', error);
		vscode.window.showErrorMessage(`Failed to install shell hooks: ${error}`);
	}
}

/**
 * Uninstall shell hooks from shell configuration file
 */
export async function uninstallShellHooks(): Promise<void> {
	const shellInfo = await detectShell();
	
	if (!shellInfo) {
		vscode.window.showErrorMessage('Could not detect your shell.');
		return;
	}

	try {
		const content = await fs.readFile(shellInfo.configFile, 'utf-8');
		
		// Check if hooks are installed
		if (!content.includes('# DevBoost Activity Tracking')) {
			vscode.window.showInformationMessage('DevBoost shell hooks are not installed.');
			return;
		}

		// Show confirmation dialog
		const choice = await vscode.window.showWarningMessage(
			`Remove DevBoost shell hooks from ${shellInfo.configFile}?`,
			'Remove', 'Cancel'
		);

		if (choice !== 'Remove') {
			return;
		}

		// Remove hooks section
		const hookStartMarker = '# DevBoost Activity Tracking (Auto-generated - Do not edit manually)';
		const hookEndMarker = '# End DevBoost Activity Tracking';
		
		const lines = content.split('\n');
		const newLines: string[] = [];
		let inHooksSection = false;
		let skipNextEmptyLine = false;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			if (line.includes(hookStartMarker)) {
				inHooksSection = true;
				// Remove preceding empty line if it exists
				if (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
					newLines.pop();
				}
				continue;
			}
			if (line.includes(hookEndMarker)) {
				inHooksSection = false;
				skipNextEmptyLine = true; // Skip the empty line after the end marker
				continue;
			}
			if (!inHooksSection) {
				// Skip one empty line after hooks section
				if (skipNextEmptyLine && line.trim() === '') {
					skipNextEmptyLine = false;
					continue;
				}
				newLines.push(line);
			}
		}

		// Write back without hooks
		await fs.writeFile(shellInfo.configFile, newLines.join('\n'), 'utf-8');
		
		vscode.window.showInformationMessage(
			'✅ Shell hooks removed successfully! Restart your sessions or reload shell config inside the sessions for changes to take effect.',
			'Open Config File'
		).then(selection => {
			if (selection === 'Open Config File') {
				vscode.window.showTextDocument(vscode.Uri.file(shellInfo.configFile));
			}
		});

		console.log(`DevBoost: Shell hooks removed from ${shellInfo.configFile}`);
		
	} catch (error) {
		console.error('DevBoost: Error uninstalling shell hooks:', error);
		vscode.window.showErrorMessage(`Failed to remove shell hooks: ${error}`);
	}
}

/**
 * Generate inline hook code for temporary session (no config file modification)
 * For testing purposes only - not recommended for production use
 */
function generateInlineHookCode(shell: string, logPath: string, workspacePath: string): string {
	const workspaceName = path.basename(workspacePath);
	
	if (shell === 'zsh') {
		// Compact script with formatted output messages
		let code = '';
		code += `if [[ -n "\${STY:-}\${TMUX:-}" || -n "\${SSH_CONNECTION:-}" ]]; then `;
		code += `if [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]] && [[ "\${DEVBOOST_WORKSPACE:-}" == "${workspacePath}" ]]; then `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is already enabled in this session for this workspace(${workspaceName})."; `;
		code += `elif [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]]; then `;
		code += `local current_workspace_name=\$(basename "\${DEVBOOST_WORKSPACE}"); `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is already enabled for workspace: \${current_workspace_name}"; `;
		code += `echo ""; echo "   Current tracking workspace: \${DEVBOOST_WORKSPACE}"; `;
		code += `echo "   Requested workspace: ${workspacePath}"; `;
		code += `echo ""; read -q "?   Switch to new workspace? (y/N): "; local switch_response=$?; echo; `;
		code += `if [[ \$switch_response -eq 0 ]]; then `;
		code += `precmd_functions=("\${(@)precmd_functions:#devboost_log_command}"); `;
		code += `unset -f devboost_log_command 2>/dev/null; `;
		code += `export DEVBOOST_LOG="${logPath}"; `;
		code += `export DEVBOOST_WORKSPACE="${workspacePath}"; `;
		code += `devboost_log_command() { `;
		code += `local exit_code=$?; `;
		code += `local cmd=$(fc -ln -1 2>/dev/null | xargs 2>/dev/null); `;
		code += `if [[ -n "$cmd" ]] && [[ ! "$cmd" =~ ^devboost_ ]] && [[ ! "$cmd" =~ ^export ]]; then `;
		code += `local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"); `;
		code += `local shell_type="\${SHELL##*/}"; `;
		code += `local terminal_id="" terminal_name=""; `;
		code += `if [[ -n "\${STY:-}" ]]; then terminal_id="\${STY}"; terminal_name="screen"; `;
		code += `elif [[ -n "\${TMUX:-}" ]]; then terminal_id="\${TMUX##*,}"; terminal_name="tmux"; `;
		code += `elif [[ -n "\${SSH_CONNECTION:-}" ]]; then terminal_id="\${SSH_TTY##*/}"; terminal_name="ssh"; `;
		code += `else terminal_id="temp"; terminal_name="temp-session"; fi; `;
		code += `local context_json=$(printf '{"workspace":{"path":"%s","name":"${workspaceName}"},"terminal":{"id":"%s","name":"%s","shell":"%s","cwd":"%s"},"execution":{"exitCode":%d}}' "$DEVBOOST_WORKSPACE" "$terminal_id" "$terminal_name" "$shell_type" "$PWD" $exit_code); `;
		code += `printf "%s | Command: %s | Context: %s\\n" "$timestamp" "$cmd" "$context_json" >> "$DEVBOOST_LOG" 2>/dev/null; `;
		code += `fi; `;
		code += `return $exit_code; `;
		code += `}; `;
		code += `precmd_functions+=(devboost_log_command); `;
		code += `echo ""; echo "✅ DevBoost tracking switched to workspace: ${workspaceName}"; `;
		code += `else echo ""; echo "❌ Cancelled. Keeping tracking for workspace: \${current_workspace_name}"; fi; `;
		code += `else `;
		code += `export DEVBOOST_TRACKING_ENABLED=1; `;
		code += `export DEVBOOST_LOG="${logPath}"; `;
		code += `export DEVBOOST_WORKSPACE="${workspacePath}"; `;
		code += `devboost_log_command() { `;
		code += `local exit_code=$?; `;
		code += `local cmd=$(fc -ln -1 2>/dev/null | xargs 2>/dev/null); `;
		code += `if [[ -n "$cmd" ]] && [[ ! "$cmd" =~ ^devboost_ ]] && [[ ! "$cmd" =~ ^export ]]; then `;
		code += `local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"); `;
		code += `local shell_type="\${SHELL##*/}"; `;
		code += `local terminal_id="" terminal_name=""; `;
		code += `if [[ -n "\${STY:-}" ]]; then terminal_id="\${STY}"; terminal_name="screen"; `;
		code += `elif [[ -n "\${TMUX:-}" ]]; then terminal_id="\${TMUX##*,}"; terminal_name="tmux"; `;
		code += `elif [[ -n "\${SSH_CONNECTION:-}" ]]; then terminal_id="\${SSH_TTY##*/}"; terminal_name="ssh"; `;
		code += `else terminal_id="temp"; terminal_name="temp-session"; fi; `;
		code += `local context_json=$(printf '{"workspace":{"path":"%s","name":"${workspaceName}"},"terminal":{"id":"%s","name":"%s","shell":"%s","cwd":"%s"},"execution":{"exitCode":%d}}' "$DEVBOOST_WORKSPACE" "$terminal_id" "$terminal_name" "$shell_type" "$PWD" $exit_code); `;
		code += `printf "%s | Command: %s | Context: %s\\n" "$timestamp" "$cmd" "$context_json" >> "$DEVBOOST_LOG" 2>/dev/null; `;
		code += `fi; `;
		code += `return $exit_code; `;
		code += `}; `;
		code += `precmd_functions+=(devboost_log_command); `;
		code += `echo ""; echo ""; echo "✅ DevBoost tracking enabled in this terminal session for this workspace(${workspaceName})"; `;
		code += `fi; `;
		code += `else `;
		code += `echo ""; echo ""; `;
		code += `echo "⚠️  Warning: This terminal is not running inside a non-VSCode session (screen/tmux/SSH)."; `;
		code += `echo ""; `;
		code += `echo "   Tracking hooks are designed for:"; `;
		code += `echo "     • screen sessions (STY environment variable)"; `;
		code += `echo "     • tmux sessions (TMUX environment variable)"; `;
		code += `echo "     • SSH sessions (SSH_CONNECTION environment variable)"; `;
		code += `echo ""; `;
		code += `echo "   Please enter your screen/tmux/SSH session first, then use this feature again."; `;
		code += `fi`;
		return code;
	} else if (shell === 'bash') {
		// Compact script with formatted output messages
		let code = '';
		code += `if [[ -n "\${STY:-}\${TMUX:-}" || -n "\${SSH_CONNECTION:-}" ]]; then `;
		code += `if [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]] && [[ "\${DEVBOOST_WORKSPACE:-}" == "${workspacePath}" ]]; then `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is already enabled in this session for this workspace(${workspaceName})."; `;
		code += `elif [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]]; then `;
		code += `local current_workspace_name=\$(basename "\${DEVBOOST_WORKSPACE}"); `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is already enabled for workspace: \${current_workspace_name}"; `;
		code += `echo ""; echo "   Current tracking workspace: \${DEVBOOST_WORKSPACE}"; `;
		code += `echo "   Requested workspace: ${workspacePath}"; `;
		code += `echo ""; read -p "   Switch to new workspace? (y/N): " -n 1 -r; echo; `;
		code += `if [[ \$REPLY =~ ^[Yy]$ ]]; then `;
		code += `PROMPT_COMMAND="\${PROMPT_COMMAND//devboost_log_command;/}"; `;
		code += `PROMPT_COMMAND="\${PROMPT_COMMAND//;devboost_log_command/}"; `;
		code += `PROMPT_COMMAND="\${PROMPT_COMMAND//devboost_log_command/}"; `;
		code += `unset -f devboost_log_command 2>/dev/null; `;
		code += `export DEVBOOST_LOG="${logPath}"; `;
		code += `export DEVBOOST_WORKSPACE="${workspacePath}"; `;
		code += `devboost_log_command() { `;
		code += `local exit_code=$?; `;
		code += `local cmd=$(history 1 2>/dev/null | sed 's/^[ ]*[0-9]*[ ]*//'); `;
		code += `if [[ -n "$cmd" ]] && [[ ! "$cmd" =~ ^devboost_ ]] && [[ ! "$cmd" =~ ^export ]]; then `;
		code += `local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"); `;
		code += `local shell_type="\${SHELL##*/}"; `;
		code += `local terminal_id="" terminal_name=""; `;
		code += `if [[ -n "\${STY:-}" ]]; then terminal_id="\${STY}"; terminal_name="screen"; `;
		code += `elif [[ -n "\${TMUX:-}" ]]; then terminal_id="\${TMUX##*,}"; terminal_name="tmux"; `;
		code += `elif [[ -n "\${SSH_CONNECTION:-}" ]]; then terminal_id="\${SSH_TTY##*/}"; terminal_name="ssh"; `;
		code += `else terminal_id="temp"; terminal_name="temp-session"; fi; `;
		code += `local context_json=$(printf '{"workspace":{"path":"%s","name":"${workspaceName}"},"terminal":{"id":"%s","name":"%s","shell":"%s","cwd":"%s"},"execution":{"exitCode":%d}}' "$DEVBOOST_WORKSPACE" "$terminal_id" "$terminal_name" "$shell_type" "$PWD" $exit_code); `;
		code += `printf "%s | Command: %s | Context: %s\\n" "$timestamp" "$cmd" "$context_json" >> "$DEVBOOST_LOG" 2>/dev/null; `;
		code += `fi; `;
		code += `return $exit_code; `;
		code += `}; `;
		code += `if [[ ! "\${PROMPT_COMMAND:-}" =~ devboost_log_command ]]; then `;
		code += `PROMPT_COMMAND="devboost_log_command;\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"; `;
		code += `fi; `;
		code += `echo ""; echo "✅ DevBoost tracking switched to workspace: ${workspaceName}"; `;
		code += `else echo ""; echo "❌ Cancelled. Keeping tracking for workspace: \${current_workspace_name}"; fi; `;
		code += `else `;
		code += `export DEVBOOST_TRACKING_ENABLED=1; `;
		code += `export DEVBOOST_LOG="${logPath}"; `;
		code += `export DEVBOOST_WORKSPACE="${workspacePath}"; `;
		code += `devboost_log_command() { `;
		code += `local exit_code=$?; `;
		code += `local cmd=$(history 1 2>/dev/null | sed 's/^[ ]*[0-9]*[ ]*//'); `;
		code += `if [[ -n "$cmd" ]] && [[ ! "$cmd" =~ ^devboost_ ]] && [[ ! "$cmd" =~ ^export ]]; then `;
		code += `local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"); `;
		code += `local shell_type="\${SHELL##*/}"; `;
		code += `local terminal_id="" terminal_name=""; `;
		code += `if [[ -n "\${STY:-}" ]]; then terminal_id="\${STY}"; terminal_name="screen"; `;
		code += `elif [[ -n "\${TMUX:-}" ]]; then terminal_id="\${TMUX##*,}"; terminal_name="tmux"; `;
		code += `elif [[ -n "\${SSH_CONNECTION:-}" ]]; then terminal_id="\${SSH_TTY##*/}"; terminal_name="ssh"; `;
		code += `else terminal_id="temp"; terminal_name="temp-session"; fi; `;
		code += `local context_json=$(printf '{"workspace":{"path":"%s","name":"${workspaceName}"},"terminal":{"id":"%s","name":"%s","shell":"%s","cwd":"%s"},"execution":{"exitCode":%d}}' "$DEVBOOST_WORKSPACE" "$terminal_id" "$terminal_name" "$shell_type" "$PWD" $exit_code); `;
		code += `printf "%s | Command: %s | Context: %s\\n" "$timestamp" "$cmd" "$context_json" >> "$DEVBOOST_LOG" 2>/dev/null; `;
		code += `fi; `;
		code += `return $exit_code; `;
		code += `}; `;
		code += `if [[ ! "\${PROMPT_COMMAND:-}" =~ devboost_log_command ]]; then `;
		code += `PROMPT_COMMAND="devboost_log_command;\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"; `;
		code += `fi; `;
		code += `echo ""; echo ""; echo "✅ DevBoost tracking enabled in this terminal session for this workspace(${workspaceName})"; `;
		code += `fi; `;
		code += `else `;
		code += `echo ""; echo ""; `;
		code += `echo "⚠️  Warning: This terminal is not running inside a non-VSCode session (screen/tmux/SSH)."; `;
		code += `echo ""; `;
		code += `echo "   Tracking hooks are designed for:"; `;
		code += `echo "     • screen sessions (STY environment variable)"; `;
		code += `echo "     • tmux sessions (TMUX environment variable)"; `;
		code += `echo "     • SSH sessions (SSH_CONNECTION environment variable)"; `;
		code += `echo ""; `;
		code += `echo "   Please enter your screen/tmux/SSH session first, then use this feature again."; `;
		code += `fi`;
		return code;
	} else if (shell === 'powershell') {
		// Compact script with formatted output messages
		let code = '';
		code += `if ($env:SSH_CONNECTION -or $PSSenderInfo) { `;
		code += `if ($env:DEVBOOST_TRACKING_ENABLED -and $env:DEVBOOST_WORKSPACE -eq "${workspacePath}") { `;
		code += `Write-Host ""; Write-Host ""; Write-Host "⚠️  DevBoost tracking is already enabled in this session for this workspace(${workspaceName})." -ForegroundColor Yellow; `;
		code += `} elseif ($env:DEVBOOST_TRACKING_ENABLED) { `;
		code += `$current_workspace_name = Split-Path -Leaf $env:DEVBOOST_WORKSPACE; `;
		code += `Write-Host ""; Write-Host ""; Write-Host "⚠️  DevBoost tracking is already enabled for workspace: $current_workspace_name" -ForegroundColor Yellow; `;
		code += `Write-Host ""; Write-Host "   Current tracking workspace: $env:DEVBOOST_WORKSPACE" -ForegroundColor Yellow; `;
		code += `Write-Host "   Requested workspace: ${workspacePath}" -ForegroundColor Yellow; `;
		code += `Write-Host ""; $switch = Read-Host "   Switch to new workspace? (y/N)"; `;
		code += `if ($switch -match "^[Yy]$") { `;
		code += `Remove-PSReadLineKeyHandler -Chord Enter; `;
		code += `Remove-Item Function:DevBoost_LogCommand -ErrorAction SilentlyContinue; `;
		code += `$env:DEVBOOST_LOG="${logPath}"; `;
		code += `$env:DEVBOOST_WORKSPACE="${workspacePath}"; `;
		code += `function DevBoost_LogCommand { `;
		code += `$exit_code = $LASTEXITCODE; `;
		code += `$cmd = (Get-History -Count 1).CommandLine; `;
		code += `if ($cmd -and $cmd -notmatch "^DevBoost_" -and $cmd -notmatch "^\\$env:") { `;
		code += `$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); `;
		code += `$workspace_name = Split-Path -Leaf $env:DEVBOOST_WORKSPACE; `;
		code += `$terminal_id = "temp"; $terminal_name = "temp-session"; `;
		code += `if ($env:SSH_CONNECTION) { $terminal_id = $env:SSH_TTY -replace '.*/', ''; $terminal_name = "ssh" } `;
		code += `elseif ($PSSenderInfo) { $terminal_id = $PSSenderInfo.ConnectionString; $terminal_name = "remote-ps" }; `;
		code += `$context = "{\\"workspace\\":{\\"path\\":\\"$($env:DEVBOOST_WORKSPACE -replace '\\\\\\\\\\\\\\\\','\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')\",\\"name\\":\\"$workspace_name\\"},\\"terminal\\":{\\"id\\":\\"$terminal_id\\",\\"name\\":\\"$terminal_name\\",\\"shell\\":\\"powershell\\",\\"cwd\\":\\"$($PWD.Path -replace '\\\\\\\\\\\\\\\\','\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')\"},\\"execution\\":{\\"exitCode\\":$exit_code}}"; `;
		code += `"$timestamp | Command: $cmd | Context: $context" | Out-File -Append -FilePath $env:DEVBOOST_LOG -Encoding UTF8 -ErrorAction SilentlyContinue; `;
		code += `} }; `;
		code += `$null = Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock { [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine(); DevBoost_LogCommand }; `;
		code += `Write-Host ""; Write-Host "✅ DevBoost tracking switched to workspace: ${workspaceName}"; `;
		code += `} else { Write-Host ""; Write-Host "❌ Cancelled. Keeping tracking for workspace: $current_workspace_name" -ForegroundColor Yellow; }; `;
		code += `} else { `;
		code += `$env:DEVBOOST_TRACKING_ENABLED=1; `;
		code += `$env:DEVBOOST_LOG="${logPath}"; `;
		code += `$env:DEVBOOST_WORKSPACE="${workspacePath}"; `;
		code += `function DevBoost_LogCommand { `;
		code += `$exit_code = $LASTEXITCODE; `;
		code += `$cmd = (Get-History -Count 1).CommandLine; `;
		code += `if ($cmd -and $cmd -notmatch "^DevBoost_" -and $cmd -notmatch "^\\$env:") { `;
		code += `$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"); `;
		code += `$workspace_name = Split-Path -Leaf $env:DEVBOOST_WORKSPACE; `;
		code += `$terminal_id = "temp"; $terminal_name = "temp-session"; `;
		code += `if ($env:SSH_CONNECTION) { $terminal_id = $env:SSH_TTY -replace '.*/', ''; $terminal_name = "ssh" } `;
		code += `elseif ($PSSenderInfo) { $terminal_id = $PSSenderInfo.ConnectionString; $terminal_name = "remote-ps" }; `;
		code += `$context = "{\\"workspace\\":{\\"path\\":\\"$($env:DEVBOOST_WORKSPACE -replace '\\\\\\\\\\\\\\\\','\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')\",\\"name\\":\\"$workspace_name\\"},\\"terminal\\":{\\"id\\":\\"$terminal_id\\",\\"name\\":\\"$terminal_name\\",\\"shell\\":\\"powershell\\",\\"cwd\\":\\"$($PWD.Path -replace '\\\\\\\\\\\\\\\\','\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\')\"},\\"execution\\":{\\"exitCode\\":$exit_code}}"; `;
		code += `"$timestamp | Command: $cmd | Context: $context" | Out-File -Append -FilePath $env:DEVBOOST_LOG -Encoding UTF8 -ErrorAction SilentlyContinue; `;
		code += `} }; `;
		code += `$null = Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock { [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine(); DevBoost_LogCommand }; `;
		code += `Write-Host ""; Write-Host ""; Write-Host "✅ DevBoost tracking enabled in this terminal session for this workspace(${workspaceName})"; `;
		code += `}; `;
		code += `} else { `;
		code += `Write-Host ""; Write-Host ""; `;
		code += `Write-Host "⚠️  Warning: This terminal is not running inside a non-VSCode session (SSH/Remote PowerShell)." -ForegroundColor Yellow; `;
		code += `Write-Host ""; `;
		code += `Write-Host "   Tracking hooks are designed for:" -ForegroundColor Yellow; `;
		code += `Write-Host "     • SSH sessions (SSH_CONNECTION environment variable)" -ForegroundColor Yellow; `;
		code += `Write-Host "     • Remote PowerShell sessions (PSSenderInfo)" -ForegroundColor Yellow; `;
		code += `Write-Host ""; `;
		code += `Write-Host "   Please enter your SSH/Remote PowerShell session first, then use this feature again." -ForegroundColor Yellow; `;
		code += `}`;
		return code;
	}
	
	return '';
}

/**
 * Generate inline disable script for current session
 */
function generateInlineDisableCode(shell: string, workspacePath: string): string {
	const workspaceName = path.basename(workspacePath);
	
	if (shell === 'zsh') {
		let code = '';
		code += `if [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]] && [[ "\${DEVBOOST_WORKSPACE:-}" == "${workspacePath}" ]]; then `;
		code += `precmd_functions=("\${(@)precmd_functions:#devboost_log_command}"); `;
		code += `unset -f devboost_log_command; `;
		code += `unset DEVBOOST_TRACKING_ENABLED; `;
		code += `unset DEVBOOST_LOG; `;
		code += `unset DEVBOOST_WORKSPACE; `;
		code += `echo ""; echo ""; echo "✅ DevBoost tracking disabled for this workspace(${workspaceName})"; `;
		code += `elif [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]]; then `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is enabled but for a different workspace."; `;
		code += `echo "   Current tracking workspace: \${DEVBOOST_WORKSPACE}"; `;
		code += `echo "   Requested workspace: ${workspacePath}"; `;
		code += `echo "";`;
		code += `echo "   Go to ${workspaceName} workspace to disable tracking there."; `;
		code += `else `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is not enabled in this session."; `;
		code += `fi`;
		return code;
	} else if (shell === 'bash') {
		let code = '';
		code += `if [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]] && [[ "\${DEVBOOST_WORKSPACE:-}" == "${workspacePath}" ]]; then `;
		code += `PROMPT_COMMAND="\${PROMPT_COMMAND//devboost_log_command;/}"; `;
		code += `PROMPT_COMMAND="\${PROMPT_COMMAND//;devboost_log_command/}"; `;
		code += `PROMPT_COMMAND="\${PROMPT_COMMAND//devboost_log_command/}"; `;
		code += `unset -f devboost_log_command; `;
		code += `unset DEVBOOST_TRACKING_ENABLED; `;
		code += `unset DEVBOOST_LOG; `;
		code += `unset DEVBOOST_WORKSPACE; `;
		code += `echo ""; echo ""; echo "✅ DevBoost tracking disabled for this workspace(${workspaceName})"; `;
		code += `elif [[ -n "\${DEVBOOST_TRACKING_ENABLED:-}" ]]; then `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is enabled but for a different workspace."; `;
		code += `echo "   Current tracking workspace: \${DEVBOOST_WORKSPACE}"; `;
		code += `echo "   Requested workspace: ${workspacePath}"; `;
		code += `echo ""; `;
		code += `echo "   Go to ${workspaceName} workspace to disable tracking there."; `;
		code += `else `;
		code += `echo ""; echo ""; echo "⚠️  DevBoost tracking is not enabled in this session."; `;
		code += `fi`;
		return code;
	} else if (shell === 'powershell') {
		let code = '';
		code += `if ($env:DEVBOOST_TRACKING_ENABLED -and $env:DEVBOOST_WORKSPACE -eq "${workspacePath}") { `;
		code += `Remove-PSReadLineKeyHandler -Chord Enter; `;
		code += `Set-PSReadLineKeyHandler -Chord Enter -Function AcceptLine; `;
		code += `Remove-Item Function:DevBoost_LogCommand -ErrorAction SilentlyContinue; `;
		code += `Remove-Item env:DEVBOOST_TRACKING_ENABLED; `;
		code += `Remove-Item env:DEVBOOST_LOG; `;
		code += `Remove-Item env:DEVBOOST_WORKSPACE; `;
		code += `Write-Host ""; Write-Host ""; Write-Host "✅ DevBoost tracking disabled for this workspace(${workspaceName})"; `;
		code += `} elseif ($env:DEVBOOST_TRACKING_ENABLED) { `;
		code += `Write-Host ""; Write-Host ""; Write-Host "⚠️  DevBoost tracking is enabled but for a different workspace." -ForegroundColor Yellow; `;
		code += `Write-Host "   Current tracking workspace: $env:DEVBOOST_WORKSPACE" -ForegroundColor Yellow; `;
		code += `Write-Host "   Requested workspace: ${workspacePath}" -ForegroundColor Yellow; `;
		code += `Write-Host ""; `;
		code += `Write-Host "   Go to ${workspaceName} workspace to disable tracking there."; `;
		code += `} else { `;
		code += `Write-Host ""; Write-Host ""; Write-Host "⚠️  DevBoost tracking is not enabled in this session." -ForegroundColor Yellow; `;
		code += `}`;
		return code;
	}
	
	return '';
}

/**
 * Enable tracking in current terminal session (temporary, no config modification)
 * This injects hooks directly into the current session without modifying config files
 */
export async function enableTrackingInCurrentSession(): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder open.');
		return;
	}

	const shellInfo = await detectShell();
	
	if (!shellInfo) {
		vscode.window.showErrorMessage('Could not detect your shell. Supported shells: bash, zsh, PowerShell');
		return;
	}

	const sessionTypesSupported = shellInfo.shell === 'zsh' || shellInfo.shell === 'bash' ? "screen/tmux/SSH" : "SSH/Remote_PowerShell";


	const logPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'devBoost', 'activity.log');

	const confirmationMessage = `This feature will enable DevBoost command tracking in Non-VScode terminal sessions like ${sessionTypesSupported}. VScode terminal sessions are already tracked automatically.

Tracking will be enabled for workspace: ${workspaceFolder.name} 
Workspace path: ${workspaceFolder.uri.fsPath}

Before proceeding MAKE SURE: 

1. To enter into the Non-VScode terminal session. Open a terminal in this workspace, then enter into your ${sessionTypesSupported} session from there.
2. No process is running inside the Non-VScode session that could be affect environment variable changes.`;
	

	const choice = await CustomDialog.show({
		title: 'Enable Tracking in Non-VScode Terminal Session',
		message: confirmationMessage,
		buttons: [
			{ label: 'Proceed', id: 'Proceed', isPrimary: true },
			{ label: 'Cancel', id: 'Cancel' }
		],
		markdown: false
	});

	if( choice !== 'Proceed') {
		return;
	}

	// Get the active terminal
	const terminal = vscode.window.activeTerminal;

	if(!terminal) {
		vscode.window.showErrorMessage('No active terminal found.');
		return;
	}
	
	// Generate and inject inline hook code directly into the terminal
	const inlineHookCode = generateInlineHookCode(shellInfo.shell, logPath, workspaceFolder.uri.fsPath);
	
	if (inlineHookCode) {
		terminal.sendText(inlineHookCode, true);
	}
}

/**
 * Disable tracking in current terminal session
 * This removes hooks from the current session for the current workspace only
 */
export async function disableTrackingInCurrentSession(): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('No workspace folder open.');
		return;
	}

	const shellInfo = await detectShell();
	
	if (!shellInfo) {
		vscode.window.showErrorMessage('Could not detect your shell. Supported shells: bash, zsh, PowerShell');
		return;
	}

	const sessionTypesSupported = shellInfo.shell === 'zsh' || shellInfo.shell === 'bash' ? "screen/tmux/SSH" : "SSH/Remote_PowerShell";

	const confirmationMessage = `This will disable DevBoost command tracking in the Non-VScode terminal session like ${sessionTypesSupported}.

Tracking will be disabled for workspace: ${workspaceFolder.name}
Workspace path: ${workspaceFolder.uri.fsPath}

Before proceeding, MAKE SURE:

1. To enter into the Non-VScode terminal session. Open a terminal in this workspace, then enter into your ${sessionTypesSupported} session from there.
4. No process is running inside the session that could be affect environment variable changes.`;

	const choice = await CustomDialog.show({
		title: 'Disable Non-VScode Terminal Session Tracking',
		message: confirmationMessage,
		buttons: [
			{ label: 'Disable', id: 'Disable', isPrimary: true },
			{ label: 'Cancel', id: 'Cancel' }
		],
		markdown: false
	});

	if (choice !== 'Disable') {
		return;
	}

	// Get the active terminal
	const terminal = vscode.window.activeTerminal;

	if (!terminal) {
		vscode.window.showErrorMessage('No active terminal found.');
		return;
	}
	
	// Generate and inject inline disable code directly into the terminal
	const inlineDisableCode = generateInlineDisableCode(shellInfo.shell, workspaceFolder.uri.fsPath);
	
	if (inlineDisableCode) {
		terminal.sendText(inlineDisableCode, true);
	}
}

/**
 * Check hook installation status
 */
export async function checkHooksStatus(): Promise<void> {
	const shellInfo = await detectShell();
	
	if (!shellInfo) {
		vscode.window.showInformationMessage('Could not detect your shell. Supported: bash, zsh, PowerShell');
		return;
	}

	const installed = await areHooksInstalled(shellInfo.configFile);
	
	if (installed) {
		vscode.window.showInformationMessage(
			`✅ DevBoost shell hooks are installed in ${shellInfo.configFile}\n\n` +
			`Commands in screen/tmux/SSH sessions are being tracked.`,
			'Open Config File', 'Uninstall Hooks'
		).then(selection => {
			if (selection === 'Open Config File') {
				vscode.window.showTextDocument(vscode.Uri.file(shellInfo.configFile));
			} else if (selection === 'Uninstall Hooks') {
				uninstallShellHooks();
			}
		});
	} else {
		vscode.window.showInformationMessage(
			`❌ DevBoost shell hooks are not installed.\n\n` +
			`Install hooks to track commands in screen/tmux/SSH sessions.`,
			'Install Hooks'
		).then(selection => {
			if (selection === 'Install Hooks') {
				installShellHooks();
			}
		});
	}
}
