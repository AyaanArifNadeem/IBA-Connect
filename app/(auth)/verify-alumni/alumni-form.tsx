"use client";

import { useState } from "react";
import { postJson } from "@/lib/client/api";

type Method = "code" | "list";
type Field = "name" | "email" | "password" | "confirm" | "code";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 p-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#8b0000]/30 focus:outline-none aria-invalid:border-red-300";

export function AlumniForm() {
  const [method, setMethod] = useState<Method>("code");
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "", code: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setFormError(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing: Partial<Record<Field, string>> = {};
    if (values.name.trim().length < 2) missing.name = "Enter your full name";
    if (!values.email.includes("@")) missing.email = "Enter your personal email";
    if (values.password.length < 8) missing.password = "Password must be at least 8 characters long";
    if (values.password !== values.confirm) missing.confirm = "Passwords do not match";
    if (method === "code" && values.code.trim().length < 6) missing.code = "Enter the code you were given";
    setErrors(missing);
    if (Object.keys(missing).length) return;

    setSending(true);
    const rest = { name: values.name, email: values.email, password: values.password };
    const result = await postJson<{ message: string }>(
      "/api/v1/auth/alumni-register",
      method === "code" ? { ...rest, method, code: values.code } : { ...rest, method },
    );
    setSending(false);

    if (result.ok) {
      setDone(result.data.message);
      return;
    }
    const details = result.error.details as { path: string; message: string }[] | undefined;
    if (Array.isArray(details)) setErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
    else setFormError(result.error.message);
  }

  if (done) {
    return (
      <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        {done}
      </div>
    );
  }

  const field = (name: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1">
      <label htmlFor={`alumni-${name}`} className="ml-1 text-xs font-semibold text-gray-700">
        {label}
      </label>
      <input
        id={`alumni-${name}`}
        value={values[name]}
        onChange={set(name)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `alumni-${name}-error` : undefined}
        className={inputClass}
        {...props}
      />
      {errors[name] ? (
        <p id={`alumni-${name}-error`} className="ml-1 text-xs text-red-700">
          {errors[name]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5 space-y-3">
      <fieldset>
        <legend className="ml-1 text-xs font-semibold text-gray-700">How do you want to verify?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(
            [
              ["code", "I have a code"],
              ["list", "My email is on the alumni list"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center justify-center rounded-xl border p-2 text-center text-xs font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#8b0000]/40 ${
                method === value ? "border-[#8b0000] bg-red-50 text-[#8b0000]" : "border-gray-200 text-gray-600"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {field("name", "Full name", { autoComplete: "name" })}
      {field("email", "Personal email", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
      {method === "code"
        ? field("code", "Alumni code", { autoComplete: "off", placeholder: "IBA-XXXX-XXXX", className: `${inputClass} uppercase` })
        : null}
      {field("password", "Password", { type: "password", autoComplete: "new-password" })}
      {field("confirm", "Confirm password", { type: "password", autoComplete: "new-password" })}
      <p className="ml-1 text-[11px] text-gray-500">
        At least 8 characters, with upper and lower case letters, a number and a symbol.
      </p>

      {formError ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-[#8b0000] py-2.5 text-sm font-semibold text-white hover:bg-[#6b0000] disabled:opacity-60"
      >
        {sending ? "Verifying…" : "Verify and create account"}
      </button>
    </form>
  );
}
