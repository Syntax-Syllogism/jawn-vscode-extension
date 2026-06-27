import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { pickFolder } from './filePicker';
import type { CommandDef, FlagDef } from '../registry/types';

export interface OutputDirectoryChoice extends vscode.QuickPickItem {
	value?: string;
	custom?: boolean;
}

export interface PickOutputDirectoryOptions {
	command: CommandDef;
	flag: FlagDef;
	label: string;
	defaultValue?: string;
	lastValue?: string;
}

const NOISE_DIRS = new Set(['.git', '.sf', '.sfdx', 'node_modules', 'dist', 'out', 'coverage', '.vscode']);

export async function pickOutputDirectory(options: PickOutputDirectoryOptions): Promise<string | undefined> {
	const { label, defaultValue, lastValue } = options;
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	const seen = new Set<string>();
	const items: OutputDirectoryChoice[] = [];

	function addCandidate(value: string, description: string): void {
		if (seen.has(value)) {
			return;
		}
		seen.add(value);
		items.push({ label: value, description, value });
	}

	if (defaultValue) {
		addCandidate(defaultValue, 'Default');
	}

	if (lastValue && lastValue !== defaultValue) {
		addCandidate(lastValue, 'Last used');
	}

	if (workspaceRoot) {
		const packageDirs = await readSfdxPackageDirs(workspaceRoot);
		for (const dir of packageDirs) {
			addCandidate(dir, 'Package directory');
		}

		try {
			const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory() && !NOISE_DIRS.has(entry.name)) {
					addCandidate(entry.name, 'Workspace folder');
				}
			}
		} catch {
			// silently skip if workspace root is unreadable
		}
	}

	items.push({ label: '$(file-directory) Choose Different Folder...', custom: true });

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: label,
		matchOnDescription: true,
	});

	if (!picked) {
		return undefined;
	}

	if (picked.custom) {
		return pickFolder(label, defaultValue);
	}

	return picked.value;
}

async function readSfdxPackageDirs(workspaceRoot: string): Promise<string[]> {
	try {
		const content = await fs.readFile(path.join(workspaceRoot, 'sfdx-project.json'), 'utf8');
		const json = JSON.parse(content) as unknown;
		if (!json || typeof json !== 'object') {
			return [];
		}
		const dirs = (json as Record<string, unknown>).packageDirectories;
		if (!Array.isArray(dirs)) {
			return [];
		}
		const defaults: string[] = [];
		const others: string[] = [];
		for (const dir of dirs) {
			if (!dir || typeof dir !== 'object') {
				continue;
			}
			const dirPath = (dir as Record<string, unknown>).path;
			if (typeof dirPath !== 'string') {
				continue;
			}
			if ((dir as Record<string, unknown>).default) {
				defaults.push(dirPath);
			} else {
				others.push(dirPath);
			}
		}
		return [...defaults, ...others];
	} catch {
		return [];
	}
}
