import { queryOptions } from "@tanstack/react-query";
import { fetchAllDocuments, resolveDocumentUrl } from "./documents-storage";
import { getStudentDocumentsBundle, getStudentPortalSnapshot } from "./portal.functions";
import type { Database } from "@/integrations/supabase/types";

export type SlotKind = Database["public"]["Enums"]["slot_kind"];
export type EventKind = Database["public"]["Enums"]["event_kind"];

// Non-user-specific static UI presentation constants
export const GPA_SCALE = [
  ["A+", "4.00", "≥ 95"],
  ["A", "4.00", "90 – 94"],
  ["A-", "3.70", "85 – 89"],
  ["B+", "3.30", "80 – 84"],
  ["B", "3.00", "75 – 79"],
  ["C+", "2.30", "70 – 74"],
  ["C", "2.00", "65 – 69"],
  ["D", "1.00", "60 – 64"],
  ["F", "0.00", "< 60"],
] as const;

export const DAYS = [
  ["Saturday", "السبت"],
  ["Sunday", "الأحد"],
  ["Monday", "الاثنين"],
  ["Tuesday", "الثلاثاء"],
  ["Wednesday", "الأربعاء"],
  ["Thursday", "الخميس"],
] as const;

export const KIND_LABEL: Record<SlotKind, string> = {
  lecture: "محاضرة",
  section: "سكشن",
  lab: "معمل",
};

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  exam: "اختبار",
  deadline: "موعد نهائي",
  academic: "فعالية أكاديمية",
  announcement: "إعلان",
};

export const AUDIENCE_LABEL: Record<Database["public"]["Enums"]["document_audience"], string> = {
  all: "جميع الطلاب",
  program: "برنامج محدد",
  level: "مستوى محدد",
  student: "طالب محدد",
};

export function portalSnapshotQuery(semesterId?: string) {
  return queryOptions({
    queryKey: ["portal-snapshot", semesterId ?? "current"],
    queryFn: () => getStudentPortalSnapshot({ data: semesterId ? { semesterId } : {} }),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export const profileQuery = queryOptions({
  queryKey: ["portal-snapshot", "current"],
  queryFn: () => getStudentPortalSnapshot({ data: {} }),
  select: (snap) => snap.profile,
  staleTime: 15_000,
});

export const studentDocumentsQuery = queryOptions({
  queryKey: ["student-documents-bundle"],
  queryFn: () => getStudentDocumentsBundle(),
  staleTime: 15_000,
});

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: () => fetchAllDocuments(),
  staleTime: 10_000,
});

export async function signedUrl(
  docId: string,
  download?: string,
  options?: { allowHidden?: boolean; kind?: "shared" | "private" },
) {
  return resolveDocumentUrl(docId, download, options);
}

export function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
