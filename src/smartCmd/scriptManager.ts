// Script Management Module - Handles script file operations for buttons
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { smartCmdButton, InputField } from './treeProvider';

/**
 * Get the scripts directory path based on scope
 */
export function getScriptsDir(scope: 'workspace' | 'global', globalStoragePath?: string): string | null {
	if (scope === 'workspace') {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			return null;
		}
		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
		return path.join(workspaceRoot, '.vscode', 'devBoost', 'scripts');
	} else {
		if (!globalStoragePath) {
			return null;
		}
		return path.join(globalStoragePath, 'scripts');
	}
}

/**
 * Generate a unique script filename from button name
 */
export function generateScriptFileName(buttonName: string, existingFiles: string[] = []): string {
	// Sanitize button name for filename
	let baseName = buttonName
		.replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
		.replace(/\s+/g, '_')      // Replace spaces with underscores
		.toLowerCase();
	
	if (!baseName || baseName.length === 0) {
		baseName = 'script';
	}
	
	// Determine shell extension based on OS
	const isWindows = process.platform === 'win32';
	const extension = isWindows ? '.bat' : '.sh';
	
	let filename = `${baseName}${extension}`;
	let counter = 1;
	
	// Ensure uniqueness
	while (existingFiles.includes(filename)) {
		filename = `${baseName}_${counter}${extension}`;
		counter++;
	}
	
	return filename;
}

/**
 * Save script content to file
 */
export async function saveScript(
	scriptContent: string,
	scriptFileName: string,
	scope: 'workspace' | 'global',
	globalStoragePath?: string
): Promise<string | null> {
	const scriptsDir = getScriptsDir(scope, globalStoragePath);
	if (!scriptsDir) {
		console.error('DevBoost: Cannot determine scripts directory');
		return null;
	}
	
	try {
		// Ensure scripts directory exists
		await fs.mkdir(scriptsDir, { recursive: true });
		
		const scriptPath = path.join(scriptsDir, scriptFileName);
		
		// Write script content
		await fs.writeFile(scriptPath, scriptContent, { encoding: 'utf-8' });
		
		// Make script executable on Unix-like systems
		if (process.platform !== 'win32') {
			try {
				await fs.chmod(scriptPath, 0o755); // rwxr-xr-x
			} catch (chmodError) {
				console.warn('DevBoost: Could not make script executable:', chmodError);
			}
		}
		
		console.log(`DevBoost: Saved script to ${scriptPath}`);
		return scriptPath;
	} catch (error) {
		console.error('DevBoost: Error saving script:', error);
		return null;
	}
}

/**
 * Read script content from file
 */
export async function readScript(
	scriptFileName: string,
	scope: 'workspace' | 'global',
	globalStoragePath?: string
): Promise<string | null> {
	const scriptsDir = getScriptsDir(scope, globalStoragePath);
	if (!scriptsDir) {
		return null;
	}
	
	try {
		const scriptPath = path.join(scriptsDir, scriptFileName);
		const content = await fs.readFile(scriptPath, 'utf-8');
		return content;
	} catch (error) {
		console.error('DevBoost: Error reading script:', error);
		return null;
	}
}

/**
 * Delete script file
 */
export async function deleteScript(
	scriptFileName: string,
	scope: 'workspace' | 'global',
	globalStoragePath?: string
): Promise<boolean> {
	const scriptsDir = getScriptsDir(scope, globalStoragePath);
	if (!scriptsDir) {
		return false;
	}
	
	try {
		const scriptPath = path.join(scriptsDir, scriptFileName);
		await fs.unlink(scriptPath);
		console.log(`DevBoost: Deleted script ${scriptPath}`);
		return true;
	} catch (error) {
		console.error('DevBoost: Error deleting script:', error);
		return false;
	}
}

/**
 * List all script files in directory
 */
export async function listScripts(
	scope: 'workspace' | 'global',
	globalStoragePath?: string
): Promise<string[]> {
	const scriptsDir = getScriptsDir(scope, globalStoragePath);
	if (!scriptsDir) {
		return [];
	}
	
	try {
		// Check if directory exists
		await fs.access(scriptsDir);
		const files = await fs.readdir(scriptsDir);
		return files.filter(f => f.endsWith('.sh') || f.endsWith('.bat'));
	} catch (error) {
		// Directory doesn't exist or error reading
		return [];
	}
}

/**
 * Generate command to execute the script based on OS
 */
export function generateScriptCommand(
	scriptFileName: string,
	scope: 'workspace' | 'global',
	execDir?: string,
	globalStoragePath?: string,
	inputs?: InputField[]
): string {
	const scriptsDir = getScriptsDir(scope, globalStoragePath);
	if (!scriptsDir) {
		return '';
	}
	
	const scriptPath = path.join(scriptsDir, scriptFileName);
	const isWindows = process.platform === 'win32';
	
	// Build base command
	let command: string;
	if (isWindows) {
		// Windows: Just call the batch file
		command = `"${scriptPath}"`;
	} else {
		// Unix: Execute the script directly (shebang will handle interpreter selection)
		// Since script has #!/usr/bin/env bash, just make it executable and run it
		command = `"${scriptPath}"`;
	}
	
	// Append input variable placeholders if present
	if (inputs && inputs.length > 0) {
		const placeholders = inputs.map(input => input.variable).join(' ');
		command = `${command} ${placeholders}`;
	}
	
	return command;
}

