import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationList } from "@/components/messages/conversation-list";

const chats = [
  { id: "c1", name: "Ali Khan", avatarPath: null, unread: 3, activity: 2, lastMessage: { preview: "See you then", sentAt: "2026-11-18T10:00:00Z", mine: false } },
  { id: "c2", name: "Sara Raza", avatarPath: null, unread: 0, activity: 1, lastMessage: { preview: "Thanks!", sentAt: "2026-11-17T10:00:00Z", mine: true } },
];

describe("ConversationList (US3.6)", () => {
  it("TC-065: shows the unread count only on chats with unread messages", () => {
    render(<ConversationList conversations={chats} avatars={new Map()} />);
    expect(screen.getByLabelText("3 unread")).toBeInTheDocument();
    expect(screen.queryByLabelText("0 unread")).not.toBeInTheDocument();
  });

  it("shows the last message, marking your own, and the open chat", () => {
    render(<ConversationList conversations={chats} activeId="c2" avatars={new Map()} />);
    expect(screen.getByText("You: Thanks!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sara Raza/ })).toHaveAttribute("aria-current", "page");
  });

  it("explains how to start when there are no chats", () => {
    render(<ConversationList conversations={[]} avatars={new Map()} />);
    expect(screen.getByText(/No chats yet/)).toBeInTheDocument();
  });
});
