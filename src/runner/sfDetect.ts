import { execFile } from 'child_process';
import * as vscode from 'vscode';

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

function execSf(args: readonly string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile('sf', [...args], (error, _stdout, stderr) => {
			if (error) {
				reject(new Error(stderr || error.message));
				return;
			}

			resolve();
		});
	});
}
