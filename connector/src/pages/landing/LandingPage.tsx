import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ChevronsRight,
  FileCode2,
  GitPullRequest,
  Layers,
  MessageSquareText,
  Plug,
  Radio,
  Search,
  Upload,
  Zap,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import dashboardHeroImage from "@/assets/landing/vector-dashboard-hero.png";
import ingestHeroImage from "@/assets/landing/vector-ingest-hero.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PublicNav from "@/components/landing/PublicNav";
import PublicFooter from "@/components/landing/PublicFooter";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const integrationLogos = [
  { name: "Slack", logo: "/connector-icons/slack.svg", active: true },
  { name: "Teams", logo: "/connector-icons/teams.svg", active: false },
  { name: "ServiceNow", logo: "/connector-icons/servicenow.svg", active: false },
  { name: "Zendesk", logo: "/connector-icons/zendesk.svg", active: false },
  { name: "Intercom", logo: "/connector-icons/intercom.svg", active: false },
  { name: "GitHub", logo: "/connector-icons/github.svg", active: true },
  { name: "Figma", logo: "/connector-icons/figma.svg", active: false },
  { name: "Google Forms", logo: "/connector-icons/google_forms.svg", active: false },
] as const;

const steps = [
  {
    number: "01",
    title: "Connect",
    description:
      "Plug in Slack, Teams, and your other tools. Vector ingests every customer conversation and feedback channel automatically.",
    icon: Plug,
    color: "#3564e8",
  },
  {
    number: "02",
    title: "Synthesize",
    description:
      "AI filters noise, identifies patterns across thousands of messages, and surfaces the signals that matter most to your product.",
    icon: BrainCircuit,
    color: "#1f9e91",
  },
  {
    number: "03",
    title: "Ship",
    description:
      "Feature requests are created automatically. Our agent generates full product context pages and PRs to your connected GitHub repo.",
    icon: GitPullRequest,
    color: "#8b5cf6",
  },
] as const;

const features = [
  {
    icon: Search,
    title: "Signal Detection",
    description:
      "AI-powered analysis identifies actionable customer feedback buried in thousands of messages, separating signal from noise.",
  },
  {
    icon: Layers,
    title: "Feature Requests",
    description:
      "Automatically generate structured feature requests from synthesized signals with full context and customer evidence.",
  },
  {
    icon: FileCode2,
    title: "Agent-Powered PRs",
    description:
      "Our AI agent creates pull requests based on approved feature requests, complete with implementation details.",
  },
  {
    icon: MessageSquareText,
    title: "Product Context",
    description:
      "Full context pages for each feature request with chat-based refinement. Update scope and requirements conversationally.",
  },
  {
    icon: Upload,
    title: "Manual Ingestion",
    description:
      "Upload customer data directly via CSV, JSON, or plain text for teams not yet on supported communication platforms.",
  },
  {
    icon: Zap,
    title: "Real-time Synthesis",
    description:
      "Continuous processing of incoming data keeps insights fresh. New signals are detected and surfaced as conversations happen.",
  },
] as const;

