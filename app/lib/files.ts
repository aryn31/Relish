import fs from "fs";
import path from "path";
import crypto from "crypto";

const dir = path.join(process.cwd(), "uploads");
const sniff = (b: Buffer): string | null =>
  b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "jpg" :
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png" :
  b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" ? "webp" : null;

/** Validates type (by content, not filename) and size (<=5MB); returns stored name or an error string. */
export async function saveImage(f: File): Promise<{ name: string } | { error: string }> {
  if (f.size > 5 * 1024 * 1024) return { error: "Image must be 5 MB or smaller." };
  const buf = Buffer.from(await f.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { error: "Image must be JPEG, PNG or WebP." };
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return { name };
}
export function readUpload(name: string): { buf: Buffer; type: string } | null {
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) return null;
  try {
    const buf = fs.readFileSync(path.join(dir, name));
    return { buf, type: name.endsWith("png") ? "image/png" : name.endsWith("webp") ? "image/webp" : "image/jpeg" };
  } catch { return null; }
}
