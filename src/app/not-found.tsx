import Link from 'next/link';

export const metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4 py-16"
    >
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        The page you were looking for has moved or no longer exists. Check the address, or start
        again from the home page.
      </p>
      <p>
        <Link href="/" className="font-medium underline underline-offset-4">
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
