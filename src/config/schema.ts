import { z } from 'zod';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';

export const ConfigSchema = z.object({
  jekyll: z
    .object({
      buildDir: z.string().default('_site'),
      sourceDir: z.string().default('.'),
      buildCommand: z.string().default('bundle exec jekyll build'),
    })
    .default({}),
  server: z
    .object({
      port: z.number().optional(),
      host: z.string().default('127.0.0.1'),
    })
    .default({}),
  crawl: z
    .object({
      useSitemap: z.boolean().default(true),
      maxPages: z.number().default(50),
      paths: z.array(z.string()).default(['/']),
    })
    .default({}),
  thresholds: z
    .object({
      lighthouse: z
        .object({ performance: z.number().min(0).max(1).default(0.8), seo: z.number().min(0).max(1).default(0.9), 'best-practices': z.number().min(0).max(1).default(0.9) })
        .default({}),
      accessibility: z.object({ maxIssues: z.number().default(0) }).default({}),
      links: z.object({ maxBroken: z.number().default(0) }).default({}),
      html: z.object({ maxErrors: z.number().default(0) }).default({}),
    })
    .default({}),
  reports: z
    .object({
      formats: z.array(z.enum(['json', 'html', 'md'])).default(['json']),
      outDir: z.string().default('reports'),
    })
    .default({}),
});

export type AuditConfig = z.infer<typeof ConfigSchema>;

export async function loadConfig(customPath?: string): Promise<AuditConfig> {
  const defaults = ConfigSchema.parse({});

  const candidates = customPath
    ? [customPath]
    : ['jekyll-audit.config.js', 'jekyll-audit.config.cjs', 'jekyll-audit.config.json'];

  for (const file of candidates) {
    try {
      const full = path.resolve(process.cwd(), file);
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      if (file.endsWith('.json')) {
        const raw = await fs.readFile(full, 'utf8');
        const json = JSON.parse(raw);
        return ConfigSchema.parse(json);
      }
      const mod = await import(pathToFileURL(full).href);
      const cfg = (mod.default ?? mod.config ?? mod) as unknown;
      return ConfigSchema.parse(cfg);
    } catch {
      // ignore and continue to next candidate
    }
  }

  return defaults;
}
