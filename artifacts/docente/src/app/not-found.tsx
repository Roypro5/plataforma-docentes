import Link from "next/link";
export default function NotFound() {
  return <section className="rounded-2xl border bg-surface p-8">
    <p className="text-sm text-muted-foreground">Error 404</p>
    <h1 className="font-display my-4 text-3xl">Esta página no existe</h1>
    <p className="mb-6">Puedes volver al inicio para explorar la demostración.</p>
    <Link className="inline-flex rounded-xl bg-primary px-5 py-3 text-primary-foreground" href="/">Volver al inicio</Link>
  </section>;
}