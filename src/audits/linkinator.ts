import * as linkinator from 'linkinator';

export interface LinkResult {
  url: string;
  status?: number;
  state?: 'BROKEN' | 'OK' | 'SKIPPED' | string;
  parent?: string;
}

export interface LinkinatorRunOutput {
  links: LinkResult[];
  brokenCount: number;
}

export interface LinkinatorOptions {
  recurse?: boolean;
  timeout?: number;
  concurrency?: number;
  linksToSkip?: Array<string>;
}

export async function runLinkCheck(startUrl: string, options?: LinkinatorOptions): Promise<LinkinatorRunOutput> {
  const res = await (linkinator as any).check({
    path: startUrl,
    recurse: options?.recurse ?? true,
    timeout: options?.timeout ?? 30000,
    concurrency: options?.concurrency ?? 100,
    linksToSkip: options?.linksToSkip,
  });

  const links: LinkResult[] = (res?.links ?? []).map((l: any) => ({
    url: l.url,
    status: l.status,
    state: l.state,
    parent: l.parent,
  }));
  const brokenCount = links.filter((l) => l.state === 'BROKEN').length;
  return { links, brokenCount };
}
