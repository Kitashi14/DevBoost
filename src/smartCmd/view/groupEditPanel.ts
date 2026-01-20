// Group Edit Panel for SmartCmd Button Groups
import * as vscode from 'vscode';
import { ButtonGroup, smartCmdButton } from '../treeProvider';

export interface GroupOperation {
	type: 'delete' | 'rename' | 'reorder' | 'removeButton' | 'reorderGroups';
	groupId: string;
	newName?: string;
	newButtonOrder?: string[];
	buttonIdToRemove?: string;
	newGroupOrder?: string[];  // For reordering groups within a scope
	scope?: 'workspace' | 'global';  // Scope for group reordering
}

export class GroupEditPanel {
	private static currentPanel: GroupEditPanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private disposables: vscode.Disposable[] = [];
	private groups: ButtonGroup[];
	private buttons: smartCmdButton[];
	private treeDataChangeListener: vscode.Disposable | undefined;

	private constructor(
		panel: vscode.WebviewPanel,
		groups: ButtonGroup[],
		buttons: smartCmdButton[],
		private onComplete: (operations: GroupOperation[]) => Promise<void>,
		private getUpdatedData: () => { groups: ButtonGroup[], buttons: smartCmdButton[] },
		onDidChangeTreeData?: vscode.Event<any>
	) {
		this.panel = panel;
		this.groups = [...groups];
		this.buttons = [...buttons];

		// Set up webview content
		this.panel.webview.html = this.getHtmlContent();

		// Listen to tree data changes if event provided
		if (onDidChangeTreeData) {
			this.treeDataChangeListener = onDidChangeTreeData(() => {
				this.refreshData();
			});
			this.disposables.push(this.treeDataChangeListener);
		}

		// Handle messages from webview
		this.panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'deleteGroup':
						await this.handleDeleteGroup(message.groupId);
						break;
					case 'renameGroup':
						await this.handleRenameGroup(message.groupId, message.newName);
						break;
					case 'removeButtonFromGroup':
						await this.handleRemoveButton(message.groupId, message.buttonId);
						break;
					case 'reorderButtons':
						await this.handleReorderButtons(message.groupId, message.newOrder);
						break;
					case 'reorderGroups':
						await this.handleReorderGroups(message.scope, message.newOrder);
						break;
				}
			},
			null,
			this.disposables
		);

		// Clean up when panel is closed
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
	}

	private refreshData(): void {
		const { groups, buttons } = this.getUpdatedData();
		this.groups = [...groups];
		this.buttons = [...buttons];
		
		// Update the webview with new data
		this.panel.webview.postMessage({
			command: 'refreshData',
			groups: this.getGroupsForWebview(),
			buttons: this.getButtonsForWebview()
		});
	}

	private getGroupsForWebview() {
		return this.groups.map(g => ({
			id: g.id,
			name: g.name,
			scope: g.scope,
			buttonIds: g.buttonIds
		}));
	}

	private getButtonsForWebview() {
		return this.buttons.map(b => ({
			id: b.id!,
			name: b.name,
			description: b.description || '',
			scope: b.scope
		}));
	}

	public static show(
		groups: ButtonGroup[],
		buttons: smartCmdButton[],
		onComplete: (operations: GroupOperation[]) => Promise<void>,
		getUpdatedData: () => { groups: ButtonGroup[], buttons: smartCmdButton[] },
		onDidChangeTreeData?: vscode.Event<any>
	): void {
		// If panel already exists, reveal it
		if (GroupEditPanel.currentPanel) {
			GroupEditPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
			return;
		}

		// Create new panel
		const panel = vscode.window.createWebviewPanel(
			'groupEditPanel',
			'Edit Button Groups',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		GroupEditPanel.currentPanel = new GroupEditPanel(
			panel,
			groups,
			buttons,
			onComplete,
			getUpdatedData,
			onDidChangeTreeData
		);
	}

	private async handleDeleteGroup(groupId: string): Promise<void> {
		const group = this.groups.find(g => g.id === groupId);
		if (!group) return;

		const confirm = await vscode.window.showWarningMessage(
			`Delete group "${group.name}"? Buttons in this group will not be deleted.`,
			{ modal: true },
			'Delete'
		);

		if (confirm === 'Delete') {
			await this.onComplete([{ type: 'delete', groupId }]);
			this.refreshData();
		}
	}

	private async handleRenameGroup(groupId: string, currentName: string): Promise<void> {
		const newName = await vscode.window.showInputBox({
			prompt: 'Enter a new name for the group',
			value: currentName,
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Group name cannot be empty';
				}
				if (value.length > 50) {
					return 'Group name is too long (max 50 characters)';
				}
				return null;
			}
		});

		if (newName && newName !== currentName) {
			await this.onComplete([{ type: 'rename', groupId, newName }]);
			this.refreshData();
		}
	}

	private async handleRemoveButton(groupId: string, buttonId: string): Promise<void> {
		await this.onComplete([{ type: 'removeButton', groupId, buttonIdToRemove: buttonId }]);
		this.refreshData();
	}

	private async handleReorderButtons(groupId: string, newOrder: string[]): Promise<void> {
		await this.onComplete([{ type: 'reorder', groupId, newButtonOrder: newOrder }]);
	}

	private async handleReorderGroups(scope: 'workspace' | 'global', newOrder: string[]): Promise<void> {
		await this.onComplete([{ type: 'reorderGroups', groupId: '', newGroupOrder: newOrder, scope }]);
	}

	private getHtmlContent(): string {
		const groups = this.getGroupsForWebview();
		const buttons = this.getButtonsForWebview();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Edit Button Groups</title>
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
		
		button.danger {
			background-color: var(--vscode-inputValidation-errorBackground);
			color: var(--vscode-inputValidation-errorForeground);
		}
		
		button.danger:hover {
			opacity: 0.9;
		}
		
		.group-container {
			margin-bottom: 15px;
			border: 1px solid var(--vscode-panel-border);
			border-radius: 6px;
			overflow: hidden;
			cursor: grab;
			transition: transform 0.1s ease;
		}
		
		.group-container.dragging {
			opacity: 0.5;
			background-color: var(--vscode-list-activeSelectionBackground);
		}
		
		.group-container.drag-over {
			border-top: 3px solid var(--vscode-focusBorder);
			margin-top: -3px;
		}
		
		.group-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px 16px;
			background-color: var(--vscode-sideBarSectionHeader-background);
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		
		.group-header-left {
			display: flex;
			align-items: center;
			gap: 12px;
		}
		
		.group-drag-handle {
			cursor: grab;
			color: var(--vscode-descriptionForeground);
			font-size: 18px;
			padding: 4px;
			margin-right: 4px;
		}
		
		.group-drag-handle:hover {
			color: var(--vscode-foreground);
		}
		
		.group-name {
			font-size: 16px;
			font-weight: 600;
		}
		
		.group-scope {
			font-size: 11px;
			padding: 2px 8px;
			border-radius: 10px;
			background-color: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
		}
		
		.group-actions {
			display: flex;
			gap: 8px;
		}
		
		.group-actions button {
			padding: 4px 10px;
			font-size: 12px;
		}
		
		.button-list {
			padding: 0;
			margin: 0;
			list-style: none;
		}
		
		.button-item {
			display: flex;
			align-items: center;
			padding: 10px 16px;
			border-bottom: 1px solid var(--vscode-panel-border);
			background-color: var(--vscode-editor-background);
			cursor: grab;
		}
		
		.button-item:last-child {
			border-bottom: none;
		}
		
		.button-item:hover {
			background-color: var(--vscode-list-hoverBackground);
		}
		
		.button-item.dragging {
			opacity: 0.5;
			background-color: var(--vscode-list-activeSelectionBackground);
		}
		
		.button-item.drag-over {
			border-top: 2px solid var(--vscode-focusBorder);
		}
		
		.drag-handle {
			cursor: grab;
			margin-right: 12px;
			color: var(--vscode-descriptionForeground);
			font-size: 16px;
		}
        
        .drag-handle:hover {
            color: var(--vscode-foreground);
        }
		
		.button-info {
			flex: 1;
			min-width: 0;
		}
		
		.button-name {
			font-weight: 500;
			margin-bottom: 2px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		
		.button-description {
			font-size: 12px;
			color: var(--vscode-descriptionForeground);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		
		.button-actions {
			display: flex;
			gap: 8px;
			margin-left: 12px;
		}
		
		.button-actions button {
			padding: 4px 8px;
			font-size: 11px;
		}
		
		.empty-group {
			padding: 20px;
			text-align: center;
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		
		.no-groups {
			text-align: center;
			padding: 40px;
			color: var(--vscode-descriptionForeground);
		}
		
		.section-divider {
			margin: 30px 0 20px 0;
			padding-bottom: 10px;
			border-bottom: 1px solid var(--vscode-panel-border);
			font-size: 14px;
			font-weight: 600;
			color: var(--vscode-descriptionForeground);
		}
		
		.move-buttons {
			display: flex;
			flex-direction: column;
			gap: 2px;
			margin-right: 8px;
		}
		
		.move-btn {
			padding: 2px 6px !important;
			font-size: 10px !important;
			line-height: 1;
		}
	</style>
</head>
<body>
	<h1>Edit Button Groups</h1>
	<p class="subtitle">Manage your button groups: rename, delete, reorder groups and buttons within groups</p>
	
	<div id="groupsContainer"></div>
	
	<script>
		const vscode = acquireVsCodeApi();
		
		let groups = ${JSON.stringify(groups)};
		let buttons = ${JSON.stringify(buttons)};
		let draggedItem = null;
		let draggedGroupId = null;
		let draggedGroup = null;
		let draggedGroupScope = null;
		
		function getButtonById(id) {
			return buttons.find(b => b.id === id);
		}
		
		function renderGroups() {
			const container = document.getElementById('groupsContainer');
			
			if (groups.length === 0) {
				container.innerHTML = '<div class="no-groups">No groups have been created yet. Create groups from the SmartCmd view.</div>';
				return;
			}
			
			// Separate by scope
			const globalGroups = groups.filter(g => g.scope === 'global');
			const workspaceGroups = groups.filter(g => g.scope === 'workspace');
			
			let html = '';
			
			if (globalGroups.length > 0) {
				html += '<div class="section-divider" data-scope="global">🌐 Global Groups</div>';
				html += '<div class="groups-section" data-scope="global">';
				globalGroups.forEach(group => {
					html += renderGroup(group);
				});
				html += '</div>';
			}
			
			if (workspaceGroups.length > 0) {
				html += '<div class="section-divider" data-scope="workspace">📁 Workspace Groups</div>';
				html += '<div class="groups-section" data-scope="workspace">';
				workspaceGroups.forEach(group => {
					html += renderGroup(group);
				});
				html += '</div>';
			}
			
			container.innerHTML = html;
			setupDragAndDrop();
			setupGroupDragAndDrop();
		}
		
		function renderGroup(group) {
			const validButtons = group.buttonIds
				.map(id => getButtonById(id))
				.filter(b => b !== undefined);
			
			let buttonsHtml = '';
			if (validButtons.length === 0) {
				buttonsHtml = '<div class="empty-group">No buttons in this group. Add buttons from the SmartCmd view.</div>';
			} else {
				buttonsHtml = '<ul class="button-list">';
				validButtons.forEach((btn, index) => {
					buttonsHtml += \`
						<li class="button-item" draggable="true" data-group-id="\${group.id}" data-button-id="\${btn.id}" data-index="\${index}">
							<span class="drag-handle" title="Drag to reorder button">⋮⋮</span>
							<div class="button-info">
								<div class="button-name">\${escapeHtml(btn.name)}</div>
								<div class="button-description">\${escapeHtml(btn.description || 'No description')}</div>
							</div>
							<div class="button-actions">
								<button class="danger" onclick="removeButton('\${group.id}', '\${btn.id}')">Remove</button>
							</div>
						</li>
					\`;
				});
				buttonsHtml += '</ul>';
			}
			
			return \`
				<div class="group-container" draggable="true" data-group-id="\${group.id}" data-scope="\${group.scope}">
					<div class="group-header">
						<div class="group-header-left">
							<span class="group-drag-handle" title="Drag to reorder group">⋮⋮</span>
							<span class="group-name">\${escapeHtml(group.name)}</span>
							<span class="group-scope">\${group.scope}</span>
							<span style="color: var(--vscode-descriptionForeground); font-size: 12px;">\${validButtons.length} button\${validButtons.length !== 1 ? 's' : ''}</span>
						</div>
						<div class="group-actions">
							<button onclick="renameGroup('\${group.id}', '\${escapeHtml(group.name)}')" class="secondary">Rename</button>
							<button onclick="deleteGroup('\${group.id}')" class="danger">Delete Group</button>
						</div>
					</div>
					\${buttonsHtml}
				</div>
			\`;
		}
		
		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}
		
		function setupDragAndDrop() {
			const items = document.querySelectorAll('.button-item');
			
			items.forEach(item => {
				item.addEventListener('dragstart', handleDragStart);
				item.addEventListener('dragend', handleDragEnd);
				item.addEventListener('dragover', handleDragOver);
				item.addEventListener('dragleave', handleDragLeave);
				item.addEventListener('drop', handleDrop);
			});
		}
		
		function handleDragStart(e) {
			draggedItem = e.target;
			draggedGroupId = e.target.dataset.groupId;
			e.target.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
		}
		
		function handleDragEnd(e) {
			e.target.classList.remove('dragging');
			document.querySelectorAll('.button-item').forEach(item => {
				item.classList.remove('drag-over');
			});
			draggedItem = null;
			draggedGroupId = null;
		}
		
		function handleDragOver(e) {
			e.preventDefault();
			const target = e.target.closest('.button-item');
			if (target && target !== draggedItem && target.dataset.groupId === draggedGroupId) {
				target.classList.add('drag-over');
			}
		}
		
		function handleDragLeave(e) {
			const target = e.target.closest('.button-item');
			if (target) {
				target.classList.remove('drag-over');
			}
		}
		
		function handleDrop(e) {
			e.preventDefault();
			const target = e.target.closest('.button-item');
			if (!target || target === draggedItem || target.dataset.groupId !== draggedGroupId) {
				return;
			}
			
			const groupId = draggedGroupId;
			const group = groups.find(g => g.id === groupId);
			if (!group) return;
			
			const draggedId = draggedItem.dataset.buttonId;
			const targetId = target.dataset.buttonId;
			
			const draggedIndex = group.buttonIds.indexOf(draggedId);
			const targetIndex = group.buttonIds.indexOf(targetId);
			
			if (draggedIndex === -1 || targetIndex === -1) return;
			
			// Reorder
			group.buttonIds.splice(draggedIndex, 1);
			group.buttonIds.splice(targetIndex, 0, draggedId);
			
			// Send reorder to extension
			vscode.postMessage({
				command: 'reorderButtons',
				groupId: groupId,
				newOrder: group.buttonIds
			});
			
			renderGroups();
		}
		
		// Group drag and drop functions
		function setupGroupDragAndDrop() {
			const groupContainers = document.querySelectorAll('.group-container');
			
			groupContainers.forEach(container => {
				container.addEventListener('dragstart', handleGroupDragStart);
				container.addEventListener('dragend', handleGroupDragEnd);
				container.addEventListener('dragover', handleGroupDragOver);
				container.addEventListener('dragleave', handleGroupDragLeave);
				container.addEventListener('drop', handleGroupDrop);
			});
		}
		
		function handleGroupDragStart(e) {
			// Only start group drag if dragging from group header/handle, not from button items
			if (e.target.closest('.button-item')) {
				return;
			}
			const container = e.target.closest('.group-container');
			if (!container) return;
			
			draggedGroup = container;
			draggedGroupScope = container.dataset.scope;
			container.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', container.dataset.groupId);
		}
		
		function handleGroupDragEnd(e) {
			const container = e.target.closest('.group-container');
			if (container) {
				container.classList.remove('dragging');
			}
			document.querySelectorAll('.group-container').forEach(c => {
				c.classList.remove('drag-over');
			});
			draggedGroup = null;
			draggedGroupScope = null;
		}
		
		function handleGroupDragOver(e) {
			e.preventDefault();
			// Only allow if we're dragging a group (not a button)
			if (!draggedGroup) return;
			
			const target = e.target.closest('.group-container');
			if (target && target !== draggedGroup && target.dataset.scope === draggedGroupScope) {
				target.classList.add('drag-over');
			}
		}
		
		function handleGroupDragLeave(e) {
			const target = e.target.closest('.group-container');
			if (target) {
				target.classList.remove('drag-over');
			}
		}
		
		function handleGroupDrop(e) {
			e.preventDefault();
			// Only handle if we're dropping a group
			if (!draggedGroup) return;
			
			const target = e.target.closest('.group-container');
			if (!target || target === draggedGroup || target.dataset.scope !== draggedGroupScope) {
				return;
			}
			
			const scope = draggedGroupScope;
			const draggedId = draggedGroup.dataset.groupId;
			const targetId = target.dataset.groupId;
			
			// Get groups of same scope in current order
			const scopeGroups = groups.filter(g => g.scope === scope);
			const draggedIndex = scopeGroups.findIndex(g => g.id === draggedId);
			const targetIndex = scopeGroups.findIndex(g => g.id === targetId);
			
			if (draggedIndex === -1 || targetIndex === -1) return;
			
			// Reorder in the filtered array
			const [removed] = scopeGroups.splice(draggedIndex, 1);
			scopeGroups.splice(targetIndex, 0, removed);
			
			// Get the new order of group IDs for this scope
			const newOrder = scopeGroups.map(g => g.id);
			
			// Update local groups array to reflect new order
			const otherGroups = groups.filter(g => g.scope !== scope);
			groups = [...otherGroups, ...scopeGroups];
			
			// Send reorder to extension
			vscode.postMessage({
				command: 'reorderGroups',
				scope: scope,
				newOrder: newOrder
			});
			
			renderGroups();
		}
		
		function deleteGroup(groupId) {
			vscode.postMessage({
				command: 'deleteGroup',
				groupId: groupId
			});
		}
		
		function renameGroup(groupId, currentName) {
			vscode.postMessage({
				command: 'renameGroup',
				groupId: groupId,
				newName: currentName
			});
		}
		
		function removeButton(groupId, buttonId) {
			const group = groups.find(g => g.id === groupId);
			if (group) {
				group.buttonIds = group.buttonIds.filter(id => id !== buttonId);
				renderGroups();
			}
			
			vscode.postMessage({
				command: 'removeButtonFromGroup',
				groupId: groupId,
				buttonId: buttonId
			});
		}
		
		// Handle messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.command) {
				case 'refreshData':
					groups = message.groups;
					buttons = message.buttons;
					renderGroups();
					break;
			}
		});
		
		// Initial render
		renderGroups();
	</script>
</body>
</html>`;
	}

	private dispose() {
		GroupEditPanel.currentPanel = undefined;
		this.panel.dispose();

		while (this.disposables.length) {
			const disposable = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}
