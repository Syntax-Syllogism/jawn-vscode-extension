import * as vscode from 'vscode';
import type { CommandDef } from '../registry/types';

type JawnNode = GroupNode | SubgroupNode | CommandNode;

interface GroupNode {
	type: 'group';
	label: string;
	commands: readonly CommandDef[];
}

interface SubgroupNode {
	type: 'subgroup';
	label: string;
	commands: readonly CommandDef[];
}

interface CommandNode {
	type: 'command';
	command: CommandDef;
}

export class JawnCommandsProvider implements vscode.TreeDataProvider<JawnNode> {
	public constructor(private readonly commands: readonly CommandDef[]) {}

	public getTreeItem(element: JawnNode): vscode.TreeItem {
		if (element.type === 'group') {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
			item.contextValue = 'jawnGroup';
			item.iconPath = new vscode.ThemeIcon(element.label === 'AEP Generation' ? 'file-code' : 'person');
			return item;
		}

		if (element.type === 'subgroup') {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
			item.contextValue = 'jawnSubgroup';
			item.iconPath = new vscode.ThemeIcon('symbol-class');
			return item;
		}

		const item = new vscode.TreeItem(trimTitle(element.command.title), vscode.TreeItemCollapsibleState.None);
		item.command = {
			command: element.command.id,
			title: element.command.title,
		};
		item.tooltip = element.command.cliId;
		item.iconPath = new vscode.ThemeIcon(commandIcon(element.command));
		item.contextValue = 'jawnCommand';
		return item;
	}

	public getChildren(element?: JawnNode): JawnNode[] {
		if (element?.type === 'group') {
			if (element.commands.some((command) => command.subgroup)) {
				return orderedSubgroups(element.commands);
			}

			return element.commands.map((command) => ({ type: 'command', command }));
		}

		if (element?.type === 'subgroup') {
			return element.commands.map((command) => ({ type: 'command', command }));
		}

		if (element) {
			return [];
		}

		return orderedGroups(this.commands).map(([label, groupCommands]) => ({
			type: 'group',
			label,
			commands: groupCommands,
		}));
	}
}

function trimTitle(title: string): string {
	return title.replace(/^SF Jawn:\s*/, '');
}

function orderedGroups(commands: readonly CommandDef[]): [string, CommandDef[]][] {
	return orderedBuckets(commands, (command) => command.group, ['User Lifecycle', 'AEP Generation']);
}

function orderedSubgroups(commands: readonly CommandDef[]): SubgroupNode[] {
	return orderedBuckets(commands, (command) => command.subgroup ?? '', ['Generators', 'Selector Helpers', 'Domain-Process Bindings'])
		.filter(([label]) => label.length > 0)
		.map(([label, subgroupCommands]) => ({ type: 'subgroup', label, commands: subgroupCommands }));
}

function orderedBuckets<T>(items: readonly T[], keyOf: (item: T) => string, preferredOrder: readonly string[]): [string, T[]][] {
	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		const bucket = buckets.get(key) ?? [];
		bucket.push(item);
		buckets.set(key, bucket);
	}

	const orderedKeys = [
		...preferredOrder.filter((key) => buckets.has(key)),
		...[...buckets.keys()].filter((key) => !preferredOrder.includes(key)),
	];
	return orderedKeys.map((key) => [key, buckets.get(key) ?? []]);
}

function commandIcon(command: CommandDef): string {
	if (command.destructive) {
		return 'warning';
	}

	return command.group === 'AEP Generation' ? 'file-code' : 'person';
}
