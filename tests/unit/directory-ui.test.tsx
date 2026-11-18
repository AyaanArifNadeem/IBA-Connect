import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemberCard } from "@/components/directory/member-card";
import { Pager, pageWindow } from "@/components/directory/pager";

const member = {
  id: "m1",
  name: "Ali Khan",
  isAlumnus: false,
  avatarUrl: null,
  batch: 2023,
  programme: "BS Computer Science",
  department: "Computer Science",
  field: null,
  company: null,
  skills: ["SQL", "React"],
  adviseCourses: ["CSE341"],
};

describe("MemberCard (US2.1)", () => {
  it("shows name, programme, batch, advise badge and skills, and links to the profile", () => {
    render(<MemberCard member={member} />);
    expect(screen.getByRole("heading", { name: "Ali Khan" })).toBeInTheDocument();
    expect(screen.getByText("BS Computer Science · 2023")).toBeInTheDocument();
    expect(screen.getByText("Available to advise")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Skills" })).toHaveTextContent("SQLReact");
    expect(screen.getByRole("link", { name: /View profile/ })).toHaveAttribute("href", "/members/m1");
  });

  it("shows field and company for alumni", () => {
    render(<MemberCard member={{ ...member, isAlumnus: true, field: "Banking & Finance", company: "Contoso Bank", adviseCourses: [] }} />);
    expect(screen.getByText("Alumnus · Banking & Finance · Contoso Bank")).toBeInTheDocument();
    expect(screen.queryByText("Available to advise")).not.toBeInTheDocument();
  });
});

describe("Pager", () => {
  it("keeps the first and last pages and two either side", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 8, 9, 10, 11, 12, "gap", 20]);
  });

  it("keeps the other query parameters in its links", () => {
    render(<Pager page={2} pages={3} params={new URLSearchParams("q=python&page=2")} />);
    expect(screen.getByRole("link", { name: "‹ Prev" })).toHaveAttribute("href", "?q=python");
    expect(screen.getByRole("link", { name: "Next ›" })).toHaveAttribute("href", "?q=python&page=3");
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
  });

  it("hides itself for a single page", () => {
    const { container } = render(<Pager page={1} pages={1} params={new URLSearchParams()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
