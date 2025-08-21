import lighthouse from 'lighthouse';
import { launch, LaunchedChrome } from 'chrome-launcher';

export type LighthouseCategory = 'performance' | 'seo' | 'best-practices' | 'accessibility' | 'pwa';

export interface LighthouseRunInput {
  url: string;
  categories?: LighthouseCategory[];
  includeScreenshots?: boolean;
  skipHeavyAudits?: boolean;
}

export interface LighthouseRunOutput {
  categories: Record<string, { score: number | null }>;
  rawReport: string; // JSON string from LH
}

export async function runLighthouseAudit({ url, categories, includeScreenshots, skipHeavyAudits }: LighthouseRunInput): Promise<LighthouseRunOutput> {
  let chrome: LaunchedChrome | undefined;
  try {
    chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] });
    const opts = { logLevel: 'info', output: 'json', port: chrome.port } as const;

    const lhOptions: any = { ...opts };
    if (categories && categories.length > 0) {
      lhOptions.onlyCategories = categories;
    }
    // Skip heavy screenshot audits by default unless explicitly included
    const skipList: string[] = [];
    if (!includeScreenshots) {
      skipList.push('screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot');
    }
    if (skipHeavyAudits) {
      skipList.push(
        'network-requests',
        'tasks',
        'diagnostics',
        'resource-summary',
        'script-treemap-data',
        'third-party-summary',
        'duplicate-javascript'
      );
    }
    if (skipList.length > 0) {
      lhOptions.settings = {
        ...(lhOptions.settings || {}),
        skipAudits: [...new Set([...(lhOptions.settings?.skipAudits || []), ...skipList])],
      };
    }
    const result = await lighthouse(url, lhOptions);

    const lhr = result?.lhr;
    const categoriesResult: Record<string, { score: number | null }> = {};
    if (lhr && lhr.categories) {
      for (const [key, value] of Object.entries(lhr.categories)) {
        const v: any = value as any;
        categoriesResult[key] = { score: typeof v.score === 'number' ? v.score : null };
      }
    }

    const report = Array.isArray(result?.report) ? result?.report.join('\n') : (result?.report as string | undefined);

    let raw = report || JSON.stringify(result?.lhr ?? {});
    if (!includeScreenshots) {
      try {
        const obj = JSON.parse(raw);
        // Remove known screenshot-heavy audits entirely
        if (obj && obj.audits) {
          delete obj.audits['screenshot-thumbnails'];
          delete obj.audits['final-screenshot'];
          delete obj.audits['full-page-screenshot'];
          // Additionally, scrub any lingering base64 image data within audit details
          for (const aud of Object.values(obj.audits) as any[]) {
            if (aud && aud.details) {
              scrubDetailsImages(aud.details);
            }
          }
        }
        raw = JSON.stringify(obj);
      } catch {
        // If parse fails, leave as-is
      }
    }

    return {
      categories: categoriesResult,
      rawReport: raw,
    };
  } finally {
    try {
      if (chrome) await chrome.kill();
    } catch {
      // ignore
    }
  }
}

function scrubDetailsImages(details: any) {
  if (!details) return;
  // Common shapes: {items: [{data: 'data:image/jpeg;base64,...'}]} or nested details
  if (Array.isArray(details.items)) {
    for (const it of details.items) {
      for (const [k, v] of Object.entries(it)) {
        if (typeof v === 'string' && v.startsWith('data:image/')) {
          // Drop heavy inline image data
          delete (it as any)[k];
        }
      }
    }
  }
  if (Array.isArray(details.nodes)) {
    for (const n of details.nodes) {
      if (n && typeof n === 'object') scrubDetailsImages(n);
    }
  }
  if (details.overview) scrubDetailsImages(details.overview);
  if (Array.isArray(details.items) || Array.isArray(details.nodes)) {
    // done above
  }
}
