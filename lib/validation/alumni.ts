import { z } from "zod";
import { DEFAULT_IBA_DOMAIN, emailSchema, hasIbaDomain, passwordSchema } from "./auth";

/** Codes are shown and typed in upper case, e.g. "IBA-7KQ2-M9XD". */
export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Alumni registration with a personal email (FR1.3, US1.4). */
export function alumniRegisterSchema(domain = DEFAULT_IBA_DOMAIN) {
  return z.discriminatedUnion("method", [
    z.object({
      method: z.literal("code"),
      name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
      email: emailSchema.refine((e) => !hasIbaDomain(e, domain), "You have an IBA email: please register with it instead"),
      password: passwordSchema,
      code: z.string().transform(normaliseCode).pipe(z.string().min(6, "Enter the code you were given").max(40)),
    }),
    z.object({
      method: z.literal("list"),
      name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
      email: emailSchema.refine((e) => !hasIbaDomain(e, domain), "You have an IBA email: please register with it instead"),
      password: passwordSchema,
    }),
  ]);
}

export type AlumniRegisterInput = z.infer<ReturnType<typeof alumniRegisterSchema>>;
