import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "@/app/(app)/settings/change-password-form";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function fill(current: string, next: string, confirm: string) {
  const user = userEvent.setup();
  render(<ChangePasswordForm />);
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ChangePasswordForm", () => {
  it("TC-014: catches a mismatched confirmation without calling the server", async () => {
    await fill("Old!Pass123", "Pass1!aaaa", "Pass2!bbbb");
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows field errors returned by the server", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "validation_failed", message: "x", details: [{ path: "newPassword", message: "Password cannot contain spaces" }] },
        }),
        { status: 400 },
      ),
    );
    await fill("Old!Pass123", "New Pass1!", "New Pass1!");
    expect(await screen.findByText("Password cannot contain spaces")).toBeInTheDocument();
  });

  it("TC-013: clears the form after a successful change", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { message: "Password changed." } }), { status: 200 }));
    await fill("Old!Pass123", "Ch4nged!Pass", "Ch4nged!Pass");
    expect(await screen.findByLabelText("Current password")).toHaveValue("");
  });
});
