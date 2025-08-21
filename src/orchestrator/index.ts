import { execa } from 'execa';
import path from 'node:path';
import fs from 'node:fs/promises';
import getPort from 'get-port';
import http from 'node:http';
import serveHandler from 'serve-handler';
import { runLighthouseAudit } from '../audits/lighthouse.js';
import zlib from 'node:zlib';
import YAML from 'yaml';
import { runPa11yOnUrl } from '../audits/pa11y.js';
import { discoverSitemap, parseSitemapLocs, urlsFromPaths } from '../utils/sitemap.js';
import { runLinkCheck } from '../audits/linkinator.js';
import { validateHtmlUrl } from '../audits/htmlValidator.js';

import type { AuditConfig } from '../config/schema.js';

export interface OrchestratorInput {
  cliOptions: any;
  config: AuditConfig;
}

export async function runOrchestrator({ cliOptions, config }: OrchestratorInput) {
  const buildDir = path.resolve(process.cwd(), config.jekyll.buildDir);
  const shouldBuild = !cliOptions.skipBuild && !cliOptions.baseUrl;
  const shouldServe = !cliOptions.skipServe && !cliOptions.baseUrl;

  if (shouldBuild) {
    await runJekyllBuild(config.jekyll.buildCommand);
  }

  let baseUrl: string;

  if (cliOptions.baseUrl) {
    baseUrl = cliOptions.baseUrl;
  } else if (shouldServe) {
    const baseurl = await detectJekyllBaseUrl(config.jekyll.sourceDir);
    const served = await serveBuild(buildDir, config.server.port, config.server.host);
    baseUrl = baseurl ? served.replace(/\/$/, '') + ensureLeadingSlash(baseurl) : served;
  } else {
    // Fallback to serving if no baseUrl and build skipped
    const baseurl = await detectJekyllBaseUrl(config.jekyll.sourceDir);
    const served = await serveBuild(buildDir, config.server.port, config.server.host);
    baseUrl = baseurl ? served.replace(/\/$/, '') + ensureLeadingSlash(baseurl) : served;
  }

  // Run Lighthouse audit (perf/seo/best-practices by default)
  const lhCategories = Object.keys(config.thresholds.lighthouse) as Array<'performance' | 'seo' | 'best-practices'>;
  const lighthouseResult = await runLighthouseAudit({
    url: baseUrl,
    categories: lhCategories,
    includeScreenshots: Boolean(cliOptions.includeScreenshots),
    skipHeavyAudits: String(cliOptions.output || 'summary') === 'summary',
  });

  // Prepare reports directory
  const reportsOutDir = path.resolve(process.cwd(), config.reports.outDir);
  await fs.mkdir(reportsOutDir, { recursive: true });

  // Determine output mode and write Lighthouse report accordingly
  const outputMode = String(cliOptions.output || 'summary');
  const includeDetails = Boolean(cliOptions.includeDetails);
  const useGzip = Boolean(cliOptions.gzip) && outputMode === 'full';

  let lighthouseOut = lighthouseResult.rawReport;
  if (outputMode === 'summary') {
    try {
      const obj = JSON.parse(lighthouseResult.rawReport);
      const metricsIds = [
        'first-contentful-paint',
        'largest-contentful-paint',
        'speed-index',
        'total-blocking-time',
        'cumulative-layout-shift',
        'interactive',
      ];
      const metrics: Record<string, any> = {};
      if (obj && obj.audits) {
        for (const id of metricsIds) {
          const a = obj.audits[id];
          if (a) {
            metrics[id] = {
              score: a.score ?? null,
              numericValue: a.numericValue ?? null,
              displayValue: a.displayValue ?? undefined,
            };
          }
        }
      }
      const summaryLh = {
        userAgent: obj?.userAgent,
        fetchTime: obj?.fetchTime,
        requestedUrl: obj?.requestedUrl,
        finalUrl: obj?.finalUrl,
        lighthouseVersion: obj?.lighthouseVersion,
        categories: lighthouseResult.categories,
        metrics,
      };
      lighthouseOut = JSON.stringify(summaryLh, null, 2);
    } catch {
      // fallback: keep original if parsing fails
    }
  } else if (outputMode === 'full' && !includeDetails) {
    // Strip audit details to reduce size if requested
    try {
      const obj = JSON.parse(lighthouseResult.rawReport);
      if (obj && obj.audits) {
        for (const a of Object.values(obj.audits) as any[]) {
          if (a && 'details' in a) delete (a as any).details;
        }
      }
      // Drop other heavy top-level fields commonly not needed in CI comparisons
      delete obj.i18n;
      delete obj.timing;
      delete obj.stackPacks;
      lighthouseOut = JSON.stringify(obj);
    } catch {
      // ignore
    }
  }

  const lighthousePath = path.join(reportsOutDir, useGzip ? 'lighthouse.json.gz' : 'lighthouse.json');
  if (useGzip) {
    const gz = zlib.gzipSync(Buffer.from(lighthouseOut, 'utf8'));
    await fs.writeFile(lighthousePath, gz);
  } else {
    await fs.writeFile(lighthousePath, lighthouseOut, 'utf8');
  }

  // Console summary
  // eslint-disable-next-line no-console
  console.log('\nLighthouse category scores:');
  for (const [key, val] of Object.entries(lighthouseResult.categories)) {
    // eslint-disable-next-line no-console
    console.log(`  ${key}: ${val.score ?? 'n/a'}`);
  }

  // Threshold checks (informational for now)
  const failures: string[] = [];
  for (const [cat, min] of Object.entries(config.thresholds.lighthouse)) {
    const score = lighthouseResult.categories[cat]?.score ?? null;
    if (score !== null && score < min) {
      failures.push(`${cat} ${score.toFixed(2)} < ${min}`);
    }
  }
  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('\nThreshold warnings (will fail builds in a later step):');
    for (const f of failures) {
      // eslint-disable-next-line no-console
      console.warn(`  - ${f}`);
    }
  }

  // Accessibility audit via Pa11y
  const sitemap = await discoverSitemap(buildDir, baseUrl);
  let targets: string[];
  const maxPagesOverride = typeof cliOptions.maxPages === 'number' && !Number.isNaN(cliOptions.maxPages)
    ? (cliOptions.maxPages as number)
    : config.crawl.maxPages;
  const pathsOverride = typeof cliOptions.paths === 'string' && (cliOptions.paths as string).trim().length > 0
    ? String(cliOptions.paths).split(',').map((p) => p.trim()).filter(Boolean)
    : null;
  const useSitemap = !cliOptions.noSitemap && config.crawl.useSitemap && !pathsOverride;
  if (pathsOverride) {
    targets = urlsFromPaths(baseUrl, pathsOverride).slice(0, maxPagesOverride);
  } else if (sitemap?.pathOnDisk && useSitemap) {
    const urls = await parseSitemapLocs(sitemap.pathOnDisk);
    targets = urls.slice(0, maxPagesOverride);
  } else {
    targets = urlsFromPaths(baseUrl, config.crawl.paths).slice(0, maxPagesOverride);
  }

  const a11yResults = [] as Array<{ url: string; issues: unknown[] }>;
  for (const url of targets) {
    try {
      const res = await runPa11yOnUrl(url);
      a11yResults.push({ url, issues: res.issues });
    } catch (err) {
      a11yResults.push({ url, issues: [{ code: 'ERROR', message: (err as Error).message }] as any });
    }
  }

  // Pa11y output (summary by default)
  const a11yMode = String(cliOptions.a11yOutput || 'summary');
  let a11yOut: unknown = a11yResults;
  if (a11yMode === 'summary' || !Boolean(cliOptions.a11yIncludeDetails)) {
    const perPage = a11yResults.map((r) => {
      const counts = { error: 0, warning: 0, notice: 0 } as Record<string, number>;
      for (const issue of r.issues as any[]) {
        const t = (issue.type || '').toLowerCase();
        if (t in counts) counts[t]++;
      }
      const total = (r.issues?.length ?? 0);
      return { url: r.url, total, byType: counts };
    });
    const totalIssues = perPage.reduce((acc, p) => acc + p.total, 0);
    a11yOut = { pages: perPage.length, totalIssues, perPage };
  }
  await fs.writeFile(path.join(reportsOutDir, 'pa11y.json'), JSON.stringify(a11yOut, null, 2), 'utf8');

  const totalIssues = a11yResults.reduce((acc, r) => acc + (r.issues?.length ?? 0), 0);
  // eslint-disable-next-line no-console
  console.log(`\nAccessibility: scanned ${targets.length} page(s), total issues: ${totalIssues}`);
  let anyFailures = false;
  if (totalIssues > config.thresholds.accessibility.maxIssues) {
    // eslint-disable-next-line no-console
    console.warn(`Threshold warning: accessibility issues ${totalIssues} > ${config.thresholds.accessibility.maxIssues}`);
    anyFailures = true;
  }

  // Link check via Linkinator
  const linkTimeout = typeof cliOptions.linksTimeout === 'number' && !Number.isNaN(cliOptions.linksTimeout) ? cliOptions.linksTimeout as number : 30000;
  const linkConcurrency = typeof cliOptions.linksConcurrency === 'number' && !Number.isNaN(cliOptions.linksConcurrency) ? cliOptions.linksConcurrency as number : 100;
  const linkRes = await runLinkCheck(baseUrl, { recurse: true, timeout: linkTimeout, concurrency: linkConcurrency });

  // Link output (summary by default, optionally internal only)
  const linksMode = String(cliOptions.linksOutput || 'summary');
  const internalOnly = Boolean(cliOptions.linksInternalOnly);
  const baseOrigin = (() => { try { return new URL(baseUrl).origin; } catch { return null; } })();
  const linksFiltered = internalOnly && baseOrigin
    ? linkRes.links.filter((l) => { try { return new URL(l.url).origin === baseOrigin; } catch { return false; } })
    : linkRes.links;
  const brokenFiltered = linksFiltered.filter((l) => l.state === 'BROKEN');
  let linksOut: unknown = linkRes;
  if (linksMode === 'summary' || !Boolean(cliOptions.linksIncludeDetails)) {
    linksOut = {
      brokenCount: brokenFiltered.length,
      broken: brokenFiltered.map((l) => ({ url: l.url, status: l.status, parent: l.parent })),
    };
  }
  await fs.writeFile(path.join(reportsOutDir, 'links.json'), JSON.stringify(linksOut, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\nLinks: scanned, broken=${linkRes.brokenCount}`);
  if (linkRes.brokenCount > config.thresholds.links.maxBroken) {
    // eslint-disable-next-line no-console
    console.warn(`Threshold warning: broken links ${linkRes.brokenCount} > ${config.thresholds.links.maxBroken}`);
    anyFailures = true;
  }

  // HTML validation via html-validator
  const htmlResults: Array<{ url: string; errorCount: number; messages: unknown[] }> = [];
  for (const url of targets) {
    try {
      const res = await validateHtmlUrl(url);
      htmlResults.push({ url, errorCount: res.errorCount, messages: res.messages as unknown[] });
    } catch (err) {
      htmlResults.push({ url, errorCount: 1, messages: [{ type: 'error', message: (err as Error).message }] as any });
    }
  }
  const htmlMode = String(cliOptions.htmlOutput || 'summary');
  let htmlOut: unknown = htmlResults;
  if (htmlMode === 'summary' || !Boolean(cliOptions.htmlIncludeDetails)) {
    htmlOut = htmlResults.map((r) => ({ url: r.url, errorCount: r.errorCount }));
  }
  await fs.writeFile(path.join(reportsOutDir, 'html.json'), JSON.stringify(htmlOut, null, 2), 'utf8');
  const totalHtmlErrors = htmlResults.reduce((acc, r) => acc + (r.errorCount ?? 0), 0);
  // eslint-disable-next-line no-console
  console.log(`\nHTML: scanned ${htmlResults.length} page(s), total errors: ${totalHtmlErrors}`);
  if (totalHtmlErrors > config.thresholds.html.maxErrors) {
    // eslint-disable-next-line no-console
    console.warn(`Threshold warning: HTML errors ${totalHtmlErrors} > ${config.thresholds.html.maxErrors}`);
    anyFailures = true;
  }

  // Aggregate summary + CI exit code
  const lhSummary: Record<string, { score: number | null; threshold?: number }> = {};
  for (const [key, obj] of Object.entries(lighthouseResult.categories)) {
    const threshold = (config.thresholds.lighthouse as Record<string, number>)[key];
    lhSummary[key] = { score: obj.score, threshold };
    if (typeof threshold === 'number' && typeof obj.score === 'number' && obj.score < threshold) {
      anyFailures = true;
    }
  }

  const summary = {
    baseUrl,
    lighthouse: lhSummary,
    accessibility: { totalIssues, threshold: config.thresholds.accessibility.maxIssues },
    links: { broken: linkRes.brokenCount, threshold: config.thresholds.links.maxBroken },
    html: { totalErrors: totalHtmlErrors, threshold: config.thresholds.html.maxErrors },
    passed: !anyFailures,
    timestamp: new Date().toISOString(),
  };
  await fs.writeFile(path.join(reportsOutDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  if (anyFailures && !Boolean(cliOptions.softFail)) {
    // eslint-disable-next-line no-console
    console.error('\nOne or more thresholds failed.');
    process.exitCode = 1;
  }
}

async function runJekyllBuild(buildCommand: string) {
  // eslint-disable-next-line no-console
  console.log('Building Jekyll site...');
  const [cmd, ...args] = buildCommand.split(' ');
  await execa(cmd, args, { stdio: 'inherit', env: { ...process.env, JEKYLL_ENV: 'production' } });
}

async function serveBuild(buildDir: string, preferredPort?: number, host = '127.0.0.1'): Promise<string> {
  const port = preferredPort ?? (await getPort());

  await fs.access(buildDir);

  const server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
    return serveHandler(request, response, { public: buildDir });
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));

  // eslint-disable-next-line no-console
  console.log(`Serving ${buildDir} at http://${host}:${port}`);

  return `http://${host}:${port}`;
}

async function detectJekyllBaseUrl(sourceDir: string): Promise<string | null> {
  try {
    const cfgPath = path.resolve(process.cwd(), sourceDir, '_config.yml');
    const raw = await fs.readFile(cfgPath, 'utf8');
    const doc = YAML.parse(raw) as { baseurl?: string } | null;
    if (doc && typeof doc.baseurl === 'string' && doc.baseurl.trim() !== '') {
      return doc.baseurl.trim();
    }
  } catch {
    // ignore missing or parse errors
  }
  return null;
}

function ensureLeadingSlash(p: string): string {
  if (!p.startsWith('/')) return '/' + p;
  return p;
}
