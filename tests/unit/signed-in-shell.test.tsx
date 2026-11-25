import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

const getIdentity = vi.fn();
const getCurrentMember = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getIdentity: () => getIdentity(), getCurrentMember: () => getCurrentMember() }));

const incomingRequestCount = vi.fn();
const unreadTotal = vi.fn();
const avatarUrl = vi.fn();
vi.mock("@/lib/services/connections", () => ({ incomingRequestCount: (id: string) => incomingRequestCount(id) }));
vi.mock("@/lib/services/messages", () => ({ unreadTotal: (id: string) => unreadTotal(id) }));
vi.mock("@/lib/storage/avatars", () => ({ avatarUrl: (p: string | null) => avatarUrl(p) }));

import { SignedInShell } from "@/components/layout/signed-in-shell";

const member = { id: "m1", name: "Sara Raza", avatarPath: "m1/a.png", role: "STUDENT", status: "ACTIVE", deletedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  getIdentity.mockResolvedValue({ id: "m1", email: "s@khi.iba.edu.pk", emailVerified: true });
  getCurrentMember.mockResolvedValue(member);
  avatarUrl.mockResolvedValue("https://signed.test/a.png");
  incomingRequestCount.mockResolvedValue(3);
  unreadTotal.mockResolvedValue(5);
});

describe("SignedInShell data loading", () => {
  it("starts the avatar, request and unread lookups together, not one after another", async () => {
    // None of the three resolves until all of them have been called: a sequential shell would hang
    const gate = (() => {
      let release!: () => void;
      const promise = new Promise<void>((r) => (release = r));
      return { promise, release };
    })();
    let started = 0;
    const start = <T,>(value: T) => () => {
      started += 1;
      if (started === 3) gate.release();
      return gate.promise.then(() => value);
    };
    avatarUrl.mockImplementation(start("https://signed.test/a.png"));
    incomingRequestCount.mockImplementation(start(3));
    unreadTotal.mockImplementation(start(5));

    const element = await SignedInShell({ children: null });
    expect(started).toBe(3);
    expect(element.props.user).toEqual({ name: "Sara Raza", avatarUrl: "https://signed.test/a.png", isAdmin: false });
    expect(element.props.counts).toEqual({ requests: 3, messages: 5 });
  });

  it("marks admins", async () => {
    getCurrentMember.mockResolvedValue({ ...member, role: "ADMIN" });
    const element = await SignedInShell({ children: null });
    expect(element.props.user.isAdmin).toBe(true);
  });

  it("loads nothing for a visitor who is not signed in, not verified or suspended", async () => {
    getIdentity.mockResolvedValueOnce(null);
    await expect(SignedInShell({ children: null })).rejects.toThrow("redirect:/sign-in");

    getIdentity.mockResolvedValueOnce({ id: "m1", email: null, emailVerified: false });
    await expect(SignedInShell({ children: null })).rejects.toThrow("redirect:/verify?error=unverified");

    getCurrentMember.mockResolvedValueOnce({ ...member, status: "SUSPENDED" });
    await expect(SignedInShell({ children: null })).rejects.toThrow("redirect:/sign-out?reason=suspended");

    getCurrentMember.mockResolvedValueOnce({ ...member, deletedAt: new Date() });
    await expect(SignedInShell({ children: null })).rejects.toThrow("redirect:/sign-in");

    expect(incomingRequestCount).not.toHaveBeenCalled();
    expect(unreadTotal).not.toHaveBeenCalled();
    expect(avatarUrl).not.toHaveBeenCalled();
  });
});
