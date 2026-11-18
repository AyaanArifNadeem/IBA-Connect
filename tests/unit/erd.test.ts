import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { currentDot, parseSchema } from "../../scripts/erd.mjs";

type Field = { name: string; id: boolean; fk: boolean; isRelation: boolean };
type Model = { name: string; fields: Field[] };

const root = join(__dirname, "..", "..");

describe("ERD (docs/architecture)", () => {
  it("matches prisma/schema.prisma (run npm run docs:erd after changing the schema)", () => {
    const saved = readFileSync(join(root, "docs/architecture/erd.dot"), "utf8").replace(/\r\n/g, "\n");
    expect(saved).toBe(currentDot());
  });

  it("reads every model, key and relation", () => {
    const models = parseSchema(readFileSync(join(root, "prisma/schema.prisma"), "utf8")).models as unknown as Model[];
    const model = (name: string) => models.find((m) => m.name === name)!;
    expect(models.map((m) => m.name)).toEqual(expect.arrayContaining(["User", "Connection", "Message", "Post", "PostResponse", "Block"]));

    const field = (name: string) => model("Connection").fields.find((f) => f.name === name)!;
    expect(field("id").id).toBe(true);
    expect(field("requesterId").fk).toBe(true);
    expect(field("requester").isRelation).toBe(true);
    expect(model("UserSkill").fields.filter((f) => f.id).map((f) => f.name)).toEqual(["userId", "skillId"]);
  });
});
