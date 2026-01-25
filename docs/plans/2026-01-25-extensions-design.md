# Ivan Ads Manager - Extensions Design

## Overview

Extending the meta-mcp MCP server with:
1. Web dashboard for managing ads via browser
2. Automation rules engine for automated campaign actions
3. Slack notifications for alerts and reports

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Ivan Ads Manager                       │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────┐   ┌──────────────┐   ┌────────────┐ │
│  │ Web Dashboard │   │  Automation  │   │   Slack    │ │
│  │   (Express)   │   │    Engine    │   │  Notifier  │ │
│  └───────┬───────┘   └──────┬───────┘   └─────┬──────┘ │
│          │                  │                 │         │
│          └──────────────────┼─────────────────┘         │
│                             │                            │
│                    ┌────────┴────────┐                  │
│                    │  MetaApiClient  │                  │
│                    │ (existing code) │                  │
│                    └────────┬────────┘                  │
│                             │                            │
└─────────────────────────────┼───────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Meta Marketing   │
                    │       API         │
                    └───────────────────┘
```

## 1. Web Dashboard

### Stack
- Express.js (staying in TypeScript ecosystem)
- EJS templates (simple server-side rendering)
- TailwindCSS (via CDN for simplicity)

### Authentication
- Simple shared password via `DASHBOARD_PASSWORD` env var
- Session-based auth with express-session
- Password checked on login, session cookie maintained

### Routes

```
GET  /login              - Login page
POST /login              - Submit password
GET  /                   - Dashboard home (list accounts)
GET  /account/:id        - Account overview
GET  /account/:id/campaigns      - List campaigns
GET  /account/:id/insights       - Performance analytics
GET  /account/:id/automations    - Manage automation rules
POST /account/:id/automations    - Create automation rule
POST /api/campaign/:id/pause     - Pause campaign
POST /api/campaign/:id/resume    - Resume campaign
GET  /api/health                 - Health check
```

### Views

1. **Login** - Simple password form
2. **Dashboard Home** - List all ad accounts with summary metrics
3. **Account Overview** - Campaigns table, spend, performance summary
4. **Campaign Detail** - Full insights, ads, ad sets
5. **Automations** - List rules, create new rules

## 2. Automation Rules Engine

### Rule Structure

```typescript
interface AutomationRule {
  id: string;
  name: string;
  accountId: string;
  enabled: boolean;
  trigger: {
    type: 'schedule' | 'threshold';
    // For schedule
    cron?: string; // e.g., "0 9 * * *" (9 AM daily)
    // For threshold
    metric?: string;
    operator?: 'gt' | 'lt' | 'eq';
    value?: number;
    checkInterval?: number; // minutes
  };
  conditions: {
    campaignStatus?: 'ACTIVE' | 'PAUSED' | 'ANY';
    campaignNameContains?: string;
    minSpend?: number;
    maxSpend?: number;
  };
  actions: {
    type: 'pause' | 'resume' | 'notify' | 'adjustBudget';
    budgetChange?: number; // percentage for adjustBudget
    notifyMessage?: string;
  }[];
  createdAt: Date;
  lastRunAt?: Date;
}
```

### Storage
- JSON file storage (simple, works on Railway)
- `data/automations.json`

### Scheduler
- Node-cron for scheduled rules
- Polling interval for threshold rules

### MVP Rules

1. **Daily Spend Alert** - Notify if daily spend exceeds threshold
2. **Low Performance Auto-Pause** - Pause campaigns with CTR < X
3. **Budget Depletion Warning** - Alert when 80% of budget spent
4. **Weekly Performance Report** - Send summary to Slack every Monday

## 3. Slack Notifications

### Integration
- Slack Incoming Webhook
- `SLACK_WEBHOOK_URL` env var

### Message Types

1. **Alerts** - Immediate notifications (spend threshold, errors)
2. **Reports** - Scheduled summaries (daily/weekly performance)
3. **Actions** - Confirmation of automated actions (campaign paused)

### Message Format

```typescript
interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}
```

Use Slack Block Kit for rich formatting:
- Campaign summaries with metrics
- Action buttons (link to dashboard)
- Color-coded alerts (green/yellow/red)

## File Structure

```
src/
├── web/
│   ├── server.ts          # Express app setup
│   ├── routes/
│   │   ├── auth.ts        # Login/logout
│   │   ├── dashboard.ts   # Main dashboard routes
│   │   ├── api.ts         # API endpoints
│   │   └── automations.ts # Automation management
│   ├── views/
│   │   ├── layout.ejs
│   │   ├── login.ejs
│   │   ├── dashboard.ejs
│   │   ├── account.ejs
│   │   └── automations.ejs
│   └── public/
│       └── style.css
├── automation/
│   ├── engine.ts          # Rule evaluation engine
│   ├── scheduler.ts       # Cron job management
│   └── rules.ts           # Rule definitions and storage
├── notifications/
│   ├── slack.ts           # Slack webhook client
│   └── templates.ts       # Message templates
└── data/
    └── automations.json   # Rule storage
```

## Environment Variables

```bash
# Existing
META_ACCESS_TOKEN=
META_APP_ID=
META_APP_SECRET=

# New for dashboard
DASHBOARD_PASSWORD=your-shared-password
SESSION_SECRET=random-session-secret
PORT=3000

# New for Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

## Implementation Order

1. **Web Dashboard MVP**
   - Express server setup
   - Login page with password auth
   - Dashboard home with account list
   - Account detail with campaigns

2. **Automation Engine**
   - Rule storage (JSON file)
   - Scheduled rule execution
   - Basic actions (pause/resume)

3. **Slack Integration**
   - Webhook client
   - Alert notifications
   - Add notify action to automation

4. **Polish**
   - Better error handling
   - Loading states
   - Responsive design

## Deployment

### Railway
- Same deployment pattern as SEO tool
- `npm run start:web` script for web server
- Environment variables in Railway dashboard

### Procfile
```
web: npm run start:web
```

## Next Steps

1. Add web dependencies (express, ejs, express-session)
2. Create Express server in `src/web/server.ts`
3. Implement auth middleware
4. Build dashboard views
5. Add automation engine
6. Integrate Slack notifications
