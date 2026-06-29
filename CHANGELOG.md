# Change Log

All notable changes to the "jawn-ext" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.5]

### Changed

- Reorganized the AEP Generation sidebar into **Pattern Layers**, **Selector Injection (AT4DX)**, and **Domain Processes (AT4DX)** (previously Generators / Selector Helpers / Domain-Process Bindings).
- Renamed the batch command to **AEP Generate (Multiple)** to distinguish it from the single-layer generators.
- For `user strip`/`freeze`/`unfreeze`, the single-user prompt now asks for `field:value` (e.g. `Username:user@example.com`), and `--external-id` is only prompted when a definition file is chosen.

### Fixed

- The `--user` prompt now shows a `field:value` placeholder and description, so single-user targeting no longer fails with `Expected field:value`.
- `npm run gen:commands` now runs correctly on Windows (the codegen entry-point guard no longer mismatches Windows file URLs).

## [0.1.4] - 2026-06-27

### Changed

- Internal maintenance and tooling updates

## [0.1.3] - 2026-06-27

### Changed

- Output directory selection now uses Quick Pick interface

### Fixed

- Sidebar icon now renders as monochrome silhouette
- Fixed sf CLI resolution on Windows systems

## [0.1.1] - 2026-06-26

### Changed

- Internal maintenance and tooling updates

## [0.1.0] - 2026-06-26

### Added

- Guided AEP command execution
- AEP command registry generation
- Jawn lifecycle extension workflows

## [Unreleased]

- Initial release
