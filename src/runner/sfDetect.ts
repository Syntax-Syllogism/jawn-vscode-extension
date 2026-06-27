import * as vscode from 'vscode';
import { execSf } from './sfProcess';

export interface SfDetector {
	ensureReady(): Promise<boolean>;
}

export function createSfDetector(): SfDetector {
	let checked = false;

	return {
		async ensureReady(): Promise<boolean> {
			if (checked) {
				return true;
			}

			try {
				await execSf(['--version']);
				await execSf(['jawn', '--help']);
				checked = true;
				return true;
			} catch (error) {
				const install = await vscode.window.showErrorMessage(
					`The Salesforce CLI with the jawn plugin is required. ${error instanceof Error ? error.message : ''}`,
					'Install jawn plugin',
				);
				if (install === 'Install jawn plugin') {
					const terminal = vscode.window.createTerminal('Jawn setup');
					terminal.show();
					terminal.sendText('sf plugins install @syntax-syllogism/jawn');
				}

				return false;
			}
		},
	};
}

