"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FolderOpen, Info, Minus, Plus, XCircle } from "lucide-react";
import { es } from "@/i18n/es";
import { Section } from "./page-header";

const t = es.sistema;

function Tag() {
  return <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">{t.nonPersistent}</span>;
}

const btn = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-[transform,background-color] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";

export function Showcase() {
  const [on, setOn] = useState(false);
  const [level, setLevel] = useState(1);
  const [count, setCount] = useState(28);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [errors, setErrors] = useState<{ name?: boolean; grade?: boolean }>({});
  const [result, setResult] = useState<null | "ok" | "bad">(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er = { name: name.trim().length < 4, grade: !grade };
    setErrors(er);
    setResult(er.name || er.grade ? "bad" : "ok");
  };
  const reset = () => { setName(""); setGrade(""); setErrors({}); setResult(null); };

  const swatches = [
    ["primary", "bg-primary"], ["accent", "bg-accent"], ["gold", "bg-gold"], ["surface", "bg-surface"], ["danger", "bg-danger"],
  ] as const;

  const field = "mt-1.5 block min-h-12 w-full rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title={t.palette}>
        <ul className="grid grid-cols-5 gap-2">
          {swatches.map(([k, c]) => (
            <li key={k} className="min-w-0 text-center">
              <span className={`block aspect-square rounded-xl border ${c}`} aria-hidden />
              <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">{t.paletteNames[k]}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.typography}>
        <p className="font-display text-3xl font-semibold">{t.typeDisplay}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.typeBody}</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">0123456789 · 1.º 2.º 3.º</p>
      </Section>

      <Section title={t.buttons}>
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} bg-primary text-primary-foreground`} data-testid="button-demo-primary">{t.primary}</button>
          <button className={`${btn} bg-accent text-accent-foreground`} data-testid="button-demo-secondary">{t.secondary}</button>
          <button className={`${btn} border hover:bg-muted`} data-testid="button-demo-quiet">{t.quiet}</button>
          <button className={`${btn} bg-primary text-primary-foreground`} disabled>{t.disabled}</button>
        </div>
      </Section>

      <Section title={t.controls} aside={<Tag />}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p id="sw-l" className="text-sm font-medium">{t.switchLabel}</p>
              <p className="text-xs text-muted-foreground" aria-live="polite">{on ? t.switchOn : t.switchOff}</p>
            </div>
            <button role="switch" aria-checked={on} aria-labelledby="sw-l" onClick={() => setOn(!on)} data-testid="switch-demo"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted border"}`}>
              <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-surface shadow transition-transform ${on ? "translate-x-5" : ""}`} />
            </button>
          </div>
          <div>
            <p id="lv-l" className="mb-2 text-sm font-medium">{t.levelLabel}</p>
            <div role="radiogroup" aria-labelledby="lv-l" className="grid grid-cols-3 rounded-xl border bg-muted/60 p-1">
              {t.levels.map((l, i) => (
                <button key={l} role="radio" aria-checked={level === i} onClick={() => setLevel(i)} data-testid={`radio-level-${i}`}
                  className={`min-h-10 rounded-lg text-sm font-medium transition-colors ${level === i ? "bg-surface shadow-sm text-primary" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t.counterLabel}</p>
            <div className="flex items-center gap-2">
              <button aria-label={t.decrease} onClick={() => setCount(Math.max(0, count - 1))} className="grid h-10 w-10 place-items-center rounded-lg border hover:bg-muted" data-testid="button-decrease"><Minus className="h-4 w-4" /></button>
              <output aria-live="polite" className="w-10 text-center font-mono text-lg font-semibold" data-testid="text-count">{count}</output>
              <button aria-label={t.increase} onClick={() => setCount(Math.min(60, count + 1))} className="grid h-10 w-10 place-items-center rounded-lg border hover:bg-muted" data-testid="button-increase"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </Section>

      <div className="lg:col-span-2">
        <Section title={t.form} aside={<Tag />}>
          <p className="mb-4 text-sm text-muted-foreground">{t.formNote}</p>
          <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
            <div>
              <label htmlFor="f-name" className="text-sm font-medium">{t.nameLabel}</label>
              <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} aria-invalid={!!errors.name} aria-describedby={errors.name ? "e-name" : undefined}
                className={`${field} ${errors.name ? "border-danger" : ""}`} data-testid="input-session-name" />
              {errors.name && <p id="e-name" className="mt-1.5 text-sm text-danger">{t.nameError}</p>}
            </div>
            <div>
              <label htmlFor="f-grade" className="text-sm font-medium">{t.gradeLabel}</label>
              <select id="f-grade" value={grade} onChange={(e) => setGrade(e.target.value)} aria-invalid={!!errors.grade} aria-describedby={errors.grade ? "e-grade" : undefined}
                className={`${field} ${errors.grade ? "border-danger" : ""}`} data-testid="select-grade">
                <option value="">{t.gradePh}</option>
                {t.grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {errors.grade && <p id="e-grade" className="mt-1.5 text-sm text-danger">{t.gradeError}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button type="submit" className={`${btn} bg-primary text-primary-foreground`} data-testid="button-validate">{t.validate}</button>
              <button type="button" onClick={reset} className={`${btn} border hover:bg-muted`} data-testid="button-reset">{t.reset}</button>
              <p role="status" className="text-sm" data-testid="status-validation">
                {result === "ok" && <span className="inline-flex items-center gap-1.5 text-ok"><CheckCircle2 className="h-4 w-4" aria-hidden />{t.valid}</span>}
                {result === "bad" && <span className="inline-flex items-center gap-1.5 text-danger"><XCircle className="h-4 w-4" aria-hidden />{t.invalid}</span>}
              </p>
            </div>
          </form>
        </Section>
      </div>

      <Section title={t.feedback}>
        <div className="space-y-2 text-sm">
          <p className="flex gap-2 rounded-xl bg-primary-soft p-3 text-primary"><Info className="h-4 w-4 shrink-0" aria-hidden />{t.infoMsg}</p>
          <p className="flex gap-2 rounded-xl bg-accent-soft p-3 text-accent"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />{t.warnMsg}</p>
          <p className="flex gap-2 rounded-xl bg-danger-soft p-3 text-danger"><XCircle className="h-4 w-4 shrink-0" aria-hidden />{t.errorMsg}</p>
        </div>
      </Section>

      <div className="grid gap-5">
        <Section title={t.empty}>
          <div className="flex flex-col items-center rounded-xl border border-dashed py-6 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="font-display mt-2 font-semibold">{t.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{t.emptyBody}</p>
          </div>
        </Section>
        <Section title={t.loading}>
          <div className="space-y-2 motion-safe:animate-pulse" aria-hidden>
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
          </div>
        </Section>
      </div>
    </div>
  );
}
