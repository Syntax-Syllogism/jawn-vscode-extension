import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
	['jawn aep generate', 'SF Jawn: AEP Generate'],
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
	['jawn aep generate', 'Generators'],
	['jawn aep generate selector', 'Generators'],
	['jawn aep generate domain', 'Generators'],
	['jawn aep generate service', 'Generators'],
	['jawn aep generate unitofwork', 'Generators'],
	['jawn aep generate selector method', 'Selector Helpers'],
	['jawn aep generate selector field-injection', 'Selector Helpers'],
	['jawn aep generate action', 'Domain-Process Bindings'],
	['jawn aep generate criteria', 'Domain-Process Bindings'],
]);

const requireOneOfById = new Map([
	['jawn aep generate', ['selector', 'domain', 'unit-of-work']],
]);

const flavorFlags = new Set(['at4dx', 'fflib']);
const userTargetFlags = new Set(['user', 'users-def']);

const guiHiddenFlagsByCommand = new Map<string, Set<string>>([
	['jawn user access', new Set(['output'])],
]);

const placeholderByCommandFlag = new Map([
	['*:user', 'myUser@email.com'],
	['jawn user access:target', 'Object__c.Field__c'],
]);

const summaryByCommandFlag = new Map([
	['*:user', 'User value to match.'],
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
		supportsNoPrompt: supportsNoPrompt || undefined,
		destructive: cliId === 'jawn user strip' ? true : undefined,
		requireOneOf: requireOneOfById.get(cliId),
		flags: Object.entries(command.flags ?? {})
			.filter(([name]) => shouldPromptForFlag(cliId, name))
			.sort(([left], [right]) => flagOrder(cliId, left) - flagOrder(cliId, right))
			.map(([name, flag]) => omitUndefined({
				name,
				kind: flagKind(name, flag),
				summary: summaryFor(cliId, name, flag),
				required: flag.required || undefined,
				options: flag.options,
				placeholder: placeholderFor(cliId, name),
				exclusiveGroup: exclusiveGroupFor(command, name),
				default: flag.default,
			})),
	});
}

function shouldPromptForFlag(commandId: string, name: string): boolean {
	if (name === 'json' || name === 'no-prompt' || name === 'api-version' || name === 'flags-dir') {
		return false;
	}

	return !guiHiddenFlagsByCommand.get(commandId)?.has(name);
}

function flagKind(name: string, flag: ManifestFlag): string {
	if (name === 'target-org') {
		return 'org';
	}
	if (name === 'api-version') {
		return 'apiVersion';
	}
	if (name === 'output-path') {
		return 'outputDir';
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

function placeholderFor(commandId: string, flagName: string): string | undefined {
	return placeholderByCommandFlag.get(`${commandId}:${flagName}`) ?? placeholderByCommandFlag.get(`*:${flagName}`);
}

function summaryFor(commandId: string, flagName: string, flag: ManifestFlag): string | undefined {
	return summaryByCommandFlag.get(`${commandId}:${flagName}`) ?? summaryByCommandFlag.get(`*:${flagName}`) ?? flag.summary ?? flag.description;
}

function flagOrder(commandId: string, flagName: string): number {
	if (!['jawn user strip', 'jawn user freeze', 'jawn user unfreeze'].includes(commandId)) {
		return 0;
	}

	if (flagName === 'external-id') {
		return -2;
	}

	if (flagName === 'user') {
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

if (import.meta.url === `file://${process.argv[1]}`) {
	const manifestPath = resolve(process.argv[2] ?? 'vendor/jawn.oclif.manifest.json');
	const outputPath = resolve(process.argv[3] ?? 'src/registry/commands.generated.ts');
	const packageJsonPath = resolve(process.argv[4] ?? 'package.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as OclifManifest;
	writeFileSync(outputPath, generateRegistry(manifest));
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
	writeFileSync(packageJsonPath, `${JSON.stringify(updatePackageContributesCommands(packageJson, manifest), null, 2)}\n`);
}
