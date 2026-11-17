import type { Metadata } from "next";

export const metadata: Metadata = { title: "Set up your profile · IBA Connect" };

// Replaced by the profile setup form in backlog item US1.5.
export default function ProfileSetupPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Set up your profile</h1>
      <p className="text-muted-foreground">Your email is verified. Profile setup is coming next.</p>
    </div>
  );
}
