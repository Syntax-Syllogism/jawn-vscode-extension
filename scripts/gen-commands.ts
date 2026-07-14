import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface ManifestFlag {
	name?: string;
	type?: string;
	summary?: string;
	description?: string;
	required?: boolean;
	options?: string[];
	default?: string;
}

interface ManifestCommand {
	id: string;
	description?: string;
	summary?: string;
	flags?: Record<string, ManifestFlag>;
}

interface OclifManifest {
	commands: Record<string, ManifestCommand>;
}

interface PackageJson {
	contributes?: {
		commands?: ContributedCommand[];
	};
}

interface ContributedCommand {
	command: string;
	title: string;
}

const allowList = new Set([
	'jawn user provision',
	'jawn user access',
	'jawn user strip',
	'jawn user freeze',
	'jawn user unfreeze',
	'jawn user snapshot',
	'jawn user restore',
	'jawn user diff',
	'jawn aep generate',
	'jawn aep generate selector',
	'jawn aep generate domain',
	'jawn aep generate service',
	'jawn aep generate unitofwork',
	'jawn aep generate selector method',
	'jawn aep generate selector field-injection',
	'jawn aep generate action',
	'jawn aep generate criteria',
]);

const titleById = new Map([
	['jawn user provision', 'SF Jawn: User Provision'],
	['jawn user access', 'SF Jawn: User Access'],
	['jawn user strip', 'SF Jawn: User Strip'],
	['jawn user freeze', 'SF Jawn: User Freeze'],
	['jawn user unfreeze', 'SF Jawn: User Unfreeze'],
	['jawn user snapshot', 'SF Jawn: User Snapshot'],
	['jawn user restore', 'SF Jawn: User Restore'],
	['jawn user diff', 'SF Jawn: User Diff'],
	['jawn aep generate', 'SF Jawn: AEP Generate (Multiple)'],
	['jawn aep generate selector', 'SF Jawn: AEP Generate Selector'],
	['jawn aep generate domain', 'SF Jawn: AEP Generate Domain'],
	['jawn aep generate service', 'SF Jawn: AEP Generate Service'],
	['jawn aep generate unitofwork', 'SF Jawn: AEP Generate Unit of Work'],
	['jawn aep generate selector method', 'SF Jawn: AEP Selector Method'],
	['jawn aep generate selector field-injection', 'SF Jawn: AEP Selector Field Injection'],
	['jawn aep generate action', 'SF Jawn: AEP Generate Action'],
	['jawn aep generate criteria', 'SF Jawn: AEP Generate Criteria'],
]);

const groupById = new Map([
	['jawn user provision', 'User Lifecycle'],
	['jawn user access', 'User Lifecycle'],
	['jawn user strip', 'User Lifecycle'],
	['jawn user freeze', 'User Lifecycle'],
	['jawn user unfreeze', 'User Lifecycle'],
	['jawn user snapshot', 'User Lifecycle'],
	['jawn user restore', 'User Lifecycle'],
	['jawn user diff', 'User Lifecycle'],
	['jawn aep generate', 'AEP Generation'],
	['jawn aep generate selector', 'AEP Generation'],
	['jawn aep generate domain', 'AEP Generation'],
	['jawn aep generate service', 'AEP Generation'],
	['jawn aep generate unitofwork', 'AEP Generation'],
	['jawn aep generate selector method', 'AEP Generation'],
	['jawn aep generate selector field-injection', 'AEP Generation'],
	['jawn aep generate action', 'AEP Generation'],
	['jawn aep generate criteria', 'AEP Generation'],
]);

const subgroupById = new Map([
	['jawn aep generate', 'Pattern Layers'],
	['jawn aep generate selector', 'Pattern Layers'],
	['jawn aep generate domain', 'Pattern Layers'],
	['jawn aep generate service', 'Pattern Layers'],
	['jawn aep generate unitofwork', 'Pattern Layers'],
	['jawn aep generate selector method', 'Selector Injection (AT4DX)'],
	['jawn aep generate selector field-injection', 'Selector Injection (AT4DX)'],
	['jawn aep generate action', 'Domain Processes (AT4DX)'],
	['jawn aep generate criteria', 'Domain Processes (AT4DX)'],
]);

