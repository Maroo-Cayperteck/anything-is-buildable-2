import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthAccountStatus } from "@/lib/accounts.functions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoginCard } from "@/components/portal/LoginCard";
import { Button } from "@/components/ui/button";
import { portalSignIn } from "@/lib/session";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — جامعة حلوان الأهلية" },
      {
        name: "description",
        content:
          "تسجيل الدخول إلى نظام معلومات الطلاب — جامعة حلوان الأهلية (Helwan National University)",
      },
      { property: "og:title", content: "تسجيل الدخول — جامعة حلوان الأهلية" },
      { property: "og:description", content: "بوابة نظام معلومات الطلاب — جامعة حلوان الأهلية" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) return;
        const status = await getAuthAccountStatus();
        if (active && (status.roles.includes("admin") || status.accountStatus === "active"))
          void navigate({
            to: status.roles.includes("admin") ? "/admin" : "/portal",
            replace: true,
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <LoginCard
      title="مرحبًا بعودتك"
      subtitle="سجّل الدخول إلى بوابة الطالب"
      identifierLabel="الرقم الجامعي"
      identifierPlaceholder="925250050"
      onSubmit={async (u, p) => {
        const { error, role } = await portalSignIn(u, p);
        if (error) return error;

        navigate({ to: role === "admin" ? "/admin" : "/portal", replace: true });
        return null;
      }}
      footer={
        <div className="space-y-3">
          <a
            href="https://www.facebook.com/HNU.Helwan"
            target="_blank"
            rel="noopener noreferrer"
            className="group block transition-opacity hover:opacity-90"
            title="الصفحة الرسمية لجامعة حلوان الأهلية"
          >
            <div className="text-sm font-bold text-foreground">Helwan National University</div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground">
              Student Information System
            </div>
          </a>
          <div className="space-y-2 pt-1">
            <Button asChild variant="brand" size="lg" className="h-12 w-full text-base">
              <Link to="/admin-login">دخول المسؤول</Link>
            </Button>
            <div className="pt-1">
              <Link
                to="/register"
                className="inline-block text-xs font-semibold text-primary hover:underline"
              >
                تفعيل / تسجيل حساب طالب جديد
              </Link>
            </div>
          </div>
        </div>
      }
    />
  );
}
