#!/usr/bin/env node
/**
 * Compile every LaTeX document under docs/ to PDF.
 *
 *   npm run docs:build              build all documents
 *   npm run docs:build -- backlog   build documents whose path contains "backlog"
 *
 * A document is any .tex file that contains \documentclass. Each is compiled twice with
 * pdflatex (for page references) in its own folder, with docs/common on the TeX path.
 * PDFs are written to docs/build/<same relative path>.pdf (git-ignored).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, copyFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, delimiter, basename } from "node:path";

const root = resolve(import.meta.dirname, "..");
const docsDir = join(root, "docs");
const buildDir = join(docsDir, "build");
const commonDir = join(docsDir, "common");
const filter = process.argv[2];

function findDocuments(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full === buildDir || entry === "common" || entry.startsWith(".")) continue;
    if (statSync(full).isDirectory()) found.push(...findDocuments(full));
    else if (entry.endsWith(".tex") && /\\documentclass/.test(readFileSync(full, "utf8"))) found.push(full);
  }
  return found;
}

// Generate the test case table and spreadsheet from test-cases.json first
const exported = spawnSync(process.execPath, [join(root, "scripts/export-test-cases.mjs")], { stdio: "inherit" });
if (exported.status !== 0) process.exit(exported.status ?? 1);

const docs = findDocuments(docsDir).filter((f) => !filter || relative(docsDir, f).includes(filter));
if (docs.length === 0) {
  console.error(filter ? `No documents match "${filter}".` : "No documents found.");
  process.exit(1);
}

let failed = 0;
for (const file of docs) {
  const rel = relative(docsDir, file);
  const cwd = dirname(file);
  const outDir = join(cwd, ".latex-out");
  mkdirSync(outDir, { recursive: true });
  const env = { ...process.env, TEXINPUTS: `.${delimiter}${commonDir}${delimiter}${process.env.TEXINPUTS ?? ""}` };
  let ok = true;
  for (let pass = 1; pass <= 2 && ok; pass++) {
    const result = spawnSync(
      "pdflatex",
      ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${outDir}`, basename(file)],
      { cwd, env, encoding: "utf8" },
    );
    if (result.status !== 0) {
      ok = false;
      const log = (result.stdout ?? "").split("\n");
      const firstError = log.findIndex((l) => l.startsWith("!"));
      console.error(`FAIL ${rel}`);
      console.error(log.slice(Math.max(0, firstError), firstError + 8).join("\n") || result.stderr);
    }
  }
  if (!ok) {
    failed++;
    continue;
  }
  const pdfName = basename(file).replace(/\.tex$/, ".pdf");
  const target = join(buildDir, dirname(rel), pdfName);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(outDir, pdfName), target);
  console.log(`ok   ${rel} -> ${relative(root, target)}`);
}

if (failed) {
  console.error(`${failed} of ${docs.length} document(s) failed.`);
  process.exit(1);
}
