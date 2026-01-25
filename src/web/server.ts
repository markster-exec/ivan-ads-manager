import { config } from "dotenv";
config({ path: ".env.local" });

import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { MetaApiClient } from "../meta-client.js";
import { AuthManager } from "../utils/auth.js";
import { AutomationEngine } from "../automation/engine.js";
import { SlackNotifier } from "../notifications/slack.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ivan-ads-manager-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Extend session type
declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
  }
}

// Initialize Meta client and automation
let metaClient: MetaApiClient | null = null;
let automationEngine: AutomationEngine | null = null;
let slackNotifier: SlackNotifier | null = null;

async function initializeClients() {
  try {
    console.log("🔐 Initializing Meta API client...");
    const auth = AuthManager.fromEnvironment();
    await auth.refreshTokenIfNeeded();
    metaClient = new MetaApiClient(auth);
    console.log("✅ Meta API client ready");

    // Initialize Slack if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      slackNotifier = new SlackNotifier(process.env.SLACK_WEBHOOK_URL);
      console.log("✅ Slack notifier ready");
    }

    // Initialize automation engine
    automationEngine = new AutomationEngine(metaClient, slackNotifier);
    await automationEngine.start();
    console.log("✅ Automation engine started");

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize clients:", error);
    return false;
  }
}

// Auth middleware
function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: metaClient ? "healthy" : "initializing",
    timestamp: new Date().toISOString(),
  });
});

