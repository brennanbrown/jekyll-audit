declare module 'pa11y' {
  interface Pa11yIssue {
    code: string;
    message: string;
    context?: string;
    selector?: string;
    type?: string;
    typeCode?: number;
  }
  interface Pa11yResult {
    issues: Pa11yIssue[];
    documentTitle?: string;
    pageUrl?: string;
  }
  interface Pa11yOptions {
    standard?: string;
    timeout?: number;
  }
  function pa11y(url: string, options?: Pa11yOptions): Promise<Pa11yResult>;
  export = pa11y;
}
