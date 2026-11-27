import {Button} from "@/components/ui/button";
import {GraduationCap} from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoginCard } from "@/components/portal/LoginCard";
import { portalSignIn, portalSignOut } from "@/lib/session";

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دخول المسؤول — بوابة الطالب" },
      { name: "description", content: "تسجيل دخول المسؤول لإدارة ملفات الطلاب." },
      { property: "og:title", content: "دخول المسؤول — بوابة الطالب" },
      { property: "og:description", content: "لوحة إدارة ملفات الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();

  return (
    <LoginCard
      title="بوابة المسؤول"
      subtitle="إدارة نظام وشؤون الطلاب"
      identifierLabel="البريد الإلكتروني أو اسم المستخدم للمسؤول"
      identifierPlaceholder="admin@hnu.edu.eg"
      onSubmit={async (u, p) => {
        const { error, role } = await portalSignIn(u, p);
        if (error) return error;
        if (role !== "admin") {
          await portalSignOut();
          return "هذا الحساب لا يملك صلاحيات المسؤول";
        }
        navigate({ to: "/admin", replace: true });
        return null;
      }}
      footer={
        <div className="space-y-3">
          <Button asChild variant="brand" size="lg" className="h-12 w-full text-base"><Link to="/"><GraduationCap className="h-5 w-5"/>العودة لدخول الطلاب</Link></Button>
          <div className="border-t pt-2">
            <a
              href="https://www.facebook.com/HNU.Helwan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              جامعة حلوان الأهلية — Helwan National University
            </a>
          </div>
        </div>
      }
    />
  );
}
