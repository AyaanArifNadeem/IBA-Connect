import { TEMP, cleanLeftovers, pool, removeAccount, supabaseAdmin, tempId } from "./helpers";

/** Remove the temp accounts (their requests, chats and posts go with them) and everything else the run created. */
export default async function globalTeardown() {
  for (const email of Object.values(TEMP)) {
    const id = tempId(email);
    const files = await supabaseAdmin.storage.from("avatars").list(id);
    if (files.data?.length) await supabaseAdmin.storage.from("avatars").remove(files.data.map((f) => `${id}/${f.name}`));
    await removeAccount(id);
  }
  await cleanLeftovers();
  await pool.end();
}