const requireOneOfById = new Map([
	['jawn aep generate', ['selector', 'domain', 'unit-of-work']],
]);

const flavorFlags = new Set(['at4dx', 'fflib']);
const userTargetFlags = new Set(['user', 'users-def']);

const guiHiddenFlagsByCommand = new Map<string, Set<string>>([
	['jawn user access', new Set(['output'])],
	['jawn user snapshot', new Set(['out'])],
	['jawn user diff', new Set(['output'])],
]);

const placeholderByCommandFlag = new Map([
	['*:user', 'Username:myUser@email.com'],
	['jawn user access:target', 'Object__c.Field__c'],
	['jawn user diff:against', 'Username:otherUser@email.com'],
]);

const summaryByCommandFlag = new Map([
	['*:user', 'Target a single user as field:value (e.g. Username:user@example.com).'],
	['jawn user strip:external-id', 'Default field used to match users in the definition file.'],
	['jawn user freeze:external-id', 'Default field used to match users in the definition file.'],
	['jawn user unfreeze:external-id', 'Default field used to match users in the definition file.'],
	['jawn user diff:against', 'Compare against this baseline user or persona.'],
	['jawn user restore:snapshot', 'Snapshot JSON file to restore from.'],
	['jawn aep generate action:class-name', 'Action class name to generate.'],
	['jawn aep generate criteria:class-name', 'Criteria class name to generate.'],
]);

export function generateRegistry(manifest: OclifManifest): string {
	const commands = lifecycleCommands(manifest).map((command) => commandDef(command));

	return `import type { CommandDef } from './types';\n\nexport const commands: readonly CommandDef[] = ${JSON.stringify(commands, null, '\t')} as const;\n`;
}

export function generateContributesCommands(manifest: OclifManifest): ContributedCommand[] {
	return lifecycleCommands(manifest).map((command) => ({
		command: vscodeCommandId(command.id),
		title: titleById.get(cliCommandId(command.id)) ?? cliCommandId(command.id),
	}));
}

export function updatePackageContributesCommands(packageJson: PackageJson, manifest: OclifManifest): PackageJson {
	return {
		...packageJson,
		contributes: {
			...packageJson.contributes,
			commands: generateContributesCommands(manifest),
		},
	};
}

function lifecycleCommands(manifest: OclifManifest): ManifestCommand[] {
	return Object.values(manifest.commands)
		.filter((command) => allowList.has(cliCommandId(command.id)))
		.sort((left, right) => [...allowList].indexOf(cliCommandId(left.id)) - [...allowList].indexOf(cliCommandId(right.id)));
}

function commandDef(command: ManifestCommand): Record<string, unknown> {
	const cliId = cliCommandId(command.id);
	const supportsNoPrompt = Boolean(command.flags?.['no-prompt']);
	return omitUndefined({
		id: vscodeCommandId(command.id),
		cliId,
		title: titleById.get(cliId) ?? cliId,
		group: groupById.get(cliId) ?? 'User Lifecycle',
		subgroup: subgroupById.get(cliId),
		// restore exposes --no-prompt as a normal picker option; it must not be
		// injected or routed through the special confirmation strategy.
		supportsNoPrompt: supportsNoPrompt && cliId !== 'jawn user restore' ? true : undefined,
		destructive: cliId === 'jawn user strip' ? true : undefined,
		requireOneOf: requireOneOfById.get(cliId),
		flags: Object.entries(command.flags ?? {})
			.filter(([name]) => shouldPromptForFlag(cliId, name))
			.sort(([left], [right]) => flagOrder(cliId, left) - flagOrder(cliId, right))
			.map(([name, flag]) => omitUndefined({
				name,
				kind: flagKind(cliId, name, flag),
				summary: summaryFor(cliId, name, flag),
				required: flag.required || requiredOverride(cliId, name) || undefined,
				options: flag.options,
				placeholder: placeholderFor(cliId, name),
				exclusiveGroup: exclusiveGroupFor(command, name),
				dependsOnFlag: dependsOnFlagFor(command, name),
				default: flag.default,
			})),
	});
}

