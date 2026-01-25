import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import type { MetaApiClient } from "../meta-client.js";
import type { SlackNotifier } from "../notifications/slack.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AutomationRule {
  id: string;
  name: string;
  accountId: string;
  enabled: boolean;
  trigger: {
    type: "schedule" | "threshold";
    cron?: string;
    metric?: string;
    operator?: "gt" | "lt" | "eq";
    value?: number;
    checkInterval?: number;
  };
  conditions: {
    campaignStatus?: "ACTIVE" | "PAUSED" | "ANY";
    campaignNameContains?: string;
    minSpend?: number;
    maxSpend?: number;
  };
  actions: {
    type: "pause" | "resume" | "notify" | "adjustBudget";
    budgetChange?: number;
    notifyMessage?: string;
  }[];
  createdAt: string;
  lastRunAt?: string;
}

export class AutomationEngine {
  private rules: Map<string, AutomationRule> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private intervalJobs: Map<string, NodeJS.Timeout> = new Map();
  private dataPath: string;
  private metaClient: MetaApiClient;
  private slackNotifier: SlackNotifier | null;

  constructor(metaClient: MetaApiClient, slackNotifier: SlackNotifier | null = null) {
    this.metaClient = metaClient;
    this.slackNotifier = slackNotifier;
    this.dataPath = path.join(__dirname, "../../data/automations.json");
  }

  async start(): Promise<void> {
    await this.loadRules();
    this.scheduleAllRules();
    console.log(`📋 Loaded ${this.rules.size} automation rules`);
  }

