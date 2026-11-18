import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatThread, mergeMessages } from "@/components/messages/chat-thread";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const other = { id: "o1", name: "Ali Khan", email: "ali@khi.iba.edu.pk", avatarUrl: null, deleted: false };
const msg = (id: string, body: string, sentAt: string, mine = false) => ({ id, body, sentAt, mine, readAt: null });
const renderThread = (props: Partial<Parameters<typeof ChatThread>[0]> = {}) =>
  render(
    <ChatThread
      connectionId="c1"
      other={other}
      note="Help with CSE341?"
      requestedByMe
      initialMessages={[msg("m1", "Hi", "2026-11-18T10:00:00.000Z", true)]}
      {...props}
    />,
  );

describe("ChatThread (US3.5, P09)", () => {
  it("shows the email, the request note and the messages with times", () => {
    renderThread();
    expect(screen.getByText("ali@khi.iba.edu.pk")).toBeInTheDocument();
    expect(screen.getByText("Your request note: “Help with CSE341?”")).toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveTextContent("You: Hi");
  });

  it("TC-063: sends with Enter and adds the message", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(json(201, { data: msg("m2", "How are you?", "2026-11-18T10:01:00.000Z", true) }));
    renderThread();
    await user.type(screen.getByLabelText("Write a message"), "How are you?{Enter}");
    expect(await screen.findByText("How are you?")).toBeInTheDocument();
    expect(screen.getByLabelText("Write a message")).toHaveValue("");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ body: "How are you?" });
  });

  it("TC-073: the Send button is disabled for an empty message", () => {
    renderThread();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("TC-072: refuses more than 2,000 characters before sending", async () => {
    const user = userEvent.setup();
    renderThread();
    const box = screen.getByLabelText("Write a message");
    await user.click(box);
    await user.paste("a".repeat(2001));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at most 2,000 characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("TC-074: polls for new messages after the latest one", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValue(json(200, { data: [msg("m2", "New from Ali", "2026-11-18T10:02:00.000Z")] }));
    renderThread({ pollMs: 1000 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    await waitFor(() => expect(screen.getByText("New from Ali")).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/connections/c1/messages?after=2026-11-18T10%3A00%3A00.000Z");
  });

  it("explains when the other member has left", () => {
    renderThread({ other: { ...other, name: "Deleted member", email: null, deleted: true } });
    expect(screen.getByText("This member has left IBA Connect.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Write a message")).not.toBeInTheDocument();
  });
});

describe("mergeMessages", () => {
  it("adds new messages once, in time order", () => {
    const a = msg("a", "1", "2026-11-18T10:00:00.000Z");
    const b = msg("b", "2", "2026-11-18T10:01:00.000Z");
    expect(mergeMessages([a], [b, a]).map((m) => m.id)).toEqual(["a", "b"]);
    expect(mergeMessages([b], [a]).map((m) => m.id)).toEqual(["a", "b"]);
  });
});
