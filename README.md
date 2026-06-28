# Jawn

Jawn is a VS Code extension for guided `@syntax-syllogism/jawn` Salesforce CLI workflows.

## Features

- Command Palette entries and Jawn sidebar actions for every supported command.
- User Lifecycle commands:
  - `SF Jawn: User Provision` (`sf jawn user provision`)
  - `SF Jawn: User Access` (`sf jawn user access`)
  - `SF Jawn: User Strip` (`sf jawn user strip`)
  - `SF Jawn: User Freeze` (`sf jawn user freeze`)
  - `SF Jawn: User Unfreeze` (`sf jawn user unfreeze`)
- AEP Generation commands:
  - `SF Jawn: AEP Generate` (`sf jawn aep generate`)
  - `SF Jawn: AEP Generate Selector` (`sf jawn aep generate selector`)
  - `SF Jawn: AEP Generate Domain` (`sf jawn aep generate domain`)
  - `SF Jawn: AEP Generate Service` (`sf jawn aep generate service`)
  - `SF Jawn: AEP Generate Unit of Work` (`sf jawn aep generate unitofwork`)
  - `SF Jawn: AEP Selector Method` (`sf jawn aep generate selector method`)
  - `SF Jawn: AEP Selector Field Injection` (`sf jawn aep generate selector field-injection`)
  - `SF Jawn: AEP Generate Action` (`sf jawn aep generate action`)
  - `SF Jawn: AEP Generate Criteria` (`sf jawn aep generate criteria`)
- Dedicated Jawn activity-bar view:
  - User Lifecycle commands remain flat.
  - AEP commands are grouped into Generators, Selector Helpers, and Domain-Process Bindings.
- Guided native inputs:
  - Salesforce org picker with `jawn.defaultTargetOrg` fallback.
  - File pickers for definition files.
  - Folder picker for AEP `--output-path`.
  - QuickPick enums for flags such as `--trigger-operation`.
  - Single-select QuickPick for mutually exclusive choices such as AEP flavor (`--at4dx` or `--fflib`) and user target (`--user` or `--users-def`).
  - Multi-select QuickPick for boolean options, including AEP `--dry-run` and aggregate artifact toggles.
  - InputBox prompts for string values such as SObject names, class names, prefixes, and ordering tokens.
- AEP aggregate generation validates that at least one artifact group is selected: selector, domain, or unit of work.
- Org-less AEP helper commands run without prompting for an org; AEP service generation lets the org prompt be skipped.
- Background `sf jawn ...` execution through `child_process.spawn`, streamed to the `Jawn` Output Channel.
- Cancellable progress notifications while commands run.
- Human-readable CLI output by default; the extension does not force `--json`.
- Automatic `--no-prompt` only for commands that support it.
- Dry-run-first confirmation for destructive user strip operations.
- Optional dry-run support for AEP generation commands, with an Open Folder action after successful file generation.
- Pre-run detection for the Salesforce CLI and the jawn plugin, with an install action when the plugin is missing.

## Requirements

Install the Salesforce CLI and the jawn plugin before running commands:

```sh
sf plugins install @syntax-syllogism/jawn
```

The extension checks for `sf` and `sf jawn --help` before the first command run. If the plugin is missing, it offers an install action.

## Extension Settings

- `jawn.defaultTargetOrg`: default Salesforce org alias or username for future workflows.

## Development

### Quick Start

```sh
npm install
npm test
npm run package:vsix
```

See [docs/README.md](docs/README.md) for comprehensive developer documentation, including:

- **[Architecture Overview](docs/architecture.md)** — Design and components
- **[Input System](docs/input-system.md)** — How user input is collected
- **[Command Runner](docs/command-runner.md)** — Command execution
- **[Command Registry](docs/command-registry.md)** — Command definitions and generation
- **[Extending the Extension](docs/extending.md)** — Adding new commands and features
- **[Testing Guide](docs/testing.md)** — Writing and running tests

### Updating Commands

Refresh the committed command registry from a jawn oclif manifest:

```sh
npm run gen:commands -- vendor/jawn.oclif.manifest.json src/registry/commands.generated.ts
```

This is needed when the jawn plugin adds new commands or changes flag definitions.
