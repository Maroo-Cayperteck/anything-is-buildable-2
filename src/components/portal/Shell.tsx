import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileDown,
  FolderCog,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  UserRound,
  Users,
  BarChart3,
  X,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { portalSignOut } from "@/lib/session";
import { cn } from "@/lib/utils";

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const STUDENT_NAV: NavItem[] = [
  { to: "/user-guide.html", label: "دليل الاستخدام", icon: BookOpen },
  { to: "/portal", label: "يومي الدراسي", icon: LayoutDashboard },
  { to: "/portal/info", label: "بيانات الطالب", icon: UserRound },
  { to: "/portal/registration", label: "جدولي وموادي", icon: ClipboardList },
  { to: "/portal/courses", label: "المقررات الدراسية", icon: BookOpen },
  { to: "/portal/grades", label: "النتائج والمعدل التراكمي", icon: BarChart3 },
  { to: "/portal/documents", label: "تحميل ملفات الطالب", icon: FileDown },
  { to: "/portal/events", label: "الإعلانات والفعاليات", icon: CalendarDays },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/user-guide.html", label: "دليل الاستخدام", icon: BookOpen },
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
  { to: "/admin/students", label: "الطلاب والتسجيل", icon: Users },
  { to: "/admin/academic", label: "الشؤون الأكاديمية", icon: BookOpen },
  { to: "/admin/documents", label: "إدارة ملفات الطلاب", icon: FolderCog },
  { to: "/admin/events", label: "الإعلانات والفعاليات", icon: Megaphone },
  { to: "/admin/logs", label: "سجل النشاط", icon: History },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-2xl font-black text-white shadow-card transition-transform group-hover:scale-105",
        className,
      )}
      style={{
        backgroundColor: "#1e3a5f",
        boxShadow: "0 4px 14px rgba(30, 58, 95, 0.28)",
      }}
    >
      <span className="font-sans text-[0.95rem] font-black tracking-tight leading-none text-white drop-shadow-sm">
        HNU
      </span>
    </div>
  );
}

export function Shell({
  nav,
  title,
  userName,
  userTag,
  signOutTo,
  children,
}: {
  nav: NavItem[];
  title: string;
  userName: string;
  userTag?: string | null | undefined;
  signOutTo: "/" | "/admin-login";
  children: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") || "/" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Close mobile sidebar automatically on route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  // Close mobile sidebar on Escape key press
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileOpen((prev) => !prev);
    } else {
      setDesktopOpen((prev) => !prev);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await portalSignOut();
    navigate({ to: signOutTo, replace: true });
  }

  const isActive = (to: string) =>
    to === "/portal" || to === "/admin" ? path === to : path.startsWith(to);
  // Display only the first letter of the user's name
  const initial = userName.trim().split(/\s+/)[0]?.[0] || userName.trim()[0] || "ع";

  return (
    <div dir="ltr" className="flex min-h-screen w-full overflow-x-clip">
      {/* Mobile semi-transparent backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/50 backdrop-blur-xs transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar with smooth desktop collapse and mobile slide-in */}
      <aside
        dir="rtl"
        aria-label="القائمة الجانبية"
        className={cn(
          "bg-sidebar text-sidebar-foreground",
          // Mobile styles: slide-in drawer
          "fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-in-out",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          // Desktop styles: sticky full-height sidebar that remains pinned while content scrolls
          "lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:h-dvh lg:self-start lg:translate-x-0 lg:shadow-none lg:shrink-0",
          desktopOpen
            ? "lg:w-72 lg:min-w-72 lg:max-w-72 lg:opacity-100"
            : "lg:w-0 lg:min-w-0 lg:max-w-0 lg:opacity-0 lg:pointer-events-none lg:overflow-hidden",
        )}
      >
        <div className="flex h-full w-72 min-w-72 flex-col">
          <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
            <a
              href="https://www.facebook.com/HNU.Helwan"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 transition-opacity hover:opacity-90"
              title="الصفحة الرسمية لجامعة حلوان الأهلية"
            >
              <BrandMark className="h-10 w-10 rounded-xl" />
              <div className="min-w-0">
                <div className="font-bold text-sm text-sidebar-foreground">جامعة حلوان الأهلية</div>
                <div className="text-[0.7rem] text-sidebar-muted">Helwan National University</div>
              </div>
            </a>
            {/* Close button on mobile */}
            <button
              className="mr-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
              aria-label="إغلاق القائمة"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {nav.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  reloadDocument={item.to.endsWith(".html")}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent font-semibold"
                      : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className={cn("h-5 w-5", active && "text-gold")} />
                  {item.label}
                  {active && (
                    <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-gold" />
                  )}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={signOut}
            className="flex items-center gap-3 border-t border-sidebar-border px-7 py-4 text-sm text-sidebar-muted transition-colors hover:text-sidebar-foreground"
          >
            <LogOut className="h-5 w-5" /> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div dir="rtl" className="flex min-w-0 flex-1 flex-col transition-all duration-300">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-8">
          {/* Hamburger Menu Button - accessible on both desktop and mobile */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="تبديل القائمة الجانبية"
            title="القائمة الجانبية"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">{title}</h1>
          <div className="mr-auto flex items-center gap-3">
            {userTag && (
              <span className="hidden rounded-full bg-secondary px-3 py-1 font-mono text-xs font-semibold text-secondary-foreground sm:inline">
                {userTag}
              </span>
            )}
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground select-none">
              {initial}
            </div>
            <span className="hidden max-w-48 truncate text-sm md:inline">{userName}</span>
          </div>
        </header>
        <main key={path} className="page-enter mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          {children}
        </main>
        <footer className="mt-auto px-8 pb-6 text-center text-xs text-muted-foreground">
          <a
            href="https://www.facebook.com/HNU.Helwan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:text-primary transition-colors font-medium"
          >
            <span>
              جامعة حلوان الأهلية — Helwan National University © {new Date().getFullYear()}
            </span>
          </a>
        </footer>
      </div>
    </div>
  );
}

export function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-card", className)}>
      {title && (
        <div className="flex items-center gap-3 border-b px-6 py-4">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h2 className="font-semibold">{title}</h2>
          {action && <div className="mr-auto">{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={cn("mt-1.5 text-[0.95rem]", mono && "font-mono font-semibold")}>
        {value || "—"}
      </div>
    </div>
  );
}

export function SampleBadge() {
  return (
    <a
      href="https://www.facebook.com/HNU.Helwan"
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:underline"
    >
      جامعة حلوان الأهلية
    </a>
  );
}

export function GradePill({ grade }: { grade: string }) {
  const tone =
    grade.startsWith("A") || grade.startsWith("B")
      ? "bg-info-soft text-primary"
      : grade === "F"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning-soft text-warning";
  return (
    <span
      className={cn(
        "inline-grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-bold",
        tone,
      )}
    >
      {grade}
    </span>
  );
}

export function FullLoader() {
  return (
    <div className="grid min-h-screen place-items-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "info",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: string | undefined;
  tone?: "info" | "gold" | "success" | "danger";
}) {
  const toneCls = {
    info: "bg-info-soft text-primary",
    gold: "bg-gold-soft text-warning",
    success: "bg-success-soft text-success",
    danger: "bg-destructive/10 text-danger",
  }[tone];
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5">
      <div className={cn("grid h-12 w-12 place-items-center rounded-xl", toneCls)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="label-caps">{label}</div>
        <div className="mt-1 text-2xl font-bold">
          {value} {sub && <span className="text-sm font-normal text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
