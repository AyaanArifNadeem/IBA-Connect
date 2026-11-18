import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostForm } from "@/components/board/post-form";
import { daysLeft } from "@/lib/board";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const courses = [{ code: "CSE341", title: "Database Systems" }];

describe("PostForm (US4.1, P11)", () => {
  it("TC-076: lists what is missing and does not publish", async () => {
    const user = userEvent.setup();
    render(<PostForm courses={courses} />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByText("Choose the kind of help you need")).toBeInTheDocument();
    expect(screen.getByText("Give your post a title")).toBeInTheDocument();
    expect(screen.getByText("Add some details")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TC-075: publishes a study-partner post with a course tag and opens it", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { id: "p1" } }), { status: 201 }));
    render(<PostForm courses={courses} />);
    await user.click(screen.getByLabelText("Study partner"));
    await user.type(screen.getByLabelText("Title"), "CSE341 study buddy");
    await user.type(screen.getByLabelText("Details"), "Revise together before mids");
    await user.selectOptions(screen.getByLabelText("Course tag (optional)"), "CSE341");
    expect(screen.getByText(/Closes automatically in 14 days/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/board/my-posts/p1"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      type: "STUDY_PARTNER",
      title: "CSE341 study buddy",
      body: "Revise together before mids",
      course: "CSE341",
      department: null,
    });
  });

  it("does not allow a course and a department tag together", async () => {
    const user = userEvent.setup();
    render(<PostForm courses={courses} initial={{ type: "COURSE_ADVICE", title: "Advice", body: "x", course: "CSE341", department: "" }} />);
    await user.selectOptions(screen.getByLabelText("Department tag (optional)"), "Economics");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByText("Tag a course or a department, not both")).toBeInTheDocument();
  });

  it("locks the type when editing (US4.5)", () => {
    render(<PostForm courses={courses} postId="p1" initial={{ type: "CAREER_ADVICE", title: "Advice", body: "x", course: "", department: "" }} />);
    expect(screen.getByLabelText("Study partner")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("daysLeft", () => {
  it("rounds up and never goes below zero", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    expect(daysLeft("2026-11-30T09:00:00Z", now)).toBe(12);
    expect(daysLeft("2026-11-18T11:00:00Z", now)).toBe(1);
    expect(daysLeft("2026-11-17T10:00:00Z", now)).toBe(0);
  });
});
