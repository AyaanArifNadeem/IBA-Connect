import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AlumniRecordKind, Role } from "@/lib/generated/prisma/enums";
import { findUsableRecord } from "@/lib/services/alumni";
import { makeUser, resetDatabase, testDb } from "./helpers";

const auth = { getUser: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

const codesRoute = await import("@/app/api/v1/admin/alumni-codes/route");
const codeRoute = await import("@/app/api/v1/admin/alumni-codes/[id]/route");
const listRoute = await import("@/app/api/v1/admin/alumni-list/route");

const adminId = "ad000000-0000-4000-8000-000000000001";
const studentId = "57000000-0000-4000-8000-000000000002";
const signInAs = (id: string) =>
  auth.getUser.mockResolvedValue({
    data: { user: { id, email: `${id}@khi.iba.edu.pk`, email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
const json = (method: string, body: unknown) =>
  new Request("http://localhost/x", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const createCode = async (expiresInDays: number | null = 30) =>
  (await (await codesRoute.POST(json("POST", { expiresInDays }), {})).json()).data;
const patch = (id: string, action: string) =>
  codeRoute.PATCH(json("PATCH", { action }), { params: Promise.resolve({ id }) });
const upload = (csv: string, name = "alumni.csv") => {
  const form = new FormData();
  form.append("file", new File([csv], name, { type: "text/csv" }));
  return listRoute.POST(new Request("http://localhost/x", { method: "POST", body: form }), {});
};

beforeEach(async () => {
  await resetDatabase();
  await makeUser({ id: adminId, email: "admin@khi.iba.edu.pk", role: Role.ADMIN });
  await makeUser({ id: studentId, email: "student@khi.iba.edu.pk" });
  signInAs(adminId);
});
afterAll(() => testDb.$disconnect());

describe("admin: alumni codes (FR1.9)", () => {
  it("TC-037: creates an active code and records it in the audit log", async () => {
    const created = await createCode(30);
    expect(created.code).toMatch(/^IBA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);

    const list = (await (await codesRoute.GET(new Request("http://localhost/x"), {})).json()).data;
    expect(list).toEqual([expect.objectContaining({ code: created.code, status: "active", claimedBy: null })]);
    expect(await testDb.adminAction.findFirst({ where: { action: "alumni_code.create" } })).toMatchObject({
      adminId,
      targetId: created.id,
    });
  });

  it("TC-038: a revoked code can no longer verify anyone", async () => {
    const created = await createCode();
    expect((await patch(created.id, "revoke")).status).toBe(200);
    expect(await findUsableRecord({ method: "code", code: created.code })).toBeNull();
    expect(await testDb.adminAction.count({ where: { action: "alumni_code.revoke" } })).toBe(1);
  });

  it("expiring a code stops it straight away", async () => {
    const created = await createCode(null);
    await patch(created.id, "expire");
    const list = (await (await codesRoute.GET(new Request("http://localhost/x"), {})).json()).data;
    expect(list[0].status).toBe("expired");
  });

  it("refuses to change a code that was already used or ended", async () => {
    const created = await createCode();
    await testDb.alumniRecord.update({ where: { id: created.id }, data: { claimedById: studentId } });
    expect((await patch(created.id, "revoke")).status).toBe(409);

    const other = await createCode();
    await patch(other.id, "revoke");
    expect((await patch(other.id, "expire")).status).toBe(409);
  });

  it("TC-040: refuses non-admins", async () => {
    signInAs(studentId);
    expect((await codesRoute.POST(json("POST", { expiresInDays: 30 }), {})).status).toBe(403);
    expect((await codesRoute.GET(new Request("http://localhost/x"), {})).status).toBe(403);
    expect((await upload("email\na@example.test")).status).toBe(403);
    expect(await testDb.alumniRecord.count()).toBe(0);
  });
});

describe("admin: alumni list upload (FR1.9)", () => {
  it("TC-039: adds new entries, skips duplicates and reports bad rows", async () => {
    await testDb.alumniRecord.create({ data: { kind: AlumniRecordKind.LIST_ENTRY, personalEmail: "old@example.test" } });
    const csv = [
      "Email,Name,Batch",
      "ayesha@example.test,Ayesha Malik,2015",
      '"omar@example.test","Khan, Omar",2012',
      "OLD@example.test,Already There,2010",
      "ayesha@example.test,Ayesha again,2015",
      "not-an-email,Someone,2014",
      "zara@example.test,Zara,1850",
    ].join("\r\n");
    const res = await upload(csv);
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body).toMatchObject({ added: 2, skipped: 2, summary: { total: 3, claimed: 0 } });
    expect(body.invalid).toEqual([
      { line: 6, reason: "Not a valid email" },
      { line: 7, reason: "Batch is not a valid year" },
    ]);
    expect(await testDb.alumniRecord.findUnique({ where: { personalEmail: "omar@example.test" } })).toMatchObject({
      name: "Khan, Omar",
      batch: 2012,
    });
  });

  it("needs an email column and a .csv file", async () => {
    expect((await (await upload("name\nAyesha")).json()).data.invalid[0].reason).toMatch(/email/);
    expect((await upload("email\na@example.test", "list.xlsx")).status).toBe(400);
  });
});
