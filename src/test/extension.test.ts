import * as assert from 'assert';
import { execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as vscode from 'vscode';
import { pickDefFile, type PickDefFileOptions } from '../input/defFilePicker';
import { pickFolder } from '../input/filePicker';
import { gatherInputs, type BooleanPick, type InputApi, type PickOutputDirectoryOptions } from '../input/gatherInputs';
import { pickOutputDirectory } from '../input/outputDirPicker';
import { showWorkspaceQuickPick } from '../input/workspaceQuickPick';
import { prioritizeOrgChoices } from '../input/orgPicker';
import { commands } from '../registry/commands.generated';
import type { CommandDef } from '../registry/types';
import { buildJawnArgs, createCommandRunner, type RunnerDeps } from '../runner/commandRunner';
import { JawnCommandsProvider } from '../tree/jawnCommandsProvider';
import { LastValueStore } from '../util/memento';

suite('Jawn extension', () => {
	test('registry exposes lifecycle and AEP commands with known flag kinds', () => {
		assert.deepStrictEqual(commands.map((command) => command.id), [
			'jawn.user.provision',
			'jawn.user.access',
			'jawn.user.strip',
			'jawn.user.freeze',
			'jawn.user.unfreeze',
			'jawn.aep.generate',
			'jawn.aep.generate.selector',
			'jawn.aep.generate.domain',
			'jawn.aep.generate.service',
			'jawn.aep.generate.unitofwork',
			'jawn.aep.generate.selector.method',
			'jawn.aep.generate.selector.field-injection',
			'jawn.aep.generate.action',
			'jawn.aep.generate.criteria',
		]);

		const knownKinds = new Set(['org', 'file', 'outputDir', 'string', 'boolean', 'apiVersion', 'enum']);
		for (const command of commands) {
			for (const flag of command.flags) {
				assert.ok(knownKinds.has(flag.kind), `${command.id}:${flag.name} has unknown kind ${flag.kind}`);
			}
		}
	});

	test('AEP registry captures required input metadata', () => {
		const aepGenerate = commandById('jawn.aep.generate');
		assert.strictEqual(aepGenerate.group, 'AEP Generation');
		assert.strictEqual(aepGenerate.subgroup, 'Pattern Layers');
		assert.deepStrictEqual(aepGenerate.requireOneOf, ['selector', 'domain', 'unit-of-work']);
		assert.strictEqual(aepGenerate.flags.find((flag) => flag.name === 'at4dx')?.exclusiveGroup, 'flavor');
		assert.strictEqual(aepGenerate.flags.find((flag) => flag.name === 'fflib')?.exclusiveGroup, 'flavor');
		const outputPath = aepGenerate.flags.find((flag) => flag.name === 'output-path');
		assert.strictEqual(outputPath?.kind, 'outputDir');
		assert.strictEqual(outputPath?.default, 'generated-files');

		assert.ok(!commandById('jawn.aep.generate.action').flags.some((flag) => flag.name === 'target-org'));
		assert.strictEqual(commandById('jawn.aep.generate.service').flags.find((flag) => flag.name === 'target-org')?.required, undefined);
		assert.deepStrictEqual(commandById('jawn.aep.generate.action').flags.find((flag) => flag.name === 'trigger-operation')?.options, [
			'Before_Insert',
			'Before_Update',
			'Before_Delete',
			'After_Insert',
			'After_Update',
			'After_Delete',
			'After_Undelete',
		]);
	});

	test('generated registry stays in sync with the checked-in manifest fixture', () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-codegen-'));
		const registryPath = join(tempDir, 'commands.generated.ts');
		const packagePath = join(tempDir, 'package.json');
		writeFileSync(packagePath, readFileSync('package.json', 'utf8'));

		execFileSync('node', [
			'--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
			'--experimental-strip-types',
			'scripts/gen-commands.ts',
			'vendor/jawn.oclif.manifest.json',
			registryPath,
			packagePath,
		], { cwd: process.cwd() });

		assert.strictEqual(readFileSync(registryPath, 'utf8'), readFileSync('src/registry/commands.generated.ts', 'utf8'));
		const generatedPackage = JSON.parse(readFileSync(packagePath, 'utf8')) as { contributes: { commands: unknown } };
		const currentPackage = JSON.parse(readFileSync('package.json', 'utf8')) as { contributes: { commands: unknown } };
		assert.deepStrictEqual(generatedPackage.contributes.commands, currentPackage.contributes.commands);
	});

	test('gatherInputs builds argv from definition file picker responses and skips blank optionals', async () => {
		const command = commandById('jawn.user.provision');
		const store = new LastValueStore(new MemoryMemento());
		let defFilePickCount = 0;
		const inputApi: InputApi = {
			pickOrg: async () => 'scratch',
			pickFile: async () => {
				throw new Error('native file picker should not be used for definition files');
			},
			pickDefFile: async () => defFilePickCount++ === 0 ? 'config/users.json' : 'config/personas.json',
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async () => '',
			showQuickPick: async () => undefined,
			showBooleanPick: async (items: readonly BooleanPick[]) => items.filter((item) => item.flag.name === 'dry-run'),
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.deepStrictEqual(result?.args, [
			'--target-org', 'scratch',
			'--users-def', 'config/users.json',
			'--personas-def', 'config/personas.json',
			'--dry-run',
		]);
	});

	test('gatherInputs aborts when a required definition file prompt is cancelled', async () => {
		const command = commandById('jawn.user.provision');
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'scratch',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async () => '',
			showQuickPick: async () => undefined,
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		assert.strictEqual(await gatherInputs(command, store, inputApi), undefined);
	});

	test('gatherInputs aborts when an exclusive-group definition file prompt is cancelled', async () => {
		const command = commandById('jawn.user.freeze');
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => options.prompt?.includes('match users') ? 'Username' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'Users definition file'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		assert.strictEqual(await gatherInputs(command, store, inputApi), undefined);
	});

	test('gatherInputs passes last-used definition file and stores the selected relative path', async () => {
		const command = commandById('jawn.user.strip');
		const store = new LastValueStore(new MemoryMemento());
		await store.set(command.id, 'users-def', 'config/previous-users.json');
		const receivedOptions: PickDefFileOptions[] = [];
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async (options) => {
				receivedOptions.push(options);
				return 'config/current-users.json';
			},
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => options.prompt?.includes('match users') ? 'Username' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'Users definition file'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.deepStrictEqual(result?.args, [
			'--users-def', 'config/current-users.json',
			'--external-id', 'Username',
			'--target-org', 'dev',
		]);
		assert.strictEqual(receivedOptions[0].lastValue, 'config/previous-users.json');
		assert.strictEqual(store.get(command.id, 'users-def'), 'config/current-users.json');
	});

	test('gatherInputs uses verified access flags without prompting for dead output mode', async () => {
		const command = commandById('jawn.user.access');
		const accessType = command.flags.find((flag) => flag.name === 'type');
		const target = command.flags.find((flag) => flag.name === 'target');
		assert.deepStrictEqual(accessType?.options, ['field', 'object']);
		assert.strictEqual(target?.placeholder, 'Object__c.Field__c');
		assert.ok(!command.flags.some((flag) => flag.name === 'output'));
		assert.ok(!command.flags.some((flag) => flag.name === 'api-version'));

		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => options.prompt?.includes('Target API name') ? 'Account.Name' : '',
			showQuickPick: async (items) => items[0],
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.deepStrictEqual(result?.args, [
			'--target-org', 'dev',
			'--type', 'field',
			'--target', 'Account.Name',
		]);
	});

	test('gatherInputs aborts when a required org is cancelled', async () => {
		const command = commandById('jawn.user.access');
		const store = new LastValueStore(new MemoryMemento());
		await store.set(command.id, 'target-org', 'previous-org');
		const inputApi: InputApi = {
			pickOrg: async () => undefined,
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async () => 'Account.Name',
			showQuickPick: async (items) => items[0],
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		assert.strictEqual(await gatherInputs(command, store, inputApi), undefined);
	});

	test('prioritizeOrgChoices moves the last-used org first without changing cancel semantics', () => {
		const choices = [
			{ label: 'one', value: 'one' },
			{ label: 'two', value: 'two' },
		];

		assert.deepStrictEqual(prioritizeOrgChoices(choices, 'two').map((choice) => choice.value), ['two', 'one']);
		assert.deepStrictEqual(prioritizeOrgChoices(choices).map((choice) => choice.value), ['one', 'two']);
	});

	test('pickFolder returns project-relative paths and root as dot', async () => {
		await withWorkspaceFolders(['/repo'], async () => {
			await withOpenDialog([vscode.Uri.file('/repo/force-app')], async () => {
				assert.strictEqual(await pickFolder('Output folder'), 'force-app');
			});

			await withOpenDialog([vscode.Uri.file('/repo')], async () => {
				assert.strictEqual(await pickFolder('Output folder'), '.');
			});
		});
	});

	test('pickFolder rejects out-of-workspace folders', async () => {
		const warnings: string[] = [];
		await withWorkspaceFolders(['/repo'], async () => {
			await withOpenDialog([vscode.Uri.file('/outside')], async () => {
				await withWarningMessage(async (message) => {
					warnings.push(message);
					return undefined;
				}, async () => {
					assert.strictEqual(await pickFolder('Output folder'), undefined);
				});
			});
		});

		assert.deepStrictEqual(warnings, ['Choose a folder inside the current workspace.']);
	});

	test('showWorkspaceQuickPick injects last-used first, deduplicates, and returns undefined on cancel', async () => {
		const capturedItems: vscode.QuickPickItem[][] = [];
		await withQuickPick((items) => {
			capturedItems.push([...items]);
			return items[0];
		}, async () => {
			const result = await showWorkspaceQuickPick({
				items: [
					{ label: 'users.json', value: 'config/users.json' },
					{ label: 'users duplicate', value: 'config/users.json' },
					{ label: 'personas.json', value: 'config/personas.json' },
				],
				lastValue: 'config/users.json',
				placeHolder: 'Pick JSON',
			});
			assert.strictEqual(result, 'config/users.json');
		});

		assert.deepStrictEqual(capturedItems[0].map((item) => (item as unknown as { value: string }).value), [
			'config/users.json',
			'config/personas.json',
		]);

		await withQuickPick(() => undefined, async () => {
			const result = await showWorkspaceQuickPick({
				items: [{ label: 'users.json', value: 'config/users.json' }],
				placeHolder: 'Pick JSON',
			});
			assert.strictEqual(result, undefined);
		});
	});

	test('pickDefFile offers discovered workspace JSON files and returns a relative path', async () => {
		const command = commandById('jawn.user.provision');
		const flag = command.flags.find((f) => f.name === 'users-def')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		mkdirSync(join(tempDir, 'config'));
		mkdirSync(join(tempDir, 'data'));
		writeFileSync(join(tempDir, 'config', 'users.json'), '{}');
		writeFileSync(join(tempDir, 'data', 'personas.json'), '{}');
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withFindFiles([
				vscode.Uri.file(join(tempDir, 'data', 'personas.json')),
				vscode.Uri.file(join(tempDir, 'config', 'users.json')),
			], async () => {
				await withQuickPick((items) => {
					capturedItems.push([...items]);
					return items.find((item) => (item as unknown as { value: string }).value === 'data/personas.json');
				}, async () => {
					const result = await pickDefFile({ flag, label: 'Path to user definition JSON file.' });
					assert.strictEqual(result, 'data/personas.json');
				});
			});
		});

		assert.deepStrictEqual(capturedItems[0].map((item) => (item as unknown as { value: string }).value), [
			'config/users.json',
			'data/personas.json',
		]);
		assert.strictEqual(capturedItems[0][0].label, 'users.json');
		assert.strictEqual(capturedItems[0][0].description, 'config');
	});

	test('pickDefFile filters JSON files ignored by git', async () => {
		const command = commandById('jawn.user.provision');
		const flag = command.flags.find((f) => f.name === 'users-def')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		mkdirSync(join(tempDir, 'config'));
		mkdirSync(join(tempDir, 'ignored'));
		writeFileSync(join(tempDir, '.gitignore'), 'ignored/**\n');
		writeFileSync(join(tempDir, 'config', 'users.json'), '{}');
		writeFileSync(join(tempDir, 'ignored', 'users.json'), '{}');
		execFileSync('git', ['init'], { cwd: tempDir });
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withFindFiles([
				vscode.Uri.file(join(tempDir, 'ignored', 'users.json')),
				vscode.Uri.file(join(tempDir, 'config', 'users.json')),
			], async () => {
				await withQuickPick((items) => {
					capturedItems.push([...items]);
					return undefined;
				}, async () => {
					await pickDefFile({ flag, label: 'Path to user definition JSON file.', lastValue: 'ignored/users.json' });
				});
			});
		});

		assert.deepStrictEqual(capturedItems[0].map((item) => (item as unknown as { value: string }).value), ['config/users.json']);
	});

	test('pickDefFile puts an existing last-used file first and deduplicates discovered matches', async () => {
		const command = commandById('jawn.user.provision');
		const flag = command.flags.find((f) => f.name === 'users-def')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		mkdirSync(join(tempDir, 'config'));
		writeFileSync(join(tempDir, 'config', 'users.json'), '{}');
		writeFileSync(join(tempDir, 'config', 'personas.json'), '{}');
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withFindFiles([
				vscode.Uri.file(join(tempDir, 'config', 'personas.json')),
				vscode.Uri.file(join(tempDir, 'config', 'users.json')),
			], async () => {
				await withQuickPick((items) => {
					capturedItems.push([...items]);
					return undefined;
				}, async () => {
					await pickDefFile({ flag, label: 'Path to user definition JSON file.', lastValue: 'config/users.json' });
				});
			});
		});

		const values = capturedItems[0].map((item) => (item as unknown as { value: string }).value);
		assert.deepStrictEqual(values, ['config/users.json', 'config/personas.json']);
		assert.strictEqual(capturedItems[0][0].description, 'Last used • config');
	});

	test('pickDefFile silently omits a missing last-used file', async () => {
		const command = commandById('jawn.user.provision');
		const flag = command.flags.find((f) => f.name === 'users-def')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		mkdirSync(join(tempDir, 'config'));
		writeFileSync(join(tempDir, 'config', 'users.json'), '{}');
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withFindFiles([vscode.Uri.file(join(tempDir, 'config', 'users.json'))], async () => {
				await withQuickPick((items) => {
					capturedItems.push([...items]);
					return undefined;
				}, async () => {
					await pickDefFile({ flag, label: 'Path to user definition JSON file.', lastValue: 'config/missing.json' });
				});
			});
		});

		assert.deepStrictEqual(capturedItems[0].map((item) => item.description), ['config']);
	});

	test('gatherInputs enforces user-or-users-def targeting as a single choice', async () => {
		const command = commandById('jawn.user.freeze');
		const userFlag = command.flags.find((flag) => flag.name === 'user');
		assert.strictEqual(userFlag?.placeholder, 'Username:myUser@email.com');
		assert.strictEqual(userFlag?.summary, 'Target a single user as field:value (e.g. Username:user@example.com).');

		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => {
				throw new Error('file picker should not be used for single-user targeting');
			},
			pickDefFile: async () => {
				throw new Error('definition file picker should not be used for single-user targeting');
			},
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => {
				if (options.prompt?.includes('match users')) {
					throw new Error('external-id should not be prompted for single-user targeting');
				}

				return options.prompt?.includes('single user') ? 'Username:myUser@email.com' : '';
			},
			showQuickPick: async (items) => items[0],
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.deepStrictEqual(result?.args, [
			'--user', 'Username:myUser@email.com',
			'--target-org', 'dev',
		]);
	});

	test('gatherInputs chooses exactly one AEP flavor flag', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => options.prompt?.includes('SObject') ? 'Account' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'AT4DX'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.ok(result?.args.includes('--at4dx'));
		assert.ok(!result?.args.includes('--fflib'));
	});

	test('gatherInputs aborts when AEP flavor selection is cancelled', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => options.prompt?.includes('SObject') ? 'Account' : '',
			showQuickPick: async () => undefined,
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		assert.strictEqual(await gatherInputs(command, store, inputApi), undefined);
	});

	test('gatherInputs emits output-path only when a directory is picked', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => 'force-app',
			showInputBox: async (options) => options.prompt?.includes('SObject') ? 'Account' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'fflib'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		assert.deepStrictEqual((await gatherInputs(command, store, inputApi))?.args, [
			'--target-org', 'dev',
			'--sobject', 'Account',
			'--fflib',
			'--output-path', 'force-app',
		]);

		const cancelDirApi: InputApi = {
			...inputApi,
			pickOutputDirectory: async () => undefined,
		};
		const cancelledDir = await gatherInputs(command, new LastValueStore(new MemoryMemento()), cancelDirApi);
		assert.ok(!cancelledDir?.args.includes('--output-path'));
	});

	test('gatherInputs handles enum and org-less AEP commands', async () => {
		const command = commandById('jawn.aep.generate.action');
		let pickedOrg = false;
		let inputCount = 0;
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => {
				pickedOrg = true;
				return 'dev';
			},
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async () => {
				if (inputCount === 0) {
					inputCount += 1;
					return 'Account';
				}
				if (inputCount === 1) {
					inputCount += 1;
					return 'AccountAction';
				}
				return '';
			},
			showQuickPick: async (items) => items.find((item) => item.label === 'After_Update'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.strictEqual(pickedOrg, false);
		assert.deepStrictEqual(result?.args, [
			'--sobject', 'Account',
			'--class-name', 'AccountAction',
			'--trigger-operation', 'After_Update',
		]);
	});

	test('gatherInputs lets optional AEP service org be skipped', async () => {
		const command = commandById('jawn.aep.generate.service');
		const store = new LastValueStore(new MemoryMemento());
		let inputCount = 0;
		const inputApi: InputApi = {
			pickOrg: async () => undefined,
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async () => inputCount++ === 0 ? 'Billing' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'AT4DX'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		const result = await gatherInputs(command, store, inputApi);

		assert.deepStrictEqual(result?.args, [
			'--service-basename', 'Billing',
			'--at4dx',
		]);
	});

	test('gatherInputs enforces aggregate AEP artifact selection', async () => {
		const command = commandById('jawn.aep.generate');
		const warnings: string[] = [];
		const baseInputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => undefined,
			showInputBox: async (options) => options.prompt?.includes('SObject') ? 'Account' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'AT4DX'),
			showBooleanPick: async () => [],
			showWarningMessage: async (message) => {
				warnings.push(message);
				return undefined;
			},
		};

		assert.strictEqual(await gatherInputs(command, new LastValueStore(new MemoryMemento()), baseInputApi), undefined);
		assert.deepStrictEqual(warnings, ['Select at least one of: --selector, --domain, --unit-of-work']);

		const selected = await gatherInputs(command, new LastValueStore(new MemoryMemento()), {
			...baseInputApi,
			showBooleanPick: async (items) => items.filter((item) => item.flag.name === 'selector'),
		});
		assert.ok(selected?.args.includes('--selector'));
	});

	test('buildJawnArgs avoids json by default and injects no-prompt only where supported', () => {
		const command = commandById('jawn.user.access');

		assert.deepStrictEqual(buildJawnArgs(command, ['--target-org', 'dev']), [
			'jawn', 'user', 'access',
			'--target-org', 'dev',
		]);

		assert.deepStrictEqual(buildJawnArgs(commandById('jawn.user.provision'), ['--target-org', 'dev']), [
			'jawn', 'user', 'provision',
			'--target-org', 'dev',
			'--no-prompt',
		]);

		assert.deepStrictEqual(buildJawnArgs(commandById('jawn.aep.generate.selector'), ['--target-org', 'dev', '--sobject', 'Account', '--at4dx']), [
			'jawn', 'aep', 'generate', 'selector',
			'--target-org', 'dev',
			'--sobject', 'Account',
			'--at4dx',
		]);
	});

	test('destructive strip previews with dry-run before applying', async () => {
		const strip = commandById('jawn.user.strip');
		const spawnedArgs: string[][] = [];
		const output = new MemoryOutputChannel();
		const runner = createCommandRunner({
			output,
			spawnProcess: (_file, args) => {
				spawnedArgs.push([...args]);
				return fakeChildProcess('{"status":0,"result":{}}');
			},
			withProgress: async (_options, task) => task({ report: () => undefined }, new vscode.CancellationTokenSource().token),
			showInformationMessage: async () => 'Run' as never,
			showWarningMessage: async () => 'Apply' as never,
			showErrorMessage: async () => undefined as never,
		} satisfies RunnerDeps);

		await runner.run(strip, { args: ['--target-org', 'dev', '--user', 'myUser@email.com'], displayArgs: ['--target-org', 'dev', '--user', 'myUser@email.com'] });

		assert.strictEqual(spawnedArgs.length, 2);
		assert.ok(spawnedArgs[0].includes('--dry-run'));
		assert.ok(!spawnedArgs[1].includes('--dry-run'));
		assert.ok(spawnedArgs[0].includes('--no-prompt'));
		assert.ok(!spawnedArgs[0].includes('--json'));
		assert.ok(!spawnedArgs[1].includes('--json'));
		assert.match(output.value, /\$ sf jawn user strip/);
	});

	test('runner executes AEP without prompt injection and offers to open the output folder', async () => {
		const selector = commandById('jawn.aep.generate.selector');
		const spawnedArgs: string[][] = [];
		const infos: string[] = [];
		const opened: unknown[][] = [];
		const runner = createCommandRunner({
			output: new MemoryOutputChannel(),
			workspaceFolder: '/repo',
			spawnProcess: (_file, args) => {
				spawnedArgs.push([...args]);
				return fakeChildProcess('Generated selector');
			},
			withProgress: async (_options, task) => task({ report: () => undefined }, new vscode.CancellationTokenSource().token),
			showInformationMessage: async (message: string) => {
				infos.push(message);
				return 'Open Folder' as never;
			},
			showWarningMessage: async () => undefined as never,
			showErrorMessage: async () => undefined as never,
			executeCommand: <T = unknown>(...args: unknown[]): Thenable<T> => {
				opened.push(args);
				return Promise.resolve(undefined as T);
			},
		} satisfies RunnerDeps);

		await runner.run(selector, {
			args: ['--target-org', 'dev', '--sobject', 'Account', '--at4dx'],
			displayArgs: ['--target-org', 'dev', '--sobject', 'Account', '--at4dx'],
		});

		assert.deepStrictEqual(spawnedArgs, [[
			'jawn', 'aep', 'generate', 'selector',
			'--target-org', 'dev',
			'--sobject', 'Account',
			'--at4dx',
		]]);
		assert.ok(!spawnedArgs[0].includes('--no-prompt'));
		assert.ok(!spawnedArgs[0].includes('--json'));
		assert.deepStrictEqual(infos, ['SF Jawn: AEP Generate Selector completed.']);
		assert.strictEqual(opened[0][0], 'revealInExplorer');
		assert.strictEqual((opened[0][1] as vscode.Uri).fsPath, '/repo/generated-files');
	});

	test('runner does not offer to open output folder after AEP dry-run', async () => {
		const selector = commandById('jawn.aep.generate.selector');
		const infos: string[] = [];
		const opened: unknown[][] = [];
		const runner = createCommandRunner({
			output: new MemoryOutputChannel(),
			workspaceFolder: '/repo',
			spawnProcess: () => fakeChildProcess('Generated selector'),
			withProgress: async (_options, task) => task({ report: () => undefined }, new vscode.CancellationTokenSource().token),
			showInformationMessage: async (message: string) => {
				infos.push(message);
				return 'Open Folder' as never;
			},
			showWarningMessage: async () => undefined as never,
			showErrorMessage: async () => undefined as never,
			executeCommand: <T = unknown>(...args: unknown[]): Thenable<T> => {
				opened.push(args);
				return Promise.resolve(undefined as T);
			},
		} satisfies RunnerDeps);

		await runner.run(selector, {
			args: ['--target-org', 'dev', '--sobject', 'Account', '--at4dx', '--dry-run'],
			displayArgs: ['--target-org', 'dev', '--sobject', 'Account', '--at4dx', '--dry-run'],
		});

		assert.deepStrictEqual(infos, ['SF Jawn: AEP Generate Selector completed.']);
		assert.deepStrictEqual(opened, []);
	});

	test('runner strips ANSI output and reports JSON-envelope failures', async () => {
		const access = commandById('jawn.user.access');
		const errors: string[] = [];
		const infos: string[] = [];
		const output = new MemoryOutputChannel();
		const runner = createCommandRunner({
			output,
			spawnProcess: () => fakeChildProcess('\u001b[31m{"status":1,"message":"bad"}\u001b[0m', 0),
			withProgress: async (_options, task) => task({ report: () => undefined }, new vscode.CancellationTokenSource().token),
			showInformationMessage: async (message: string) => {
				infos.push(message);
				return 'Run' as never;
			},
			showWarningMessage: async () => undefined as never,
			showErrorMessage: async (message: string) => {
				errors.push(message);
				return undefined as never;
			},
		} satisfies RunnerDeps);

		await runner.run(access, { args: ['--target-org', 'dev', '--type', 'field', '--target', 'Account.Name'], displayArgs: ['--target-org', 'dev', '--type', 'field', '--target', 'Account.Name'] });

		assert.match(output.value, /"status":1/);
		assert.doesNotMatch(output.value, /\u001b/);
		assert.deepStrictEqual(errors, ['SF Jawn: User Access failed. See the Jawn output channel.']);
		assert.deepStrictEqual(infos, []);
	});

	test('runner runs access immediately and treats cancellation as a user stop, not a failure', async () => {
		const access = commandById('jawn.user.access');
		const errors: string[] = [];
		const infos: string[] = [];
		const spawnedArgs: string[][] = [];
		const output = new MemoryOutputChannel();
		const runner = createCommandRunner({
			output,
			spawnProcess: (_file, args) => {
				spawnedArgs.push([...args]);
				return fakeCancellableChildProcess();
			},
			withProgress: async (_options, task) => {
				const source = new vscode.CancellationTokenSource();
				const promise = task({ report: () => undefined }, source.token);
				source.cancel();
				return promise;
			},
			showInformationMessage: async (message: string) => {
				infos.push(message);
				return 'Run' as never;
			},
			showWarningMessage: async () => undefined as never,
			showErrorMessage: async (message: string) => {
				errors.push(message);
				return undefined as never;
			},
		} satisfies RunnerDeps);

		await runner.run(access, { args: ['--target-org', 'dev'], displayArgs: ['--target-org', 'dev'] });

		assert.deepStrictEqual(errors, []);
		assert.deepStrictEqual(infos, []);
		assert.deepStrictEqual(spawnedArgs, [['jawn', 'user', 'access', '--target-org', 'dev']]);
	});

	test('runner surfaces a JSON result summary when one is available', async () => {
		const access = commandById('jawn.user.access');
		const infos: string[] = [];
		const runner = createCommandRunner({
			output: new MemoryOutputChannel(),
			spawnProcess: () => fakeChildProcess('{"status":0,"result":{"summary":"Access report ready"}}'),
			withProgress: async (_options, task) => task({ report: () => undefined }, new vscode.CancellationTokenSource().token),
			showInformationMessage: async (message: string) => {
				infos.push(message);
				return 'Run' as never;
			},
			showWarningMessage: async () => undefined as never,
			showErrorMessage: async () => undefined as never,
		} satisfies RunnerDeps);

		await runner.run(access, { args: ['--target-org', 'dev'], displayArgs: ['--target-org', 'dev'] });

		assert.deepStrictEqual(infos, [
			'Access report ready',
		]);
	});

	test('runner logs malformed JSON-like output and falls back to process exit code', async () => {
		const access = commandById('jawn.user.access');
		const infos: string[] = [];
		const errors: string[] = [];
		const output = new MemoryOutputChannel();
		const runner = createCommandRunner({
			output,
			spawnProcess: () => fakeChildProcess('{"status":0,', 0),
			withProgress: async (_options, task) => task({ report: () => undefined }, new vscode.CancellationTokenSource().token),
			showInformationMessage: async (message: string) => {
				infos.push(message);
				return 'Run' as never;
			},
			showWarningMessage: async () => undefined as never,
			showErrorMessage: async (message: string) => {
				errors.push(message);
				return undefined as never;
			},
		} satisfies RunnerDeps);

		await runner.run(access, { args: ['--target-org', 'dev'], displayArgs: ['--target-org', 'dev'] });

		assert.match(output.value, /\[debug\] Unable to parse Salesforce CLI JSON envelope:/);
		assert.deepStrictEqual(infos, ['SF Jawn: User Access completed.']);
		assert.deepStrictEqual(errors, []);
	});

	test('gatherInputs passes flag default and last-used value into pickOutputDirectory options', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const store = new LastValueStore(new MemoryMemento());
		await store.set(command.id, 'output-path', 'my-output');
		const receivedOptions: PickOutputDirectoryOptions[] = [];
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async (opts) => {
				receivedOptions.push(opts);
				return undefined;
			},
			showInputBox: async (options) => options.prompt?.includes('SObject') ? 'Account' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'AT4DX'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		await gatherInputs(command, store, inputApi);

		const outputOpts = receivedOptions.find((opts) => opts.flag.name === 'output-path');
		assert.ok(outputOpts, 'pickOutputDirectory should be called for output-path flag');
		assert.strictEqual(outputOpts.defaultValue, 'generated-files');
		assert.strictEqual(outputOpts.lastValue, 'my-output');
	});

	test('gatherInputs stores picked output directory for next invocation', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const store = new LastValueStore(new MemoryMemento());
		const inputApi: InputApi = {
			pickOrg: async () => 'dev',
			pickFile: async () => undefined,
			pickDefFile: async () => undefined,
			pickFolder: async () => undefined,
			pickOutputDirectory: async () => 'custom-output',
			showInputBox: async (options) => options.prompt?.includes('SObject') ? 'Account' : '',
			showQuickPick: async (items) => items.find((item) => item.label === 'AT4DX'),
			showBooleanPick: async () => [],
			showWarningMessage: async () => undefined,
		};

		await gatherInputs(command, store, inputApi);

		const receivedOptions: PickOutputDirectoryOptions[] = [];
		const secondInputApi: InputApi = {
			...inputApi,
			pickOutputDirectory: async (opts) => {
				receivedOptions.push(opts);
				return undefined;
			},
		};
		await gatherInputs(command, store, secondInputApi);
		assert.strictEqual(receivedOptions.find((o) => o.flag.name === 'output-path')?.lastValue, 'custom-output');
	});

	test('pickOutputDirectory shows Quick Pick with default as first item', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return items[0];
			}, async () => {
				const result = await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
				assert.strictEqual(result, 'generated-files');
			});
		});

		const items = capturedItems[0];
		assert.ok(items, 'showQuickPick should have been called');
		assert.strictEqual(items[0].label, 'generated-files');
		assert.strictEqual(items[0].description, 'Default');
	});

	test('pickOutputDirectory includes last-used as second item when different from default', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({
					command, flag, label: 'Output folder',
					defaultValue: 'generated-files',
					lastValue: 'force-app',
				});
			});
		});

		const items = capturedItems[0];
		assert.strictEqual(items[0].label, 'generated-files');
		assert.strictEqual(items[0].description, 'Default');
		assert.strictEqual(items[1].label, 'force-app');
		assert.strictEqual(items[1].description, 'Last used');
	});

	test('pickOutputDirectory returns undefined when Quick Pick is cancelled', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick(() => undefined, async () => {
				const result = await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
				assert.strictEqual(result, undefined);
			});
		});
	});

	test('pickOutputDirectory falls back to folder picker for Choose Different Folder', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => items.find((item) => item.label.includes('Choose Different Folder')), async () => {
				await withOpenDialog([vscode.Uri.file('/repo/custom-dir')], async () => {
					const result = await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
					assert.strictEqual(result, 'custom-dir');
				});
			});
		});
	});

	test('pickOutputDirectory rejects out-of-workspace folders from custom fallback', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const warnings: string[] = [];

		await withWorkspaceFolders(['/repo'], async () => {
			await withQuickPick((items) => items.find((item) => item.label.includes('Choose Different Folder')), async () => {
				await withOpenDialog([vscode.Uri.file('/outside')], async () => {
					await withWarningMessage(async (msg) => {
						warnings.push(msg);
						return undefined;
					}, async () => {
						const result = await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
						assert.strictEqual(result, undefined);
					});
				});
			});
		});

		assert.deepStrictEqual(warnings, ['Choose a folder inside the current workspace.']);
	});

	test('pickOutputDirectory discovers sfdx-project.json package directories', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), JSON.stringify({
			packageDirectories: [
				{ path: 'force-app', default: true },
				{ path: 'packages/shared' },
			],
		}));
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
			});
		});

		const labels = capturedItems[0].map((item) => item.label);
		assert.ok(labels.includes('force-app'), 'should include default package dir');
		assert.ok(labels.includes('packages/shared'), 'should include other package dirs');
	});

	test('pickOutputDirectory puts sfdx default package before non-default packages', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), JSON.stringify({
			packageDirectories: [
				{ path: 'packages/shared' },
				{ path: 'force-app', default: true },
			],
		}));
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
			});
		});

		const packageItems = capturedItems[0].filter((item) => item.description === 'Package directory');
		assert.strictEqual(packageItems[0].label, 'force-app');
		assert.strictEqual(packageItems[1].label, 'packages/shared');
	});

	test('pickOutputDirectory ignores malformed sfdx-project.json without throwing', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), 'not valid json {{{');

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick(() => undefined, async () => {
				const result = await pickOutputDirectory({ command, flag, label: 'Output folder', defaultValue: 'generated-files' });
				assert.strictEqual(result, undefined);
			});
		});
	});

	test('pickOutputDirectory deduplicates candidates', async () => {
		const command = commandById('jawn.aep.generate.selector');
		const flag = command.flags.find((f) => f.name === 'output-path')!;
		const tempDir = mkdtempSync(join(tmpdir(), 'jawn-test-'));
		writeFileSync(join(tempDir, 'sfdx-project.json'), JSON.stringify({
			packageDirectories: [{ path: 'generated-files', default: true }],
		}));
		const capturedItems: vscode.QuickPickItem[][] = [];

		await withWorkspaceFolders([tempDir], async () => {
			await withQuickPick((items) => {
				capturedItems.push([...items]);
				return undefined;
			}, async () => {
				await pickOutputDirectory({
					command, flag, label: 'Output folder',
					defaultValue: 'generated-files',
					lastValue: 'generated-files',
				});
			});
		});

		const generatedFilesItems = capturedItems[0].filter((item) => item.label === 'generated-files');
		assert.strictEqual(generatedFilesItems.length, 1, 'generated-files should appear only once');
		assert.strictEqual(generatedFilesItems[0].description, 'Default');
	});

	test('tree provider exposes lifecycle and nested AEP groups', () => {
		const provider = new JawnCommandsProvider(commands);
		const groups = provider.getChildren();
		assert.deepStrictEqual(groups.map((node) => node.type === 'group' ? node.label : ''), ['User Lifecycle', 'AEP Generation']);

		const lifecycle = groups[0];
		assert.strictEqual(lifecycle.type, 'group');
		assert.deepStrictEqual(provider.getChildren(lifecycle).map((node) => node.type === 'command' ? node.command.id : ''), [
			'jawn.user.provision',
			'jawn.user.access',
			'jawn.user.strip',
			'jawn.user.freeze',
			'jawn.user.unfreeze',
		]);

		const aep = groups[1];
		assert.strictEqual(aep.type, 'group');
		const subgroups = provider.getChildren(aep);
		assert.deepStrictEqual(subgroups.map((node) => node.type === 'subgroup' ? node.label : ''), ['Pattern Layers', 'Selector Injection (AT4DX)', 'Domain Processes (AT4DX)']);

		const generators = subgroups[0];
		assert.strictEqual(generators.type, 'subgroup');
		assert.deepStrictEqual(provider.getChildren(generators).map((node) => node.type === 'command' ? node.command.id : ''), [
			'jawn.aep.generate',
			'jawn.aep.generate.selector',
			'jawn.aep.generate.domain',
			'jawn.aep.generate.service',
			'jawn.aep.generate.unitofwork',
		]);
	});
});

