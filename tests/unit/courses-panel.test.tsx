import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoursesPanel } from "@/components/admin/courses-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const courses = [
  { id: "a", code: "CSE341", title: "Database Systems", department: "Computer Science", retired: false, members: 4 },
  { id: "b", code: "OLD100", title: "Old Course", department: "Economics", retired: true, members: 1 },
];

describe("CoursesPanel (FR1.10)", () => {
  it("TC-043: shows the server's duplicate-code message", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: "conflict", message: "Course code already exists." } }), { status: 409 }));
    render(<CoursesPanel courses={courses} />);
    await user.type(screen.getByLabelText("Code"), "CSE341");
    await user.type(screen.getByLabelText("Title"), "Copy");
    await user.selectOptions(screen.getByLabelText("Department"), "Computer Science");
    await user.click(screen.getByRole("button", { name: "Add course" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Course code already exists.");
  });

  it("offers Retire for active courses and Restore for retired ones", () => {
    render(<CoursesPanel courses={courses} />);
    expect(screen.getByRole("button", { name: "Retire" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("edits a course in the form", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    render(<CoursesPanel courses={courses} />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    expect(screen.getByLabelText("Code")).toHaveValue("CSE341");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/courses/a", expect.objectContaining({ method: "PATCH" })));
  });

  it("filters the list", async () => {
    const user = userEvent.setup();
    render(<CoursesPanel courses={courses} />);
    await user.type(screen.getByLabelText("Filter courses"), "econ");
    expect(screen.queryByText("Database Systems")).not.toBeInTheDocument();
    expect(screen.getByText("Old Course")).toBeInTheDocument();
  });
});
