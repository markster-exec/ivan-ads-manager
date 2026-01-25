interface SlackAlert {
  type: "alert" | "action" | "report";
  title: string;
  message: string;
  fields?: { name: string; value: string }[];
  color?: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: {
    type: string;
    text: string;
  }[];
}

export class SlackNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendAlert(alert: SlackAlert): Promise<void> {
    const color = this.getColor(alert.type, alert.color);
    const emoji = this.getEmoji(alert.type);

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${alert.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: alert.message,
        },
      },
    ];

    if (alert.fields && alert.fields.length > 0) {
      blocks.push({
        type: "section",
        fields: alert.fields.map((f) => ({
          type: "mrkdwn",
          text: `*${f.name}:*\n${f.value}`,
        })),
      });
    }

    blocks.push({
      type: "context",
      text: {
        type: "mrkdwn",
        text: `Ivan Ads Manager • ${new Date().toLocaleString()}`,
      },
    });

    const payload = {
      attachments: [
        {
          color,
          blocks,
        },
      ],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }

      console.log(`📤 Slack notification sent: ${alert.title}`);
    } catch (error) {
      console.error("Error sending Slack notification:", error);
    }
  }

  async sendPerformanceReport(data: {
    accountName: string;
    period: string;
    metrics: {
      spend: string;
      impressions: string;
      clicks: string;
      ctr: string;
      conversions?: string;
    };
    topCampaigns?: { name: string; spend: string; ctr: string }[];
  }): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Performance Report: ${data.accountName}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Period:* ${data.period}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Spend:*\n${data.metrics.spend}` },
          { type: "mrkdwn", text: `*Impressions:*\n${data.metrics.impressions}` },
          { type: "mrkdwn", text: `*Clicks:*\n${data.metrics.clicks}` },
          { type: "mrkdwn", text: `*CTR:*\n${data.metrics.ctr}` },
        ],
      },
    ];

    if (data.topCampaigns && data.topCampaigns.length > 0) {
      const campaignList = data.topCampaigns
        .map((c) => `• *${c.name}* - ${c.spend} (${c.ctr} CTR)`)
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top Campaigns:*\n${campaignList}`,
        },
      });
    }

    blocks.push({
      type: "context",
      text: {
        type: "mrkdwn",
        text: `Ivan Ads Manager • ${new Date().toLocaleString()}`,
      },
    });

    const payload = {
      attachments: [
        {
          color: "#0066CC",
          blocks,
        },
      ],
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.status}`);
      }

      console.log(`📤 Performance report sent to Slack`);
    } catch (error) {
      console.error("Error sending Slack report:", error);
    }
  }

  private getColor(type: SlackAlert["type"], customColor?: string): string {
    if (customColor) return customColor;

    switch (type) {
      case "alert":
        return "#FFA500"; // Orange
      case "action":
        return "#36A64F"; // Green
      case "report":
        return "#0066CC"; // Blue
      default:
        return "#808080"; // Gray
    }
  }

  private getEmoji(type: SlackAlert["type"]): string {
    switch (type) {
      case "alert":
        return "⚠️";
      case "action":
        return "✅";
      case "report":
        return "📊";
      default:
        return "📋";
    }
  }
}
