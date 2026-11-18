import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RespondButton } from "@/components/board/respond-button";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const post = { id: "p1", type: "STUDY_PARTNER" as const, title: "CSE341 study partner before mids", authorName: "Sara Raza" };

describe("RespondButton (US4.3, P11-B)", () => {
  it("TC-078: sends the reply as a request with the post and shows Responded", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/allowance") ? json(200, { data: { remaining: 7 } }) : json(201, { data: { id: "r1", connectionId: "c1" } }),
    );
    render(<RespondButton post={post} responded={false} />);
    await user.click(screen.getByRole("button", { name: `Respond to ${post.title}` }));
    expect(await screen.findByText("Respond to Sara Raza's post")).toBeInTheDocument();
    expect(await screen.findByText("Sent as a connection request · 7 left today")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your reply"), "I took CSE341 last year");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Responded")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.find(([u]) => u === "/api/v1/posts/p1/responses")!;
    expect(url).toBe("/api/v1/posts/p1/responses");
    expect(JSON.parse(init.body)).toEqual({ message: "I took CSE341 last year" });
  });

  it("TC-080: shows the server's limit message", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/allowance")
        ? json(200, { data: { remaining: 1 } })
        : json(429, { error: { code: "rate_limited", message: "You can send up to 10 requests a day. Please try again later." } }),
    );
    render(<RespondButton post={post} responded={false} />);
    await user.click(screen.getByRole("button", { name: `Respond to ${post.title}` }));
    await user.type(screen.getByLabelText("Your reply"), "hi");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("up to 10 requests a day");
  });

  it("asks for a reply and shows Responded when you already did", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json(200, { data: { remaining: 5 } }));
    const { rerender } = render(<RespondButton post={post} responded={false} />);
    await user.click(screen.getByRole("button", { name: `Respond to ${post.title}` }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write a short reply");
    rerender(<RespondButton key="done" post={post} responded />);
    expect(screen.getByText("Responded")).toBeInTheDocument();
  });
});
