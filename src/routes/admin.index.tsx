import {AdminPlanning} from "@/components/portal/AdminPlanning";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  History,
  Layers,
  Loader2,
  ShieldOff,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, StatCard } from "@/components/portal/Shell";
import { Button } from "@/components/ui/button";
import { getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
  });

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
        <p className="text-destructive">تعذر تحميل بيانات لوحة المسؤول.</p>
        <Button variant="outline" onClick={() => refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const { counts, recentLogs } = data;

  return (
    <div className="space-y-6">
      <AdminPlanning/>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="إجمالي الطلاب" value={counts.totalStudents} tone="info" />
        <StatCard
          icon={UserCheck}
          label="الطلاب النشطون"
          value={counts.activeStudents}
          tone="success"
        />
        <StatCard
          icon={UserPlus}
          label="طلبات معلقة"
          value={counts.pendingRegistrations}
          tone="gold"
        />
        <StatCard
          icon={ShieldOff}
          label="حسابات معلقة"
          value={counts.suspendedStudents}
          tone="danger"
        />
        <StatCard
          icon={Layers}
          label="البرامج الأكاديمية"
          value={counts.programsCount}
          sub={`${counts.activeSemestersCount} فصل حالي`}
          tone="info"
        />
        <StatCard
          icon={BookOpen}
          label="المقررات والطرح"
          value={counts.coursesCount}
          sub={`${counts.offeringsCount} طرح متاح`}
          tone="gold"
        />
        <StatCard
          icon={FileText}
          label="ملفات منشورة"
          value={counts.publishedDocuments}
          tone="info"
        />
        <StatCard
          icon={CalendarDays}
          label="فعاليات قادمة"
          value={counts.upcomingEvents}
          sub="مقيدة من قاعدة البيانات"
          tone="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="أحدث عمليات المسؤولين"
          icon={History}
          className="lg:col-span-2"
          action={
            <Link to="/admin/logs" className="text-sm text-primary hover:underline">
              السجل الكامل
            </Link>
          }
        >
          {recentLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              لا توجد عمليات مسجلة بعد.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <span className="font-mono text-xs font-semibold text-primary">
                      {log.action}
                    </span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{log.entity_type}</span>
                    {log.actor_label && (
                      <span className="mr-2 text-xs text-muted-foreground">
                        ({log.actor_label})
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {new Date(log.created_at).toLocaleString("ar-EG")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="اختصارات سريعة">
          <div className="grid gap-2">
            {(
              [
                ["/admin/students", "مراجعة طلبات التسجيل والطلاب"],
                ["/admin/academic", "إدارة المقررات والمجموعات والجداول"],
                ["/admin/documents", "إدارة ورفع ملفات الطلاب"],
                ["/admin/events", "نشر الإعلانات والفعاليات"],
              ] as const
            ).map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-info-soft"
              >
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
