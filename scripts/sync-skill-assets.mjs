import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src/rules");
const destination = join(root, "skills/install-anti-slop/assets/anti-slop");
const check = process.argv.includes("--check");

function ruleFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".grit"))
    .sort();
}

if (check) {
  const expected = ruleFiles(source);
  const actual = existsSync(destination) ? ruleFiles(destination) : [];
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error("Skill assets differ from src/rules; run `pnpm sync:skill-assets`.");
  }
  for (const file of expected) {
    if (readFileSync(join(source, file), "utf8") !== readFileSync(join(destination, file), "utf8")) {
      throw new Error(`${file} differs from its skill asset; run \`pnpm sync:skill-assets\`.`);
    }
  }
  console.log("Skill assets match src/rules.");
} else {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  for (const file of ruleFiles(source)) {
    cpSync(join(source, file), join(destination, file));
  }
  console.log(`Synced ${relative(root, destination)}.`);
}
