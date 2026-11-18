import { describe, expect, it } from "vitest";
import { detectImage } from "@/lib/storage/image-check";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detectImage (US1.6)", () => {
  it("recognises PNG, JPEG and WebP by content", () => {
    expect(detectImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(detectImage(webp)?.ext).toBe("webp");
  });

  it("rejects PDFs, SVGs, executables and empty files", () => {
    expect(detectImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(detectImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(detectImage(bytes(0x4d, 0x5a))).toBeNull();
    expect(detectImage(new Uint8Array())).toBeNull();
  });
});
