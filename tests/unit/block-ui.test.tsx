import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlockedList } from "@/app/(app)/settings/blocked-list";
import { BlockMenu } from "@/components/members/block-menu";

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

describe("BlockMenu (FR3.7)", () => {
  it("TC-070: blocks after confirming", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 201 }));
    render(<BlockMenu memberId="m1" memberName="Ali Khan" blockedByMe={false} />);
    await user.click(screen.getByRole("button", { name: "More actions for Ali Khan" }));
    await user.click(await screen.findByRole("menuitem", { name: "Block" }));
    expect(await screen.findByText("Block Ali Khan?")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/blocks", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ memberId: "m1" });
  });

  it("offers Unblock when you blocked the member", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    render(<BlockMenu memberId="m1" memberName="Ali Khan" blockedByMe />);
    expect(screen.getByText("You blocked this member.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/blocks/m1", expect.objectContaining({ method: "DELETE" })));
  });
});

describe("BlockedList", () => {
  it("lists blocked members with Unblock, or says there are none", () => {
    const { rerender } = render(<BlockedList blocked={[{ id: "a", name: "Ali Khan" }]} />);
    expect(screen.getByRole("button", { name: "Unblock Ali Khan" })).toBeInTheDocument();
    rerender(<BlockedList blocked={[]} />);
    expect(screen.getByText("You have not blocked anyone.")).toBeInTheDocument();
  });
});
