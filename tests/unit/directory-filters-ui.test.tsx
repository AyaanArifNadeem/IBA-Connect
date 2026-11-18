import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ActiveFilters } from "@/components/directory/active-filters";
import { FilterPanel } from "@/components/directory/filter-panel";
import { FilterToggle } from "@/components/directory/filter-toggle";
import { directoryQuerySchema } from "@/lib/services/directory";

const query = directoryQuerySchema.parse({ q: "python", course: "CSE341", advise: "1", batch: "2023" });
const courses = [{ value: "CSE341", label: "CSE341 · Database Systems" }];

describe("FilterPanel (US2.3)", () => {
  it("offers the filters in the client's priority order", () => {
    render(<FilterPanel query={query} courses={courses} skills={["Python"]} />);
    const labels = screen.getAllByText(/^[1-5] · /).map((l) => l.textContent);
    expect(labels).toEqual(["1 · Course", "2 · Skill", "3 · Available to advise", "4 · Batch", "5 · Department"]);
  });

  it("shows the current filters and keeps the search", () => {
    const { container } = render(<FilterPanel query={query} courses={courses} skills={["Python"]} />);
    expect(screen.getByLabelText("1 · Course")).toHaveValue("CSE341");
    expect(screen.getByLabelText("3 · Available to advise")).toBeChecked();
    expect(screen.getByLabelText("4 · Batch")).toHaveValue("2023");
    expect(container.querySelector('input[type="hidden"][name="q"]')).toHaveValue("python");
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", "/directory?q=python");
  });

  it("has alumni field and company filters (US2.5)", () => {
    render(<FilterPanel query={query} courses={courses} skills={[]} />);
    expect(screen.getByLabelText("Alumni only")).toBeInTheDocument();
    expect(screen.getByLabelText("Field")).toBeInTheDocument();
    expect(screen.getByLabelText("Company")).toBeInTheDocument();
  });
});

describe("ActiveFilters", () => {
  it("TC-052: each chip removes only its own filter and resets the page", () => {
    render(<ActiveFilters params={new URLSearchParams("q=python&course=CSE341&advise=1&page=3")} />);
    expect(screen.getByRole("link", { name: /CSE341/ })).toHaveAttribute("href", "/directory?q=python&advise=1");
    expect(screen.getByRole("link", { name: /Advisers/ })).toHaveAttribute("href", "/directory?q=python&course=CSE341");
    expect(screen.queryByRole("link", { name: /python/ })).not.toBeInTheDocument();
  });

  it("shows nothing without filters", () => {
    const { container } = render(<ActiveFilters params={new URLSearchParams("q=x")} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FilterToggle (P21)", () => {
  it("shows the number of filters and opens the panel on phones", async () => {
    const user = userEvent.setup();
    render(
      <FilterToggle count={2}>
        <p>panel</p>
      </FilterToggle>,
    );
    const button = screen.getByRole("button", { name: "Filters (2)" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