function requiredOverride(commandId: string, flagName: string): boolean {
	return commandId === 'jawn user diff' && (flagName === 'against' || flagName === 'personas-def');
}

function shouldPromptForFlag(commandId: string, name: string): boolean {
	if (name === 'json' || (name === 'no-prompt' && commandId !== 'jawn user restore') || name === 'api-version' || name === 'flags-dir') {
		return false;
	}

	return !guiHiddenFlagsByCommand.get(commandId)?.has(name);
}

function flagKind(commandId: string, name: string, flag: ManifestFlag): string {
	if (name === 'target-org') {
		return 'org';
	}
	if (name === 'api-version') {
		return 'apiVersion';
	}
	if (name === 'output-path') {
		return 'outputDir';
	}
	if (commandId === 'jawn user restore' && name === 'snapshot') {
		return 'file';
	}
	if (flag.type === 'boolean') {
		return 'boolean';
	}
	if (flag.options?.length) {
		return 'enum';
	}
	if (flag.type === 'option' && /file|path|def$/.test(name)) {
		return 'file';
	}

	return 'string';
}

function exclusiveGroupFor(command: ManifestCommand, flagName: string): string | undefined {
	if (flavorFlags.has(flagName)) {
		return 'flavor';
	}

	const commandFlagNames = new Set(Object.keys(command.flags ?? {}));
	if (userTargetFlags.has(flagName) && commandFlagNames.has('user') && commandFlagNames.has('users-def')) {
		return 'userTarget';
	}

	return undefined;
}

function dependsOnFlagFor(command: ManifestCommand, flagName: string): string | undefined {
	const commandId = cliCommandId(command.id);
	const explicit = new Map([
		['jawn user diff:against', 'user'],
		['jawn user diff:personas-def', 'users-def'],
	]).get(`${commandId}:${flagName}`);
	if (explicit) {
		return explicit;
	}
	if (flagName !== 'external-id') {
		return undefined;
	}

	// `external-id` only sets the default match field for `--users-def` entries, so
	// defer it to the def-file branch of the userTarget choice (single-user mode
	// carries its own `field:value`). Scope to commands that offer that choice.
	const commandFlagNames = new Set(Object.keys(command.flags ?? {}));
	if (commandFlagNames.has('user') && commandFlagNames.has('users-def')) {
		return 'users-def';
	}

	return undefined;
}

function placeholderFor(commandId: string, flagName: string): string | undefined {
	return placeholderByCommandFlag.get(`${commandId}:${flagName}`) ?? placeholderByCommandFlag.get(`*:${flagName}`);
}

function summaryFor(commandId: string, flagName: string, flag: ManifestFlag): string | undefined {
	return summaryByCommandFlag.get(`${commandId}:${flagName}`) ?? summaryByCommandFlag.get(`*:${flagName}`) ?? flag.summary ?? flag.description;
}

function flagOrder(commandId: string, flagName: string): number {
	if (!['jawn user strip', 'jawn user freeze', 'jawn user unfreeze', 'jawn user snapshot', 'jawn user diff'].includes(commandId)) {
		return 0;
	}

	// Surface the userTarget choice (single user vs. definition file) before
	// `--target-org` and the rest. `--external-id` is not ordered here: it carries
	// `dependsOnFlag` and is only prompted within the `--users-def` branch.
	if (flagName === 'user') {
		return -1;
	}
	if (flagName === 'users-def') {
		return -1;
	}

	return 0;
}

function cliCommandId(manifestId: string): string {
	return manifestId.replace(/:/g, ' ');
}

function vscodeCommandId(manifestId: string): string {
	return manifestId.replace(/:/g, '.').replaceAll(' ', '.');
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const manifestPath = resolve(process.argv[2] ?? 'vendor/jawn.oclif.manifest.json');
	const outputPath = resolve(process.argv[3] ?? 'src/registry/commands.generated.ts');
	const packageJsonPath = resolve(process.argv[4] ?? 'package.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as OclifManifest;
	writeFileSync(outputPath, generateRegistry(manifest));
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
	writeFileSync(packageJsonPath, `${JSON.stringify(updatePackageContributesCommands(packageJson, manifest), null, 2)}\n`);
}