function commandById(id: string): CommandDef {
	const command = commands.find((candidate) => candidate.id === id);
	assert.ok(command, `missing command ${id}`);
	return command;
}

async function withWorkspaceFolders(roots: readonly string[], task: () => Promise<void>): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(vscode.workspace, 'workspaceFolders');
	Object.defineProperty(vscode.workspace, 'workspaceFolders', {
		configurable: true,
		value: roots.map((root, index) => ({ uri: vscode.Uri.file(root), name: root, index })),
	});
	try {
		await task();
	} finally {
		if (descriptor) {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', descriptor);
		} else {
			delete (vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders;
		}
	}
}

async function withOpenDialog(result: readonly vscode.Uri[] | undefined, task: () => Promise<void>): Promise<void> {
	const original = vscode.window.showOpenDialog;
	vscode.window.showOpenDialog = async () => result as vscode.Uri[] | undefined;
	try {
		await task();
	} finally {
		vscode.window.showOpenDialog = original;
	}
}

async function withFindFiles(result: readonly vscode.Uri[], task: () => Promise<void>): Promise<void> {
	const original = vscode.workspace.findFiles;
	(vscode.workspace as unknown as { findFiles: unknown }).findFiles = async () => result;
	try {
		await task();
	} finally {
		(vscode.workspace as unknown as { findFiles: unknown }).findFiles = original;
	}
}

