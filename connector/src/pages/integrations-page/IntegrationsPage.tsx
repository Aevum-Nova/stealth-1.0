import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ExternalLink,
  MessageSquare,
  Shield,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const integrations = [
  {
    name: "Slack",
    logo: "/connector-icons/slack.svg",
    status: "active" as const,
    description:
      "Connect your Slack workspace to automatically ingest customer conversations from selected channels. Vector monitors messages in real time and feeds them into the synthesis pipeline.",
    features: [
      "Real-time message ingestion",
      "Channel-level filtering",
      "Thread context preservation",
      "Public & private channels",
      "OAuth 2.0 authentication",
    ],
    category: "Communication",
  },
  {
    name: "GitHub",
    logo: "/connector-icons/github.svg",
    status: "active" as const,
    description:
      "Connect your GitHub repository so the Vector agent can create pull requests from approved feature requests. The agent reads your codebase and generates implementation code.",
    features: [
      "Automated PR creation",
      "Branch management",
      "Codebase-aware generation",
      "PR descriptions with context",
      "OAuth App authorization",
    ],
    category: "Development",
  },
  {
    name: "Microsoft Teams",
    logo: "/connector-icons/teams.svg",
    status: "coming-soon" as const,
    description:
      "Ingest customer conversations from Microsoft Teams channels and chats. Full support for team channels, group chats, and meeting transcripts.",
    features: [
      "Channel & chat monitoring",
      "Meeting transcript ingestion",
      "Azure AD integration",
      "Selective channel import",
    ],
    category: "Communication",
  },
  {
    name: "ServiceNow",
    logo: "/connector-icons/servicenow.svg",
    status: "coming-soon" as const,
    description:
      "Pull customer support tickets and feedback from ServiceNow instances. Vector analyzes ticket patterns to identify feature gaps and recurring issues.",
    features: [
      "Ticket ingestion",
      "Custom field mapping",
      "Category filtering",
      "Historical data import",
    ],
    category: "Support",
  },
  {
    name: "Zendesk",
    logo: "/connector-icons/zendesk.svg",
    status: "coming-soon" as const,
    description:
      "Connect Zendesk to pull support tickets, satisfaction surveys, and help center feedback. Analyze support trends to surface product improvement opportunities.",
    features: [
      "Ticket & conversation sync",
      "CSAT data ingestion",
      "Tag-based filtering",
      "Help center feedback",
    ],
    category: "Support",
  },
  {
    name: "Intercom",
    logo: "/connector-icons/intercom.svg",
    status: "coming-soon" as const,
    description:
      "Ingest Intercom conversations, product tours feedback, and survey responses. Ideal for teams using Intercom as their primary customer communication platform.",
    features: [
      "Live chat ingestion",
      "Survey response import",
      "User segment filtering",
      "Conversation tagging",
    ],
    category: "Communication",
  },
  {
    name: "Figma",
    logo: "/connector-icons/figma.svg",
    status: "coming-soon" as const,
    description:
      "Import design feedback and comments from Figma files. Capture design review discussions and user testing notes directly from your design workflow.",
    features: [
      "Comment ingestion",
      "File & project filtering",
      "Design review tracking",
      "Annotation context",
    ],
    category: "Design",
  },
  {
    name: "Google Forms",
    logo: "/connector-icons/google_forms.svg",
    status: "coming-soon" as const,
    description:
      "Import customer survey responses and feedback form submissions from Google Forms. Analyze structured and unstructured responses at scale.",
    features: [
      "Form response ingestion",
      "Multi-form support",
      "Automatic field mapping",
      "Scheduled sync",
    ],
    category: "Surveys",
  },
] as const;

const capabilities = [
  {
    icon: Zap,
    title: "Real-time ingestion",
    description:
      "Active connectors stream data in real time. No polling, no delays.",
  },
  {
    icon: Shield,
    title: "Secure by default",
    description:
      "OAuth 2.0 flows, encrypted at rest and in transit. SOC 2 compliant.",
  },
  {
    icon: MessageSquare,
    title: "Context preservation",
    description:
      "Thread context, timestamps, and author info are preserved for better synthesis.",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  const active = integrations.filter((i) => i.status === "active");
  const upcoming = integrations.filter((i) => i.status === "coming-soon");

  return (
    <main className="vector-integrations-page">
      <div className="vector-public-container">
        {/* Header */}
        <div className="vector-integrations-page-header">
          <Badge variant="teal">Integrations</Badge>
          <h1>Connect your entire stack</h1>
          <p>
            Vector plugs into the tools your team already uses. Feedback flows
            in automatically — no copy-paste, no context switching.
          </p>
        </div>

        {/* Capabilities strip — hidden for now */}

        {/* Active integrations */}
        <section className="vector-integrations-section">
          <h2>Active Integrations</h2>
          <div className="vector-integrations-detail-grid">
            {active.map((integration) => (
              <Card
                key={integration.name}
                className="vector-integration-detail-card"
              >
                <CardContent className="vector-integration-detail-content">
                  <div className="vector-integration-detail-header">
                    <div className="vector-integration-detail-logo">
                      <img src={integration.logo} alt="" />
                    </div>
                    <div>
                      <h3>{integration.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="success" className="text-[10px]">
                          Active
                        </Badge>
                        <span className="text-xs text-[#7d7d7d]">
                          {integration.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="vector-integration-detail-desc">
                    {integration.description}
                  </p>
                  <ul className="vector-integration-detail-features">
                    {integration.features.map((f) => (
                      <li key={f}>
                        <Check className="size-3.5 text-emerald-600 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/register">
                    <Button variant="outline" size="sm" className="mt-4 w-full">
                      Set up {integration.name}
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Coming soon */}
        <section className="vector-integrations-section">
          <h2>Coming Soon</h2>
          <p className="vector-integrations-section-desc">
            These integrations are in development. Sign up to be notified when
            they launch.
          </p>
          <div className="vector-integrations-upcoming-grid">
            {upcoming.map((integration) => (
              <Card
                key={integration.name}
                className="vector-integration-upcoming-card"
              >
                <CardContent className="vector-integration-upcoming-content">
                  <div className="vector-integration-upcoming-top">
                    <div className="vector-integration-upcoming-logo">
                      <img src={integration.logo} alt="" />
                    </div>
                    <Badge variant="ghost" className="text-[10px]">
                      {integration.category}
                    </Badge>
                  </div>
                  <h3>{integration.name}</h3>
                  <p>{integration.description}</p>
                  <ul className="vector-integration-upcoming-features">
                    {integration.features.slice(0, 3).map((f) => (
                      <li key={f}>
                        <Check className="size-3 text-[#a1a1aa] shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Manual ingestion */}
        <section className="vector-integrations-manual">
          <Card className="vector-integrations-manual-card">
            <CardContent className="vector-integrations-manual-content">
              <div>
                <h3>Don't see your tool?</h3>
                <p>
                  Use manual ingestion to upload customer data from any source.
                  Supports CSV, JSON, and plain text formats.
                </p>
              </div>
              <div className="vector-integrations-manual-actions">
                <Link to="/docs">
                  <Button variant="outline" size="sm">
                    Learn about ingestion
                    <ExternalLink className="size-3.5" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">
                    Get started
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
