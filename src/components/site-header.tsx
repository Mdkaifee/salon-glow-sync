import { Link } from "@tanstack/react-router";

import logo from "@/assets/glowante-logo.png";
import { SITE_NAME } from "@/lib/site";

const tabs = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/business", label: "Business" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center" aria-label={`${SITE_NAME} home`}>
          <img src={logo} alt={SITE_NAME} width={160} height={44} className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.to === "/" }}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-primary sm:px-4"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
