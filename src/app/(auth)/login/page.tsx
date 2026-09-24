import Link from "next/link";
import { redirect } from "next/navigation";
import { isNotNull, eq, and } from "drizzle-orm";
import { GraduationCap, BookOpenCheck, Wallet, Users } from "lucide-react";
import { getSchool } from "@/lib/session";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { enumLabel } from "@/lib/i18n";
import { LoginForm } from "@/components/login-form";
import { QuickSignIn } from "@/components/quick-sign-in";

// Quick sign-in reads the live staff/PIN list — never freeze this page at
// build time, or a PIN set after deploy wouldn't show up until a rebuild.
export const dynamic = "force-dynamic";

const POINTS = [
  { icon: Users, text: "The full student register, KG1 to Thanaweya Amma" },
  { icon: Wallet, text: "Fee plans, instalments, and receipts in Egyptian pounds" },
  { icon: BookOpenCheck, text: "Income by year, stage, grade, and fee type" },
];

export default async function LoginPage() {
  const school = await getSchool();
  if (!school) redirect("/setup");

  const quickStaff = await db.query.staff.findMany({
    where: and(eq(staff.schoolId, school.id), isNotNull(staff.pinHash)),
    with: { user: { columns: { name: true, email: true } } },
    orderBy: (s, { asc }) => asc(s.createdAt),
  });
  const locale = (school.locale as "en" | "ar") ?? "en";

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
          {quickStaff.length > 0 && (
            <>
              <QuickSignIn
                staff={quickStaff.map((s) => ({
                  id: s.id,
                  name: s.user.name ?? s.user.email,
                  role: enumLabel(locale, s.role),
                }))}
              />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or sign in with email <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <LoginForm />
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
