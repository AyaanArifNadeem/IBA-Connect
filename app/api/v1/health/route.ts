import { connection } from "next/server";
import { ok, route } from "@/lib/api/handler";

/** Liveness check for monitoring and the e2e tests. */
export const GET = route(async () => {
  await connection(); // always answer at request time, never from the build
  return ok({ status: "ok", version: process.env.npm_package_version ?? "0.1.0", time: new Date().toISOString() });
});
