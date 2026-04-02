import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  Lightbulb,
  Newspaper,
  Rocket,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const guides = [
  {
    icon: Rocket,
    category: "Quick Start",
    title: "Set up Vector in 5 minutes",
    description:
      "Connect your Slack workspace, run your first synthesis, and review your first set of customer signals.",
    link: "/docs",
    time: "5 min read",
  },
  {
    icon: Wrench,
    category: "Configuration",
    title: "Configuring Slack channel filters",
    description:
      "Learn how to select specific channels for monitoring, set up exclusion rules, and configure message filters.",
    link: "/docs",
    time: "8 min read",
  },
  {
    icon: Lightbulb,
    category: "Best Practices",
    title: "Maximizing signal quality",
    description:
      "Tips for structuring your ingestion pipeline to get the most accurate and actionable signals from your customer data.",
    link: "/docs",
    time: "6 min read",
  },
  {
    icon: FileText,
    category: "Tutorial",
    title: "From signal to pull request",
    description:
      "Walk through the complete workflow: detect a signal, promote it to a feature request, refine context, and generate a PR.",
    link: "/docs",
    time: "12 min read",
  },
  {
    icon: BookOpen,
    category: "Deep Dive",
    title: "Understanding the synthesis engine",
    description:
      "How Vector's AI processes thousands of messages to identify patterns, cluster feedback, and score signals.",
    link: "/docs",
    time: "10 min read",
  },
  {
    icon: Wrench,
    category: "Integration",
    title: "Connecting GitHub for PR generation",
    description:
      "Set up the GitHub connector so the Vector agent can create pull requests in your repository automatically.",
    link: "/docs",
    time: "4 min read",
  },
] as const;

const changelog = [
  {
    version: "0.4.0",
    date: "March 2026",
    title: "Agent-powered PR generation",
    description:
      "The Vector agent can now generate pull requests from approved feature requests. Connect your GitHub repository and let the agent handle implementation.",
    type: "feature" as const,
  },
  {
    version: "0.3.0",
    date: "February 2026",
    title: "Product context pages",
    description:
      "Feature requests now include full product context pages with AI-generated requirements, scope, and acceptance criteria. Chat-based refinement is live.",
    type: "feature" as const,
  },
  {
    version: "0.2.1",
    date: "February 2026",
    title: "Signal scoring improvements",
    description:
      "Improved signal scoring algorithm with better noise filtering. Signals now account for message recency, author authority, and thread engagement.",
    type: "improvement" as const,
  },
  {
    version: "0.2.0",
    date: "January 2026",
    title: "Manual data ingestion",
    description:
      "Upload CSV, JSON, or plain text files directly. Supports batch processing and automatic format detection.",
    type: "feature" as const,
  },
  {
    version: "0.1.0",
    date: "January 2026",
    title: "Initial release",
    description:
      "Slack connector, signal detection, feature request generation, and dashboard. The foundation of Vector.",
    type: "feature" as const,
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ResourcesPage() {
  return (
    <main className="vector-resources">
      <div className="vector-public-container">
        {/* Header */}
        <div className="vector-resources-header">
          <Badge variant="teal">Resources</Badge>
          <h1>Guides, tutorials, and updates</h1>
          <p>
            Learn how to get the most out of Vector with step-by-step guides,
            best practices, and the latest product updates.
          </p>
        </div>

        {/* Guides Grid */}
        <section className="vector-resources-section">
          <div className="vector-resources-section-header">
            <h2>Guides & Tutorials</h2>
            <p>Step-by-step walkthroughs for every part of the platform.</p>
          </div>

          <div className="vector-resources-grid">
            {guides.map((guide) => (
              <Link key={guide.title} to={guide.link} className="block">
                <Card className="vector-resource-card group">
                  <CardContent className="vector-resource-card-content">
                    <div className="vector-resource-card-top">
                      <div className="vector-resource-icon">
                        <guide.icon className="size-4" />
                      </div>
                      <Badge variant="ghost" className="text-[10px]">
                        {guide.category}
                      </Badge>
                    </div>
                    <h3>{guide.title}</h3>
                    <p>{guide.description}</p>
                    <div className="vector-resource-card-footer">
                      <span className="vector-resource-time">
                        <Clock className="size-3" />
                        {guide.time}
                      </span>
                      <ArrowRight className="size-3.5 text-[#3564e8] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Changelog */}
        <section className="vector-resources-section">
          <div className="vector-resources-section-header">
            <h2>Changelog</h2>
            <p>What's new in Vector — features, improvements, and fixes.</p>
          </div>

          <div className="vector-changelog">
            {changelog.map((entry) => (
              <div key={entry.version} className="vector-changelog-entry">
                <div className="vector-changelog-marker">
                  <div className="vector-changelog-dot" />
                  <div className="vector-changelog-line" />
                </div>
                <div className="vector-changelog-content">
                  <div className="vector-changelog-meta">
                    <Badge
                      variant={
                        entry.type === "feature" ? "blue" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {entry.type === "feature" ? "New Feature" : "Improvement"}
                    </Badge>
                    <span className="vector-changelog-version">
                      v{entry.version}
                    </span>
                    <span className="vector-changelog-date">{entry.date}</span>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="vector-resources-cta">
          <h2>Ready to get started?</h2>
          <p>
            Create your account and start turning customer conversations into
            shipped features.
          </p>
          <div className="vector-resources-cta-actions">
            <Link to="/register">
              <Button size="lg">
                Start free beta
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/docs">
              <Button variant="outline" size="lg">
                Read the docs
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
