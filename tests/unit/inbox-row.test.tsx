import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboxRow } from "@/components/requests/inbox-row";
import type { InboxItem } from "@/lib/services/connections";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const item = (over: Partial<InboxItem> = {}): InboxItem => ({
  id: "c1",
  status: "PENDING",
  note: "Can you help with CSE341?",
  createdAt: "2026-11-18T09:00:00Z",
  respondedAt: null,
  person: { id: "p1", name: "Ali Khan", avatarPath: null },
  email: null,
  viaPost: null,
  cooldownDays: 0,
  ...over,
});

describe("InboxRow (US3.4, P08)", () => {
  it("TC-059: incoming rows can be accepted", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { status: "ACCEPTED" } }), { status: 200 }));
    render(<InboxRow item={item()} view="incoming" avatarUrl={null} />);
    expect(screen.getByText("“Can you help with CSE341?”")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept request from Ali Khan" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/connections/c1");
    expect(JSON.parse(init.body)).toEqual({ action: "accept" });
  });

  it("shows the post a request came from", () => {
    render(<InboxRow item={item({ viaPost: { id: "p", title: "CSE341 study buddy" } })} view="incoming" avatarUrl={null} />);
    expect(screen.getByText("via your post: CSE341 study buddy")).toBeInTheDocument();
  });

  it("TC-060: outgoing declined rows show the cooldown", () => {
    render(<InboxRow item={item({ status: "DECLINED", cooldownDays: 2 })} view="outgoing" avatarUrl={null} />);
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Can ask again in 2 days")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("TC-067: accepted rows show the email and a Message button", () => {
    render(<InboxRow item={item({ status: "ACCEPTED", email: "ali@khi.iba.edu.pk", respondedAt: "2026-11-18T10:00:00Z" })} view="accepted" avatarUrl={null} />);
    expect(screen.getByRole("link", { name: "ali@khi.iba.edu.pk" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute("href", "/messages/c1");
  });
});
