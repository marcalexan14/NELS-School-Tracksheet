// Pure, client-safe permission tables — no server-only imports here, so the
// sidebar (a client component) can filter its own links with the same rules
// the pages enforce server-side.

export type Role = "OWNER" | "ADMIN" | "REGISTRAR" | "ACCOUNTANT" | "TEACHER" | "VIEWER";

export type Page =
  | "dashboard"
  | "students"
  | "admissions"
  | "enrollments"
  | "fees"
  | "payments"
  | "reports"
  | "export"
  | "settings";

// Who can even open a page. Owner/Admin see everything — the "admin view".
// Everyone else gets only the screens their job touches — the "limited,
// data-entry view": a registrar enrols, an accountant collects, a teacher
// looks students up. None of them get the school-wide dashboards.
const VIEW_ROLES: Record<Page, Role[]> = {
  dashboard: ["OWNER", "ADMIN", "VIEWER"],
  students: ["OWNER", "ADMIN", "REGISTRAR", "ACCOUNTANT", "TEACHER", "VIEWER"],
  admissions: ["OWNER", "ADMIN", "REGISTRAR"],
  enrollments: ["OWNER", "ADMIN", "REGISTRAR"],
  fees: ["OWNER", "ADMIN", "ACCOUNTANT"],
  payments: ["OWNER", "ADMIN", "ACCOUNTANT"],
  reports: ["OWNER", "ADMIN", "VIEWER"],
  export: ["OWNER", "ADMIN"],
  settings: ["OWNER", "ADMIN"],
};

// Who can change data, as opposed to merely see the page (e.g. every role
// that can view Students can search it; only these can add/edit one).
export type WriteArea = "students" | "enrollments" | "fees" | "payments" | "settings";

const WRITE_ROLES: Record<WriteArea, Role[]> = {
  students: ["OWNER", "ADMIN", "REGISTRAR"],
  enrollments: ["OWNER", "ADMIN", "REGISTRAR"],
  fees: ["OWNER", "ADMIN", "ACCOUNTANT"],
  payments: ["OWNER", "ADMIN", "ACCOUNTANT"],
  settings: ["OWNER", "ADMIN"],
};

export function canView(role: Role, page: Page): boolean {
  return VIEW_ROLES[page].includes(role);
}

export function can(role: Role, area: WriteArea): boolean {
  return WRITE_ROLES[area].includes(role);
}

// Where each role lands after signing in, and where a page redirects a role
// that isn't allowed to see it.
export function homeFor(role: Role): string {
  switch (role) {
    case "REGISTRAR":
      return "/dashboard/students";
    case "ACCOUNTANT":
      return "/dashboard/payments";
    case "TEACHER":
      return "/dashboard/students";
    default:
      return "/dashboard";
  }
}

// Sidebar entries, in display order. `page` drives visibility via VIEW_ROLES;
// `section` groups a run of items under a heading.
export const NAV_ITEMS = [
  { href: "/dashboard", page: "dashboard", key: "nav_dashboard", section: null },
  { href: "/dashboard/students", page: "students", key: "nav_students", section: "section_school" },
  { href: "/dashboard/admissions", page: "admissions", key: "nav_admissions", section: null },
  { href: "/dashboard/enrollments", page: "enrollments", key: "nav_enrollments", section: null },
  { href: "/dashboard/fees", page: "fees", key: "nav_fees", section: "section_finance" },
  { href: "/dashboard/payments", page: "payments", key: "nav_payments", section: null },
  { href: "/dashboard/reports", page: "reports", key: "nav_reports", section: null },
  { href: "/dashboard/export", page: "export", key: "nav_export", section: null },
  { href: "/dashboard/settings", page: "settings", key: "nav_settings", section: null },
] as const satisfies readonly { href: string; page: Page; key: string; section: string | null }[];
