import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectButton } from "@/components/members/connect-button";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("ConnectButton (US3.1, P07)", () => {
  it("TC-054: sends a request with a note and shows Request sent", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/allowance") ? json(200, { data: { remaining: 7 } }) : json(201, { data: { id: "c1", remainingToday: 6 } }),
    );
    render(<ConnectButton memberId="m1" memberName="Ali Khan" initial={{ state: "none" }} />);
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("7 requests left today")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Why are you reaching out?"), "Help with CSE341?");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("button", { name: "Request sent" })).toBeDisabled();
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/v1/connections")!;
    expect(JSON.parse(init.body)).toEqual({ recipientId: "m1", note: "Help with CSE341?" });
  });

  it("TC-056: shows the limit message from the server", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/allowance")
        ? json(200, { data: { remaining: 1 } })
        : json(429, { error: { code: "rate_limited", message: "You can send up to 10 requests a day. Please try again later." } }),
    );
    render(<ConnectButton memberId="m1" memberName="Ali Khan" initial={{ state: "none" }} />);
    await user.click(screen.getByRole("button", { name: "Connect" }));
    await user.type(screen.getByLabelText("Why are you reaching out?"), "hi");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("up to 10 requests a day");
  });

  it("asks for a note before sending", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json(200, { data: { remaining: 5 } }));
    render(<ConnectButton memberId="m1" memberName="Ali Khan" initial={{ state: "none" }} />);
    await user.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Say briefly why you are reaching out");
  });

  it("shows the right state for pending, incoming, connected, cooldown and blocked", () => {
    const { rerender, container } = render(<ConnectButton memberId="m" memberName="A" initial={{ state: "pending_outgoing", connectionId: "c" }} />);
    expect(screen.getByRole("button", { name: "Request sent" })).toBeDisabled();
    rerender(<ConnectButton key="2" memberId="m" memberName="A" initial={{ state: "pending_incoming", connectionId: "c" }} />);
    expect(screen.getByRole("link", { name: "Respond to request" })).toHaveAttribute("href", "/requests");
    rerender(<ConnectButton key="3" memberId="m" memberName="A" initial={{ state: "connected", connectionId: "c9" }} />);
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute("href", "/messages/c9");
    rerender(<ConnectButton key="4" memberId="m" memberName="A" initial={{ state: "cooldown", days: 2 }} />);
    expect(screen.getByRole("button", { name: "Ask again in 2 days" })).toBeDisabled();
    rerender(<ConnectButton key="5" memberId="m" memberName="A" initial={{ state: "blocked" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
