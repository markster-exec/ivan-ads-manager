# Ivan Ads Manager

Meta Ads management tool with web dashboard, automation rules, and Slack notifications. Built on top of [meta-ads-mcp](https://github.com/brijr/meta-mcp).

## Live Demo

**https://ivan-ads-manager-production.up.railway.app**

## Features

### Web Dashboard
- View all Meta ad accounts
- List campaigns with status, objective, daily budget
- Pause/Resume campaigns with one click
- Performance insights (spend, impressions, clicks, CTR, CPC, CPM, reach, frequency)
- Password-protected access

### Automation Rules
- **Schedule-based triggers** - Run at specific times (cron)
- **Threshold-based triggers** - When metrics exceed values
- **Supported metrics:** Spend, CTR, CPC, CPM, Frequency, Impressions, Clicks, Reach
- **Actions:** Send Slack notification, Pause campaign, Resume campaign
- **Persistence:** Rules stored in Redis, survive redeploys

### Slack Notifications
- Real-time alerts when rules trigger
- Action confirmations (campaign paused/resumed)
- Test endpoint to verify integration

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/markster-exec/ivan-ads-manager.git
cd ivan-ads-manager
npm install --ignore-scripts
```

### 2. Configure Environment

Create `.env.local`:

```bash
# Required
META_ACCESS_TOKEN=EAAxxxxx...

# Dashboard
DASHBOARD_PASSWORD=your-password
SESSION_SECRET=random-string

# Optional
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
REDIS_URL=redis://localhost:6379
```

### 3. Run

```bash
npm run dev:web
```

Open http://localhost:3000

## Deployment (Railway)

### Services Required
1. **Node.js app** - The main application
2. **Redis** - For automation persistence

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| META_ACCESS_TOKEN | Yes | Meta API token (starts with EAA...) |
| DASHBOARD_PASSWORD | Yes | Login password |
| SESSION_SECRET | Yes | Session encryption key |
| SLACK_WEBHOOK_URL | No | Slack webhook for notifications |
| REDIS_URL | No | Auto-set when adding Railway Redis |

### Deploy Steps

1. Create new Railway project
2. Add service from GitHub repo
3. Add Redis database
4. Set environment variables
5. Deploy

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Dashboard (requires login) |
| `/login` | Login page |
| `/health` | Health check |
| `/debug` | Configuration status |
| `/test-slack` | Test Slack integration |
| `/account/:id` | Account campaigns |
| `/account/:id/insights` | Performance metrics |
| `/account/:id/automations` | Manage rules |

## Getting Meta Access Token

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create or select an app
3. Go to **Tools** → **Graph API Explorer**
4. Select your app
5. Generate Access Token with permissions:
   - `ads_management`
   - `ads_read`
   - `business_management`
6. Copy the token (starts with `EAA...`)

## Setting Up Slack

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create New App → From scratch
3. Enable **Incoming Webhooks**
4. Add webhook to workspace
5. Copy webhook URL
6. Add to `SLACK_WEBHOOK_URL` environment variable

## Project Structure

```
src/
├── index.ts              # MCP server (for Claude integration)
├── meta-client.ts        # Meta Marketing API client
├── web/
│   ├── server.ts         # Express web server
│   └── views/            # EJS templates
├── automation/
│   └── engine.ts         # Automation rules engine
└── notifications/
    └── slack.ts          # Slack webhook client
```

## Commands

```bash
npm run dev:web      # Start web dashboard (development)
npm run start:web    # Start web dashboard (production)
npm run dev          # Start MCP server
```

## License

MIT

## Credits

Built on [meta-ads-mcp](https://github.com/brijr/meta-mcp) by [brijr](https://github.com/brijr).

---

*Last updated: 2026-01-27 by Claude (Opus 4.5)*
