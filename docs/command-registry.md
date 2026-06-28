# Command Registry

The Command Registry defines all available Jawn commands and their flags. It is automatically generated from the jawn CLI plugin's oclif manifest.

## Overview

The registry has two layers:

1. **Type definitions** (`src/registry/types.ts`) — `CommandDef` and `FlagDef` interfaces
2. **Command data** (`src/registry/commands.generated.ts`) — Auto-generated from the oclif manifest

## Regenerating Commands

When the jawn plugin releases new commands or changes flag definitions, regenerate the registry:

```bash
npm run gen:commands -- vendor/jawn.oclif.manifest.json src/registry/commands.generated.ts
```

This script:
1. Parses the oclif manifest (JSON)
2. Filters to whitelisted commands (see `allowList`)
3. Extracts flags and infers UI metadata
4. Writes `src/registry/commands.generated.ts`
5. Updates `package.json` contributes list

## Command Definition (`CommandDef`)

```typescript
interface CommandDef {
  id: string;                     // VS Code command ID (e.g., 'jawn.user.provision')
  cliId: string;                  // CLI command ID (e.g., 'jawn user provision')
  title: string;                  // Display title (e.g., 'SF Jawn: User Provision')
  group: string;                  // Sidebar group ('User Lifecycle' or 'AEP Generation')
  subgroup?: string;              // Subgroup for AEP commands
  supportsNoPrompt?: boolean;     // If true, add --no-prompt automatically
  destructive?: boolean;          // If true, use dry-run → confirm → apply workflow
  requireOneOf?: string[];        // At least one of these flags must be selected (e.g., selector, domain, unitofwork)
  flags: FlagDef[];               // Flag definitions in prompt order
}
```

## Flag Definition (`FlagDef`)

```typescript
interface FlagDef {
  name: string;                 // CLI flag name (e.g., 'target-org')
  kind: FlagKind;               // UI type ('org' | 'file' | 'outputDir' | 'string' | 'boolean' | 'apiVersion' | 'enum')
  summary?: string;             // Description shown to user
  required?: boolean;           // If true, flag is mandatory
  options?: string[];           // For enum kind: allowed values
  placeholder?: string;         // For string/file kinds: example text
  exclusiveGroup?: string;      // Mutually exclusive group name
  default?: string;             // Default value
}
```

## Flag Kinds

The UI presentation of each flag is determined by its `kind`:

| Kind | Picker | Use case |
|------|--------|----------|
| `org` | Org picker with cached value | `--target-org` |
| `file` | File open dialog | Definition files like `--users-def`, `--object-list` |
| `outputDir` | Directory picker (Quick Pick + fallback to native dialog) | `--output-path` for generated files |
| `string` | Text input box | Names, prefixes, class names, email addresses |
| `apiVersion` | Text input box with version number validation | `--api-version` |
| `enum` | Quick Pick with predefined options | `--trigger-operation` (create, update, delete) |
| `boolean` | Multi-select Quick Pick | `--dry-run`, artifact toggles (selector, domain, unitofwork) |

## Generation Rules

The `scripts/gen-commands.ts` script applies these rules:

### Whitelisting

Only commands in the `allowList` are exposed. This prevents accidental inclusion of CLI-only or internal commands. Current whitelisted commands:

- `jawn user provision`
- `jawn user access`
- `jawn user strip`
- `jawn user freeze`
- `jawn user unfreeze`
- `jawn aep generate`
- `jawn aep generate selector`
- `jawn aep generate domain`
- `jawn aep generate service`
- `jawn aep generate unitofwork`
- `jawn aep generate selector method`
- `jawn aep generate selector field-injection`
- `jawn aep generate action`
- `jawn aep generate criteria`

### Flag Kind Inference

Flag kind is inferred based on the flag name and type:

```typescript
function flagKind(name: string, flag: ManifestFlag): string {
  if (name === 'target-org') return 'org';
  if (name === 'api-version') return 'apiVersion';
  if (name === 'output-path') return 'outputDir';
  if (flag.type === 'boolean') return 'boolean';
  if (flag.options?.length) return 'enum';
  if (flag.type === 'option' && /file|path|def$/.test(name)) return 'file';
  return 'string';  // Default
}
```

### Exclusive Groups

