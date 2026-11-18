import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlumniForm } from "@/app/(auth)/verify-alumni/alumni-form";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function fill(user: ReturnType<typeof userEvent.setup>, withCode = true) {
  await user.type(screen.getByLabelText("Full name"), "Bilal Khan");
  await user.type(screen.getByLabelText("Personal email"), "bilal@example.test");
  if (withCode) await user.type(screen.getByLabelText("Alumni code"), "iba-7kq2-m9xd");
  await user.type(screen.getByLabelText("Password"), "Str0ng!Pass");
  await user.type(screen.getByLabelText("Confirm password"), "Str0ng!Pass");
}

describe("AlumniForm (US1.4)", () => {
  it("TC-015: sends the code and shows the confirmation", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { message: "You are verified as an alumnus." } }), { status: 201 }));
    render(<AlumniForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Verify and create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent("You are verified as an alumnus.");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ method: "code", code: "iba-7kq2-m9xd", email: "bilal@example.test" });
  });

  it("TC-016: the alumni-list option needs no code", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { message: "ok" } }), { status: 201 }));
    render(<AlumniForm />);
    await user.click(screen.getByRole("radio", { name: "My email is on the alumni list" }));
    expect(screen.queryByLabelText("Alumni code")).not.toBeInTheDocument();
    await fill(user, false);
    await user.click(screen.getByRole("button", { name: "Verify and create account" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.method).toBe("list");
    expect(body).not.toHaveProperty("code");
  });

  it("TC-017: shows the refusal from the server", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "bad_request", message: "We could not verify you as an alumnus." } }), { status: 400 }),
    );
    render(<AlumniForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Verify and create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not verify you as an alumnus.");
  });

  it("checks the passwords match before sending", async () => {
    const user = userEvent.setup();
    render(<AlumniForm />);
    await user.type(screen.getByLabelText("Password"), "Str0ng!Pass");
    await user.type(screen.getByLabelText("Confirm password"), "Other!Pass1");
    await user.click(screen.getByRole("button", { name: "Verify and create account" }));
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
