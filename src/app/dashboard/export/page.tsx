import { redirect } from "next/navigation";
import { Download, Database } from "lucide-react";
import { requireStaff } from "@/lib/session";
import { listYears } from "@/lib/academic";
import { getTranslator, type Locale } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SHEETS = [
  "School",
  "Academic years",
  "Terms",
  "Grade ladder",
  "Classrooms",
  "Staff",
  "Students",
  "Guardians",
  "Enrolments",
  "Documents",
  "Fee items",
  "Fee plans",
  "Fee plan lines",
  "Charges",
  "Installments",
  "Discounts",
  "Payments",
  "Payment allocations",
];

export default async function ExportPage() {
  const ctx = await requireStaff();
  if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(ctx.role)) redirect("/dashboard");

  const locale = (ctx.school.locale as Locale) ?? "en";
  const t = getTranslator(locale);
  const years = await listYears(ctx.schoolId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav_export")}</h1>
        <p className="text-sm text-muted-foreground">{t("export_subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("export_download_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" action="/api/export" className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="year">{t("export_scope")}</Label>
              <select
                id="year"
                name="year"
                defaultValue="all"
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="all">{t("export_all_data")}</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit">
              <Download className="h-4 w-4" />
              {t("export_button")}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">{t("export_hint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("export_included")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {SHEETS.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                <Database className="h-3 w-3" /> {s}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("export_note")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
