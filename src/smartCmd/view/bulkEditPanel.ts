// Bulk Edit Panel for SmartCmd Buttons
import * as vscode from 'vscode';
import * as path from 'path';
import { smartCmdButton } from '../treeProvider';

export class BulkEditPanel {
	private static currentPanel: BulkEditPanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private disposables: vscode.Disposable[] = [];
	private buttons: smartCmdButton[];
	private treeDataChangeListener: vscode.Disposable | undefined;

	private constructor(
		panel: vscode.WebviewPanel,
		buttons: smartCmdButton[],
		private onComplete: (operations: BulkOperation[]) => Promise<void>,
		private getUpdatedButtons: () => smartCmdButton[],
		onDidChangeTreeData?: vscode.Event<any>
	) {
		this.panel = panel;
		this.buttons = buttons;

		// Set up webview content
		this.panel.webview.html = this.getHtmlContent();

		// Listen to tree data changes if event provided
		if (onDidChangeTreeData) {
			this.treeDataChangeListener = onDidChangeTreeData(() => {
				this.refreshButtonData();
			});
			this.disposables.push(this.treeDataChangeListener);
		}

		// Handle messages from webview
		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'submit':
						await this.handleSubmit(message.operations);
						break;
					case 'cancel':
						this.dispose();
						break;
				}
			},
			null,
			this.disposables
		);

		// Clean up when panel is closed
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
	}

	private refreshButtonData(): void {
		// Get fresh button data
		const updatedButtons = this.getUpdatedButtons();
		this.buttons = updatedButtons;
		
		// Update the webview with new data
		this.panel.webview.postMessage({
			command: 'refreshButtons',
			buttons: this.getButtonsForWebview()
		});
	}

	private getButtonsForWebview() {
		// Sort buttons: global first, then workspace
		const sortedButtons = [...this.buttons].sort((a, b) => {
			if (a.scope === 'global' && b.scope === 'workspace') return -1;
			if (a.scope === 'workspace' && b.scope === 'global') return 1;
			return 0;
		});

		return sortedButtons.map(b => ({
			id: b.id!, // Use button's UUID
			name: b.name,
			cmd: b.cmd,
			description: b.description || 'N/A',
			scope: b.scope,
			execDir: b.execDir || '.',
			scriptFile: b.scriptFile || null
		}));
	}

	public static show(
		buttons: smartCmdButton[],
		onComplete: (operations: BulkOperation[]) => Promise<void>,
		getUpdatedButtons: () => smartCmdButton[],
		onDidChangeTreeData?: vscode.Event<any>
	): void {
		// If panel already exists, reveal it
		if (BulkEditPanel.currentPanel) {
			BulkEditPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
			return;
		}

		// Create new panel
		const panel = vscode.window.createWebviewPanel(
			'bulkEditButtons',
			'Bulk Edit Buttons',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		BulkEditPanel.currentPanel = new BulkEditPanel(
			panel, 
			buttons, 
			onComplete, 
			getUpdatedButtons,
			onDidChangeTreeData
		);
	}

	private async handleSubmit(operations: BulkOperation[]): Promise<void> {
		if (!operations || operations.length === 0) {
			vscode.window.showInformationMessage('No operations to perform.');
			return;
		}

		try {
			await this.onComplete(operations);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to complete operations: ${error}`);
		}
	}

	private getHtmlContent(): string {
		const buttons = this.getButtonsForWebview();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Bulk Edit Buttons</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			padding: 20px;
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		
		h1 {
			font-size: 24px;
			margin-bottom: 10px;
			color: var(--vscode-foreground);
		}
		
		.subtitle {
			color: var(--vscode-descriptionForeground);
			margin-bottom: 20px;
		}
		
		.controls {
			margin-bottom: 20px;
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			align-items: center;
		}
		
		.button-group {
			display: flex;
			gap: 10px;
		}
		
		button {
			padding: 6px 14px;
			background-color: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			cursor: pointer;
			font-size: 13px;
			border-radius: 2px;
		}
		
		button:hover {
			background-color: var(--vscode-button-hoverBackground);
		}
		
		button.secondary {
			background-color: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		
		button.secondary:hover {
			background-color: var(--vscode-button-secondaryHoverBackground);
		}
		
		button:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
		
		.table-container {
			overflow-x: auto;
			margin-bottom: 20px;
		}
		
		table {
			width: 100%;
			border-collapse: collapse;
			background-color: var(--vscode-editor-background);
		}
		
		th, td {
			padding: 10px 15px;
			text-align: left;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		th {
			background-color: var(--vscode-editor-background);
			font-weight: 600;
			position: sticky;
			top: 0;
			z-index: 10;
		}
		
		tr:hover {
			background-color: var(--vscode-list-hoverBackground);
		}
		
		input[type="checkbox"] {
			cursor: pointer;
			width: 16px;
			height: 16px;
		}
		
		input[type="text"] {
			width: 100%;
			padding: 4px 8px;
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			font-size: 13px;
			font-family: var(--vscode-font-family);
		}
		
		input[type="text"]:focus {
			outline: 1px solid var(--vscode-focusBorder);
		}
		
		.badge {
			display: inline-block;
			padding: 2px 8px;
			border-radius: 10px;
			font-size: 11px;
			font-weight: 500;
		}
		
		.badge-global {
			background-color: var(--vscode-charts-blue);
			color: var(--vscode-editor-background);
		}
		
		.badge-workspace {
			background-color: var(--vscode-charts-orange);
			color: var(--vscode-editor-background);
		}
		
		.badge-script {
			background-color: var(--vscode-charts-green);
			color: var(--vscode-editor-background);
			margin-left: 4px;
		}
		
		.command-preview {
			font-family: var(--vscode-editor-font-family);
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			max-width: 300px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		
		.footer {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-top: 20px;
			border-top: 1px solid var(--vscode-panel-border);
		}
		
		.selection-info {
			color: var(--vscode-descriptionForeground);
			font-size: 13px;
		}
		
		.action-buttons {
			display: flex;
			gap: 10px;
		}
		
		.bulk-actions {
			display: flex;
			gap: 10px;
			align-items: center;
		}
		
		.divider {
			height: 20px;
			width: 1px;
			background-color: var(--vscode-panel-border);
			margin: 0 10px;
		}
		
		.execdir-input {
			min-width: 120px;
		}
		
		.filter-group {
			display: flex;
			gap: 10px;
			align-items: center;
		}
		
		select {
			padding: 4px 8px;
			background-color: var(--vscode-dropdown-background);
			color: var(--vscode-dropdown-foreground);
			border: 1px solid var(--vscode-dropdown-border);
			cursor: pointer;
			font-size: 13px;
		}
		
		.warning {
			color: var(--vscode-errorForeground);
			font-size: 12px;
			margin-top: 4px;
		}
		
		.revert-icon {
			display: inline-block;
			margin-left: 8px;
			padding: 4px;
			background: none;
			border: none;
			cursor: pointer;
			font-size: 16px;
			color: var(--vscode-button-secondaryForeground);
			opacity: 0.8;
			transition: opacity 0.2s;
		}
		
		.revert-icon:hover {
			opacity: 1;
			color: var(--vscode-button-foreground);
		}
		
		.checkbox-cell {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		
		.scope-header {
			display: flex;
			align-items: center;
			gap: 10px;
			font-weight: 600;
			font-size: 15px;
			letter-spacing: 0.5px;
			text-transform: uppercase;
			color: var(--vscode-foreground);
		}
		
		.scope-header input[type="checkbox"] {
			cursor: pointer;
		}
		
		.modal {
			display: none;
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0, 0, 0, 0.5);
			z-index: 1000;
			justify-content: center;
			align-items: center;
		}
		
		.modal-content {
			background-color: var(--vscode-editor-background);
			padding: 24px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			min-width: 450px;
			max-width: 600px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		}
		
		.modal-header {
			font-size: 18px;
			font-weight: 600;
			margin-bottom: 20px;
			color: var(--vscode-foreground);
		}
		
		.modal-body {
			margin-bottom: 24px;
		}
		
		.modal-body label {
			display: block;
			margin-bottom: 8px;
			font-size: 13px;
			color: var(--vscode-foreground);
		}
		
		.modal-footer {
			display: flex;
			justify-content: flex-end;
			gap: 10px;
		}
		
		.modal-input {
			width: 100%;
			padding: 8px 12px;
			background-color: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			border: 1px solid var(--vscode-input-border);
			font-size: 14px;
			font-family: var(--vscode-font-family);
			border-radius: 2px;
			box-sizing: border-box;
		}
		
		.modal-input:focus {
			outline: 1px solid var(--vscode-focusBorder);
			border-color: var(--vscode-focusBorder);
		}
	</style>
</head>
<body>
	<!-- Modal for bulk set exec dir -->
	<div id="execDirModal" class="modal">
		<div class="modal-content">
			<div class="modal-header">Set Execution Directory</div>
			<div class="modal-body">
				<label for="execDirInput">Enter execution directory for selected buttons:</label>
				<input type="text" id="execDirInput" class="modal-input" value="." placeholder="e.g. &lt;workspace&gt;, &lt;workspace&gt;/src, /usr/local/bin, . (current directory) etc.">
			</div>
			<div class="modal-footer">
				<button onclick="closeExecDirModal()">Cancel</button>
				<button onclick="confirmExecDir()">Apply</button>
			</div>
		</div>
	</div>
	
	<!-- Modal for final submit confirmation -->
	<div id="submitModal" class="modal">
		<div class="modal-content">
			<div class="modal-header" style="color: var(--vscode-errorForeground);">⚠️ Confirm Changes</div>
			<div class="modal-body">
				<p id="submitMessage" style="margin: 0; margin-bottom: 10px;"></p>
				<p style="color: var(--vscode-errorForeground); font-weight: 600; font-size: 13px;">
					This action cannot be undone.
				</p>
			</div>
			<div class="modal-footer">
				<button onclick="closeSubmitModal()">Cancel</button>
				<button onclick="confirmSubmit()" style="background-color: var(--vscode-button-background);">Apply Changes</button>
			</div>
		</div>
	</div>
	
	<h1>Bulk Edit Buttons</h1>
	<p class="subtitle">Select multiple buttons to edit or delete in one operation</p>
	
	<div class="controls">
		<div class="filter-group">
			<label>Filter by Type:</label>
			<select id="typeFilter" onchange="applyFilter()">
				<option value="all">All Types</option>
				<option value="script">Scripts Only</option>
				<option value="command">Commands Only</option>
			</select>
		</div>
		
		<div class="divider"></div>
		
		<div class="bulk-actions">
			<label>Bulk Actions:</label>
			<button onclick="bulkSetExecDir()" class="secondary">Set Execution Directory</button>
			<button onclick="bulkDelete()" class="secondary" style="background-color: var(--vscode-errorForeground);">Delete Selected</button>
		</div>
	</div>
	
	<div class="table-container">
		<table id="buttonsTable">
			<thead>
				<tr>
					<th style="width: 40px;"><input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll()"></th>
					<th>Name</th>
					<th>Scope</th>
					<th>Command Preview</th>
					<th>Execution Directory</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody id="buttonsBody">
				<!-- Will be populated by JavaScript -->
			</tbody>
		</table>
	</div>
	
	<div class="footer">
		<div class="selection-info">
			<span id="selectionCount">0 buttons selected</span>
		</div>
		<div class="action-buttons">
			<button onclick="cancel()">Cancel</button>
			<button id="applyButton" onclick="submit()" disabled>Apply Changes</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let buttons = ${JSON.stringify(buttons)};
		let selectedButtons = new Set(); // Now stores button IDs
		let modifiedExecDirs = new Map(); // Now uses button ID as key
		let buttonsToDelete = new Set(); // Now stores button IDs
		
		// Listen for messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.command) {
				case 'refreshButtons':
					// Update buttons data
					buttons = message.buttons;
					
					// Clear any selections and modifications that reference deleted buttons
					const validIds = new Set(buttons.map(b => b.id));
					selectedButtons = new Set([...selectedButtons].filter(id => validIds.has(id)));
					
					// Clean up modifiedExecDirs: remove if button deleted OR if modified value now matches actual value
					modifiedExecDirs = new Map([...modifiedExecDirs].filter(([id, modifiedValue]) => {
						if (!validIds.has(id)) return false; // Button deleted
						const button = buttons.find(b => b.id === id);
						// Keep only if modified value is different from actual value
						return modifiedValue !== button.execDir;
					}));
					
					buttonsToDelete = new Set([...buttonsToDelete].filter(id => validIds.has(id)));
					
					// Re-render the table
					renderTable();
					
					console.log('Buttons refreshed. New count:', buttons.length);
					break;
			}
		});
		
		// Update the Apply Changes button state
		function updateApplyButtonState() {
			const applyButton = document.getElementById('applyButton');
			const hasChanges = buttonsToDelete.size > 0 || modifiedExecDirs.size > 0;
			applyButton.disabled = !hasChanges;
		}
		
		function renderTable() {
			const tbody = document.getElementById('buttonsBody');
			tbody.innerHTML = '';
			
			const typeFilter = document.getElementById('typeFilter').value;
			let currentScope = null;
			
			buttons.forEach((button, displayIndex) => {
				// Apply type filter
				if (typeFilter === 'script' && !button.scriptFile) return;
				if (typeFilter === 'command' && button.scriptFile) return;
				
				// Add scope header row if scope changed
				if (button.scope !== currentScope) {
					currentScope = button.scope;
					const headerRow = document.createElement('tr');
					headerRow.style.backgroundColor = 'var(--vscode-editor-background)';
					headerRow.style.borderTop = '2px solid var(--vscode-panel-border)';
					headerRow.innerHTML = \`
						<td colspan="6" style="padding: 12px 15px;">
							<div class="scope-header">
								<input 
									type="checkbox" 
									id="\${button.scope}ScopeCheckbox" 
									onchange="toggleScopeSelection('\${button.scope}')"
									title="Select all \${button.scope} buttons"
								>
								<label for="\${button.scope}ScopeCheckbox" style="cursor: pointer;">
									\${button.scope === 'global' ? '🌐 Global Commands' : '📁 Workspace Commands'}
								</label>
							</div>
						</td>
					\`;
					tbody.appendChild(headerRow);
				}
				
				const buttonId = button.id;
				const tr = document.createElement('tr');
				if (buttonsToDelete.has(buttonId)) {
					tr.style.backgroundColor = 'var(--vscode-inputValidation-errorBackground)';
					tr.style.opacity = '0.6';
				}
				
				const cmdPreview = button.scriptFile 
					? \`run \${button.scriptFile}\`
					: button.cmd.substring(0, 50) + (button.cmd.length > 50 ? '...' : '');
				
				const scopeBadge = button.scope === 'global' 
					? '<span class="badge badge-global">Global</span>' 
					: '<span class="badge badge-workspace">Workspace</span>';
				
				const scriptBadge = button.scriptFile 
					? '<span class="badge badge-script">📜 Script</span>' 
					: '';
				
				const currentExecDir = modifiedExecDirs.get(buttonId) !== undefined 
					? modifiedExecDirs.get(buttonId) 
					: button.execDir;
				
				// Check if button has any modifications
				const hasModifications = modifiedExecDirs.has(buttonId) || buttonsToDelete.has(buttonId);
				
				tr.innerHTML = \`
					<td>
						<div class="checkbox-cell">
							<input 
								type="checkbox" 
								\${selectedButtons.has(buttonId) ? 'checked' : ''} 
								onchange="toggleButton('\${escapeHtml(buttonId)}')"
								\${buttonsToDelete.has(buttonId) ? 'disabled' : ''}
							>
							\${hasModifications ? 
								'<button class="revert-icon" onclick="revertButton(\\'' + escapeHtml(buttonId) + '\\')" title="Revert all changes">↻</button>' : ''}
						</div>
					</td>
					<td>
						<strong>\${escapeHtml(button.name)}</strong>
						\${scriptBadge}
					</td>
					<td>\${scopeBadge}</td>
					<td>
						<div class="command-preview" title="\${escapeHtml(button.cmd)}">
							\${escapeHtml(cmdPreview)}
						</div>
					</td>
					<td>
						<input 
							type="text" 
							class="execdir-input" 
							value="\${escapeHtml(currentExecDir)}" 
							onchange="updateExecDir('\${escapeHtml(buttonId)}', this.value)"
							\${buttonsToDelete.has(buttonId) ? 'disabled' : ''}
							placeholder="."
						>
						\${modifiedExecDirs.has(buttonId) ? '<div class="warning">Modified</div>' : ''}
					</td>
					<td>\${escapeHtml(button.description)}</td>
				\`;
				
			    tbody.appendChild(tr);
		    });
		
		    updateSelectionCount();
		    updateApplyButtonState();
	    }		
        
        function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}
		
		function toggleButton(id) {
			if (selectedButtons.has(id)) {
				selectedButtons.delete(id);
			} else {
				selectedButtons.add(id);
			}
			updateSelectionCount();
		}
		
		function toggleSelectAll() {
			const checkbox = document.getElementById('selectAllCheckbox');
			if (checkbox.checked) {
				selectAll();
			} else {
				deselectAll();
			}
		}
		
		function selectAll() {
			const typeFilter = document.getElementById('typeFilter').value;
			
			buttons.forEach((button) => {
				const buttonId = button.id;
				if (buttonsToDelete.has(buttonId)) return;
				if (typeFilter === 'script' && !button.scriptFile) return;
				if (typeFilter === 'command' && button.scriptFile) return;
				
				selectedButtons.add(buttonId);
			});
			
			renderTable();
		}
		
		function deselectAll() {
			selectedButtons.clear();
			document.getElementById('selectAllCheckbox').checked = false;
			renderTable();
		}
		
		function updateSelectionCount() {
			const count = selectedButtons.size;
			document.getElementById('selectionCount').textContent = 
				\`\${count} button\${count !== 1 ? 's' : ''} selected\`;
			
			// Check if all visible (non-deleted) buttons are selected
			const typeFilter = document.getElementById('typeFilter').value;
			let visibleCount = 0;
			buttons.forEach((button) => {
				const buttonId = button.id;
				if (buttonsToDelete.has(buttonId)) return;
				if (typeFilter === 'script' && !button.scriptFile) return;
				if (typeFilter === 'command' && button.scriptFile) return;
				visibleCount++;
			});
			
			document.getElementById('selectAllCheckbox').checked = 
				selectedButtons.size > 0 && selectedButtons.size === visibleCount;
			
			// Update scope checkboxes
			updateScopeCheckboxes();
		}
		
		function toggleScopeSelection(scope) {
			const typeFilter = document.getElementById('typeFilter').value;
			const checkbox = document.getElementById(scope + 'ScopeCheckbox');
			
			if (checkbox.checked) {
				// Select all buttons in this scope
				buttons.forEach((button) => {
					if (button.scope !== scope) return;
					const buttonId = button.id;
					if (buttonsToDelete.has(buttonId)) return;
					if (typeFilter === 'script' && !button.scriptFile) return;
					if (typeFilter === 'command' && button.scriptFile) return;
					
					selectedButtons.add(buttonId);
				});
			} else {
				// Deselect all buttons in this scope
				buttons.forEach((button) => {
					if (button.scope !== scope) return;
					const buttonId = button.id;
					selectedButtons.delete(buttonId);
				});
			}
			
			renderTable();
		}
		
		function updateScopeCheckboxes() {
			const typeFilter = document.getElementById('typeFilter').value;
			
			// Update global scope checkbox
			const globalCheckbox = document.getElementById('globalScopeCheckbox');
			if (globalCheckbox) {
				let globalCount = 0;
				let globalSelectedCount = 0;
				buttons.forEach((button) => {
					if (button.scope !== 'global') return;
					const buttonId = button.id;
					if (buttonsToDelete.has(buttonId)) return;
					if (typeFilter === 'script' && !button.scriptFile) return;
					if (typeFilter === 'command' && button.scriptFile) return;
					
					globalCount++;
					if (selectedButtons.has(buttonId)) {
						globalSelectedCount++;
					}
				});
				globalCheckbox.checked = globalCount > 0 && globalSelectedCount === globalCount;
				globalCheckbox.indeterminate = globalSelectedCount > 0 && globalSelectedCount < globalCount;
			}
			
			// Update workspace scope checkbox
			const workspaceCheckbox = document.getElementById('workspaceScopeCheckbox');
			if (workspaceCheckbox) {
				let workspaceCount = 0;
				let workspaceSelectedCount = 0;
				buttons.forEach((button) => {
					if (button.scope !== 'workspace') return;
					const buttonId = button.id;
					if (buttonsToDelete.has(buttonId)) return;
					if (typeFilter === 'script' && !button.scriptFile) return;
					if (typeFilter === 'command' && button.scriptFile) return;
					
					workspaceCount++;
					if (selectedButtons.has(buttonId)) {
						workspaceSelectedCount++;
					}
				});
				workspaceCheckbox.checked = workspaceCount > 0 && workspaceSelectedCount === workspaceCount;
				workspaceCheckbox.indeterminate = workspaceSelectedCount > 0 && workspaceSelectedCount < workspaceCount;
			}
		}
		
		function updateExecDir(id, value) {
			const normalizedValue = value.trim() || '.';
            if(normalizedValue === buttons.find(b => b.id === id).execDir) {
                modifiedExecDirs.delete(id);
            } else {
                modifiedExecDirs.set(id, normalizedValue);
            }
			renderTable();
		}
		
		function revertButton(id) {
			// Revert all changes for this button
			modifiedExecDirs.delete(id);
			buttonsToDelete.delete(id);
			renderTable();
		}
		
		function bulkSetExecDir() {
			if (selectedButtons.size === 0) {
				alert('Please select at least one button');
				return;
			}
			
			// Show modal
			const modal = document.getElementById('execDirModal');
			const input = document.getElementById('execDirInput');
			modal.style.display = 'flex';
			input.value = '.';
			input.focus();
			input.select();
			
			// Handle Enter key
			input.onkeydown = (e) => {
				if (e.key === 'Enter') {
					confirmExecDir();
				} else if (e.key === 'Escape') {
					closeExecDirModal();
				}
			};
		}
		
		function closeExecDirModal() {
			const modal = document.getElementById('execDirModal');
			modal.style.display = 'none';
		}
		
		function confirmExecDir() {
			const input = document.getElementById('execDirInput');
			const execDir = input.value;
			
			const normalizedDir = execDir.trim() || '.';
			selectedButtons.forEach(id => {
                if(normalizedDir === buttons.find(b => b.id === id).execDir) {
                    modifiedExecDirs.delete(id);
                } else {
                    modifiedExecDirs.set(id, normalizedDir);
                }
			});
			
			closeExecDirModal();
			renderTable();
		}
		
		function bulkDelete() {
			if (selectedButtons.size === 0) {
				alert('Please select at least one button to delete');
				return;
			}
			
			// Directly mark buttons for deletion
			selectedButtons.forEach(id => {
				buttonsToDelete.add(id);
			});
			
			selectedButtons.clear();
			renderTable();
		}
		
		function applyFilter() {
			deselectAll();
			renderTable();
		}
		
		function submit() {
			const operations = [];
			
			// Add delete operations (use button IDs)
			buttonsToDelete.forEach(id => {
				operations.push({
					type: 'delete',
					buttonId: id,
					button: buttons.find(b => b.id === id)
				});
			});
			
			// Add update operations for modified execDirs (use button IDs)
			modifiedExecDirs.forEach((execDir, id) => {
				const button = buttons.find(b => b.id === id);
				if (!buttonsToDelete.has(id) && button && execDir !== button.execDir) {
					operations.push({
						type: 'update',
						buttonId: id,
						button: button,
						changes: {
							execDir: execDir
						}
					});
				}
			});
		
            if (operations.length === 0) {
                return; // Button should be disabled, but just in case
            }
		
            // Show confirmation modal
            const deleteCount = operations.filter(op => op.type === 'delete').length;
            const updateCount = operations.filter(op => op.type === 'update').length;		

            const modal = document.getElementById('submitModal');
            const message = document.getElementById('submitMessage');
            
            let msgText = 'You are about to apply the following changes:\\n\\n';
            if (updateCount > 0) {
                msgText += \`• Update \${updateCount} button(s)\\n\`;
            }
            if (deleteCount > 0) {
                msgText += \`• Delete \${deleteCount} button(s)\`;
            }
            
            message.textContent = msgText;
            message.style.whiteSpace = 'pre-line';
            modal.style.display = 'flex';
		}
		
		function closeSubmitModal() {
			const modal = document.getElementById('submitModal');
			modal.style.display = 'none';
		}
		
		function confirmSubmit() {
			const operations = [];
			
			// Add delete operations (use button IDs)
			buttonsToDelete.forEach(id => {
				operations.push({
					type: 'delete',
					buttonId: id,
					button: buttons.find(b => b.id === id)
				});
			});
			
			// Add update operations for modified execDirs (use button IDs)
			modifiedExecDirs.forEach((execDir, id) => {
				const button = buttons.find(b => b.id === id);
				if (!buttonsToDelete.has(id) && button && execDir !== button.execDir) {
					operations.push({
						type: 'update',
						buttonId: id,
						button: button,
						changes: {
							execDir: execDir
						}
					});
				}
			});
			
			closeSubmitModal();
			actualSubmit(operations);
		}
		
		function actualSubmit(operations) {
			vscode.postMessage({
				command: 'submit',
				operations: operations
			});
		}
		
		function cancel() {
			vscode.postMessage({
				command: 'cancel'
			});
		}
		
		// Initialize
		console.log('Total buttons:', buttons.length);
		console.log('Buttons data:', buttons);
		renderTable();
	</script>
</body>
</html>`;
	}

	private dispose() {
		BulkEditPanel.currentPanel = undefined;

		this.panel.dispose();

		while (this.disposables.length) {
			const disposable = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}

export interface BulkOperation {
	type: 'delete' | 'update';
	buttonId: string; // Use button UUID instead of array index
	button: smartCmdButton;
	changes?: {
		execDir?: string;
	};
}
