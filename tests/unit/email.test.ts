import { describe, expect, it, vi } from "vitest";
import { BrevoSender, ConsoleSender } from "@/lib/email";

const message = {
  to: { email: "member@example.test", name: "Member" },
  subject: "New connection request",
  html: "<p>Hello</p>",
  text: "Hello",
};

describe("BrevoSender", () => {
  it("posts the email to Brevo with the API key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    const sender = new BrevoSender("test-key", { email: "noreply@example.test", name: "IBA Connect" }, fetchMock);

    await sender.send(message);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("test-key");
    expect(JSON.parse(init.body)).toMatchObject({
      sender: { email: "noreply@example.test", name: "IBA Connect" },
      to: [{ email: "member@example.test", name: "Member" }],
      subject: "New connection request",
      htmlContent: "<p>Hello</p>",
      textContent: "Hello",
    });
  });

  it("throws without leaking the recipient when Brevo refuses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 401 }));
    const sender = new BrevoSender("bad-key", { email: "noreply@example.test", name: "IBA Connect" }, fetchMock);

    const error = await sender.send(message).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("401");
    expect((error as Error).message).not.toContain("member@example.test");
  });
});

describe("ConsoleSender", () => {
  it("keeps the message instead of sending it", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = new ConsoleSender();
    await sender.send(message);
    expect(sender.sent).toHaveLength(1);
    expect(info.mock.calls[0][0]).not.toContain("member@example.test");
    info.mockRestore();
  });
});
