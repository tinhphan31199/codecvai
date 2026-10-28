import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = readFileSync(join(root, "src", "data", "codecv.ts"), "utf8");

const compiled = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
const fn = new Function("exports", "module", "console", compiled);
fn(module.exports, module, console);
const data = module.exports;

const candidates = data.candidates.map((c) => {
  const out = { ...c };
  if (c.repoState === "connected") {
    out.repoTree = data.repoTree;
    out.architectureLayers = data.architectureLayers;
  }
  return out;
});

const seed = {
  workspace: data.workspace,
  positions: data.positions,
  candidates,
  reports: data.reportRows,
  team: data.teamMembers,
  models: data.aiModels,
  uploadStages: data.uploadStages,
};

const outDir = join(root, "backend", "internal", "store", "seeddata");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "seed.json");
writeFileSync(outPath, JSON.stringify(seed, null, 2));

console.log(
  `Wrote ${outPath}: ${seed.positions.length} positions, ${seed.candidates.length} candidates, ${seed.reports.length} reports, ${seed.team.length} members, ${seed.models.length} models.`,
);
