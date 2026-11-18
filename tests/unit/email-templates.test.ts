import { describe, expect, it } from "vitest";
import { connectionRequestEmail } from "@/lib/email/templates";

describe("connectionRequestEmail (FR3.6)", () => {
  const mail = connectionRequestEmail({
    to: { email: "ali@khi.iba.edu.pk", name: "Ali Khan" },
    from: "Sara <b>Raza</b>",
    note: "Help with <script>alert(1)</script>?",
    appUrl: "https://iba-connect.test",
  });

  it("links to the requests inbox and greets by first name", () => {
    expect(mail.html).toContain('href="https://iba-connect.test/requests"');
    expect(mail.html).toContain("Hi Ali,");
    expect(mail.text).toContain("https://iba-connect.test/requests");
  });

  it("escapes names and notes in the HTML", () => {
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Sara &lt;b&gt;Raza&lt;/b&gt;");
  });
});
