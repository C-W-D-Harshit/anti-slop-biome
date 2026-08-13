---
name: install-anti-slop
description: Install and configure the anti-slop Biome GritQL rules in a local TypeScript or JavaScript repository. Use whenever a user asks to add anti-slop lint rules to Biome, copy the anti-slop plugin, configure opinionated Biome rules, or migrate an existing local anti-slop setup.
---

# Install anti-slop for Biome

Install the bundled GritQL rules into the current repository and integrate them with the repository's existing Biome setup. Preserve unrelated work and adapt to the project's package manager and configuration style.

## Procedure

1. Inspect the repository before changing it:
   - Read its agent instructions.
   - Check `git status` and preserve unrelated changes.
   - Identify the package manager from `packageManager` and lockfiles.
   - Find the Biome configuration (`biome.json` or `biome.jsonc`). If none exists, create a minimal one after confirming the project uses (or wants) Biome.
   - Check whether anti-slop files or plugin entries already exist. Do not overwrite them without reviewing the diff.

2. Copy the bundled rules from this skill. Run from the target repository:

   ```bash
   node <skill-directory>/scripts/install.mjs
   ```

   This creates `tools/biome/anti-slop/` containing one `.grit` file per rule. Pass another relative destination as the first argument when the repository has an established tooling layout. The script refuses to replace an existing destination; only use `--force` after backing up and reviewing existing files.

3. Ensure a current Biome is installed (`@biomejs/biome` 2.x as a development dependency). GritQL plugins require Biome 2.0 or later; query `npm view @biomejs/biome version` rather than trusting a remembered version. Do not replace the package manager or rewrite unrelated dependency ranges.

4. Register every rule in the `plugins` array of `biome.json`, merging with existing entries instead of replacing them:

   ```json
   {
     "plugins": [
       "./tools/biome/anti-slop/no-chained-type-assertions.grit",
       "./tools/biome/anti-slop/no-conditional-empty-object-spread.grit",
       "./tools/biome/anti-slop/no-known-value-widening.grit",
       "./tools/biome/anti-slop/no-module-mocking.grit",
       "./tools/biome/anti-slop/no-object-parameters.grit",
       "./tools/biome/anti-slop/no-reflect-apply.grit",
       "./tools/biome/anti-slop/no-reflect-get.grit",
       "./tools/biome/anti-slop/no-runtime-typeof.grit",
       "./tools/biome/anti-slop/no-shape-in-symbol-names.grit",
       "./tools/biome/anti-slop/no-unknown-parameters.grit",
       "./tools/biome/anti-slop/no-unknown-returns.grit",
       "./tools/biome/anti-slop/no-unknown-type-aliases.grit",
       "./tools/biome/anti-slop/no-unsafe-dictionary-type.grit"
     ]
   }
   ```

   Every rule reports at `error` severity; Biome offers no per-plugin severity configuration. To drop a rule, remove its entry and delete the file. To scope a rule to certain paths, replace its string entry with `{ "path": "...", "includes": ["src/**"] }`.

5. Run `biome lint` (through the repository's usual script) to validate the configuration loads. If findings appear, report them and fix them only when the user asked for migration/cleanup. Do not suppress rules or mechanically launder types to make lint pass. Individual findings are suppressed with `// biome-ignore lint/plugin/<rule-name>: <reason>`.

6. Review the final diff and clearly report:
   - copied path,
   - Biome version confirmed,
   - configuration changed,
   - checks run and any remaining findings.

## Migration guidance

When replacing an older local copy, compare its rules and diagnostics before overwriting. Keep project-specific rules in their own `.grit` files; anti-slop is intentionally generic. Prefer inference, `as const`, `satisfies`, named owner contracts, and boundary parsing when resolving findings.

Users migrating from the original Oxlint anti-slop plugin should know two rules have no Biome equivalent (`no-widen-then-assert` and `require-safety-comment-for-type-assertion` need scope analysis and comment access that GritQL plugins do not provide) and several others match syntactically rather than semantically; see the repository README for the exact differences.