Some flags are mutually exclusive and grouped for single-select UI:

- **`flavor`** — Flags: `--at4dx`, `--fflib`
  - Used to select AEP architecture pattern
  - Only one can be selected

- **`userTarget`** — Flags: `--user`, `--users-def`
  - Used to select how users are specified
  - Only one can be selected

### Hidden Flags

Some CLI flags are hidden from the UI (not prompted for):

- `--json` — Extension reads human-readable output
- `--no-prompt` — Added automatically if `supportsNoPrompt: true`
- `--api-version` — Not exposed; could be added if needed
- `--flags-dir` — Not supported

Some commands have additional hidden flags:

- `jawn user access` — Hides `--output` (output is shown in Input Box instead)

### Flag Ordering

Flags are prompted in this order:

1. Flags specified in the flag order rules
2. All other flags in manifest order

Order rules apply per-command to important flags first:

- For `jawn user strip`, `jawn user freeze`, `jawn user unfreeze`:
  - `--external-id` (first)
  - `--user` (second)
  - Rest in order

### Placeholders

Input boxes show placeholder text to guide the user:

- `*:user` → `myUser@email.com` (any command)
- `jawn user access:target` → `Object__c.Field__c` (specific command)

Placeholders are defined as `placeholderByCommandFlag` map and can be extended.

### Summaries

Summaries are displayed as descriptions in pickers and input boxes, sourced in this priority:

1. Custom summary from `summaryByCommandFlag` map
2. Wildcard summary (`*:flagName`)
3. Flag's own `summary` from manifest
4. Flag's own `description` from manifest
5. (no summary if none match)

## Extending the Registry

### To add a new command

1. Ensure the command is added to the jawn CLI plugin (not this extension)
2. Add the command ID to `allowList` in `scripts/gen-commands.ts`
3. Add a title mapping to `titleById`
4. Add group/subgroup mappings to `groupById` / `subgroupById`
5. Add any ordering, placeholder, or summary overrides
6. Run `npm run gen:commands` to regenerate

### To add a new flag kind

1. Add the kind string to `FlagKind` in `src/registry/types.ts`
2. Add inference logic to `flagKind()` in `scripts/gen-commands.ts`
3. Add UI handling in `src/input/gatherInputs.ts` (new `gatherFlag()` branch or new method on `InputApi`)
4. Wire the real implementation in `createVsCodeInputApi()`
5. Add tests to `src/test/extension.test.ts`

See [input-system.md](input-system.md#adding-a-new-flag-kind) for the full process.

### To adjust UI metadata

Edit the maps in `scripts/gen-commands.ts`:

- `titleById` — Display name for Command Palette
- `groupById` — Sidebar group (User Lifecycle, AEP Generation, etc.)
- `subgroupById` — Subgroup for AEP commands
- `placeholderByCommandFlag` — Placeholder text for input boxes
- `summaryByCommandFlag` — Description text for pickers
- `guiHiddenFlagsByCommand` — Flags to exclude from UI
- `flavorFlags`, `userTargetFlags` — Exclusive flag groups
- Flag ordering in `flagOrder()`

After editing, run `npm run gen:commands` to update.

## Example: Generated Command

Here's how `jawn user provision` looks after generation:

```typescript
{
  id: 'jawn.user.provision',
  cliId: 'jawn user provision',
  title: 'SF Jawn: User Provision',
  group: 'User Lifecycle',
  supportsNoPrompt: true,
  flags: [
    {
      name: 'target-org',
      kind: 'org',
      required: true,
      summary: 'Salesforce org alias or username',
    },
    {
      name: 'user',
      kind: 'string',
      placeholder: 'myUser@email.com',
      summary: 'User value to match.',
    },
    {
      name: 'firstName',
      kind: 'string',
      summary: 'First name of the provision user',
    },
    // ... more flags
  ],
}
```

When this is executed, the extension:
1. Prompts for each flag in order (org, user, firstName, ...)
2. Builds args: `['jawn', 'user', 'provision', '--target-org=my-org', '--user=test@example.com', ...]`
3. Adds internal flag: `--no-prompt` (because `supportsNoPrompt: true`)
4. Spawns: `sf jawn user provision --target-org=my-org --user=test@example.com --no-prompt`
