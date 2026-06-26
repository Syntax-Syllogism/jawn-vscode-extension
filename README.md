# Jawn

Jawn is a VS Code extension for guided `@syntax-syllogism/jawn` Salesforce CLI workflows.

## Features

- Command Palette entries for the v1 user lifecycle commands:
  - `SF Jawn: User Provision`
  - `SF Jawn: User Access`
  - `SF Jawn: User Strip`
  - `SF Jawn: User Freeze`
  - `SF Jawn: User Unfreeze`
- A dedicated Jawn activity-bar view grouped by workflow area.
- Native VS Code prompts for orgs, definition files, enum values, text values, and boolean options.
- Background `sf jawn ...` execution through `child_process.spawn`, streamed to the `Jawn` Output Channel.
- Background CLI execution with streamed human-readable output and `--no-prompt` on commands that support it.
- Dry-run-first confirmation for destructive user strip operations.

## Requirements

Install the Salesforce CLI and the jawn plugin before running commands:

```sh
sf plugins install @syntax-syllogism/jawn
```

The extension checks for `sf` and `sf jawn --help` before the first command run. If the plugin is missing, it offers an install action.

## Extension Settings

- `jawn.defaultTargetOrg`: default Salesforce org alias or username for future workflows.

## Development

```sh
npm install
npm test
npm run package:vsix
```

Refresh the committed command registry from a jawn oclif manifest:

```sh
npm run gen:commands -- vendor/jawn.oclif.manifest.json src/registry/commands.generated.ts
```
