import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { Dashboard } from "@/lib/services/dashboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const data: Dashboard = {
  counts: { pendingRequests: 2, unreadMessages: 1, openPosts: 1, connections: 4 },
  pendingRequests: [
    { id: "r1", status: "PENDING", note: "Can you help?", createdAt: "", respondedAt: null, person: { id: "a", name: "Ali Khan", avatarPath: null }, email: null, viaPost: null, cooldownDays: 0 },
  ],
  unreadChats: [{ id: "c1", name: "Carla", avatarPath: null, unread: 1, activity: 1, lastMessage: { preview: "See you at 5", sentAt: "", mine: false } }],
  openPosts: [{ id: "p1", type: "STUDY_PARTNER", title: "CSE341 study buddy", state: "open", expiresAt: new Date(Date.now() + 9 * 86_400_000 - 1000).toISOString(), responses: 2 }],
};

describe("DashboardView (FR1.7, P04)", () => {
  it("TC-032: shows the counts with links to each list", () => {
    render(<DashboardView name="Sara Raza" data={data} />);
    expect(screen.getByRole("heading", { name: "Hi Sara" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /2\s*Pending requests/ })).toHaveAttribute("href", "/requests");
    expect(screen.getByRole("link", { name: /1\s*Unread messages/ })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: /1\s*My open posts/ })).toHaveAttribute("href", "/board/my-posts");
  });

  it("lists pending requests with Accept and Decline, unread chats and open posts", () => {
    render(<DashboardView name="Sara Raza" data={data} />);
    expect(screen.getByRole("button", { name: "Accept request from Ali Khan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Carla/ })).toHaveAttribute("href", "/messages/c1");
    expect(screen.getByRole("link", { name: /CSE341 study buddy/ })).toHaveAttribute("href", "/board/my-posts/p1");
  });

  it("TC-033: links to every main screen in one click (NFR14)", () => {
    render(<DashboardView name="Sara Raza" data={data} />);
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    for (const screenHref of ["/directory", "/board", "/messages", "/requests", "/profile", "/settings", "/board/new"]) {
      expect(hrefs).toContain(screenHref);
    }
  });
});
