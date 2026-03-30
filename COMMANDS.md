# HarvinAI - All Commands & Scripts Reference

## Environment Variables Required

| Variable | Used By | Purpose |
|----------|---------|---------|
| `MONGO_URI` | All scripts | MongoDB connection string |
| `GROQ_API_KEY` | signal-news-scan, funding-news-scan, bulk-meta, extension-bot, rescan-missing | Groq LLM API |
| `GOOGLE_API_KEY` | estimate-traffic, fetch-traffic-free, fill-missing-traffic, detect route | Google CrUX API for traffic |
| `PORT` | Next.js | Web server port (optional, defaults to 3000) |

---

## 1. Development & Build

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## 2. Bulk Domain Metadata Extraction

Reads `Accounts.txt`, fetches each domain, extracts category/region/store data, stores in MongoDB.

```bash
# Full run
node scripts/bulk-meta.js

# Process first 100 domains
node scripts/bulk-meta.js --limit 100

# Report stats without processing
node scripts/bulk-meta.js --dry-run

# Auto-restart wrapper (handles TLS crashes in Node v24)
bash scripts/run-bulk-meta.sh
bash scripts/run-bulk-meta.sh --limit 1000
```

---

## 3. Tech Stack Scanning

### Extension Bot (recommended - most accurate)
Launches real Chrome with HarvinAI extension, captures page data, POSTs to `/api/detect`.

```bash
# Scan all accounts with no tech data
node scripts/extension-bot.js

# Scan first 50
node scripts/extension-bot.js --limit 50

# 3 tabs at once
node scripts/extension-bot.js --concurrency 3

# Rescan ALL accounts (even with existing tech)
node scripts/extension-bot.js --force

# Resume from last run
node scripts/extension-bot.js --resume

# Filter by category
node scripts/extension-bot.js --category "Fashion & Apparel"
```

### Bulk Tech Scanner (API-based, lighter)

```bash
# Scan all missing
node scripts/bulk-tech-scan.js

# Scan first 500
node scripts/bulk-tech-scan.js --limit 500

# Rescan all
node scripts/bulk-tech-scan.js --force

# 10 parallel scans (default: 5)
node scripts/bulk-tech-scan.js --concurrency 10

# Resume from last progress
node scripts/bulk-tech-scan.js --resume
```

### Backfill tech into company_meta

```bash
# Copy tech names from tech_cache into company_meta.techStack
node scripts/backfill-techstack.js
```

---

## 4. Traffic / MAU Estimation

### Estimate via Tranco + CrUX (primary)

```bash
# Full run (all accounts)
node scripts/estimate-traffic.js

# Process first 500
node scripts/estimate-traffic.js --limit 500

# Report stats only
node scripts/estimate-traffic.js --dry-run

# Re-estimate all (ignore cache)
node scripts/estimate-traffic.js --refresh
```

### Fetch from free sources

```bash
# Update all
node scripts/fetch-traffic-free.js

# Only accounts without MAU
node scripts/fetch-traffic-free.js --only-missing

# First 1000
node scripts/fetch-traffic-free.js --limit 1000

# Import real data from TSV
node scripts/fetch-traffic-free.js --import file.csv
```

### Fill missing traffic

```bash
node scripts/fill-missing-traffic.js
```

### Import real MAU data from TSV

```bash
node scripts/import-mau.js docs/unknown-accounts.csv
node scripts/import-mau.js docs/unknown-accounts.csv --dry-run
```

---

## 5. Market News Scanning

### D2C Brand News (no API keys needed - pure regex)

```bash
# Full run (top 500 brands)
node scripts/market-news-scan.js

# Preview without writing
node scripts/market-news-scan.js --dry-run

# Limit brands
node scripts/market-news-scan.js --limit 50

# Single brand
node scripts/market-news-scan.js --domain nykaa.com

# Only high-score brands
node scripts/market-news-scan.js --min-score 40

# Verbose output
node scripts/market-news-scan.js --verbose
```

### Funding News Aggregator (needs Groq)

```bash
# Full run
node scripts/funding-news-scan.js

# Preview
node scripts/funding-news-scan.js --dry-run

# Limit articles
node scripts/funding-news-scan.js --limit 20
```

---

## 6. Signal Scoring

### Daily Signal Scan (news + signals via LLM)

```bash
# Full run (top 5000 domains)
node scripts/signal-news-scan.js

# Process 50 domains
node scripts/signal-news-scan.js --limit 50

# Preview without writing
node scripts/signal-news-scan.js --dry-run

# Single domain
node scripts/signal-news-scan.js --domain nykaa.com
```

