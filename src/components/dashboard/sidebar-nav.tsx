"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  GraduationCap,
  ReceiptText,
  Wallet,
  BarChart3,
  DatabaseBackup,
  Settings,
} from "lucide-react";
import { getTranslator, type Locale } from "@/lib/i18n";
import { canView, NAV_ITEMS, type Role, type Page } from "@/lib/permissions";

// Icons live here, not in the shared (client-safe but otherwise plain) NAV_ITEMS
// list — icon components are functions, and functions can't cross the server
// -> client boundary if that list were ever built server-side.
const ICONS: Record<Page, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  students: Users,
  admissions: UserPlus,
  enrollments: GraduationCap,
  fees: ReceiptText,
  payments: Wallet,
  reports: BarChart3,
  export: DatabaseBackup,
  settings: Settings,
};

export function SidebarNav({ locale, role }: { locale: Locale; role: Role }) {
  const pathname = usePathname();
  const t = getTranslator(locale);
  const items = NAV_ITEMS.filter((item) => canView(role, item.page));

  return (
    <nav className="flex-1 space-y-1 p-3">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const Icon = ICONS[item.page];
        return (
          <div key={item.href}>
            {item.section && (
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                {t(item.section)}
              </p>
            )}
            <Link
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "" : "hover:bg-accent/60"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-lg bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={`relative z-10 h-4 w-4 ${
                  active ? "text-accent-foreground" : "text-muted-foreground"
                }`}
              />
              <span
                className={`relative z-10 ${
                  active ? "text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {t(item.key)}
              </span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
