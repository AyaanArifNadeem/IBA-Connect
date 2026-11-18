import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardFilters } from "@/components/board/board-filters";
import { PostCard, type PostCardData } from "@/components/board/post-card";

const post: PostCardData = {
  id: "p1",
  type: "STUDY_PARTNER",
  title: "CSE341 study partner before mids",
  body: "Revise together",
  courseCode: "CSE341",
  departmentTag: null,
  expiresAt: new Date(Date.now() + 12 * 86_400_000 - 1000).toISOString(),
  author: { id: "a", name: "Sara Raza" },
  mine: false,
  responses: 3,
};

describe("PostCard (US4.2, P10)", () => {
  it("shows type, days left, title, author, tag and responses", () => {
    render(<PostCard post={post} />);
    expect(screen.getByText("Study partner")).toBeInTheDocument();
    expect(screen.getByText("12 days left")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CSE341 study partner before mids" })).toBeInTheDocument();
    expect(screen.getByText("Sara Raza")).toBeInTheDocument();
    expect(screen.getByText("CSE341")).toBeInTheDocument();
    expect(screen.getByText("3 responses")).toBeInTheDocument();
  });

  it("marks your own post", () => {
    render(<PostCard post={{ ...post, mine: true, responses: 1 }} />);
    expect(screen.getByText(/Your post/)).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("1 response")).toBeInTheDocument();
  });
});

describe("BoardFilters (TC-077)", () => {
  it("offers All and the 4 types, keeping the other filters in each link", () => {
    render(<BoardFilters type="COURSE_ADVICE" course="CSE341" q="mids" courses={[{ code: "CSE341", title: "DB" }]} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/board?course=CSE341&q=mids");
    expect(screen.getByRole("link", { name: "Study partner" })).toHaveAttribute("href", "/board?type=study-partner&course=CSE341&q=mids");
    expect(screen.getByRole("link", { name: "Course advice" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Course tag")).toHaveValue("CSE341");
    expect(screen.getByLabelText("Search posts")).toHaveValue("mids");
  });
});
