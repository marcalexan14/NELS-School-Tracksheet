import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, BookOpenCheck, Wallet, Users } from "lucide-react";
import { getSchool } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/app/actions/auth";

const POINTS = [
  { icon: Users, text: "The full student register, KG1 to Thanaweya Amma" },
  { icon: Wallet, text: "Fee plans, instalments, and receipts in Egyptian pounds" },
  { icon: BookOpenCheck, text: "Income by year, stage, grade, and fee type" },
];

export default async function LoginPage() {
  const school = await getSchool();
  if (!school) redirect("/setup");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-mesh relative hidden flex-col justify-between border-r border-border p-10 lg:flex">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-teal to-brand-violet text-white">
            <GraduationCap className="h-4 w-4" />
          </span>
          NELS Tracking Sheet
        </span>
        <div className="space-y-6">
          <h2 className="max-w-sm text-3xl font-semibold tracking-tight text-balance">
            {school.name}
          </h2>
          <ul className="space-y-3">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card shadow-sm">
                  <p.icon className="h-4 w-4 text-brand-teal" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {school.name}</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Staff access to {school.name}</p>
          </div>
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            Accounts are created by an administrator in{" "}
            <Link href="/dashboard/settings" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
