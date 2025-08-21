import validator from 'html-validator';

export interface HtmlValidationMessage {
  type: string; // 'error' | 'info' | 'warning'
  message: string;
  extract?: string;
  lastLine?: number;
  lastColumn?: number;
}

export interface HtmlValidationResult {
  url: string;
  messages: HtmlValidationMessage[];
  errorCount: number;
}

export async function validateHtmlUrl(url: string): Promise<HtmlValidationResult> {
  const res = (await (validator as any)({ url, format: 'json' })) as { messages?: HtmlValidationMessage[] };
  const messages = res.messages ?? [];
  const errorCount = messages.filter((m) => m.type === 'error').length;
  return { url, messages, errorCount };
}
