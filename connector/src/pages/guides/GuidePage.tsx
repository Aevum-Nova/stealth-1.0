import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { guides, type Guide } from "./guides-data";

/* ------------------------------------------------------------------ */
/*  Image placeholder                                                  */
/* ------------------------------------------------------------------ */

function AssetPlaceholder({ label }: { label: string }) {
  return (
    <div className="vector-guide-asset">
      <div className="vector-guide-asset-inner">
        <span>{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section renderers                                                  */
/* ------------------------------------------------------------------ */

function GuideSection({
  section,
}: {
  section: Guide["sections"][number];
}) {
  return (
    <section className="vector-guide-section">
      <h2>{section.heading}</h2>
      {section.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {section.asset && <AssetPlaceholder label={section.asset} />}
      {section.steps && (
        <ol className="vector-guide-steps">
          {section.steps.map((step, i) => (
            <li key={i}>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </li>
          ))}
        </ol>
      )}
      {section.tip && (
        <div className="vector-guide-tip">
          <strong>Tip</strong>
          <p>{section.tip}</p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const guide = guides.find((g) => g.slug === slug);

  if (!guide) {
    return <Navigate to="/resources" replace />;
  }

  return (
    <main className="vector-guide">
      <article className="vector-guide-container">
        {/* Back link */}
        <Link to="/resources" className="vector-guide-back">
          <ArrowLeft className="size-3.5" />
          All guides
        </Link>

        {/* Header */}
        <header className="vector-guide-header">
          <Badge variant="blue">{guide.category}</Badge>
          <h1>{guide.title}</h1>
          <p className="vector-guide-subtitle">{guide.subtitle}</p>
          <div className="vector-guide-meta">
            <span>
              <Clock className="size-3.5" />
              {guide.time}
            </span>
            <span>
              <Calendar className="size-3.5" />
              {guide.date}
            </span>
          </div>
        </header>

        {/* Hero image placeholder */}
        <AssetPlaceholder label={guide.heroAsset} />

        {/* Sections */}
        {guide.sections.map((section, i) => (
          <GuideSection key={i} section={section} />
        ))}

        {/* Bottom CTA */}
        <div className="vector-guide-cta">
          <h3>Ready to try it yourself?</h3>
          <p>
            Create your free Vector account and start turning customer
            conversations into shipped features.
          </p>
          <div className="vector-guide-cta-actions">
            <Link to="/register">
              <Button>
                Get started free
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/docs">
              <Button variant="outline">Read the docs</Button>
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
