import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getSchool } from "@/lib/session";
import { setupAction } from "@/app/actions/auth";
import { SetupYearFields } from "@/components/setup-year-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SetupPage() {
  if (await getSchool()) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-teal to-brand-violet text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Set up NELS Tracking Sheet</h1>
            <p className="text-xs text-muted-foreground">
              One-time setup. Creates the Egyptian grade ladder (KG1 &rarr; Thanaweya Amma), your
              first academic year, and the owner account.
            </p>
          </div>
        </div>

        <form action={setupAction} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="schoolName">School name</Label>
              <Input id="schoolName" name="schoolName" required placeholder="New Egyptian Language School" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="shortName">Short code</Label>
              <Input id="shortName" name="shortName" placeholder="NELS" maxLength={6} />
            </div>
          </div>

          <SetupYearFields />
          <p className="text-xs text-muted-foreground">
            Pick the year and adjust the dates if your calendar isn&apos;t September&ndash;June. You
            can add more years and edit these later in Settings.
          </p>

          <div className="h-px bg-border" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
          </div>

          <Button type="submit" className="w-full">
            Create school
          </Button>
        </form>
      </div>
    </div>
  );
}
