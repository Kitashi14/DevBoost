// Workspace Utilities - Common workspace and file operations
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Get the current workspace folder
 */
export function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
	return vscode.workspace.workspaceFolders?.[0];
}

/**
 * Get the current workspace path
 */
export function getCurrentWorkspacePath(): string | undefined {
	const workspaceFolder = getCurrentWorkspaceFolder();
	return workspaceFolder?.uri.fsPath;
}

/**
 * Check if a workspace is open
 */
export function isWorkspaceOpen(): boolean {
	return !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0);
}

/**
 * Show error if no workspace is open
 */
export function showNoWorkspaceError(actionName: string = 'this action'): boolean {
	if (!isWorkspaceOpen()) {
		vscode.window.showErrorMessage(`Please open a workspace to use ${actionName}.`);
		return true;
	}
	return false;
}

/**
 * Get .vscode directory path for current workspace
 */
export function getVSCodeDirectoryPath(): string | null {
	const workspacePath = getCurrentWorkspacePath();
	if (!workspacePath) {
		return null;
	}
	return path.join(workspacePath, '.vscode');
}

/**
 * Ensure .vscode directory exists
 */
export async function ensureVSCodeDirectory(): Promise<string | null> {
	const vscodeDir = getVSCodeDirectoryPath();
	if (!vscodeDir) {
		return null;
	}

	try {
		await fs.mkdir(vscodeDir, { recursive: true });
		return vscodeDir;
	} catch (error) {
		console.error('Error creating .vscode directory:', error);
		return null;
	}
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read file with error handling
 */
export async function readFileContent(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error);
		return null;
	}
}

/**
 * Write file with error handling and directory creation
 */
export async function writeFileContent(filePath: string, content: string): Promise<boolean> {
	try {
		// Ensure directory exists
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, content, 'utf-8');
		return true;
	} catch (error) {
		console.error(`Error writing file ${filePath}:`, error);
		return false;
	}
}

/**
 * Get file extension based on OS for scripts
 */
export function getScriptExtension(): string {
	return process.platform === 'win32' ? '.bat' : '.sh';
}

/**
 * Get platform-specific information
 */
export function getPlatformInfo(): { platform: string; shell: string } {
	let platform = 'Unknown';
	if (process.platform === 'win32') {
		platform = 'Windows';
	} else if (process.platform === 'darwin') {
		platform = 'macOS';
	} else if (process.platform === 'linux') {
		platform = 'Linux';
	}

	const shell = process.env.SHELL || process.env.COMSPEC || 'Unknown shell';
	const shellName = path.basename(shell).replace(/\.(exe|com|bat)$/i, '');

	return { platform, shell: shellName };
}

/**
 * Sanitize filename from user input
 */
export function sanitizeFileName(name: string): string {
	return name
		.replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, hyphens
		.replace(/\s+/g, '_')      // Replace spaces with underscores
		.toLowerCase()
		.trim() || 'unnamed';
}

/**
 * Generate unique filename
 */
export function generateUniqueFileName(
	baseName: string,
	extension: string,
	existingFiles: string[] = []
): string {
	const sanitizedBase = sanitizeFileName(baseName);
	let filename = `${sanitizedBase}${extension}`;
	let counter = 1;

	while (existingFiles.includes(filename)) {
		filename = `${sanitizedBase}_${counter}${extension}`;
		counter++;
	}

	return filename;
}