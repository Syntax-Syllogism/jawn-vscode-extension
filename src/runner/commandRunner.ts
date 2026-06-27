import type { ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import { spawnSf } from './sfProcess';
import * as vscode from 'vscode';
import type { CommandDef } from '../registry/types';
import type { GatheredInputs } from '../input/gatherInputs';
import { stripAnsi } from './ansi';

export interface CommandRunner {
	run(command: CommandDef, inputs: GatheredInputs): Promise<void>;
}

export interface RunnerDeps {
	output: vscode.OutputChannel;
	spawnProcess: SpawnProcess;
	withProgress: typeof vscode.window.withProgress;
	showInformationMessage: typeof vscode.window.showInformationMessage;
	showWarningMessage: typeof vscode.window.showWarningMessage;
	showErrorMessage: typeof vscode.window.showErrorMessage;
	executeCommand?: typeof vscode.commands.executeCommand;
	workspaceFolder?: string;
}

export type SpawnProcess = (file: string, args: readonly string[], options: { cwd?: string; env: NodeJS.ProcessEnv }) => ChildProcessWithoutNullStreams;

interface RunResult {
	code: number | null;
	stdout: string;
	stderr: string;
	cancelled: boolean;
}

export function createCommandRunner(deps: RunnerDeps): CommandRunner {
	return {
		async run(command, inputs): Promise<void> {
			const baseArgs = buildJawnArgs(command, inputs.args);
			const displayCommand = `sf ${buildDisplayArgs(command, inputs.displayArgs).join(' ')}`;
			if (requiresRunConfirmation(command)) {
				const runPrompt = command.destructive ? `Preview ${displayCommand}, then confirm before applying changes?` : `Run ${displayCommand}?`;
				const runChoice = await deps.showInformationMessage(runPrompt, { modal: true }, 'Run');
				if (runChoice !== 'Run') {
					return;
				}
			}

			if (command.destructive) {
				const dryRunArgs = withFlag(baseArgs, '--dry-run');
				deps.output.show(true);
				deps.output.appendLine(`$ sf ${dryRunArgs.join(' ')}`);
				const dryRun = await spawnWithProgress(deps, command, dryRunArgs, 'Previewing jawn strip changes');
				if (dryRun.cancelled) {
					return;
				}
				if (!isSuccess(dryRun)) {
					deps.showErrorMessage(`${command.title} dry run failed. See the Jawn output channel.`);
					deps.output.show(true);
					return;
				}

				const apply = await deps.showWarningMessage('Apply the strip changes shown in the Jawn output channel?', { modal: true }, 'Apply');
				if (apply !== 'Apply') {
					return;
				}

				const applyArgs = withoutFlag(baseArgs, '--dry-run');
				await runAndReport(deps, command, applyArgs);
				return;
			}

			await runAndReport(deps, command, baseArgs);
		},
	};
}

export function buildJawnArgs(command: CommandDef, inputArgs: readonly string[]): string[] {
	return [...command.cliId.split(' '), ...inputArgs, ...internalFlags(command)];
}

export function buildDisplayArgs(command: CommandDef, displayInputArgs: readonly string[]): string[] {
	return [...command.cliId.split(' '), ...displayInputArgs];
}

async function runAndReport(deps: RunnerDeps, command: CommandDef, args: readonly string[]): Promise<void> {
	deps.output.show(true);
	deps.output.appendLine(`$ sf ${args.join(' ')}`);
	const result = await spawnWithProgress(deps, command, args, `Running ${command.title}`);
	if (result.cancelled) {
		return;
	}

	if (isSuccess(result)) {
		await reportSuccess(deps, command, inputsFromArgs(command, args), result);
		return;
	}

	deps.showErrorMessage(`${command.title} failed. See the Jawn output channel.`);
	deps.output.show(true);
}

function spawnWithProgress(deps: RunnerDeps, command: CommandDef, args: readonly string[], title: string): Promise<RunResult> {
	return Promise.resolve(deps.withProgress(
		{ location: vscode.ProgressLocation.Notification, title, cancellable: true },
		(_progress, token) => runProcess(deps, command, args, token),
	));
}

function runProcess(deps: RunnerDeps, _command: CommandDef, args: readonly string[], token: vscode.CancellationToken): Promise<RunResult> {
	return new Promise((resolve) => {
		const child = deps.spawnProcess('sf', args, {
			cwd: deps.workspaceFolder,
			env: process.env,
		});
		let stdout = '';
		let stderr = '';
		let cancelled = false;

		const cancel = token.onCancellationRequested(() => {
			cancelled = true;
			child.kill();
		});

		child.stdout.on('data', (chunk: Buffer | string) => {
			const text = stripAnsi(String(chunk));
			stdout += text;
			deps.output.append(text);
		});
		child.stderr.on('data', (chunk: Buffer | string) => {
			const text = stripAnsi(String(chunk));
			stderr += text;
			deps.output.append(text);
		});
		child.on('close', (code) => {
			cancel.dispose();
			resolve({ code, stdout, stderr, cancelled });
		});
	});
}

function isSuccess(result: RunResult): boolean {
	const payload = parseJsonEnvelope(result.stdout) ?? parseJsonEnvelope(result.stderr);
	if (payload && typeof payload.status === 'number') {
		return payload.status === 0;
	}

	return result.code === 0;
}

function parseJsonEnvelope(value: string): { status?: number; result?: unknown; message?: string } | undefined {
	const trimmed = value.trim();
	if (!trimmed.startsWith('{')) {
		return undefined;
	}

	try {
		return JSON.parse(trimmed) as { status?: number; result?: unknown; message?: string };
	} catch {
		return undefined;
	}
}

function withFlag(args: readonly string[], flag: string): string[] {
	return args.includes(flag) ? [...args] : [...args, flag];
}

function withoutFlag(args: readonly string[], flag: string): string[] {
	return args.filter((arg) => arg !== flag);
}

function internalFlags(command: CommandDef): string[] {
	return command.supportsNoPrompt ? ['--no-prompt'] : [];
}

function requiresRunConfirmation(command: CommandDef): boolean {
	return command.supportsNoPrompt === true;
}

function successMessage(command: CommandDef, result: RunResult): string {
	const payload = parseJsonEnvelope(result.stdout) ?? parseJsonEnvelope(result.stderr);
	if (payload?.message) {
		return payload.message;
	}

	if (payload?.result && typeof payload.result === 'object') {
		const summary = 'summary' in payload.result ? payload.result.summary : undefined;
		if (typeof summary === 'string' && summary.length > 0) {
			return summary;
		}
	}

	return `${command.title} completed.`;
}

async function reportSuccess(deps: RunnerDeps, command: CommandDef, inputArgs: readonly string[], result: RunResult): Promise<void> {
	if (inputArgs.includes('--dry-run')) {
		deps.showInformationMessage(successMessage(command, result));
		return;
	}

	const outputDir = outputDirectory(command, inputArgs, deps.workspaceFolder);
	if (!outputDir) {
		deps.showInformationMessage(successMessage(command, result));
		return;
	}

	const choice = await deps.showInformationMessage(successMessage(command, result), 'Open Folder');
	if (choice === 'Open Folder') {
		await (deps.executeCommand ?? vscode.commands.executeCommand)('revealInExplorer', vscode.Uri.file(outputDir));
	}
}

function inputsFromArgs(command: CommandDef, args: readonly string[]): string[] {
	const prefixLength = command.cliId.split(' ').length;
	return args.slice(prefixLength);
}

function outputDirectory(command: CommandDef, inputArgs: readonly string[], workspaceFolder?: string): string | undefined {
	const outputFlag = command.flags.find((flag) => flag.kind === 'outputDir');
	if (!outputFlag) {
		return undefined;
	}

	const outputPath = flagValue(inputArgs, outputFlag.name) ?? outputFlag.default;
	if (!outputPath) {
		return undefined;
	}

	return path.isAbsolute(outputPath) || !workspaceFolder ? outputPath : path.join(workspaceFolder, outputPath);
}

function flagValue(args: readonly string[], flagName: string): string | undefined {
	const index = args.indexOf(`--${flagName}`);
	return index >= 0 ? args[index + 1] : undefined;
}

export const defaultSpawnProcess: SpawnProcess = (_file, args, options) => spawnSf(args, options);
