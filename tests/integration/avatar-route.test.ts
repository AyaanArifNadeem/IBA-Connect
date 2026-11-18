import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, resetDatabase, testDb } from "./helpers";

// Supabase Auth and Storage are fakes; the database is real.
const auth = { getUser: vi.fn() };
const storage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
  createAdminClient: () => ({ storage: { from: () => storage } }),
}));
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

const { POST, DELETE } = await import("@/app/api/v1/profile/avatar/route");

const memberId = "c0ffee00-1234-4abc-8def-0123456789ab";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7 not an image");

function upload(bytes: Uint8Array<ArrayBuffer>, name: string, type: string) {
  const body = new FormData();
  body.append("file", new File([bytes], name, { type }));
  return POST(new Request("http://localhost/api/v1/profile/avatar", { method: "POST", body }), {});
}

beforeEach(async () => {
  await resetDatabase();
  Object.values(storage).forEach((fn) => fn.mockReset());
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.test/signed" }, error: null });
  auth.getUser.mockResolvedValue({
    data: { user: { id: memberId, email: "m@khi.iba.edu.pk", email_confirmed_at: "2026-11-01T00:00:00Z" } },
    error: null,
  });
  await makeUser({ id: memberId, email: "m@khi.iba.edu.pk" });
});
afterAll(() => testDb.$disconnect());

describe("POST /api/v1/profile/avatar (US1.6)", () => {
  it("TC-023: stores an image in the private bucket and returns a signed link", async () => {
    const res = await upload(PNG, "me.png", "image/png");
    expect(res.status).toBe(200);
    expect((await res.json()).data.avatarUrl).toBe("https://storage.test/signed");

    const [path, , options] = storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${memberId}/[0-9a-f-]+\\.png$`));
    expect(options).toEqual({ contentType: "image/png", upsert: false });
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).avatarPath).toBe(path);
  });

  it("TC-024: rejects a PDF, even when it pretends to be an image", async () => {
    const res = await upload(PDF, "me.png", "image/png");
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/Only image files/);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("rejects a file over 2 MB", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    const res = await upload(big, "big.png", "image/png");
    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("deletes the old photo after a new one is saved", async () => {
    await testDb.user.update({ where: { id: memberId }, data: { avatarPath: `${memberId}/old.png` } });
    await upload(PNG, "new.png", "image/png");
    expect(storage.remove).toHaveBeenCalledWith([`${memberId}/old.png`]);
  });

  it("requires a signed-in member", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await upload(PNG, "me.png", "image/png")).status).toBe(401);
  });
});

describe("DELETE /api/v1/profile/avatar", () => {
  it("removes the photo", async () => {
    await testDb.user.update({ where: { id: memberId }, data: { avatarPath: `${memberId}/old.png` } });
    const res = await DELETE(new Request("http://localhost/api/v1/profile/avatar", { method: "DELETE" }), {});
    expect(res.status).toBe(200);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: memberId } })).avatarPath).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith([`${memberId}/old.png`]);
  });
});
