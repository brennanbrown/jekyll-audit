import fs from 'node:fs/promises';
import path from 'node:path';

export interface SitemapDiscovery {
  pathOnDisk?: string; // e.g., /abs/path/_site/sitemap.xml
  url?: string; // e.g., http://127.0.0.1:4000/sitemap.xml
}

// Try to find a sitemap.xml in the built output directory, and derive its URL from baseUrl.
export async function discoverSitemap(buildDir: string, baseUrl: string): Promise<SitemapDiscovery | null> {
  try {
    const p = path.resolve(buildDir, 'sitemap.xml');
    await fs.access(p);
    const url = baseUrl.replace(/\/$/, '') + '/sitemap.xml';
    return { pathOnDisk: p, url };
  } catch {
    return null;
  }
}

// Very lightweight sitemap parser that extracts <loc> values. Not a full XML parser but sufficient for common cases.
export async function parseSitemapLocs(filePath: string): Promise<string[]> {
  const xml = await fs.readFile(filePath, 'utf8');
  const locRegex = /<loc>([^<]+)<\/loc>/gim;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url) urls.push(url);
  }
  return urls;
}

export function urlsFromPaths(baseUrl: string, paths: string[]): string[] {
  const base = baseUrl.replace(/\/$/, '');
  return paths.map((p) => {
    const withSlash = p.startsWith('/') ? p : '/' + p;
    return base + withSlash;
  });
}
