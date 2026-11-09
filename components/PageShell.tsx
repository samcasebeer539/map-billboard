import NavMenu from "./NavMenu";

// Layout for the non-map pages: menu top-left, content centered below
export default function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 p-4">
        <NavMenu />
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-12">{children}</main>
    </div>
  );
}
