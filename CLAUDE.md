# Ivan Ads Manager

Meta Ads management tool with web dashboard, automation rules, and Slack notifications.

## Live URL

**https://ivan-ads-manager-production.up.railway.app**

## Project Structure

```
src/
├── index.ts           # Original MCP server (for Claude integration)
├── meta-client.ts     # Meta Marketing API client
├── web/
│   ├── server.ts      # Express web server
│   └── views/         # EJS templates
├── automation/
│   └── engine.ts      # Automation rules engine (Redis-backed)
└── notifications/
    └── slack.ts       # Slack webhook notifications
```

## Running Locally

```bash
# Web dashboard
npm run dev:web

# MCP server (for Claude)
npm run dev
```

## Key Commands

- `npm run start:web` - Start web server (production)
- `npm run dev:web` - Start web server (development)
- `npm run dev` - Start MCP server
- `npm run list:tools` - List available MCP tools

## Environment Variables

**Required:**
- `META_ACCESS_TOKEN` - Meta API access token (starts with EAA...)

**Dashboard:**
- `DASHBOARD_PASSWORD` - Web dashboard password
- `SESSION_SECRET` - Session encryption key

**Optional:**
- `SLACK_WEBHOOK_URL` - Slack incoming webhook for notifications
- `REDIS_URL` - Redis URL for automation persistence (auto-set by Railway)
- `PORT` - Server port (default: 3000)

## Deployment (Railway)

Architecture:
- ivan-ads-manager service (Node.js app)
- Redis service (automation storage)

The app uses nixpacks with tsx runtime (no TypeScript build step due to memory constraints).

## Debugging Endpoints

- `/health` - Basic health check
- `/debug` - Full config status (token, Redis, automation engine)
- `/test-slack` - Send test Slack message

## Features

1. **Dashboard** - View accounts, campaigns, pause/resume
2. **Insights** - Spend, impressions, clicks, CTR, CPC, CPM, reach, frequency
3. **Automations** - Schedule or threshold-based rules with Slack alerts
4. **Persistence** - Rules stored in Redis, survive redeploys

## Automation Metrics

- Spend
- CTR (%)
- CPC
- CPM
- Frequency
- Impressions
- Clicks
- Reach
