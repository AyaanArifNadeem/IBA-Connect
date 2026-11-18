import "server-only";
import { randomInt } from "node:crypto";
import { conflict, notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { AlumniRecordKind } from "@/lib/generated/prisma/enums";
import { emailSchema } from "@/lib/validation/auth";
import { recordAdminAction } from "./audit";

/** No 0/O, 1/I/L, so codes can be read out and typed without mistakes. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const generateCode = () => `IBA-${block()}-${block()}`;

export type CodeStatus = "active" | "claimed" | "expired" | "revoked";

export function codeStatus(r: { claimedById: string | null; revokedAt: Date | null; expiresAt: Date | null }, now = new Date()): CodeStatus {
  if (r.claimedById) return "claimed";
  if (r.revokedAt) return "revoked";
  if (r.expiresAt && r.expiresAt <= now) return "expired";
  return "active";
}

export async function listCodes() {
  const rows = await db.alumniRecord.findMany({
    where: { kind: AlumniRecordKind.CODE },
    include: { claimedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.inviteCode!,
    note: r.name,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    claimedBy: r.claimedBy?.name ?? null,
    claimedAt: r.claimedAt,
    status: codeStatus(r),
  }));
}

/** FR1.9: create a code; expiresInDays null means it does not expire. */
export async function createCode(adminId: string, input: { expiresInDays: number | null; note?: string }) {
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
  return db.$transaction(async (tx) => {
    // Retry on the (very unlikely) chance of a duplicate code
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      if (await tx.alumniRecord.findUnique({ where: { inviteCode: code } })) continue;
      const record = await tx.alumniRecord.create({
        data: { kind: AlumniRecordKind.CODE, inviteCode: code, name: input.note || null, expiresAt, createdById: adminId },
      });
      await recordAdminAction(adminId, "alumni_code.create", { type: "alumni_code", id: record.id }, { expiresAt: expiresAt?.toISOString() ?? null }, tx);
      return record;
    }
    throw new Error("Could not generate a unique code");
  });
}

/** FR1.9: expire (stop now, for audit) or revoke (withdrawn) an unclaimed code. */
export async function endCode(adminId: string, id: string, how: "expire" | "revoke") {
  const record = await db.alumniRecord.findFirst({ where: { id, kind: AlumniRecordKind.CODE } });
  if (!record) throw notFound("Code not found.");
  const status = codeStatus(record);
  if (status === "claimed") throw conflict("This code has already been used and cannot be changed.");
  if (status !== "active") throw conflict(`This code is already ${status}.`);

  return db.$transaction(async (tx) => {
    const updated = await tx.alumniRecord.update({
      where: { id },
      data: how === "revoke" ? { revokedAt: new Date() } : { expiresAt: new Date() },
    });
    await recordAdminAction(adminId, `alumni_code.${how}`, { type: "alumni_code", id }, undefined, tx);
    return updated;
  });
}

// ---------------------------------------------------------------- alumni list

/** Minimal CSV reader: commas, double quotes, CRLF or LF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export const MAX_LIST_ROWS = 5000;

/**
 * FR1.9: import the university's alumni list. The first row must name the columns; "email" is
 * required, "name" and "batch" are optional. Existing emails are skipped; bad rows are reported.
 */
export async function importAlumniList(adminId: string, csv: string) {
  const rows = parseCsv(csv.replace(/^﻿/, ""));
  if (rows.length < 2) return { added: 0, skipped: 0, invalid: [{ line: 1, reason: "The file has no data rows" }] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = { email: header.indexOf("email"), name: header.indexOf("name"), batch: header.indexOf("batch") };
  if (col.email === -1) return { added: 0, skipped: 0, invalid: [{ line: 1, reason: 'The first row must include an "email" column' }] };
  if (rows.length - 1 > MAX_LIST_ROWS) {
    return { added: 0, skipped: 0, invalid: [{ line: 1, reason: `At most ${MAX_LIST_ROWS} rows per upload` }] };
  }

  const invalid: { line: number; reason: string }[] = [];
  const entries = new Map<string, { personalEmail: string; name: string | null; batch: number | null }>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const email = emailSchema.safeParse(r[col.email] ?? "");
    if (!email.success) return invalid.push({ line, reason: "Not a valid email" });
    const batchRaw = col.batch >= 0 ? (r[col.batch] ?? "").trim() : "";
    const batch = batchRaw ? Number(batchRaw) : null;
    if (batch !== null && (!Number.isInteger(batch) || batch < 1960 || batch > new Date().getFullYear())) {
      return invalid.push({ line, reason: "Batch is not a valid year" });
    }
    const name = col.name >= 0 ? (r[col.name] ?? "").trim().slice(0, 80) || null : null;
    entries.set(email.data, { personalEmail: email.data, name, batch });
  });

  const existing = new Set(
    (await db.alumniRecord.findMany({ where: { personalEmail: { in: [...entries.keys()] } }, select: { personalEmail: true } })).map(
      (r) => r.personalEmail,
    ),
  );
  const fresh = [...entries.values()].filter((e) => !existing.has(e.personalEmail));
  const skipped = rows.length - 1 - invalid.length - fresh.length;

  await db.$transaction(async (tx) => {
    if (fresh.length) {
      await tx.alumniRecord.createMany({
        data: fresh.map((e) => ({ ...e, kind: AlumniRecordKind.LIST_ENTRY, createdById: adminId })),
        skipDuplicates: true,
      });
    }
    await recordAdminAction(adminId, "alumni_list.import", { type: "alumni_list", id: "upload" }, { added: fresh.length, skipped, invalid: invalid.length }, tx);
  });

  return { added: fresh.length, skipped, invalid: invalid.slice(0, 50) };
}

export async function alumniListSummary() {
  const [total, claimed] = await Promise.all([
    db.alumniRecord.count({ where: { kind: AlumniRecordKind.LIST_ENTRY } }),
    db.alumniRecord.count({ where: { kind: AlumniRecordKind.LIST_ENTRY, claimedById: { not: null } } }),
  ]);
  return { total, claimed };
}
