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

const NAV = [
  { href: "/dashboard", key: "nav_dashboard", icon: LayoutDashboard, section: null, admin: false },
  { href: "/dashboard/students", key: "nav_students", icon: Users, section: "section_school", admin: false },
  { href: "/dashboard/admissions", key: "nav_admissions", icon: UserPlus, section: null, admin: false },
  { href: "/dashboard/enrollments", key: "nav_enrollments", icon: GraduationCap, section: null, admin: false },
  { href: "/dashboard/fees", key: "nav_fees", icon: ReceiptText, section: "section_finance", admin: false },
  { href: "/dashboard/payments", key: "nav_payments", icon: Wallet, section: null, admin: false },
  { href: "/dashboard/reports", key: "nav_reports", icon: BarChart3, section: null, admin: false },
  { href: "/dashboard/export", key: "nav_export", icon: DatabaseBackup, section: null, admin: true },
  { href: "/dashboard/settings", key: "nav_settings", icon: Settings, section: null, admin: false },
] as const;

export function SidebarNav({ locale, canExport }: { locale: Locale; canExport: boolean }) {
  const pathname = usePathname();
  const t = getTranslator(locale);

  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.filter((item) => !item.admin || canExport).map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
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
              <item.icon
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
