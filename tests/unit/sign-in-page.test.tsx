import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignIn from "@/app/(auth)/sign-in/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const signInWithOAuth = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithOAuth } }) }));

const fetchMock = vi.fn();
beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  signInWithOAuth.mockReset();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function fillAndSubmit(email = "sara@khi.iba.edu.pk", password = "Secret!123") {
  const user = userEvent.setup();
  render(<SignIn />);
  await user.type(screen.getByPlaceholderText("name@khi.iba.edu.pk"), email);
  await user.type(screen.getByPlaceholderText("••••••••"), password);
  await user.click(screen.getByRole("button", { name: /sign in with email/i }));
}

describe("Sign-in page", () => {
  it("asks for both fields when the form is submitted empty", async () => {
    const user = userEvent.setup();
    render(<SignIn />);
    await user.click(screen.getByRole("button", { name: /sign in with email/i }));
    expect(await screen.findByText("Please fill out all fields")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets alumni sign in with a personal email (FR1.3)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { next: "/dashboard" } }));
    await fillAndSubmit("bilal.khan@example.test");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("Only @khi.iba.edu.pk accounts can join")).not.toBeInTheDocument();
  });

  it("links to register, forgot password and alumni verification", () => {
    render(<SignIn />);
    expect(screen.getByRole("link", { name: /register here/i })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /forgot/i })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: /verify your status/i })).toHaveAttribute("href", "/verify-alumni");
  });

  it("TC-008: shows the server's message for a wrong password", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { code: "unauthorized", message: "Incorrect email or password." } }),
    );
    await fillAndSubmit();
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/sign-in", expect.objectContaining({ method: "POST" }));
  });

  it("TC-006: sends an unverified member to the verify page", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: { code: "email_not_verified", message: "Please verify your email address first." } }),
    );
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify?error=unverified"));
  });

  it("goes where the server says after a successful sign-in", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { next: "/profile/setup" } }));
    await fillAndSubmit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/profile/setup"));
  });
});

describe("Microsoft sign-in button (US1.1)", () => {
  it("starts Azure sign-in with a callback back to the app", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
    signInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignIn />);
    await user.click(screen.getByRole("button", { name: "Sign in with Microsoft (IBA)" }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "azure",
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fdashboard", scopes: "openid email profile" },
    });
  });

  it("explains when Microsoft sign-in is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const user = userEvent.setup();
    render(<SignIn />);
    await user.click(screen.getByRole("button", { name: "Sign in with Microsoft (IBA)" }));
    expect(screen.getByText(/not set up yet/)).toBeInTheDocument();
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});
