// A quiet placeholder while the lab's code downloads (usually a fraction of a
// second). The router shows it when someone opens /lab directly.
export function LabLoading() {
  return <p className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Loading the lab…</p>
}
