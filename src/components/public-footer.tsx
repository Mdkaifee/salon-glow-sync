import { Link } from "@tanstack/react-router";

import { SITE_NAME } from "@/lib/site";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/70 bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {SITE_NAME}. Salon appointment booking and business tools.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal links">
          <Link to="/about" className="hover:text-primary">About</Link>
          <Link to="/terms-of-services" className="hover:text-primary">Terms of Service</Link>
          <Link to="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
