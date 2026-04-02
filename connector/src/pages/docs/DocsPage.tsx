import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Code2,
  GitPullRequest,
  Layers,
  MessageSquareText,
  Plug,
  Search,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Docs sidebar sections                                              */
/* ------------------------------------------------------------------ */

const sections = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    content: {
      heading: "Getting Started with Vector",
      body: `Vector helps product teams turn raw customer conversations into structured feature requests and pull requests — automatically.

To get started, create your account and connect your first data source. Vector currently supports Slack as a live connector, with Teams, ServiceNow, Zendesk, and more coming soon. You can also manually upload data via CSV, JSON, or plain text.`,
      steps: [
        {
          title: "1. Create your account",
          description:
            "Sign up at Vector and complete the onboarding flow. You'll be guided through connecting your first data source.",
        },
        {
          title: "2. Connect a data source",
          description:
            "Navigate to Connectors and add your Slack workspace. Authorize Vector to read messages from the channels you choose.",
        },
        {
          title: "3. Run your first synthesis",
          description:
            "Once data is flowing in, trigger a synthesis run. Vector will analyze conversations, extract signals, and generate feature requests.",
        },
        {
          title: "4. Review signals and feature requests",
          description:
            "Browse detected signals in the Signals tab. Promoted signals become Feature Requests with full product context pages.",
        },
        {
          title: "5. Ship with the Agent",
          description:
            "When you're ready to act on a feature request, the Vector agent generates a pull request to your connected GitHub repository.",
        },
      ],
    },
  },
  {
    id: "connectors",
    title: "Connectors",
    icon: Plug,
    content: {
      heading: "Setting Up Connectors",
      body: `Connectors are the bridge between your communication tools and Vector. They stream customer conversations into the platform for analysis.

Currently, Vector supports Slack as a fully operational connector. When you set up a Slack connector, Vector listens to your selected channels and ingests messages in real time.`,
      steps: [
        {
          title: "Slack Connector",
          description:
            "Navigate to Connectors > New > Slack. Authorize via OAuth and select the channels to monitor. Vector will begin ingesting messages immediately. Public and private channels are supported.",
        },
        {
          title: "GitHub Connector",
          description:
            "Connect your GitHub repository so the Vector agent can create pull requests. Navigate to Connectors > New > GitHub and authorize the integration.",
        },
        {
          title: "Manual Ingestion",
          description:
            "For platforms without a live connector, use the Ingest page to upload CSV, JSON, or plain text files containing customer feedback.",
        },
        {
          title: "Coming Soon",
          description:
            "Microsoft Teams, ServiceNow, Zendesk, Intercom, Figma, and Google Forms connectors are in development. Sign up for early access.",
        },
      ],
    },
  },
  {
    id: "signals",
    title: "Signals",
    icon: Search,
    content: {
      heading: "Understanding Signals",
      body: `Signals are the atomic units of customer insight in Vector. When the synthesis engine processes ingested data, it identifies recurring themes, pain points, and requests — each captured as a signal.

Signals are scored by frequency, urgency, and impact. The dashboard gives you a real-time view of what customers are asking for, sorted by importance.`,
      steps: [
        {
          title: "Signal Detection",
          description:
            "Vector's AI analyzes ingested conversations and identifies patterns across messages. Similar requests are clustered into a single signal with supporting evidence.",
        },
        {
          title: "Signal Scoring",
          description:
            "Each signal is scored based on how often it appears, how urgent the customer language is, and the potential impact on your product. Higher scores mean higher priority.",
        },
        {
          title: "Signal Review",
          description:
            "Browse signals in the Signals tab. Each signal shows the original messages that contributed to it, the computed score, and an AI-generated summary.",
        },
        {
          title: "Promoting to Feature Requests",
          description:
            "When a signal is strong enough, promote it to a Feature Request. This creates a full product context page with requirements, scope, and implementation guidance.",
        },
      ],
    },
  },
  {
    id: "feature-requests",
    title: "Feature Requests",
    icon: Layers,
    content: {
      heading: "Feature Requests & Product Context",
      body: `Feature Requests in Vector are more than a title and description. Each request includes a full product context page — a living document that captures requirements, customer evidence, scope, and implementation notes.

Product context pages are designed to be the single source of truth for a feature. They combine the synthesized customer signal with your team's refinements.`,
      steps: [
        {
          title: "Product Context Pages",
          description:
            "Each feature request gets a dedicated page with AI-generated context: the problem, customer quotes, suggested scope, technical considerations, and acceptance criteria.",
        },
        {
          title: "Chat-Based Refinement",
          description:
            "Use the built-in chat to refine the feature request. Ask the agent to adjust scope, add requirements, or rephrase the description. Changes are reflected in real time.",
        },
        {
          title: "Approval Workflow",
          description:
            "When the feature request is ready, approve it to trigger the agent. The agent reads the product context and generates a pull request with the implementation.",
        },
        {
          title: "Tracking Status",
          description:
            "Feature requests track their lifecycle: Draft, In Review, Approved, In Progress, and Shipped. The dashboard shows a real-time overview of your pipeline.",
        },
      ],
    },
  },
  {
    id: "agent",
    title: "Agent & PRs",
    icon: GitPullRequest,
    content: {
      heading: "The Vector Agent",
      body: `The Vector Agent is the final step in the pipeline. Once a feature request is approved, the agent reads the product context page and generates a pull request to your connected GitHub repository.

The agent understands your codebase context, the feature requirements, and the customer evidence. It generates meaningful, well-structured code changes.`,
      steps: [
        {
          title: "How the Agent Works",
          description:
            "The agent reads the product context page, analyzes your repository structure, and generates code changes that implement the feature. It creates a PR with a descriptive title, body, and linked feature request.",
        },
        {
          title: "Code Generation",
          description:
            "The agent generates production-quality code based on the patterns in your repository. It respects your coding style, file structure, and testing conventions.",
        },
        {
          title: "Review & Iterate",
          description:
            "Review the generated PR like any other. Leave comments, request changes, or merge directly. You can also go back to the product context page to refine requirements and regenerate.",
        },
        {
          title: "GitHub Integration",
          description:
            "PRs are created on a feature branch in your connected repository. The PR body includes the full context from the feature request, customer evidence, and implementation notes.",
        },
      ],
    },
  },
  {
    id: "data-ingestion",
    title: "Data Ingestion",
    icon: Upload,
    content: {
      heading: "Manual Data Ingestion",
      body: `Not all customer feedback lives in Slack. Vector's ingestion system lets you upload data from any source — CSV files, JSON exports, or plain text documents.

This is useful for importing historical data, feedback from surveys, support tickets exported from other tools, or notes from customer calls.`,
      steps: [
        {
          title: "Supported Formats",
          description:
            "Upload CSV, JSON, or plain text files. For CSV files, Vector auto-detects column headers and maps them to message fields (content, author, timestamp, source).",
        },
        {
          title: "Uploading Data",
          description:
            "Navigate to the Ingest page and drag-and-drop your files. You can upload multiple files at once. Each file creates a batch that you can track.",
        },
        {
          title: "Processing",
          description:
            "After upload, Vector processes the data through the same synthesis pipeline as live connectors. Signals are detected and merged with existing data.",
        },
        {
          title: "Best Practices",
          description:
            "Include as much context as possible: timestamps, author names, and source labels help the synthesis engine produce better signals.",
        },
      ],
    },
  },
  {
    id: "api",
    title: "API Reference",
    icon: Code2,
    comingSoon: true,
    content: {
      heading: "API Reference",
      body: `The Vector API is not yet available. We're building a REST API that will provide programmatic access to connectors, signals, feature requests, and synthesis jobs.

Once released, all endpoints will require authentication via Bearer token. The API will follow REST conventions with JSON request and response bodies. Rate limits and pagination will be documented per endpoint.`,
      steps: [
        {
          title: "Authentication",
          description:
            "All API requests will require a Bearer token in the Authorization header. You'll be able to obtain your token from the Dashboard settings page.",
        },
        {
          title: "Connectors API",
          description:
            "GET /api/connectors — List all connectors. POST /api/connectors — Create a new connector. GET /api/connectors/:id — Get connector details. DELETE /api/connectors/:id — Remove a connector.",
        },
        {
          title: "Signals API",
          description:
            "GET /api/signals — List all signals with pagination. GET /api/signals/:id — Get signal details with source messages. POST /api/signals/:id/promote — Promote a signal to a feature request.",
        },
        {
          title: "Feature Requests API",
          description:
            "GET /api/feature-requests — List all feature requests. GET /api/feature-requests/:id — Get full product context. POST /api/feature-requests/:id/approve — Approve and trigger the agent.",
        },
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>(sections[0].id);
  const current = sections.find((s) => s.id === activeSection) ?? sections[0];

  return (
    <main className="vector-docs">
      <div className="vector-public-container">
        {/* Header */}
        <div className="vector-docs-header">
          <Badge variant="blue">Documentation</Badge>
          <h1>Learn how to use Vector</h1>
          <p>
            Everything you need to connect your tools, synthesize customer
            feedback, and ship features faster.
          </p>
        </div>

        <div className="vector-docs-layout">
          {/* Sidebar */}
          <aside className="vector-docs-sidebar">
            <nav>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    "vector-docs-nav-item",
                    activeSection === s.id && "active"
                  )}
                >
                  <s.icon className="size-4" />
                  <span>{s.title}</span>
                  {"comingSoon" in s && s.comingSoon && (
                    <span className="ml-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70 whitespace-nowrap">Coming Soon</span>
                  )}
                  <ChevronRight className="size-3.5 ml-auto opacity-0 group-[.active]:opacity-100" />
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="vector-docs-content">
            <div className="vector-docs-content-header">
              <current.icon className="size-6 text-[#3564e8]" />
              <h2>{current.content.heading}</h2>
              {"comingSoon" in current && current.comingSoon && (
                <span className="inline-flex items-center rounded-full bg-[#3564e8]/10 px-2.5 py-0.5 text-xs font-medium text-[#3564e8] whitespace-nowrap">Coming Soon</span>
              )}
            </div>

            <div className="vector-docs-body">
              {current.content.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <div className="vector-docs-steps">
              {current.content.steps.map((step, i) => (
                <Card key={i} className="vector-docs-step-card">
                  <CardContent className="vector-docs-step-content">
                    <h4>{step.title}</h4>
                    <p>{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeSection === "getting-started" && (
              <div className="vector-docs-cta">
                <Link to="/register">
                  <Button>
                    Create your account
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
