import Link from "next/link";
import { features } from "@/config/features";
import { es } from "@/i18n/es";

export default function NotFound() {
  const t = es.shell.notFound;
  return <section className="rounded-2xl border bg-surface p-8">
    <p className="text-sm text-muted-foreground">{t.eyebrow}</p>
    <h1 className="font-display my-4 text-3xl">{t.title}</h1>
    <p className="mb-6">{features.stageInfo ? t.body : t.bodyProduct}</p>
    <Link className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 text-primary-foreground" href="/">{t.back}</Link>
  </section>;
}
