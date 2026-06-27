export type FlagKind = 'org' | 'file' | 'outputDir' | 'string' | 'boolean' | 'apiVersion' | 'enum';

export interface FlagDef {
	name: string;
	kind: FlagKind;
	summary?: string;
	required?: boolean;
	options?: readonly string[];
	placeholder?: string;
	exclusiveGroup?: string;
	default?: string;
}

export interface CommandDef {
	id: string;
	cliId: string;
	title: string;
	group: string;
	subgroup?: string;
	supportsNoPrompt?: boolean;
	destructive?: boolean;
	requireOneOf?: readonly string[];
	flags: readonly FlagDef[];
}
