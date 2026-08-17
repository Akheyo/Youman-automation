const BASE = import.meta.env.BASE_URL;

/**
 * Setzt den konfigurierten `base`-Pfad vor einen internen Pfad.
 * Nötig, damit dieselbe Codebasis unter https://akheyo.github.io/<repo>/
 * und unter einer eigenen Domain (base = "/") funktioniert.
 */
export function withBase(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('tel:')) {
    return path;
  }
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const rel = path.startsWith('/') ? path : `/${path}`;
  return `${base}${rel}` || '/';
}

/** Vergleicht den aktuellen Pfad mit einem Nav-Ziel (inkl. Unterseiten). */
export function isActive(currentPath: string, href: string): boolean {
  const strip = (p: string) => {
    const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
    const withoutBase = base && p.startsWith(base) ? p.slice(base.length) : p;
    return withoutBase.replace(/\/+$/, '') || '/';
  };
  const current = strip(currentPath);
  const target = href.replace(/\/+$/, '') || '/';
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}