/**
 * Create script content with proper shebang and structure
 * Note: execDir is NOT included in script - it's handled by button execution
 */
export function createScriptContent(
	commands: string,
	description?: string,
	inputs?: InputField[]
): string {
	const isWindows = process.platform === 'win32';
	
	// Replace input variable placeholders with positional argument references
	let processedCommands = commands;

	// Check if script content is already processed (has shebang or @echo off)
	const firstLine = processedCommands.split('\n')[0].trim();
	const containsSheBangOrEcho = firstLine?.startsWith('#!') || firstLine?.startsWith('@echo') || false;
	if(containsSheBangOrEcho){
		//remove first line from processedCommands
		processedCommands = processedCommands.split('\n').slice(1).join('\n');
	}
	if (inputs && inputs.length > 0) {
		inputs.forEach((input, index) => {
			const argNum = index + 1;
			const placeholder = input.variable; // e.g., {username}
			const argReference = isWindows ? `%${argNum}` : `$${argNum}`;
			
			// Replace all occurrences of the placeholder with the argument reference
			const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
			processedCommands = processedCommands.replace(regex, argReference);
		});
	}
	
	if (isWindows) {
		// Windows batch file
		let content = '@echo off\n';
		if (description) {
			content += `REM Description: ${description}\n`;
		}
		
		// Add input arguments documentation
		if (inputs && inputs.length > 0) {
			content += 'REM\n';
			content += 'REM Script Arguments:\n';
			inputs.forEach((input, index) => {
				const argNum = index + 1;
				const varName = input.variable.replace(/[{}]/g, '');
				content += `REM   %${argNum} - ${varName}: ${input.placeholder}\n`;
			});
			content += 'REM\n';
		}
		
		content += '\n';
		content += processedCommands + '\n';
		return content;
	} else {
		// Unix shell script
		let content = '#!/usr/bin/env bash\n';
		if (description) {
			content += `# Description: ${description}\n`;
		}
		
		// Add input arguments documentation
		if (inputs && inputs.length > 0) {
			content += '#\n';
			content += '# Script Arguments:\n';
			inputs.forEach((input, index) => {
				const argNum = index + 1;
				const varName = input.variable.replace(/[{}]/g, '');
				content += `#   $${argNum} - ${varName}: ${input.placeholder}\n`;
			});
			content += '#\n';
		}
		
		content += '\n';
		content += 'set -e  # Exit on error\n\n';
		
		content += processedCommands + '\n';
		return content;
	}
}

/**
 * Process button with script: save script and update button cmd
 */
export async function processButtonWithScript(
	button: smartCmdButton,
	globalStoragePath?: string
): Promise<smartCmdButton | null> {
	if (!button.scriptContent || !button.scope) {
		return button;
	}
	
	try {
		// Get existing script files to ensure unique name
		const existingScripts = await listScripts(button.scope, globalStoragePath);
		
		// Generate script filename
		const scriptFileName = button.scriptFile || generateScriptFileName(button.name, existingScripts);
		
		// Check if script content is already processed (has shebang or @echo off)
        const SecondLine = button.scriptContent.split('\n')[1].trim();
        const isAlreadyProcessed = SecondLine?.startsWith('# Description:') || SecondLine?.startsWith('REM Description:') || false;
        
        let scriptContent: string;
        if (isAlreadyProcessed) {
            // Script is already processed (e.g., when copying from workspace to global)
            // Use it directly without calling createScriptContent
            scriptContent = button.scriptContent;
        } else {
            // Create script content with proper structure (no execDir - handled externally)
            // Pass inputs for argument documentation
            scriptContent = createScriptContent(
                button.scriptContent,
                button.description,
                button.inputs
            );
        }
		
		// Save script file
		const scriptPath = await saveScript(scriptContent, scriptFileName, button.scope, globalStoragePath);
		
		if (!scriptPath) {
			console.error('DevBoost: Failed to save script file');
			return null;
		}
		
		// Generate command to run the script (pass inputs for placeholder appending)
		const scriptCommand = generateScriptCommand(
			scriptFileName, 
			button.scope, 
			button.execDir, 
			globalStoragePath,
			button.inputs
		);
		
		// Return updated button (without scriptContent, only scriptFile)
		// Keep execDir so execution can handle directory change
		const { scriptContent: _, ...buttonWithoutContent } = button;
		return {
			...buttonWithoutContent,
			scriptFile: scriptFileName,
			cmd: scriptCommand
			// execDir is preserved from original button
		};
	} catch (error) {
		console.error('DevBoost: Error processing button with script:', error);
		return null;
	}
}