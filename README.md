# anti-slop-biome

Opinionated Biome GritQL rules that reject low-evidence and low-signal TypeScript and JavaScript patterns.

This is a Biome port of [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), the Oxlint plugin by [Dillon Mulroy](https://github.com/dmmulroy). Same philosophy, same rules, expressed as [Biome plugins](https://biomejs.dev/linter/plugins/) so teams already on Biome can use them without adding a second linter.

Like the original, this project is meant to be vendored, not treated as a fixed npm dependency. Copy the rules into your repository, read them, and change them to match your team's standards. The bundled agent skill handles the initial copy and configuration; after that, the vendored files are yours to maintain and make your own.

Requires Biome 2.0 or later (GritQL plugin support).

## Install with an agent skill

```bash
npx skills add C-W-D-Harshit/anti-slop-biome --skill install-anti-slop
```

Then ask your coding agent to install or configure anti-slop in the current repository. The skill copies the rules, checks the Biome version, merges the plugin entries into the existing `biome.json`, and validates the result.

## Manual local installation

Copy `src/rules/` into the target repository, for example at `tools/biome/anti-slop/`, and register every rule in `biome.json`:

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

Every rule reports at `error` severity (Biome has no per-plugin severity setting). To drop a rule, remove its entry. To scope a rule, use `{ "path": "...", "includes": [...] }` instead of the plain string. Suppress a single finding with:

```ts
// biome-ignore lint/plugin/no-runtime-typeof: parsing at the boundary here
```

## Rules

- `no-chained-type-assertions` — rejects nested type assertions that fabricate evidence.
- `no-conditional-empty-object-spread` — rejects conditional spreads that use `{}` to omit fields.
- `no-known-value-widening` — rejects explicit broad target types that discard known value evidence.
- `no-module-mocking` — rejects Vitest and Jest module mocks in favor of real dependency seams.
- `no-object-parameters` — rejects the broad `object` type on function inputs.
- `no-reflect-apply` — rejects `Reflect.apply` in favor of typed function calls.
- `no-reflect-get` — rejects `Reflect.get` in favor of typed property access or boundary parsing.
- `no-runtime-typeof` — requires boundary parsing instead of ad hoc `typeof` narrowing.
- `no-shape-in-symbol-names` — rejects `shape` in symbol names.
- `no-unknown-parameters` — rejects `unknown` inputs except the explicit `cause` convention.
- `no-unknown-returns` — rejects function contracts that return `unknown` or `Promise<unknown>`.
- `no-unknown-type-aliases` — rejects aliases that merely conceal `unknown`.
- `no-unsafe-dictionary-type` — rejects dictionary value contracts based on `unknown`, `any`, `object`, `{}`, and semantic equivalents.

## Violation examples

Each snippet below is rejected by the named rule.

### `no-chained-type-assertions`

```ts
const user = input as object as User;
```

### `no-conditional-empty-object-spread`

```ts
const options = {
  ...(timeout !== undefined ? { timeout } : {}),
};
```

### `no-known-value-widening`

```ts
const handlers: Record<string, Handler> = {
  start: startHandler,
};
```

This discards the known `start` key. Preserve inference or use `satisfies Record<string, Handler>` instead.

### `no-module-mocking`

```ts
vi.mock("./user-store");
```

### `no-object-parameters`

```ts
function save(value: object) {}
```

### `no-reflect-apply`

```ts
const value = Reflect.apply(operation, owner, args);
```

### `no-reflect-get`

```ts
const value = Reflect.get(owner, key);
```

### `no-runtime-typeof`

```ts
if (typeof input === "string") {
  useName(input);
}
```

### `no-shape-in-symbol-names`

```ts
interface UserShape {
  id: string;
}
```

### `no-unknown-parameters`

```ts
function handle(input: unknown) {}
```

### `no-unknown-returns`

```ts
function loadUser(): unknown {
  return input;
}
```

### `no-unknown-type-aliases`

```ts
type ExternalValue = unknown;
```

### `no-unsafe-dictionary-type`

```ts
type Metadata = Record<string, unknown>;
type OtherMetadata = { [key: string]: object };
```

## Differences from the Oxlint original

Biome plugins are GritQL patterns: they match syntax, with no scope resolution, no import tracking, no type inference, and no access to comments. That imposes honest limits, all encoded as executable `divergences` cases in each rule's `.test.json`:

**Two rules could not be ported.**

- `no-widen-then-assert` traces const bindings across statements with scope analysis; GritQL cannot express it.
- `require-safety-comment-for-type-assertion` reads the comment preceding an assertion; comments are trivia in Biome's syntax tree and invisible to GritQL plugins. A stricter cousin is possible — flag every non-const assertion and let the mandatory `biome-ignore` reason serve as the safety comment — but it is not part of the default set.

**Several rules match syntactically rather than semantically.**

- `no-module-mocking`, `no-reflect-apply`, `no-reflect-get` match `vi`/`jest`/`Reflect` by name. A local binding that shadows those names is still flagged (over-reporting); a renamed import (`import { vi as testApi }`) is missed.
- Rules that resolve file-local type aliases (`no-object-parameters`, `no-unknown-returns`, `no-unknown-type-aliases`, `no-unsafe-dictionary-type`, `no-known-value-widening`) follow one alias hop and do not substitute generic type arguments; generic type parameters that shadow a file-local alias are not recognized.
- `no-known-value-widening` cannot trace evidence through identifier chains (`const source = {...}; const x: Broad = source;`) or pair assignments with their declarations.
- `no-chained-type-assertions` reports each adjacent assertion pair in 3-plus-long chains instead of once per chain.

If a limit above matters to your team, keep the original Oxlint plugin for those rules — the two tools coexist fine.

## Development

```bash
pnpm install
pnpm check
```

`pnpm test` runs every rule against its `.test.json` fixtures (valid, invalid, and documented-divergence cases) using the real Biome binary. `src/rules/` is canonical. After changing rules, run `pnpm sync:skill-assets`; CI checks that the skill's bundled copy remains identical.

## Credits

Rule design, semantics, and messages are from [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) (MIT). This repository ports them to Biome GritQL.

## License

MIT
