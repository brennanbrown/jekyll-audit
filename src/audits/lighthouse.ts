import lighthouse from 'lighthouse';
import { launch, LaunchedChrome } from 'chrome-launcher';

export type LighthouseCategory = 'performance' | 'seo' | 'best-practices' | 'accessibility' | 'pwa';

export interface LighthouseRunInput {
  url: string;
  categories?: LighthouseCategory[];
}

export interface LighthouseRunOutput {
  categories: Record<string, { score: number | null }>;
  rawReport: string; // JSON string from LH
}

export async function runLighthouseAudit({ url, categories }: LighthouseRunInput): Promise<LighthouseRunOutput> {
  let chrome: LaunchedChrome | undefined;
  try {
    chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] });
    const opts = { logLevel: 'info', output: 'json', port: chrome.port } as const;

    const lhOptions: any = { ...opts };
    if (categories && categories.length > 0) {
      lhOptions.onlyCategories = categories;
    }
    const result = await lighthouse(url, lhOptions);

    const lhr = result?.lhr;
    const categoriesResult: Record<string, { score: number | null }> = {};
    if (lhr && lhr.categories) {
      for (const [key, value] of Object.entries(lhr.categories)) {
        categoriesResult[key] = { score: typeof value.score === 'number' ? value.score : null };
      }
    }

    const report = Array.isArray(result?.report) ? result?.report.join('\n') : (result?.report as string | undefined);
    return {
      categories: categoriesResult,
      rawReport: report || JSON.stringify(result?.lhr ?? {}),
    };
  } finally {
    try {
      if (chrome) await chrome.kill();
    } catch {
      // ignore
    }
  }
}
