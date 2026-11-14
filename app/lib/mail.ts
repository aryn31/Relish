import { db } from "./db";
/** Dev mail: stored in the `emails` table and printed. Replace body with a real provider (SMTP/Resend) for production. */
export async function sendMail(to: string, subject: string, body: string) {
  await db.prepare("INSERT INTO emails(to_addr,subject,body) VALUES(?,?,?)").run(to, subject, body);
  console.log(`\n[email] to=${to} subject=${subject}\n${body}\n`);
}
export const baseUrl = () => process.env.BASE_URL || "http://localhost:3000";
