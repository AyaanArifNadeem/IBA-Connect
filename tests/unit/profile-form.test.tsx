import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm, type ProfileFormValues } from "@/components/profile/profile-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const fetchMock = vi.fn();
beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const courses = [
  { id: "11111111-1111-4111-8111-111111111111", code: "CSE341", title: "Database Systems", department: "Computer Science" },
  { id: "22222222-2222-4222-8222-222222222222", code: "ECO101", title: "Microeconomics", department: "Economics" },
];
const empty: ProfileFormValues = { name: "Sara Raza", batch: "", programme: "", department: "", semester: "", bio: "", skills: [], courseIds: [] };

function renderForm(initial = empty, isAlumnus = false) {
  render(<ProfileForm initial={initial} courses={courses} isAlumnus={isAlumnus} submitLabel="Finish setup" redirectTo="/dashboard" />);
}

describe("ProfileForm (US1.5)", () => {
  it("TC-020: lists every missing required field and does not call the server", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    for (const message of ["Choose your batch", "Choose your programme", "Choose your department", "Choose your current semester", "Write a short bio", "Add at least one skill"]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(fetchMock).not.toHaveBeenCalledWith("/api/v1/profile", expect.anything());
  });

  it("hides the semester for alumni", () => {
    renderForm(empty, true);
    expect(screen.queryByLabelText("Current semester")).not.toBeInTheDocument();
  });

  it("adds skills with Enter, ignores duplicates and removes them", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Skills");
    await user.type(input, "Python{Enter}python{Enter}SQL{Enter}");
    const list = screen.getByRole("list", { name: "Your skills" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Python", "SQL"]);
    await user.click(screen.getByRole("button", { name: "Remove Python" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("adds a course from the list and shows it as a chip", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText(/Courses taken/), courses[0].id);
    expect(screen.getByRole("list", { name: "Courses you have taken" })).toHaveTextContent("CSE341");
  });

  it("TC-021: counts the bio and flags more than 500 characters", async () => {
    const user = userEvent.setup();
    renderForm({ ...empty, bio: "a".repeat(500) });
    expect(screen.getByText("500/500")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Short bio"), "b");
    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(screen.getByText("Bio can be at most 500 characters")).toBeInTheDocument();
  });

  it("TC-019: sends the profile and goes to the dashboard", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/v1/profile"
        ? new Response(JSON.stringify({ data: {} }), { status: 200 })
        : new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    renderForm({ ...empty, batch: "2023", programme: "BS Computer Science", department: "Computer Science", semester: "5", bio: "Hi", skills: ["Python"], courseIds: [courses[0].id] });
    await user.click(screen.getByRole("button", { name: "Finish setup" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/v1/profile")!;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({ batch: 2023, semester: 5, skills: ["Python"], courseIds: [courses[0].id] });
  });

  it("shows field errors from the server", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/v1/profile"
        ? new Response(JSON.stringify({ error: { code: "validation_failed", message: "x", details: [{ path: "courseIds", message: "One of the courses is not available. Please choose again." }] } }), { status: 400 })
        : new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    renderForm({ ...empty, batch: "2023", programme: "BS Computer Science", department: "Computer Science", semester: "5", bio: "Hi", skills: ["Python"] });
    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(await screen.findByText("One of the courses is not available. Please choose again.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
