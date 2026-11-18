"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/client/api";

type FieldErrors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

export function ChangePasswordForm() {
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
    setFormError(null);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (values.newPassword !== values.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    setSaving(true);
    const result = await postJson<{ message: string }>("/api/v1/auth/change-password", values);
    setSaving(false);

    if (result.ok) {
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success(result.data.message);
      return;
    }
    const details = result.error.details as { path: string; message: string }[] | undefined;
    if (Array.isArray(details)) {
      setErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
    } else {
      setFormError(result.error.message);
    }
  }

  const field = (name: keyof typeof values, label: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type="password"
        autoComplete={autoComplete}
        value={values[name]}
        onChange={set(name)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        required
      />
      {errors[name] ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors[name]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {field("currentPassword", "Current password", "current-password")}
      {field("newPassword", "New password", "new-password")}
      {field("confirmPassword", "Confirm new password", "new-password")}
      <p className="text-xs text-muted-foreground">
        At least 8 characters, with upper and lower case letters, a number and a symbol. No spaces.
      </p>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Change password"}
      </Button>
    </form>
  );
}
