/** @type {import('./dist/config/schema.js').AuditConfig} */
export default {
  jekyll: {
    sourceDir: '.',
    buildDir: '_site',
    buildCommand: 'bundle exec jekyll build',
  },
  server: {
    // host: '127.0.0.1',
    // port: 4001,
  },
  crawl: {
    useSitemap: true,
    maxPages: 50,
    paths: ['/'],
  },
  thresholds: {
    lighthouse: {
      performance: 0.8,
      seo: 0.9,
      'best-practices': 0.9,
    },
    accessibility: { maxIssues: 0 },
    links: { maxBroken: 0 },
    html: { maxErrors: 0 },
  },
  reports: {
    formats: ['json'],
    outDir: 'reports',
  },
};