// Test Slack endpoint
app.get("/test-slack", async (req, res) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.json({ success: false, error: "SLACK_WEBHOOK_URL not set" });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "🧪 Test message from Ivan Ads Manager!",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "✅ Slack Integration Working!", emoji: true }
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: "This is a test message from *Ivan Ads Manager*.\n\nIf you see this, Slack notifications are configured correctly!" }
          }
        ]
      }),
    });

    const text = await response.text();
    res.json({
      success: response.ok,
      status: response.status,
      response: text,
      webhookConfigured: webhookUrl.substring(0, 40) + "..."
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// Debug endpoint to check configuration
app.get("/debug", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    env: {
      META_ACCESS_TOKEN: token ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : "NOT SET",
      META_APP_ID: process.env.META_APP_ID ? "SET" : "NOT SET",
      META_APP_SECRET: process.env.META_APP_SECRET ? "SET" : "NOT SET",
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD ? "SET" : "NOT SET",
    },
    metaClientInitialized: !!metaClient,
    automationEngine: automationEngine ? {
      initialized: true,
      usingRedis: automationEngine.isUsingRedis(),
      rulesCount: automationEngine.getAllRules().length,
    } : { initialized: false },
    redisUrl: process.env.REDIS_URL ? "SET" : "NOT SET",
  };

  // Try to validate token with Meta API
  if (token && metaClient) {
    try {
      const accounts = await metaClient.getAdAccounts();
      debugInfo.metaApiTest = {
        success: true,
        accountCount: accounts.length,
        accounts: accounts.map((a: any) => ({ id: a.id, name: a.name })),
      };
    } catch (error: any) {
      debugInfo.metaApiTest = {
        success: false,
        error: error.message,
        details: error.response?.data || error.cause || "No additional details",
      };
    }
  } else if (token && !metaClient) {
    // Try to make a direct API call to test the token
    try {
      const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${token}`);
      const data = await response.json();
      debugInfo.directApiTest = {
        success: response.ok,
        data: data,
      };
    } catch (error: any) {
      debugInfo.directApiTest = {
        success: false,
        error: error.message,
      };
    }
  }

  res.json(debugInfo);
});

// Login routes
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.DASHBOARD_PASSWORD || "admin";

  if (password === correctPassword) {
    req.session.authenticated = true;
    res.redirect("/");
  } else {
    res.render("login", { error: "Invalid password" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Dashboard routes (protected)
app.get("/", requireAuth, async (req, res) => {
  try {
    if (!metaClient) {
      return res.render("error", { message: "Meta API client not initialized" });
    }

    const accounts = await metaClient.getAdAccounts();
    res.render("dashboard", { accounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.render("error", { message: "Failed to fetch ad accounts" });
  }
});

app.get("/account/:accountId", requireAuth, async (req, res) => {
  try {
    if (!metaClient) {
      return res.render("error", { message: "Meta API client not initialized" });
    }

    const { accountId } = req.params;
    const campaignsResult = await metaClient.getCampaigns(accountId);

    // Get basic account info from the campaigns response or accounts list
    const accounts = await metaClient.getAdAccounts();
    const account = accounts.find((a: any) => a.id === accountId || a.id === `act_${accountId}`);

    res.render("account", {
      accountId,
      account,
      campaigns: campaignsResult.data
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    res.render("error", { message: "Failed to fetch campaigns" });
  }
});

app.get("/account/:accountId/insights", requireAuth, async (req, res) => {
  try {
    if (!metaClient) {
      return res.render("error", { message: "Meta API client not initialized" });
    }

    const { accountId } = req.params;
    const datePreset = (req.query.date_preset as string) || "last_7d";
    const formattedAccountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

    const insightsResult = await metaClient.getInsights(formattedAccountId, {
      level: "account",
      date_preset: datePreset,
      fields: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm", "reach", "frequency"],
    });

    res.render("insights", {
      accountId,
      insights: insightsResult.data,
      datePreset
    });
  } catch (error) {
    console.error("Error fetching insights:", error);
    res.render("error", { message: "Failed to fetch insights" });
  }
});

app.get("/account/:accountId/automations", requireAuth, async (req, res) => {
  try {
    if (!automationEngine) {
      return res.render("error", { message: "Automation engine not initialized" });
    }

    const { accountId } = req.params;
    const rules = automationEngine.getRulesForAccount(accountId);

    res.render("automations", { accountId, rules });
  } catch (error) {
    console.error("Error fetching automations:", error);
    res.render("error", { message: "Failed to fetch automations" });
  }
});

// API routes
app.post("/api/campaign/:campaignId/pause", requireAuth, async (req, res) => {
  try {
    if (!metaClient) {
      return res.status(503).json({ error: "Meta API client not initialized" });
    }

    const { campaignId } = req.params;
    await metaClient.updateCampaign(campaignId, { status: "PAUSED" });

    if (slackNotifier) {
      await slackNotifier.sendAlert({
        type: "action",
        title: "Campaign Paused",
        message: `Campaign ${campaignId} was paused via dashboard`,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error pausing campaign:", error);
    res.status(500).json({ error: "Failed to pause campaign" });
  }
});

app.post("/api/campaign/:campaignId/resume", requireAuth, async (req, res) => {
  try {
    if (!metaClient) {
      return res.status(503).json({ error: "Meta API client not initialized" });
    }

    const { campaignId } = req.params;
    await metaClient.updateCampaign(campaignId, { status: "ACTIVE" });

    if (slackNotifier) {
      await slackNotifier.sendAlert({
        type: "action",
        title: "Campaign Resumed",
        message: `Campaign ${campaignId} was resumed via dashboard`,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error resuming campaign:", error);
    res.status(500).json({ error: "Failed to resume campaign" });
  }
});

app.post("/api/automations", requireAuth, async (req, res) => {
  try {
    if (!automationEngine) {
      return res.status(503).json({ error: "Automation engine not initialized" });
    }

    const rule = req.body;
    const id = await automationEngine.addRule(rule);
    res.json({ success: true, id });
  } catch (error) {
    console.error("Error creating automation:", error);
    res.status(500).json({ error: "Failed to create automation" });
  }
});

app.delete("/api/automations/:ruleId", requireAuth, async (req, res) => {
  try {
    if (!automationEngine) {
      return res.status(503).json({ error: "Automation engine not initialized" });
    }

    const { ruleId } = req.params;
    await automationEngine.removeRule(ruleId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting automation:", error);
    res.status(500).json({ error: "Failed to delete automation" });
  }
});

app.post("/api/automations/:ruleId/toggle", requireAuth, async (req, res) => {
  try {
    if (!automationEngine) {
      return res.status(503).json({ error: "Automation engine not initialized" });
    }

    const { ruleId } = req.params;
    await automationEngine.toggleRule(ruleId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error toggling automation:", error);
    res.status(500).json({ error: "Failed to toggle automation" });
  }
});

// Manual trigger for testing
app.post("/api/automations/:ruleId/run", requireAuth, async (req, res) => {
  try {
    if (!automationEngine) {
      return res.status(503).json({ error: "Automation engine not initialized" });
    }

    const { ruleId } = req.params;
    await automationEngine.runRule(ruleId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error running automation:", error);
    res.status(500).json({ error: "Failed to run automation" });
  }
});

// Start server
async function main() {
  console.log("🚀 Starting Ivan Ads Manager...");

  const initialized = await initializeClients();
  if (!initialized) {
    console.error("⚠️ Starting server without Meta API connection");
  }

  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📋 Dashboard password: ${process.env.DASHBOARD_PASSWORD ? "[SET]" : "admin (default)"}`);
  });
}

main().catch(console.error);