const metrics = [
  { value: "10x", label: "Faster insight extraction" },
  { value: "90%", label: "Noise reduction" },
  { value: "100%", label: "Customer coverage" },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f2]">
        <LoadingSpinner label="Loading" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="vector-public-page">
      <PublicNav />

      <main>
        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="vector-hero" id="hero">
          <div className="vector-hero-glow" aria-hidden />
          <div className="vector-public-container vector-hero-inner">
            <Badge variant="outline" className="vector-hero-badge">
              <Radio className="size-3.5" />
              <span>Now supporting Slack + GitHub</span>
            </Badge>

            <h1 className="vector-hero-h1">
              Turn customer conversations
              <br />
              <span className="vector-hero-h1-muted">into shipped features</span>
            </h1>

            <p className="vector-hero-subtitle">
              Vector connects to your communication tools, extracts actionable
              insights, and helps your product team build what customers actually
              need&nbsp;&mdash;&nbsp;automatically.
            </p>

            <div className="vector-hero-ctas">
              <Link to="/register">
                <Button size="lg" variant="dark-primary">
                  Start free beta
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/docs">
                <Button size="lg" variant="dark-secondary">
                  View documentation
                </Button>
              </Link>
            </div>

            {/* Metrics strip */}
            <div className="vector-hero-metrics">
              {metrics.map((m) => (
                <div key={m.label} className="vector-hero-metric">
                  <span className="vector-hero-metric-value">{m.value}</span>
                  <span className="vector-hero-metric-label">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Product Screenshots ─────────────────────────────── */}
        <section className="vector-screenshots">
          <div className="vector-public-container">
            <div className="vector-screenshots-grid" aria-hidden>
              <figure className="vector-screenshots-shot vector-screenshots-ingest">
                <img src={ingestHeroImage} alt="Data ingestion interface" />
              </figure>
              <div className="vector-screenshots-bridge">
                <span className="vector-screenshots-bridge-icon">
                  <ChevronsRight className="size-4" />
                </span>
              </div>
              <figure className="vector-screenshots-shot vector-screenshots-dashboard">
                <img src={dashboardHeroImage} alt="Dashboard overview" />
              </figure>
            </div>
          </div>
        </section>

        {/* ── Integration Strip ───────────────────────────────── */}
        <section className="vector-logo-strip">
          <div className="vector-public-container">
            <p className="vector-logo-strip-label">
              Integrates with your existing stack
            </p>
            <div className="vector-logo-strip-logos">
              {integrationLogos.map((i) => (
                <div
                  key={i.name}
                  className="vector-logo-strip-item"
                  title={i.name}
                >
                  <img src={i.logo} alt={i.name} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────── */}
        <section className="vector-how" id="how-it-works">
          <div className="vector-public-container">
            <div className="vector-section-header">
              <Badge variant="teal">How it works</Badge>
              <h2>From conversation to code in three steps</h2>
              <p>
                Vector automates the entire pipeline from raw customer feedback
                to shipped features, so your team can focus on building.
              </p>
            </div>

            <div className="vector-how-steps">
              {steps.map((step) => (
                <div key={step.number} className="vector-how-step">
                  <div
                    className="vector-how-step-number"
                    style={{ color: step.color }}
                  >
                    {step.number}
                  </div>
                  <div
                    className="vector-how-step-icon"
                    style={{ background: step.color }}
                  >
                    <step.icon className="size-5" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Grid (hidden for now) ─────────────────── */}
        {/* <section className="vector-features" id="features">
          <div className="vector-public-container">
            <div className="vector-section-header">
              <Badge variant="blue">Capabilities</Badge>
              <h2>Everything you need to listen, learn, and ship</h2>
              <p>
                From ingestion to pull requests, Vector handles the full
                lifecycle of turning customer insight into working code.
              </p>
            </div>

            <div className="vector-features-grid">
              {features.map((f) => (
                <Card key={f.title} className="vector-feature-card">
                  <CardContent className="vector-feature-card-content">
                    <div className="vector-feature-icon">
                      <f.icon className="size-5" />
                    </div>
                    <h3>{f.title}</h3>
                    <p>{f.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section> */}

        {/* ── Integrations ────────────────────────────────────── */}
        <section className="vector-integrations" id="integrations">
          <div className="vector-public-container">
            <div className="vector-section-header">
              <Badge variant="teal">Integrations</Badge>
              <h2>Plugs into your stack</h2>
              <p>
                Connect the tools your team already uses. Feedback flows in
                automatically, without copy-paste or context switching.
              </p>
            </div>

            <div className="vector-integrations-grid">
              {integrationLogos.map((integration) => (
                <div
                  key={integration.name}
                  className="vector-integration-card"
                >
                  <div className="vector-integration-icon">
                    <img src={integration.logo} alt="" />
                  </div>
                  <div className="vector-integration-info">
                    <span className="vector-integration-name">
                      {integration.name}
                    </span>
                    {integration.active ? (
                      <Badge variant="success" className="text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="ghost" className="text-[10px]">
                        Coming soon
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="vector-integrations-cta">
              <Link to="/integrations">
                <Button variant="outline" size="sm">
                  View all integrations
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── CTA Band ────────────────────────────────────────── */}
        <section className="vector-cta-band">
          <div className="vector-public-container">
            <div className="vector-cta-panel">
              <div className="vector-cta-glow" aria-hidden />
              <h2>
                Ready to build
                <br />
                what matters?
              </h2>
              <p>
                Join product teams using Vector to turn customer signal into
                shipped features. Start for free, no credit card required.
              </p>
              <div className="vector-cta-actions">
                <Link to="/register">
                  <Button size="lg" variant="dark-primary">
                    Get Started Free
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="dark-secondary">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
