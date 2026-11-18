import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AccountMenu } from "@/components/layout/account-menu";

describe("AccountMenu", () => {
  it("opens and lists the account links", async () => {
    render(<AccountMenu user={{ name: "Sara Raza", isAdmin: true }} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(await screen.findByText("Sara Raza")).toBeInTheDocument();
    for (const name of ["My profile", "Settings", "Admin", "Sign out"]) {
      expect(screen.getByRole("menuitem", { name: new RegExp(name) })).toBeInTheDocument();
    }
  });
});
