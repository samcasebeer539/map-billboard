import NavMenu from "./NavMenu";

// Layout for the non-map pages: menu top-left, content centered below
export default function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center gap-3 p-4">
        <NavMenu />
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-16">{children}</main>
    </div>
  );
}
