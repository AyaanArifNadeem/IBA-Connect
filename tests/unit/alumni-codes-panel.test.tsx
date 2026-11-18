import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlumniCodesPanel, type CodeRow } from "@/components/admin/alumni-codes-panel";

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

const row = (over: Partial<CodeRow>): CodeRow => ({
  id: "1",
  code: "IBA-AAAA-BBBB",
  note: null,
  createdAt: "2026-11-18T00:00:00Z",
  expiresAt: null,
  claimedBy: null,
  status: "active",
  ...over,
});

describe("AlumniCodesPanel (FR1.9)", () => {
  it("TC-037: creates a code with the chosen expiry and shows it", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { code: "IBA-NEW2-CODE" } }), { status: 201 }));
    render(<AlumniCodesPanel codes={[]} />);
    await user.selectOptions(screen.getByLabelText("Expires"), "90");
    await user.click(screen.getByRole("button", { name: "New code" }));
    expect(await screen.findByRole("status")).toHaveTextContent("IBA-NEW2-CODE");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expiresInDays: 90 });
    expect(refresh).toHaveBeenCalled();
  });

  it("offers expire and revoke for active codes only", () => {
    render(
      <AlumniCodesPanel
        codes={[row({ id: "a" }), row({ id: "b", code: "IBA-USED-CODE", status: "claimed", claimedBy: "Bilal Khan" })]}
      />,
    );
    const [, active, used] = screen.getAllByRole("row");
    expect(within(active).getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    expect(within(used).queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
    expect(used).toHaveTextContent("Bilal Khan");
  });

  it("TC-038: revokes a code", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    render(<AlumniCodesPanel codes={[row({ id: "abc" })]} />);
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/alumni-codes/abc", expect.objectContaining({ method: "PATCH" })));
  });
});
