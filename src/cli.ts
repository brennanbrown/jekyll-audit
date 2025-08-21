import { Command } from 'commander';
import { runOrchestrator } from './orchestrator/index.js';
import { loadConfig } from './config/schema.js';

const program = new Command();

program
  .name('jekyll-audit')
  .description('Audit Jekyll sites for performance, accessibility, SEO, links, and HTML validation.')
  .version('0.1.0');

program
  .option('--config <path>', 'Path to config file (jekyll-audit.config.js|cjs|json)')
  .option('--baseUrl <url>', 'Base URL to audit (overrides serve step)')
  .option('--report <formats>', 'Comma-separated report formats: json,html,md', 'json')
  .option('--outDir <dir>', 'Output directory for reports', 'reports')
  .option('--includeScreenshots', 'Include Lighthouse screenshot audits in JSON output (opt-in)', false)
  .option('--output <mode>', 'Lighthouse JSON output mode: summary|full', 'summary')
  .option('--includeDetails', 'Include audit details in JSON (only for full or if explicitly desired)', false)
  .option('--gzip', 'Write lighthouse.json.gz instead of lighthouse.json', false)
  .option('--softFail', 'Do not set non-zero exit code when thresholds fail', false)
  // Crawl overrides
  .option('--maxPages <n>', 'Maximum pages to scan (overrides config)', (v) => parseInt(String(v), 10))
  .option('--paths <csv>', 'Comma-separated path list to scan instead of sitemap')
  .option('--noSitemap', 'Do not use sitemap even if present', false)
  // Pa11y output controls
  .option('--a11yOutput <mode>', 'Accessibility report: summary|full', 'summary')
  .option('--a11yIncludeDetails', 'Include full issue details in output (only when full or explicitly desired)', false)
  // Linkinator output and scope controls
  .option('--linksOutput <mode>', 'Links report: summary|full', 'summary')
  .option('--linksInternalOnly', 'Only check internal links (skip external domains)', false)
  .option('--linksIncludeDetails', 'Include extra details in links output (only in full)', false)
  .option('--linksTimeout <ms>', 'Per-request timeout for link check', (v) => parseInt(String(v), 10))
  .option('--linksConcurrency <n>', 'Concurrency for link check', (v) => parseInt(String(v), 10))
  // HTML validator output controls
  .option('--htmlOutput <mode>', 'HTML validation report: summary|full', 'summary')
  .option('--htmlIncludeDetails', 'Include full validator messages in output (only in full)', false)
  .option('--skipBuild', 'Skip Jekyll build step')
  .option('--skipServe', 'Skip serving step');

program
  .command('audit')
  .description('Run the full audit pipeline (build -> serve -> audits -> reports).')
  .action(async (opts: Record<string, unknown>, cmd: Command) => {
    const options = { ...program.opts(), ...opts };
    const config = await loadConfig(options.config);
    await runOrchestrator({ cliOptions: options, config });
  });

program.parseAsync(process.argv);
