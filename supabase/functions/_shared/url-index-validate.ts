/**
 * Ensures admin-url-index-data.json lists every app route from url-route-manifest.json.
 * Run locally: node scripts/validate-url-index.mjs (also cross-checks src/App.js).
 */

import routeManifest from "./url-route-manifest.json" with { type: "json" };

type IndexItem = { label?: string; url?: string; adminTab?: string };
type IndexSection = { id?: string; items?: IndexItem[] };

export type UrlIndexValidation = {
  ok: boolean;
  missing: string[];
  extra?: string[];
};

function collectIndexUrls(sections: IndexSection[]) {
  const hashes = new Set<string>();
  const adminTabs = new Set<string>();
  const paths = new Set<string>();

  for (const section of sections) {
    for (const item of section.items || []) {
      if (item.adminTab) adminTabs.add(item.adminTab);
      const url = item.url || "";
      if (!url) continue;

      const hashMatch = url.match(/#([^?]+)/);
      if (hashMatch) hashes.add(hashMatch[1]);

      try {
        const u = new URL(url);
        if (u.hostname.includes("getscanv.com")) {
          const path = u.pathname + (u.search || "");
          if (path && path !== "/") paths.add(path);
          else if (path === "/" && u.search) paths.add("/" + u.search);
          else if (path === "/") paths.add("/");
        }
      } catch {
        /* ignore malformed */
      }
    }
  }

  return { hashes, adminTabs, paths };
}

/** Verify PIN-gated URL index covers the route manifest. */
export function validateUrlIndexSections(sections: IndexSection[]): UrlIndexValidation {
  const manifest = routeManifest as {
    hashRoutes: string[];
    hashAliases: Record<string, string>;
    adminTabs: string[];
    legalPaths: string[];
    staticPaths: string[];
    publicPaths: string[];
  };

  const { hashes, adminTabs, paths } = collectIndexUrls(sections);
  const missing: string[] = [];

  for (const hash of manifest.hashRoutes) {
    if (!hashes.has(hash)) missing.push(`hash:#${hash}`);
  }
  for (const alias of Object.keys(manifest.hashAliases || {})) {
    if (!hashes.has(alias)) missing.push(`hash-alias:#${alias}`);
  }
  for (const tab of manifest.adminTabs) {
    if (!adminTabs.has(tab)) missing.push(`admin-tab:${tab}`);
  }
  for (const legal of manifest.legalPaths) {
    const path = legal.startsWith("/") ? legal : `/${legal}`;
    if (!paths.has(path)) missing.push(`legal:${path}`);
  }
  for (const asset of manifest.staticPaths) {
    if (!paths.has(asset)) missing.push(`static:${asset}`);
  }
  for (const pub of manifest.publicPaths) {
    if (!paths.has(pub)) missing.push(`public:${pub}`);
  }

  return { ok: missing.length === 0, missing };
}
