import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisingCard } from "@/components/profile/advising-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const courses = [
  { id: "11111111-1111-4111-8111-111111111111", code: "CSE341", title: "Database Systems", canAdvise: false },
  { id: "22222222-2222-4222-8222-222222222222", code: "ECO101", title: "Microeconomics", canAdvise: false },
];

describe("AdvisingCard (US1.8)", () => {
  it("TC-087: asks for a course before saving", async () => {
    const user = userEvent.setup();
    render(<AdvisingCard initialAvailable={false} courses={courses} />);
    await user.click(screen.getByRole("switch", { name: "I am available to advise" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Choose at least one course you can advise on")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TC-026: saves the chosen courses and shows the badge", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { availableToAdvise: true, courses: [] } }), { status: 200 }));
    render(<AdvisingCard initialAvailable={false} courses={courses} />);
    expect(screen.queryByText("Available to advise", { selector: "span" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "I am available to advise" }));
    await user.click(screen.getByRole("checkbox", { name: /CSE341/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ available: true, courseIds: [courses[0].id] });
    expect(await screen.findByText("Available to advise", { selector: "span" })).toBeInTheDocument();
  });

  it("points to adding courses when the profile has none", async () => {
    const user = userEvent.setup();
    render(<AdvisingCard initialAvailable={false} courses={[]} />);
    await user.click(screen.getByRole("switch", { name: "I am available to advise" }));
    expect(screen.getByText(/Add the courses you have taken/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
