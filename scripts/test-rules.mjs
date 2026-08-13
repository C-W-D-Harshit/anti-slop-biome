import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rulesDirectory = join(root, "src/rules");
const workDirectory = join(root, ".tmp");
const biomeBinary = join(root, "node_modules/.bin/biome");

const requestedRules = process.argv.slice(2);

function ruleNames() {
  return readdirSync(rulesDirectory)
    .filter((name) => name.endsWith(".grit"))
    .map((name) => basename(name, ".grit"))
    .filter((name) => requestedRules.length === 0 || requestedRules.includes(name));
}

function normalizedCase(testCase) {
  return typeof testCase === "string" ? { code: testCase } : testCase;
}

function caseFileName(kind, index, testCase) {
  return `${kind}-${String(index).padStart(3, "0")}.${testCase.lang ?? "ts"}`;
}

function lintDiagnosticCounts(caseDirectory) {
  let stdout;
  try {
    stdout = execFileSync(biomeBinary, ["lint", "--reporter=json", "--max-diagnostics=500", "."], {
      cwd: caseDirectory,
      encoding: "utf8",
    });
  } catch (error) {
    if (typeof error.stdout !== "string" || error.stdout.length === 0) throw error;
    stdout = error.stdout;
  }
  const report = JSON.parse(stdout);
  const counts = new Map();
  for (const diagnostic of report.diagnostics) {
    if (diagnostic.category !== "plugin") {
      throw new Error(
        `Unexpected non-plugin diagnostic ${diagnostic.category} in ${caseDirectory}: ${diagnostic.message}`,
      );
    }
    const path = basename(diagnostic.location.path);
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return counts;
}

function runRule(rule) {
  const fixtures = JSON.parse(readFileSync(join(rulesDirectory, `${rule}.test.json`), "utf8"));
  const caseDirectory = join(workDirectory, rule);
  rmSync(caseDirectory, { recursive: true, force: true });
  mkdirSync(caseDirectory, { recursive: true });

  const expectations = [];
  const writeCases = (cases, kind, expectation) => {
    for (const [index, rawCase] of (cases ?? []).map(normalizedCase).entries()) {
      const file = caseFileName(kind, index, rawCase);
      writeFileSync(join(caseDirectory, file), `${rawCase.code}\n`);
      expectations.push({ file, ...expectation(rawCase) });
    }
  };

  writeCases(fixtures.valid, "valid", () => ({ expected: 0 }));
  writeCases(fixtures.invalid, "invalid", (rawCase) => ({ expected: rawCase.errors ?? null }));
  writeCases(fixtures.divergences?.missedInvalid, "missed", (rawCase) => ({
    expected: 0,
    divergence: rawCase.reason,
  }));
  writeCases(fixtures.divergences?.extraInvalid, "extra", (rawCase) => ({
    expected: null,
    divergence: rawCase.reason,
  }));
  writeCases(fixtures.divergences?.changedCount, "changed", (rawCase) => ({
    expected: rawCase.errors,
    divergence: rawCase.reason,
  }));

  writeFileSync(
    join(caseDirectory, "biome.json"),
    JSON.stringify(
      {
        root: true,
        linter: { enabled: true, rules: { preset: "none" } },
        plugins: [`../../src/rules/${rule}.grit`],
      },
      null,
      2,
    ),
  );

  const counts = lintDiagnosticCounts(caseDirectory);
  const failures = [];
  for (const { file, expected, divergence } of expectations) {
    const actual = counts.get(file) ?? 0;
    const matches = expected === null ? actual > 0 : actual === expected;
    if (!matches) {
      const label = divergence === undefined ? "" : ` (documented divergence: ${divergence})`;
      failures.push(
        `  ${file}: expected ${expected === null ? "at least 1 diagnostic" : `${expected} diagnostic(s)`}, got ${actual}${label}\n    ${readFileSync(join(caseDirectory, file), "utf8").trim().split("\n")[0]}`,
      );
    }
  }
  return { caseCount: expectations.length, failures };
}

let failedRules = 0;
let totalCases = 0;
for (const rule of ruleNames()) {
  const { caseCount, failures } = runRule(rule);
  totalCases += caseCount;
  if (failures.length === 0) {
    console.log(`ok ${rule} (${caseCount} cases)`);
  } else {
    failedRules += 1;
    console.error(`FAIL ${rule} (${failures.length}/${caseCount} cases)`);
    for (const failure of failures) console.error(failure);
  }
}

if (failedRules > 0) {
  console.error(`\n${failedRules} rule(s) failing.`);
  process.exit(1);
}
console.log(`\nAll rules pass (${totalCases} cases).`);
