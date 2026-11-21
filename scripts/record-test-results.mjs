/**
 * Copy the outcome of a real-backend run (test-results/real-backend.json, written by
 * npm run test:e2e:real) into docs/testing/test-cases.json: "actual" from each test's
 * annotations and "result" from its status. Cases the run did not cover are left as they are.
 *
 *   node scripts/record-test-results.mjs [--only TC-001,TC-002]
 */
import { readFileSync, writeFileSync } from "node:fs";

const REPORT = "test-results/real-backend.json";
const CASES = "docs/testing/test-cases.json";

const report = JSON.parse(readFileSync(REPORT, "utf8"));
const doc = JSON.parse(readFileSync(CASES, "utf8"));
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(",")) : null;

const specs = [];
const walk = (suite) => {
  specs.push(...(suite.specs ?? []));
  (suite.suites ?? []).forEach(walk);
};
report.suites.forEach(walk);

const outcomes = new Map();
for (const spec of specs) {
  const ids = spec.title.match(/TC-\d{3}/g) ?? [];
  const test = spec.tests[0];
  const run = test.results.at(-1);
  const notes = [...(test.annotations ?? []), ...(run.annotations ?? [])];
  // "actual:TC-xxx" notes belong to that case; the plain "actual" note to the first case without one
  const main = ids.find((id) => !notes.some((a) => a.type === `actual:${id}`));
  for (const id of ids) {
    const actual = notes.find((a) => a.type === `actual:${id}`)?.description ?? (id === main ? notes.find((a) => a.type === "actual")?.description : undefined);
    if (!actual || run.status === "skipped") continue;
    // A failed assertion fails every case the test covers
    outcomes.set(id, { actual, result: run.status === "passed" ? "Pass" : "Fail" });
  }
}

let updated = 0;
for (const c of doc.cases) {
  const o = outcomes.get(c.id);
  if (!o || (only && !only.has(c.id))) continue;
  c.actual = o.actual;
  c.result = o.result;
  updated++;
}
writeFileSync(CASES, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`Recorded ${updated} case(s) from ${REPORT}.`);
