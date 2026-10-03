import { adminAvisos } from "@/i18n/es-admin-avisos";

export function AnnouncementStatusBadge({ status }: { status: string }) {
  const published = status === "published";
  const text = published ? adminAvisos.status.published : status === "draft" ? adminAvisos.status.draft : status;
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${published ? "border-transparent bg-primary-soft text-primary" : "bg-muted text-foreground"}`}
      data-testid={`badge-announcement-${status}`}
    >
      {text}
    </span>
  );
}
