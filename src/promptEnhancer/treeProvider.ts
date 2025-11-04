// Prompt Enhancer Tree Provider
import * as vscode from 'vscode';

// Tree item for Prompt Enhancer actions
class PromptEnhancerTreeItem extends vscode.TreeItem {
	constructor(
		label: string,
		description: string,
		command: string,
		icon: string,
		collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
	) {
		super(label, collapsibleState);
		this.description = description;
		this.iconPath = new vscode.ThemeIcon(icon);
		this.contextValue = 'promptEnhancerAction';
		
		// Make it clickable
		this.command = {
			command: command,
			title: label,
			arguments: []
		};
	}
}

// Tree data provider for Prompt Enhancer
export class PromptEnhancerTreeProvider implements vscode.TreeDataProvider<PromptEnhancerTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PromptEnhancerTreeItem | undefined | null | void> = new vscode.EventEmitter<PromptEnhancerTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PromptEnhancerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private context: vscode.ExtensionContext) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PromptEnhancerTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PromptEnhancerTreeItem): Thenable<PromptEnhancerTreeItem[]> {
		// Root level: show Prompt Enhancer actions
		if (!element) {
			const actions: PromptEnhancerTreeItem[] = [
				new PromptEnhancerTreeItem(
					'Enhance Prompt',
					'Open full prompt enhancement interface',
					'devboost.showPromptEnhancer',
					'sparkle'
				),
				new PromptEnhancerTreeItem(
					'Quick Enhance',
					'Quick one-click enhancement from clipboard',
					'devboost.quickEnhance',
					'zap'
				)
			];
			
			return Promise.resolve(actions);
		}

		return Promise.resolve([]);
	}
}