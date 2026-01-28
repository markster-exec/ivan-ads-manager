# AGENTS

Repository-specific instructions for ivan-ads-manager. Global standards in `~/.codex/AGENTS.md`.

## Mission

Meta Ads management tool with web dashboard, automation rules, and Slack notifications.

**Live:** https://ivan-ads-manager-production.up.railway.app

## Map

| Directory | Purpose |
|-----------|---------|
| `src/index.ts` | MCP server entry |
| `src/meta-client.ts` | Meta Marketing API client |
| `src/web/server.ts` | Express web server |
| `src/web/views/` | EJS templates |
| `src/automation/engine.ts` | Rules engine (Redis-backed) |
| `src/notifications/slack.ts` | Slack webhooks |

## Commands

```bash
npm run dev:web      # Web dashboard (dev)
npm run start:web    # Web dashboard (prod)
npm run dev          # MCP server
npm run list:tools   # List MCP tools
```

## Debug Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Health check |
| `/debug` | Full config status |
| `/test-slack` | Test Slack notification |

## Environment Variables

**Required:**
- `META_ACCESS_TOKEN` - Meta API token (starts with EAA...)

**Dashboard:**
- `DASHBOARD_PASSWORD` - Web access password
- `SESSION_SECRET` - Session encryption

**Optional:**
- `SLACK_WEBHOOK_URL` - Slack notifications
- `REDIS_URL` - Automation persistence (auto-set by Railway)

## Architecture

- Node.js app on Railway
- Redis for automation rule storage
- nixpacks with tsx runtime (no build step)

## Features

1. Dashboard - View accounts, campaigns, pause/resume
2. Insights - Spend, impressions, clicks, CTR, CPC, CPM
3. Automations - Schedule or threshold-based rules
4. Persistence - Rules survive redeploys