  private async loadRules(): Promise<void> {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, "utf-8");
        const rules: AutomationRule[] = JSON.parse(data);
        rules.forEach((rule) => this.rules.set(rule.id, rule));
      }
    } catch (error) {
      console.error("Error loading automation rules:", error);
    }
  }

  private saveRules(): void {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const rules = Array.from(this.rules.values());
      fs.writeFileSync(this.dataPath, JSON.stringify(rules, null, 2));
    } catch (error) {
      console.error("Error saving automation rules:", error);
    }
  }

  private scheduleAllRules(): void {
    this.rules.forEach((rule) => {
      if (rule.enabled) {
        this.scheduleRule(rule);
      }
    });
  }

  private scheduleRule(rule: AutomationRule): void {
    // Clear existing job if any
    this.unscheduleRule(rule.id);

    if (!rule.enabled) return;

    if (rule.trigger.type === "schedule" && rule.trigger.cron) {
      try {
        const job = cron.schedule(rule.trigger.cron, () => {
          this.executeRule(rule).catch(console.error);
        });
        this.cronJobs.set(rule.id, job);
        console.log(`⏰ Scheduled rule "${rule.name}" with cron: ${rule.trigger.cron}`);
      } catch (error) {
        console.error(`Error scheduling rule "${rule.name}":`, error);
      }
    } else if (rule.trigger.type === "threshold" && rule.trigger.checkInterval) {
      const intervalMs = rule.trigger.checkInterval * 60 * 1000;
      const job = setInterval(() => {
        this.executeRule(rule).catch(console.error);
      }, intervalMs);
      this.intervalJobs.set(rule.id, job);
      console.log(`🔄 Scheduled rule "${rule.name}" every ${rule.trigger.checkInterval} minutes`);
    }
  }

  private unscheduleRule(ruleId: string): void {
    const cronJob = this.cronJobs.get(ruleId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(ruleId);
    }

    const intervalJob = this.intervalJobs.get(ruleId);
    if (intervalJob) {
      clearInterval(intervalJob);
      this.intervalJobs.delete(ruleId);
    }
  }

  private async executeRule(rule: AutomationRule): Promise<void> {
    console.log(`🔧 Executing rule: ${rule.name}`);

    try {
      // Get campaigns for the account
      const campaignsResult = await this.metaClient.getCampaigns(rule.accountId);
      const campaigns = campaignsResult.data;

      // Filter campaigns based on conditions
      const matchingCampaigns = campaigns.filter((campaign: any) => {
        if (rule.conditions.campaignStatus && rule.conditions.campaignStatus !== "ANY") {
          if (campaign.status !== rule.conditions.campaignStatus) {
            return false;
          }
        }

        if (rule.conditions.campaignNameContains) {
          if (!campaign.name?.toLowerCase().includes(rule.conditions.campaignNameContains.toLowerCase())) {
            return false;
          }
        }

        return true;
      });

      // Check threshold conditions if applicable
      let triggeredCampaigns = matchingCampaigns;
      if (rule.trigger.type === "threshold" && rule.trigger.metric) {
        triggeredCampaigns = [];

        for (const campaign of matchingCampaigns) {
          try {
            const insightsResult = await this.metaClient.getInsights(campaign.id, {
              level: "campaign",
              date_preset: "today",
              fields: [rule.trigger.metric!],
            });
            const insights = insightsResult.data;

            if (insights && insights.length > 0) {
              const metricValue = parseFloat((insights[0] as any)[rule.trigger.metric!]) || 0;
              const thresholdMet = this.checkThreshold(
                metricValue,
                rule.trigger.operator!,
                rule.trigger.value!
              );

              if (thresholdMet) {
                triggeredCampaigns.push(campaign);
              }
            }
          } catch (error) {
            console.error(`Error checking insights for campaign ${campaign.id}:`, error);
          }
        }
      }

      // Execute actions for triggered campaigns
      for (const campaign of triggeredCampaigns) {
        for (const action of rule.actions) {
          await this.executeAction(action, campaign, rule);
        }
      }

      // Update last run time
      rule.lastRunAt = new Date().toISOString();
      this.rules.set(rule.id, rule);
      this.saveRules();
    } catch (error) {
      console.error(`Error executing rule "${rule.name}":`, error);
    }
  }

  private checkThreshold(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case "gt":
        return value > threshold;
      case "lt":
        return value < threshold;
      case "eq":
        return value === threshold;
      default:
        return false;
    }
  }

  private async executeAction(
    action: AutomationRule["actions"][0],
    campaign: any,
    rule: AutomationRule
  ): Promise<void> {
    console.log(`  ➡️ Executing action: ${action.type} for campaign ${campaign.name}`);

    switch (action.type) {
      case "pause":
        await this.metaClient.updateCampaign(campaign.id, { status: "PAUSED" });
        if (this.slackNotifier) {
          await this.slackNotifier.sendAlert({
            type: "action",
            title: "Campaign Auto-Paused",
            message: `Rule "${rule.name}" paused campaign "${campaign.name}"`,
          });
        }
        break;

      case "resume":
        await this.metaClient.updateCampaign(campaign.id, { status: "ACTIVE" });
        if (this.slackNotifier) {
          await this.slackNotifier.sendAlert({
            type: "action",
            title: "Campaign Auto-Resumed",
            message: `Rule "${rule.name}" resumed campaign "${campaign.name}"`,
          });
        }
        break;

      case "notify":
        if (this.slackNotifier) {
          await this.slackNotifier.sendAlert({
            type: "alert",
            title: rule.name,
            message: action.notifyMessage?.replace("{campaign_name}", campaign.name) ||
                    `Alert triggered for campaign "${campaign.name}"`,
          });
        }
        break;

      case "adjustBudget":
        // Budget adjustment would need to update ad sets
        // This is more complex - skip for MVP
        console.log("  ⚠️ Budget adjustment not implemented in MVP");
        break;
    }
  }

  // Public API

  addRule(ruleData: Omit<AutomationRule, "id" | "createdAt">): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rule: AutomationRule = {
      ...ruleData,
      id,
      createdAt: new Date().toISOString(),
    };

    this.rules.set(id, rule);
    this.saveRules();

    if (rule.enabled) {
      this.scheduleRule(rule);
    }

    console.log(`✅ Added automation rule: ${rule.name}`);
    return id;
  }

  removeRule(ruleId: string): void {
    this.unscheduleRule(ruleId);
    this.rules.delete(ruleId);
    this.saveRules();
    console.log(`🗑️ Removed automation rule: ${ruleId}`);
  }

  toggleRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      this.rules.set(ruleId, rule);
      this.saveRules();

      if (rule.enabled) {
        this.scheduleRule(rule);
      } else {
        this.unscheduleRule(ruleId);
      }

      console.log(`🔄 Rule "${rule.name}" is now ${rule.enabled ? "enabled" : "disabled"}`);
    }
  }

  async runRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      await this.executeRule(rule);
    }
  }

  getRulesForAccount(accountId: string): AutomationRule[] {
    return Array.from(this.rules.values()).filter(
      (rule) => rule.accountId === accountId || rule.accountId === `act_${accountId}`
    );
  }

  getAllRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  stop(): void {
    this.cronJobs.forEach((job) => job.stop());
    this.intervalJobs.forEach((job) => clearInterval(job));
    this.cronJobs.clear();
    this.intervalJobs.clear();
    console.log("⏹️ Automation engine stopped");
  }
}
