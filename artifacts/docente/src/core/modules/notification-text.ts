// Relative imports: this file is covered by Vitest, which does not resolve the "@/" alias.
import { es } from "../../i18n/es";
import { isModuleId } from "../../modules/registry";

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link_path: string;
  read_at: string | null;
  created_at: string;
};

const t = es.modulos;
const SAFE_PATH = /^\/[a-z0-9/_-]*$/;

/** Internal links only (the database enforces the same shape); anything else falls back to the panel. */
export function safeInternalPath(path: string) {
  return SAFE_PATH.test(path) && !path.includes("//") ? path : "/panel";
}

/**
 * Text and link to show for a notification. Known kinds use the i18n templates; unknown kinds
 * and kinds whose data cannot be resolved fall back to the title and body stored in the database.
 * The result is always rendered as plain text.
 */
export function notificationContent(n: Pick<NotificationRow, "kind" | "title" | "body" | "link_path">, displayName: string | null) {
  const href = safeInternalPath(n.link_path);
  if (n.kind === "welcome") {
    return { title: t.notificationKinds.welcome.title(displayName?.trim() ?? ""), body: t.notificationKinds.welcome.body, href };
  }
  if (n.kind === "module_available") {
    const id = /^\/modulos\/([a-z0-9-]+)$/.exec(href)?.[1];
    if (id && isModuleId(id)) {
      const name = t.items[id].name;
      return { title: t.notificationKinds.module_available.title(name), body: t.notificationKinds.module_available.body(name), href };
    }
  }
  return { title: n.title, body: n.body, href };
}
