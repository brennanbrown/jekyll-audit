# jekyll-audit

CLI to audit Jekyll sites for performance, accessibility, SEO, links, and HTML validation.

## Quick start

Requirements: Node >= 18, Ruby with Jekyll for builds (bundle exec jekyll build).

```bash
# install deps
npm install

# build TypeScript
npm run build

# show CLI help
node bin/jekyll-audit --help

# run the full audit pipeline (build -> serve -> audits -> reports)
node bin/jekyll-audit audit

# target an already running Jekyll server
node bin/jekyll-audit --baseUrl http://127.0.0.1:4000 audit
```

## Config
Create `jekyll-audit.config.js` (optional):

```js
/** @type {import('./dist/config/schema.js').AuditConfig} */
export default {
  jekyll: { buildDir: '_site', buildCommand: 'bundle exec jekyll build' },
  crawl: { useSitemap: true, maxPages: 50, paths: ['/'] },
  thresholds: {
    lighthouse: { performance: 0.8, seo: 0.9, 'best-practices': 0.9 },
    accessibility: { maxIssues: 0 },
    links: { maxBroken: 0 },
    html: { maxErrors: 0 },
  },
  reports: { formats: ['json'], outDir: 'reports' },
};
```

## What it does
- Builds your Jekyll site (`JEKYLL_ENV=production`)
- Serves the built directory locally
- Detects `_config.yml` `baseurl` and appends it to the served URL
- Discovers URLs from `sitemap.xml` or falls back to `crawl.paths`
- Runs audits:
  - Lighthouse (perf/seo/best-practices) → `reports/lighthouse.json`
  - Pa11y (accessibility) → `reports/pa11y.json`
  - Linkinator (broken links) → `reports/links.json`
  - html-validator (HTML errors) → `reports/html.json`
- Writes `reports/summary.json` and exits non-zero if thresholds fail

## Reports
- JSON files written to `reports/` by default
- `summary.json` contains consolidated results and `passed` boolean

## CLI Flags
Common examples (full list and details in `docs/flags.html`):

```bash
# Default lean run (summary outputs)
npx @brennanbrown/jekyll-audit audit

# Full Lighthouse with details and screenshots (heavier)
npx @brennanbrown/jekyll-audit audit --output full --includeDetails --includeScreenshots

# Faster link checks (internal only, tuned)
npx @brennanbrown/jekyll-audit audit --linksInternalOnly --linksConcurrency 200 --linksTimeout 15000

# Limit pages + disable sitemap
npx @brennanbrown/jekyll-audit audit --maxPages 20 --noSitemap
```

See full flag reference: https://brennanbrown.github.io/jekyll-audit/docs/flags.html

## CI usage (GitHub Actions)
Example workflow `.github/workflows/jekyll-audit.yml`:

```yaml
name: Jekyll Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Ruby (only if Gemfile exists)
        if: hashFiles('**/Gemfile') != ''
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
      - name: Install Jekyll deps (only if Gemfile exists)
        if: hashFiles('**/Gemfile') != ''
        run: |
          bundle config set --local path 'vendor/bundle'
          bundle install
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Run jekyll-audit
        run: node bin/jekyll-audit audit
      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: jekyll-audit-reports
          path: reports/
```

## Docs
- Landing page: https://brennanbrown.github.io/jekyll-audit/
- Flags reference: https://brennanbrown.github.io/jekyll-audit/docs/flags.html

## Changelog
- See CHANGELOG.md for version history and details.

## Notes
- You can bypass build/serve using `--baseUrl` to point at a dev server.
- Thresholds control CI failure. Adjust per your needs in config.
- The workflow only installs Ruby gems if a `Gemfile` is present, and uses `bundle config set --local path 'vendor/bundle'` instead of the deprecated `--path` flag.
