# Input System

How the extension collects flag values from the user before running a Jawn CLI command.

## Overview

`src/input/gatherInputs.ts` is the entry point. `gatherInputs(command, store, inputApi)` iterates over a command's flag definitions and calls `gatherFlag(...)` for each one. The return value is `GatheredInputs` — an `args` array ready to pass to the CLI and a `displayArgs` array for the Output Channel.

`InputApi` is the seam between business logic and VS Code UI. Tests stub it directly; `createVsCodeInputApi()` wires the real pickers for production.

## Flag kinds and their pickers

| `flag.kind` | Picker called | Source file |
|---|---|---|
| `org` | `inputApi.pickOrg(lastValue)` | `src/input/orgPicker.ts` |
| `file` | `inputApi.pickFile(label, lastValue)` | `src/input/filePicker.ts` |
| `outputDir` | `inputApi.pickOutputDirectory(options)` | `src/input/outputDirPicker.ts` |
| `enum` | `inputApi.showQuickPick(options)` | inline in `gatherFlag` |
| `string` / `apiVersion` | `inputApi.showInputBox(options)` | inline in `gatherFlag` |
| `boolean` | collected separately via `inputApi.showBooleanPick(...)` | inline in `gatherInputs` |

Exclusive groups (e.g. `--at4dx` / `--fflib`) are gathered by `gatherExclusiveGroup(...)` before the per-flag loop, using `inputApi.showQuickPick`.

## Output directory picker (`outputDir`)

`pickOutputDirectory` in `src/input/outputDirPicker.ts` presents a Quick Pick before falling back to the native OS folder dialog. Candidates are built in this order:

1. **Default** — the flag's `default` value (usually `generated-files`), labelled `Default`.
2. **Last used** — the memento-stored value from the previous run, labelled `Last used`, shown only when it differs from the default.
3. **Package directories** — paths from `sfdx-project.json` `packageDirectories`, with the `default: true` entry first, labelled `Package directory`. Missing or malformed JSON is silently skipped.
4. **Workspace child folders** — direct subdirectories of the workspace root that are not noise dirs (`.git`, `.sf`, `.sfdx`, `node_modules`, `dist`, `out`, `coverage`, `.vscode`), labelled `Workspace folder`.
5. **Choose Different Folder...** — opens the native OS folder picker via `pickFolder(...)` from `src/input/filePicker.ts`, which enforces workspace-relative output and rejects out-of-workspace selections with a warning.

Candidates are deduplicated by exact string value; the first label/description wins.

The picker returns a **workspace-relative path string** in all cases (or `undefined` on cancel). Candidate directories do not need to exist — the CLI flag allows non-existent output paths.

## Adding a new flag kind

1. Add the kind string to `FlagKind` in `src/registry/types.ts`.
2. Add a new method to `InputApi` in `src/input/gatherInputs.ts` if the picker logic warrants a testable seam; otherwise call a VS Code API directly in `gatherFlag`.
3. Wire the real implementation in `createVsCodeInputApi()`.
4. Add the dispatch branch in `gatherFlag(...)`.
5. Add the new kind to the `knownKinds` set in `src/test/extension.test.ts` and write targeted tests.

## Last-value persistence

`LastValueStore` (`src/util/memento.ts`) wraps a VS Code `Memento` and keys values by `(commandId, flagName)`. `gatherFlag` reads it before prompting and writes it after a successful pick. For `file`-kind flags the stored value is the directory of the picked file (via `directoryOf(...)`), so re-runs open in the same folder.
