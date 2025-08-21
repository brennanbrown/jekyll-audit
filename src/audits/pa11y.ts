import pa11y from 'pa11y';

export interface Pa11yIssue {
  code: string;
  message: string;
  context?: string;
  selector?: string;
  type?: string;
  typeCode?: number;
}

export interface Pa11yRunResult {
  url: string;
  issues: Pa11yIssue[];
}

export interface Pa11yOptions {
  standard?: string; // WCAG2AA default in pa11y
  timeout?: number;
}

export async function runPa11yOnUrl(url: string, options?: Pa11yOptions): Promise<Pa11yRunResult> {
  const res = await pa11y(url, {
    standard: options?.standard ?? 'WCAG2AA',
    timeout: options?.timeout ?? 30000,
  } as any);
  return { url, issues: (res.issues ?? []) as Pa11yIssue[] };
}