async function withQuickPick(
	handler: (items: readonly vscode.QuickPickItem[]) => vscode.QuickPickItem | undefined,
	task: () => Promise<void>,
): Promise<void> {
	const original = vscode.window.showQuickPick;
	(vscode.window as unknown as { showQuickPick: unknown }).showQuickPick = async (items: readonly vscode.QuickPickItem[]) => handler(items);
	try {
		await task();
	} finally {
		vscode.window.showQuickPick = original;
	}
}

async function withWarningMessage(handler: (message: string) => Thenable<string | undefined>, task: () => Promise<void>): Promise<void> {
	const original = vscode.window.showWarningMessage;
	vscode.window.showWarningMessage = handler as typeof vscode.window.showWarningMessage;
	try {
		await task();
	} finally {
		vscode.window.showWarningMessage = original;
	}
}

class MemoryMemento implements vscode.Memento {
	private readonly values = new Map<string, unknown>();

	public get<T>(key: string): T | undefined;
	public get<T>(key: string, defaultValue: T): T;
	public get<T>(key: string, defaultValue?: T): T | undefined {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}

	public keys(): readonly string[] {
		return [...this.values.keys()];
	}

	public update(key: string, value: unknown): Thenable<void> {
		this.values.set(key, value);
		return Promise.resolve();
	}
}

class MemoryOutputChannel implements vscode.OutputChannel {
	public value = '';
	public readonly name = 'Jawn';

	public append(value: string): void {
		this.value += value;
	}

	public appendLine(value: string): void {
		this.value += `${value}\n`;
	}

	public clear(): void {}
	public show(): void {}
	public hide(): void {}
	public dispose(): void {}
	public replace(value: string): void {
		this.value = value;
	}
}

function fakeChildProcess(stdout: string, code = 0): any {
	const child = new EventEmitter() as any;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = () => true;
	setImmediate(() => {
		child.stdout.emit('data', stdout);
		child.emit('close', code);
	});
	return child;
}

function fakeCancellableChildProcess(): any {
	const child = new EventEmitter() as any;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	child.kill = () => {
		setImmediate(() => child.emit('close', null));
		return true;
	};
	return child;
}
