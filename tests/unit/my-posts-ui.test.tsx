import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClosePostButton } from "@/components/board/close-post-button";
import { MyPostList } from "@/components/board/my-post-list";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("ClosePostButton (US4.4)", () => {
  it("TC-081: asks before closing, then closes", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { status: "CLOSED" } }), { status: 200 }));
    render(<ClosePostButton postId="p1" />);
    await user.click(screen.getByRole("button", { name: "Close post" }));
    expect(screen.getByText("It leaves the board; you will still see the responses.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/posts/p1/close", expect.objectContaining({ method: "POST" })));
    expect(refresh).toHaveBeenCalled();
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();
    render(<ClosePostButton postId="p1" />);
    await user.click(screen.getByRole("button", { name: "Close post" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Close post" })).toBeInTheDocument();
  });
});

describe("MyPostList (P12)", () => {
  it("shows each post's state and highlights the open one", () => {
    const soon = new Date(Date.now() + 9 * 86_400_000 - 1000).toISOString();
    render(
      <MyPostList
        activeId="a"
        posts={[
          { id: "a", type: "STUDY_PARTNER", title: "CSE341 study buddy", state: "open", expiresAt: soon, responses: 4 },
          { id: "b", type: "PROJECT_TEAMMATE", title: "SWE teammate", state: "closed", expiresAt: soon, responses: 0 },
          { id: "c", type: "CAREER_ADVICE", title: "Career advice", state: "expired", expiresAt: soon, responses: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Open · 9 days")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CSE341 study buddy/ })).toHaveAttribute("aria-current", "page");
  });
});
