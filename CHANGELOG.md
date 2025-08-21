# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [0.3.1] - 2025-08-21
### Fixed
- Ensure local HTTP server is closed after audits to prevent process hanging (`src/orchestrator/index.ts`).

### Added
- Generate human-readable `reports/summary.md` with concise explanations of scores and error counts.

## [0.3.0] - 2025-08-21
### Added
- Default lean "summary" outputs for Pa11y, Linkinator, and HTML validator in `src/orchestrator/index.ts`.
- CLI flags to control output/detail levels and performance:
  - Crawl: `--maxPages`, `--paths`, `--noSitemap`.
  - Lighthouse: `--output summary|full`, `--includeDetails`, `--includeScreenshots`, `--gzip`, `--softFail`.
  - Pa11y: `--a11yOutput summary|full`, `--a11yIncludeDetails`.
  - Linkinator: `--linksOutput summary|full`, `--linksInternalOnly`, `--linksIncludeDetails`, `--linksTimeout`, `--linksConcurrency`.
  - HTML: `--htmlOutput summary|full`, `--htmlIncludeDetails`.
- Internal-only filtering for link reports and tunable link check timeout/concurrency.
- New docs page: `docs/flags.html` and nav link from `docs/index.html`.

### Changed
- README updated with CLI examples and links to docs.
- Published as `@brennanbrown/jekyll-audit@0.3.0`.

## [0.2.0] - 2025-08-21
### Added
- Lighthouse lean mode and JSON trimming:
  - `--output summary|full` (default `summary`).
  - `--includeDetails` to include audit details when desired.
  - `--gzip` to write `lighthouse.json.gz` in full mode.
  - `--softFail` to avoid non-zero exit on threshold warnings.
  - `--includeScreenshots` opt-in; screenshots excluded by default.
- Lighthouse runner skips heavy audits in summary mode and scrubs base64 blobs.

### Changed
- Default reports are smaller and more diffable for CI.

## [0.1.0] - 2025-08-20
### Added
- Initial release with build/serve orchestration and audits:
  - Lighthouse, Pa11y, Linkinator, HTML validator.
- JSON reports per audit and aggregated `summary.json`.
- Thresholds for CI failure and basic configuration support.
