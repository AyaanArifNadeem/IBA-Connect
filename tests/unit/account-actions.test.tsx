import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountActions } from "@/app/(app)/settings/account-actions";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("AccountActions (FR1.8)", () => {
  it("TC-034: deactivating asks first, then signs out", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    render(<AccountActions onDone={onDone} />);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Deactivate your account?")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("/sign-out"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/account/deactivate", expect.objectContaining({ method: "POST" }));
  });

  it("TC-035 / TC-036: delete needs DELETE typed; cancelling changes nothing", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }));
    render(<AccountActions onDone={onDone} />);

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const confirmButton = (await screen.findAllByRole("button", { name: "Delete account" })).at(-1)!;
    expect(confirmButton).toBeDisabled();
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("/sign-out"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ confirm: "DELETE" });
  });
});
