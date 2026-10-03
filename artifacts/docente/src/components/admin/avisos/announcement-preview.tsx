import { adminAvisos } from "@/i18n/es-admin-avisos";

const t = adminAvisos.form;

/**
 * Plain-text preview of an announcement. Title and body are rendered as React text nodes (never as
 * HTML) and the body keeps its line breaks with `whitespace-pre-line`.
 */
export function AnnouncementPreview({ title, body, when, audience }: { title: string; body: string; when: string; audience: string }) {
  const empty = title.trim() === "" && body.trim() === "";
  return (
    <section aria-labelledby="announcement-preview-title" className="rounded-2xl border border-dashed p-4 sm:p-5" data-testid="preview-announcement">
      <h2 id="announcement-preview-title" className="font-display text-lg font-semibold">
        {t.previewTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.previewNote}</p>
      {empty ? (
        <p className="mt-4 text-sm text-muted-foreground">{t.previewEmpty}</p>
      ) : (
        <article className="paper mt-4 rounded-xl border p-4">
          <h3 className="break-words text-base font-semibold" data-testid="text-preview-title">
            {title}
          </h3>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed" data-testid="text-preview-body">
            {body}
          </p>
        </article>
      )}
      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t.previewAudience}:</span> {audience}
        </p>
        <p>{when}</p>
      </div>
    </section>
  );
}
