export const SITE_NAME = "Glowantey";

// Keep this in sync with the public production URL. A custom domain can
// override it at build time with VITE_SITE_URL.
export const SITE_URL = (import.meta.env["VITE_SITE_URL"] || "https://glowante.lovable.app").replace(/\/$/, "");

export function canonical(path = "/") {
  return `${SITE_URL}${path}`;
}
