import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { db } from "./db";

// Uploaded images (menu photos, UPI QR codes).
// - If S3_BUCKET is set, new images go to that S3-compatible bucket (AWS S3, Neon storage, R2, MinIO…).
// - Otherwise they are stored in Postgres (the `files` table), so no extra service is needed.
// Reads check the database first, then the bucket, so images stored either way keep working.
// The bucket can stay private: images are always served through the backend at /api/img/:name.
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const sniff = (b: Buffer): string | null =>
  b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? "jpg" :
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png" :
  b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" ? "webp" : null;

const BUCKET = process.env.S3_BUCKET || "";
const PREFIX = process.env.S3_PREFIX ?? "uploads/";
const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT || undefined;

let client: S3Client | null = null;
function s3(): S3Client | null {
  if (!BUCKET) return null;
  return (client ??= new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint,
    // Most S3-compatible services expect bucket-in-path URLs; AWS itself works with either.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE ? process.env.S3_FORCE_PATH_STYLE === "true" : !!endpoint,
    // Newer SDKs add checksums some S3-compatible stores reject; only send them when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }));
}

/** Store an already-validated image buffer; returns its file name (id). */
export async function storeImage(buf: Buffer, ext: string): Promise<string> {
  const name = `${crypto.randomBytes(12).toString("hex")}.${ext}`;
  const c = s3();
  if (c) await c.send(new PutObjectCommand({ Bucket: BUCKET, Key: PREFIX + name, Body: buf, ContentType: TYPES[ext] }));
  else await db.prepare("INSERT INTO files(name,mime,data) VALUES(?,?,?)").run(name, TYPES[ext], buf);
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
  if (r) return { buf: r.data, type: r.mime };
  const c = s3();
  if (!c) return null;
  try {
    const o = await c.send(new GetObjectCommand({ Bucket: BUCKET, Key: PREFIX + name }));
    if (!o.Body) return null;
    return { buf: Buffer.from(await o.Body.transformToByteArray()), type: o.ContentType || TYPES[name.split(".").pop()!] };
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}
