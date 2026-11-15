// Removes the demo data added by `npm run seed` / `npm run photos`, leaving real data untouched.
//
//   npm run unseed           → dry run: shows what would be removed, changes nothing
//   npm run unseed -- --yes  → removes it
//
// Demo data is recognised by email: demo accounts end in "@demo.com" or ".demo", and every demo
// restaurant's email ends in ".demo". Removed: those accounts and restaurants, with their menus, tables,
// applications, orders, images, emails and activity log entries; orders that demo customers placed
// anywhere; and the demo photo credits. The super admin and all real accounts/restaurants stay.
import { db, pool } from "../src/db";
import { deleteImages } from "../src/files";

const YES = process.argv.includes("--yes");
const ids = async (sql: string, ...a: unknown[]) => ((await db.prepare(sql).all(...a)) as { id: number }[]).map((r) => r.id);
const count = async (sql: string, ...a: unknown[]) => ((await db.prepare(sql).get(...a)) as { c: number }).c;

async function main() {
  const rest = await ids("SELECT id FROM restaurants WHERE email LIKE '%.demo'");
  const users = await ids("SELECT id FROM users WHERE (email LIKE '%@demo.com' OR email LIKE '%.demo') AND role <> 'super_admin'");
  const orders = await ids("SELECT id FROM orders WHERE restaurant_id = ANY(?::int[]) OR customer_id = ANY(?::int[])", rest, users);
  const items = await ids("SELECT id FROM items WHERE restaurant_id = ANY(?::int[])", rest);
  const images = [
    ...((await db.prepare("SELECT image AS f FROM items WHERE restaurant_id = ANY(?::int[]) AND image IS NOT NULL").all(rest)) as { f: string }[]),
    ...((await db.prepare("SELECT upi_qr AS f FROM restaurants WHERE id = ANY(?::int[]) AND upi_qr IS NOT NULL").all(rest)) as { f: string }[]),
  ].map((r) => r.f);
  // Only images nothing else uses
  const shared = new Set(((await db.prepare(
    "SELECT image AS f FROM items WHERE image = ANY(?::text[]) AND NOT (restaurant_id = ANY(?::int[])) UNION SELECT upi_qr FROM restaurants WHERE upi_qr = ANY(?::text[]) AND NOT (id = ANY(?::int[]))",
  ).all(images, rest, images, rest)) as { f: string }[]).map((r) => r.f));
  const files = [...new Set(images)].filter((f) => !shared.has(f));
  const emails = await count("SELECT COUNT(*)::int c FROM emails WHERE to_addr LIKE '%@demo.com' OR to_addr LIKE '%.demo'");

  console.log(`Demo data found:
  restaurants ${rest.length}
  accounts    ${users.length}
  orders      ${orders.length}
  menu items  ${items.length}
  images      ${files.length}
  emails      ${emails}`);
  const real = await count("SELECT COUNT(*)::int c FROM restaurants WHERE NOT (id = ANY(?::int[]))", rest);
  console.log(`Real restaurants kept: ${real}`);

  if (!YES) { console.log("\nDry run: nothing changed. Run `npm run unseed -- --yes` to remove the demo data."); return; }
  if (!rest.length && !users.length) { console.log("Nothing to remove."); return; }

  await db.transaction(async () => {
    const run = (sql: string, ...a: unknown[]) => db.prepare(sql).run(...a);
    await run("DELETE FROM cancel_requests WHERE order_id = ANY(?::int[])", orders);
    await run("DELETE FROM order_lines WHERE order_id = ANY(?::int[])", orders);
    await run("DELETE FROM table_moves WHERE order_id = ANY(?::int[])", orders);
    await run("DELETE FROM orders WHERE id = ANY(?::int[])", orders);
    await run("DELETE FROM portions WHERE item_id = ANY(?::int[])", items);
    await run("DELETE FROM items WHERE id = ANY(?::int[])", items);
    await run("DELETE FROM categories WHERE restaurant_id = ANY(?::int[])", rest);
    await run("DELETE FROM tables_ WHERE restaurant_id = ANY(?::int[])", rest);
    await run("DELETE FROM applications WHERE restaurant_id = ANY(?::int[]) OR admin_user_id = ANY(?::int[])", rest, users);
    await run("DELETE FROM setup_fees WHERE restaurant_id = ANY(?::int[])", rest);
    await run("DELETE FROM tokens WHERE user_id = ANY(?::int[])", users);
    await run("DELETE FROM oplog WHERE actor_id = ANY(?::int[])", users);
    await run("DELETE FROM emails WHERE to_addr LIKE '%@demo.com' OR to_addr LIKE '%.demo'");
    await run("UPDATE users SET restaurant_id = NULL WHERE restaurant_id = ANY(?::int[]) AND NOT (id = ANY(?::int[]))", rest, users);
    await run("DELETE FROM users WHERE id = ANY(?::int[])", users);
    await run("DELETE FROM restaurants WHERE id = ANY(?::int[])", rest);
    await run("DELETE FROM settings WHERE key = 'photo_credits'");
  })();
  await deleteImages(files);
  console.log("\nDemo data removed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
