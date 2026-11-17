import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/directory",
}));

const user = { name: "Sara Raza", isAdmin: false };

describe("AppShell", () => {
  it("renders the page content inside the main landmark", () => {
    render(
      <AppShell user={user} counts={{ requests: 0, messages: 0 }}>
        <p>Page body</p>
      </AppShell>,
    );
    expect(within(screen.getByRole("main")).getByText("Page body")).toBeInTheDocument();
  });

  it("marks the current page in both menus", () => {
    render(
      <AppShell user={user} counts={{ requests: 0, messages: 0 }}>
        <p />
      </AppShell>,
    );
    const current = screen.getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(2); // top menu + bottom bar
    current.forEach((link) => expect(link).toHaveAttribute("href", "/directory"));
  });

  it("shows unread badges only when there is something unread", () => {
    render(
      <AppShell user={user} counts={{ requests: 3, messages: 0 }}>
        <p />
      </AppShell>,
    );
    expect(screen.getAllByLabelText("3 unread requests")).toHaveLength(2);
    expect(screen.queryByLabelText(/unread messages/)).not.toBeInTheDocument();
  });

  it("shows the member's initials on the account menu button", () => {
    render(
      <AppShell user={user} counts={{ requests: 0, messages: 0 }}>
        <p />
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveTextContent("SR");
  });
});
