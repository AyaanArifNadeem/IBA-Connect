import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SignIn from "@/app/(auth)/sign-in/page";

describe("Sign-in page (client-side checks)", () => {
  it("asks for both fields when the form is submitted empty", async () => {
    const user = userEvent.setup();
    render(<SignIn />);

    await user.click(screen.getByRole("button", { name: /sign in with email/i }));

    expect(await screen.findByText("Please fill out all fields")).toBeInTheDocument();
  });

  it("rejects an email outside the IBA domain", async () => {
    const user = userEvent.setup();
    render(<SignIn />);

    await user.type(screen.getByPlaceholderText("name@khi.iba.edu.pk"), "someone@gmail.com");

    expect(await screen.findByText("Only @khi.iba.edu.pk accounts can join")).toBeInTheDocument();
  });

  it("links to register, forgot password and alumni verification", () => {
    render(<SignIn />);

    expect(screen.getByRole("link", { name: /register here/i })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /forgot/i })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: /verify your status/i })).toHaveAttribute("href", "/verify-alumni");
  });
});
