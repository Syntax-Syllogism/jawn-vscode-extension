import type { CommandDef } from './types';

export const commands: readonly CommandDef[] = [
	{
		"id": "jawn.user.provision",
		"cliId": "jawn user provision",
		"title": "SF Jawn: User Provision",
		"group": "User Lifecycle",
		"supportsNoPrompt": true,
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "users-def",
				"kind": "file",
				"summary": "Path to user definition JSON file.",
				"required": true
			},
			{
				"name": "personas-def",
				"kind": "file",
				"summary": "Path to persona definition JSON file.",
				"required": true
			},
			{
				"name": "external-id",
				"kind": "string",
				"summary": "User field used to match existing users by default. Per-user `match` overrides this for individual rows. If omitted, all entries are treated as inserts."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Validate and plan actions without any write operations."
			}
		]
	},
	{
		"id": "jawn.user.access",
		"cliId": "jawn user access",
		"title": "SF Jawn: User Access",
		"group": "User Lifecycle",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "type",
				"kind": "enum",
				"summary": "Target type to audit. Phase 1 supports field and object.",
				"required": true,
				"options": [
					"field",
					"object"
				]
			},
			{
				"name": "target",
				"kind": "string",
				"summary": "Target API name. Use Object.Field for field type and Object for object type.",
				"required": true,
				"placeholder": "Object__c.Field__c"
			}
		]
	},
	{
		"id": "jawn.user.strip",
		"cliId": "jawn user strip",
		"title": "SF Jawn: User Strip",
		"group": "User Lifecycle",
		"supportsNoPrompt": true,
		"destructive": true,
		"flags": [
			{
				"name": "external-id",
				"kind": "string",
				"summary": "Default User field used to match entries in `--users-def`."
			},
			{
				"name": "user",
				"kind": "string",
				"summary": "User value to match.",
				"placeholder": "myUser@email.com",
				"exclusiveGroup": "userTarget"
			},
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "users-def",
				"kind": "file",
				"summary": "Path to a user definition JSON file.",
				"exclusiveGroup": "userTarget"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Validate and plan actions without any write operations."
			},
			{
				"name": "no-freeze",
				"kind": "boolean",
				"summary": "Skip the initial freeze step."
			},
			{
				"name": "no-deactivate",
				"kind": "boolean",
				"summary": "Skip the final deactivation step."
			},
			{
				"name": "keep-permsets",
				"kind": "boolean",
				"summary": "Keep permission set assignments."
			},
			{
				"name": "keep-permset-groups",
				"kind": "boolean",
				"summary": "Keep permission set group assignments."
			},
			{
				"name": "keep-licenses",
				"kind": "boolean",
				"summary": "Keep permission set license assignments."
			},
			{
				"name": "keep-public-groups",
				"kind": "boolean",
				"summary": "Keep public group memberships."
			},
			{
				"name": "keep-queues",
				"kind": "boolean",
				"summary": "Keep queue memberships."
			}
		]
	},
	{
		"id": "jawn.user.freeze",
		"cliId": "jawn user freeze",
		"title": "SF Jawn: User Freeze",
		"group": "User Lifecycle",
		"supportsNoPrompt": true,
		"flags": [
			{
				"name": "external-id",
				"kind": "string",
				"summary": "Default User field used to match entries in `--users-def`."
			},
			{
				"name": "user",
				"kind": "string",
				"summary": "User value to match.",
				"placeholder": "myUser@email.com",
				"exclusiveGroup": "userTarget"
			},
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "users-def",
				"kind": "file",
				"summary": "Path to a user definition JSON file.",
				"exclusiveGroup": "userTarget"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Validate and plan actions without any write operations."
			}
		]
	},
	{
		"id": "jawn.user.unfreeze",
		"cliId": "jawn user unfreeze",
		"title": "SF Jawn: User Unfreeze",
		"group": "User Lifecycle",
		"supportsNoPrompt": true,
		"flags": [
			{
				"name": "external-id",
				"kind": "string",
				"summary": "Default User field used to match entries in `--users-def`."
			},
			{
				"name": "user",
				"kind": "string",
				"summary": "User value to match.",
				"placeholder": "myUser@email.com",
				"exclusiveGroup": "userTarget"
			},
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "users-def",
				"kind": "file",
				"summary": "Path to a user definition JSON file.",
				"exclusiveGroup": "userTarget"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Validate and plan actions without any write operations."
			}
		]
	},
	{
		"id": "jawn.aep.generate",
		"cliId": "jawn aep generate",
		"title": "SF Jawn: AEP Generate",
		"group": "AEP Generation",
		"subgroup": "Generators",
		"requireOneOf": [
			"selector",
			"domain",
			"unit-of-work"
		],
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "binding-sequence",
				"kind": "string",
				"summary": "Binding sequence value for AT4DX unit-of-work metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "selector",
				"kind": "boolean",
				"summary": "Include selector artifacts in aggregate generation."
			},
			{
				"name": "domain",
				"kind": "boolean",
				"summary": "Include domain artifacts in aggregate generation."
			},
			{
				"name": "unit-of-work",
				"kind": "boolean",
				"summary": "Include unit-of-work artifacts in aggregate generation."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.selector",
		"cliId": "jawn aep generate selector",
		"title": "SF Jawn: AEP Generate Selector",
		"group": "AEP Generation",
		"subgroup": "Generators",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.domain",
		"cliId": "jawn aep generate domain",
		"title": "SF Jawn: AEP Generate Domain",
		"group": "AEP Generation",
		"subgroup": "Generators",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.service",
		"cliId": "jawn aep generate service",
		"title": "SF Jawn: AEP Generate Service",
		"group": "AEP Generation",
		"subgroup": "Generators",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias."
			},
			{
				"name": "service-basename",
				"kind": "string",
				"summary": "Base name used for generated service classes.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.unitofwork",
		"cliId": "jawn aep generate unitofwork",
		"title": "SF Jawn: AEP Generate Unit of Work",
		"group": "AEP Generation",
		"subgroup": "Generators",
		"flags": [
			{
				"name": "target-org",
				"kind": "org",
				"summary": "Target org username or alias.",
				"required": true
			},
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "at4dx",
				"kind": "boolean",
				"summary": "Generate AT4DX-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "fflib",
				"kind": "boolean",
				"summary": "Generate fflib-flavor artifacts.",
				"exclusiveGroup": "flavor"
			},
			{
				"name": "binding-sequence",
				"kind": "string",
				"summary": "Binding sequence value for AT4DX unit-of-work metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "prefix",
				"kind": "string",
				"summary": "Optional namespace-style class prefix."
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.selector.method",
		"cliId": "jawn aep generate selector method",
		"title": "SF Jawn: AEP Selector Method",
		"group": "AEP Generation",
		"subgroup": "Selector Helpers",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "class-name",
				"kind": "string",
				"summary": "Selector method-injection class name.",
				"required": true
			},
			{
				"name": "sobject-selector-class-name",
				"kind": "string",
				"summary": "Selector implementation class name used by method injection.",
				"required": true
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.selector.field-injection",
		"cliId": "jawn aep generate selector field-injection",
		"title": "SF Jawn: AEP Selector Field Injection",
		"group": "AEP Generation",
		"subgroup": "Selector Helpers",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "fields",
				"kind": "string",
				"summary": "Comma-separated API names for field-set displayed fields.",
				"required": true
			},
			{
				"name": "fieldset-name",
				"kind": "string",
				"summary": "Optional field-set API name for selector field injection."
			},
			{
				"name": "label",
				"kind": "string",
				"summary": "Optional label value for generated metadata artifacts."
			},
			{
				"name": "description",
				"kind": "string",
				"summary": "Optional description value written into generated metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.action",
		"cliId": "jawn aep generate action",
		"title": "SF Jawn: AEP Generate Action",
		"group": "AEP Generation",
		"subgroup": "Domain-Process Bindings",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "class-name",
				"kind": "string",
				"summary": "Selector method-injection class name.",
				"required": true
			},
			{
				"name": "trigger-operation",
				"kind": "enum",
				"summary": "Trigger operation enum value for AT4DX domain-process bindings.",
				"options": [
					"Before_Insert",
					"Before_Update",
					"Before_Delete",
					"After_Insert",
					"After_Update",
					"After_Delete",
					"After_Undelete"
				]
			},
			{
				"name": "order",
				"kind": "string",
				"summary": "Order-of-execution token used for AT4DX domain-process bindings (for example, 10.1)."
			},
			{
				"name": "process-name",
				"kind": "string",
				"summary": "Optional process token used to build AT4DX binding developer names."
			},
			{
				"name": "description",
				"kind": "string",
				"summary": "Optional description value written into generated metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	},
	{
		"id": "jawn.aep.generate.criteria",
		"cliId": "jawn aep generate criteria",
		"title": "SF Jawn: AEP Generate Criteria",
		"group": "AEP Generation",
		"subgroup": "Domain-Process Bindings",
		"flags": [
			{
				"name": "sobject",
				"kind": "string",
				"summary": "SObject API name used for generated artifacts.",
				"required": true
			},
			{
				"name": "class-name",
				"kind": "string",
				"summary": "Selector method-injection class name.",
				"required": true
			},
			{
				"name": "trigger-operation",
				"kind": "enum",
				"summary": "Trigger operation enum value for AT4DX domain-process bindings.",
				"options": [
					"Before_Insert",
					"Before_Update",
					"Before_Delete",
					"After_Insert",
					"After_Update",
					"After_Delete",
					"After_Undelete"
				]
			},
			{
				"name": "order",
				"kind": "string",
				"summary": "Order-of-execution token used for AT4DX domain-process bindings (for example, 10.1)."
			},
			{
				"name": "process-name",
				"kind": "string",
				"summary": "Optional process token used to build AT4DX binding developer names."
			},
			{
				"name": "description",
				"kind": "string",
				"summary": "Optional description value written into generated metadata."
			},
			{
				"name": "output-path",
				"kind": "outputDir",
				"summary": "Output folder relative to the Salesforce project root.",
				"default": "generated-files"
			},
			{
				"name": "dry-run",
				"kind": "boolean",
				"summary": "Render and validate generation output without writing files."
			}
		]
	}
] as const;
