import { Notice } from "@/components/cuenta/notice";
import { admin } from "@/i18n/es-admin";

export function AdminDenied() {
  return <Notice testId="notice-admin-denied">{admin.denied}</Notice>;
}