### Recompute Signal Scores

```bash
# Recompute all scores from last 90 days
node scripts/signal-score.js
```

---

## 7. Category Management

### Fix Unknown Categories

```bash
# Apply KNOWN_BRANDS data to existing DB entries
node scripts/fix-unknown-categories.js
```

### Reclassify Low-Confidence Domains

```bash
# Re-classify all low/missing
node scripts/reclassify-domains.js

# Preview without writing
node scripts/reclassify-domains.js --dry-run

# Limit domains
node scripts/reclassify-domains.js --limit 100

# Single domain
node scripts/reclassify-domains.js --domain zo.xyz

# Also re-check medium confidence
node scripts/reclassify-domains.js --include-medium

# Print every change
node scripts/reclassify-domains.js --verbose
```

### D2C Validation

```bash
# Full run - check every account
node scripts/validate-d2c.js

# Preview
node scripts/validate-d2c.js --dry-run

# Limit
node scripts/validate-d2c.js --limit 500

# Single domain
node scripts/validate-d2c.js --domain bit.ly

# Verbose
node scripts/validate-d2c.js --verbose
```

### Find Invalid Categories (export to CSV)

```bash
node scripts/find-invalid-categories.js
```

### Migrate Old Category Names

```bash
# One-time: rename old category names to new consolidated names
node scripts/migrate-categories.js
```

---

## 8. Data Backfills

### Location Data

```bash
# Backfill state/city (50 at a time)
node scripts/backfill-location.js

# Process 100 at a time
node scripts/backfill-location.js --batch=100

# Keep going until done
node scripts/backfill-location.js --all
```

### App Presence (Play Store / App Store links)

```bash
# Full run
node scripts/backfill-app-presence.js

# Process 100
node scripts/backfill-app-presence.js --limit 100

# Detect without writing
node scripts/backfill-app-presence.js --dry-run

# Skip domains that already have appPresence
node scripts/backfill-app-presence.js --skip-existing
```

### Re-scan Missing Domains

```bash
# Restore deleted consumer-facing accounts from Accounts.txt
node scripts/rescan-missing.js

# First 1000 missing
node scripts/rescan-missing.js --limit 1000

# Just count missing
node scripts/rescan-missing.js --dry-run
```

---

## 9. Automated Cron Jobs (GitHub Actions)

### Daily Signal Scan
- **Schedule:** Daily at 2 AM UTC
- **Workflow:** `.github/workflows/signals.yml`
- **Runs:**
  ```bash
  node scripts/signal-news-scan.js --limit 5000
  node scripts/signal-score.js
  ```
- **Manual trigger:** Go to GitHub Actions > "Daily Signal Scan" > Run workflow

### Monthly Traffic Update
- **Schedule:** 1st of every month at 4 AM UTC
- **Workflow:** `.github/workflows/traffic.yml`
- **Runs:**
  ```bash
  node scripts/estimate-traffic.js --refresh
  ```
- **Manual trigger:** Go to GitHub Actions > "Monthly Traffic Update" > Run workflow

---

## 10. Common Workflows

### New brand database setup (from scratch)
```bash
# 1. Bulk extract metadata for all domains
bash scripts/run-bulk-meta.sh

# 2. Estimate traffic for all
node scripts/estimate-traffic.js

# 3. Fix any unknown categories
node scripts/fix-unknown-categories.js

# 4. Validate D2C classification
node scripts/validate-d2c.js

# 5. Scan tech stacks
node scripts/extension-bot.js --concurrency 3

# 6. Backfill location data
node scripts/backfill-location.js --all

# 7. Backfill app presence
node scripts/backfill-app-presence.js --skip-existing

# 8. Run initial market news scan
node scripts/market-news-scan.js

# 9. Run signal scan + scoring
node scripts/signal-news-scan.js
node scripts/signal-score.js
```

### Daily maintenance
```bash
# Signal scan (automated via GitHub Action, or manual)
node scripts/signal-news-scan.js --limit 5000
node scripts/signal-score.js

# Market news
node scripts/market-news-scan.js --limit 200
```

### Fix misclassified domains
```bash
# Reclassify low-confidence ones
node scripts/reclassify-domains.js --verbose

# Or fix a specific domain
node scripts/reclassify-domains.js --domain example.com --verbose

# Then validate D2C status
node scripts/validate-d2c.js --domain example.com --verbose
```

### Refresh traffic data
```bash
# Re-estimate all (monthly)
node scripts/estimate-traffic.js --refresh

# Or just fill missing
node scripts/fill-missing-traffic.js
```
