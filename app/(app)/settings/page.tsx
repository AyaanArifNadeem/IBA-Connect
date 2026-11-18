import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/session";
import { VerificationMethod } from "@/lib/generated/prisma/enums";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Settings · IBA Connect" };

/** Account settings (wireframe P05). Deactivate and delete arrive with FR1.8. */
export default async function SettingsPage() {
  const member = await getCurrentMember();
  const usesMicrosoft = member?.verificationMethod === VerificationMethod.MICROSOFT;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {usesMicrosoft
              ? "You sign in with your IBA Microsoft account, so your password is managed by Microsoft."
              : "Other devices are signed out when you change your password."}
          </CardDescription>
        </CardHeader>
        {usesMicrosoft ? null : (
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
