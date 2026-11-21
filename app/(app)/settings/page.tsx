import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/session";
import { VerificationMethod } from "@/lib/generated/prisma/enums";
import { listBlocked } from "@/lib/services/blocks";
import { AccountActions } from "./account-actions";
import { BlockedList } from "./blocked-list";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Settings · IBA Connect" };

/** Account settings (wireframe P05): password, blocked members, deactivate or delete. */
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

      <Card>
        <CardHeader>
          <CardTitle>Blocked members</CardTitle>
          <CardDescription>Blocked members cannot send you requests or messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <BlockedList blocked={member ? await listBlocked(member.id) : []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountActions />
        </CardContent>
      </Card>
    </div>
  );
}
