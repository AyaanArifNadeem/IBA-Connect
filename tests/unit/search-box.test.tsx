import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchBox } from "@/components/directory/search-box";

describe("SearchBox (US2.2)", () => {
  it("is a GET search form on /directory with the current search filled in", () => {
    const { container } = render(<SearchBox q="python" keep={[]} />);
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/directory");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("searchbox", { name: /Search members/ })).toHaveValue("python");
  });

  it("keeps other filters as hidden fields and offers to clear the search only", () => {
    const { container } = render(<SearchBox q="sql" keep={[["advise", "1"], ["course", "CSE341"]]} />);
    const hidden = [...container.querySelectorAll('input[type="hidden"]')].map((i) => [i.getAttribute("name"), i.getAttribute("value")]);
    expect(hidden).toEqual([["advise", "1"], ["course", "CSE341"]]);
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/directory?advise=1&course=CSE341");
  });

  it("has no Clear link without a search", () => {
    render(<SearchBox keep={[]} />);
    expect(screen.queryByRole("link", { name: "Clear" })).not.toBeInTheDocument();
  });
});
