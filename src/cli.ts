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
