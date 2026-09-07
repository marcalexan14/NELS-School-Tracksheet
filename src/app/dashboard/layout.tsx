import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { auth, signOut } from "@/auth";
import { requireStaff } from "@/lib/session";
import { listYears } from "@/lib/academic";
import { getTranslator, isRtl, enumLabel, type Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { YearSwitcher } from "@/components/dashboard/year-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ctx = await requireStaff();
  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const rtl = isRtl(locale);
  const years = await listYears(ctx.schoolId);
  const accent = ctx.school.accentColor;
  const initials = (session.user.name ?? session.user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-border bg-sidebar sm:flex ltr:border-r rtl:border-l">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in oklch, ${accent}, black 18%))` }}
          >
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className={`font-semibold leading-tight ${rtl ? "font-ar" : ""}`}>
            {ctx.school.shortName || ctx.school.name}
          </span>
        </div>
        <SidebarNav locale={locale} />
        <div className="border-t border-border p-3 text-xs text-muted-foreground">
          {t("signed_in_as")}{" "}
          <span className="font-medium text-foreground">{session.user.email}</span>
          <div className="mt-0.5">{enumLabel(locale, ctx.role)}</div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-md sm:px-6">
          <div className={`truncate text-sm font-medium text-muted-foreground ${rtl ? "font-ar" : ""}`}>
            {ctx.school.name}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <YearSwitcher years={years.map((y) => ({ id: y.id, name: y.name, isCurrent: y.isCurrent }))} label={t("academic_year")} />
            <ThemeToggle />
            <Avatar className="h-8 w-8 ring-2 ring-accent">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                {t("sign_out")}
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
