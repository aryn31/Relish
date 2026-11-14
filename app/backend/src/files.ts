import crypto from "crypto";
import { db } from "./db";

// Uploaded images (menu photos, UPI QR codes) are stored in Postgres, so the app needs no
// persistent disk and survives redeploys on any host.
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const sniff = (b: Buffer): string | null =>
  b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "jpg" :
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png" :
  b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" ? "webp" : null;

/** Store an already-validated image buffer; returns its file name (id). */
export async function storeImage(buf: Buffer, ext: string): Promise<string> {
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  await db.prepare("INSERT INTO files(name,mime,data) VALUES(?,?,?)").run(name, TYPES[ext], buf);
  return name;
}

/** Validates an uploaded file (by content, not filename) and size (<=5MB); returns stored name or an error string. */
export async function saveUpload(f: { buffer: Buffer; size: number } | undefined): Promise<{ name: string } | { error: string } | null> {
  if (!f || f.size === 0) return null;
  if (f.size > 5 * 1024 * 1024) return { error: "Image must be 5 MB or smaller." };
  const ext = sniff(f.buffer);
  if (!ext) return { error: "Image must be JPEG, PNG or WebP." };
  return { name: await storeImage(f.buffer, ext) };
}

export async function readUpload(name: string): Promise<{ buf: Buffer; type: string } | null> {
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name)) return null;
  const r = (await db.prepare("SELECT mime, data FROM files WHERE name=?").get(name)) as { mime: string; data: Buffer } | undefined;
  return r ? { buf: r.data, type: r.mime } : null;
}
