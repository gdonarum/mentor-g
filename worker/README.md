# Mentor G - Cloudflare Worker Setup

This worker proxies API requests to Anthropic while:
1. **Hiding your API key** from end users
2. **Automatically logging** all analyses for feedback/improvement

## Setup Instructions

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create the D1 Database

```bash
cd worker
wrangler d1 create mentor-g-feedback
```

Copy the `database_id` from the output and paste it into `wrangler.toml`.

### 4. Initialize the Database Schema

```bash
wrangler d1 execute mentor-g-feedback --file=schema.sql
```

### 5. Set Your API Key Secret

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Enter your Anthropic API key when prompted.

### 6. Deploy the Worker

```bash
wrangler deploy
```

Note the worker URL (e.g., `https://mentor-g-api.your-subdomain.workers.dev`).

### 7. Update the Frontend

In `src/api/config.ts`, set the `WORKER_URL`:

```typescript
export const WORKER_URL = 'https://mentor-g-api.your-subdomain.workers.dev';
```

Then rebuild and redeploy the frontend.

## Viewing Logged Data

Query your feedback database:

```bash
# View recent analyses
wrangler d1 execute mentor-g-feedback --command="SELECT * FROM analyses ORDER BY timestamp DESC LIMIT 20"

# Count analyses by date
wrangler d1 execute mentor-g-feedback --command="SELECT DATE(timestamp) as date, COUNT(*) as count FROM analyses GROUP BY date"

# Find analyses with specific issues
wrangler d1 execute mentor-g-feedback --command="SELECT problem_description, response_summary FROM analyses WHERE problem_description LIKE '%brownout%'"
```

## Export Data

```bash
# Export all data as JSON
wrangler d1 execute mentor-g-feedback --command="SELECT * FROM analyses" --json > feedback-export.json
```

## Costs

- **Cloudflare Workers**: Free tier includes 100,000 requests/day
- **D1 Database**: Free tier includes 5GB storage, 5M reads/day
- **Anthropic API**: Billed to your Anthropic account

For an FRC team's usage, you'll likely stay well within free tiers.
