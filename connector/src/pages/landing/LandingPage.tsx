import { ArrowRight, ArrowRightLeft, ChevronDown, Menu } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import dashboardHeroImage from "@/assets/landing/vector-dashboard-hero.png";
import logoGithub from "@/assets/landing/logo-github.svg";
import logoGmail from "@/assets/landing/logo-gmail.svg";
import logoSlack from "@/assets/landing/logo-slack.svg";
import ingestHeroImage from "@/assets/landing/vector-ingest-hero.png";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";

const integrationLogos = [
  { name: "Slack", logo: logoSlack },
  { name: "GitHub", logo: logoGithub },
  { name: "Gmail", logo: logoGmail },
] as const;

const comingSoonSlots = [0, 1, 2] as const;

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "#hero" },
      { label: "Integrations", href: "#integrations" },
      { label: "Pricing", href: "#cta" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#" },
      { label: "Changelog", href: "#" },
      { label: "Contact", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Home", href: "#hero" },
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/register" },
    ],
  },
] as const;

function LogoWordmark() {
  return (
    <div className="vector-hero-wordmark">
      <span className="vector-hero-wordmark-mark" aria-hidden>
        <span />
        <span />
      </span>
      <span>Vector</span>
    </div>
  );
}

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
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="vector-peec-hero-page">
      <header className="vector-peec-hero-nav">
        <div className="vector-peec-hero-container vector-peec-hero-nav-inner">
          <Link
            to="/"
            className="vector-peec-hero-brand"
            aria-label="Vector home"
          >
            <LogoWordmark />
          </Link>

          <nav className="vector-peec-hero-nav-links" aria-label="Primary">
            <a href="#hero" className="vector-peec-hero-nav-link">
              Product
            </a>
            <a href="#hero" className="vector-peec-hero-nav-link has-chevron">
              <span>Resources</span>
              <ChevronDown className="size-4" />
            </a>
            <a href="#hero" className="vector-peec-hero-nav-link has-chevron">
              <span>Integrations</span>
              <ChevronDown className="size-4" />
            </a>
          </nav>

          <div className="vector-peec-hero-nav-actions">
            <Link to="/login" className="vector-peec-hero-nav-button secondary">
              Log in
            </Link>
            <Link
              to="/register"
              className="vector-peec-hero-nav-button primary"
            >
              Sign up
            </Link>
          </div>

          <button
            type="button"
            className="vector-peec-hero-nav-mobile"
            aria-label="Menu"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </header>

      <main className="vector-peec-hero-main">
        <section className="vector-peec-hero-shell" id="hero">
          <div className="vector-peec-hero-container vector-peec-hero-panel">
            <div className="vector-peec-hero-copy">
              <div className="vector-peec-hero-pill">
                <span className="vector-peec-hero-pill-dot" aria-hidden />
                Slack + GitHub connected
              </div>

              <h1>
                Customer insights
                <br />
                <span>on autopilot</span>
              </h1>

              <p>
                Ingest customer data, filter out noise, capture insights
                otherwise lost, and turn the strongest signal into feature
                requests and PRs.
              </p>

              <div className="vector-peec-hero-metrics">
                <div className="vector-peec-hero-chip">Slack threads</div>
                <div className="vector-peec-hero-chip">GitHub issues</div>
                <div className="vector-peec-hero-chip">Generate PRs</div>
              </div>

              <div className="vector-peec-hero-actions">
                <Link to="/login" className="vector-peec-hero-cta secondary">
                  View product
                </Link>
                <Link to="/register" className="vector-peec-hero-cta primary">
                  Start free trial
                </Link>
              </div>
            </div>

            <div className="vector-peec-hero-dashboard-wrap">
              <div className="vector-peec-hero-dashboard-grid" aria-hidden>
                <figure className="vector-peec-hero-shot vector-peec-hero-shot-ingest">
                  <img src={ingestHeroImage} alt="" />
                </figure>
                <div className="vector-peec-hero-flow-badge">
                  <span className="vector-peec-hero-flow-badge-inner">
                    <ArrowRightLeft className="size-4" />
                  </span>
                </div>
                <figure className="vector-peec-hero-shot vector-peec-hero-shot-dashboard">
                  <img src={dashboardHeroImage} alt="" />
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section className="vector-peec-integrations" id="integrations">
          <div className="vector-peec-hero-container">
            <div className="vector-peec-section-head">
              <div className="vector-peec-section-kicker">Integrations</div>
              <h2>Plugs into your stack</h2>
              <p>
                Connect the tools your team already uses. Feedback flows in
                automatically, without copy-paste or context switching.
              </p>
            </div>

            <div className="vector-peec-integrations-grid">
              {integrationLogos.map((integration) => (
                <article
                  key={integration.name}
                  className="vector-peec-integration-card"
                  aria-label={`${integration.name} integration`}
                >
                  <div className="vector-peec-integration-mark vector-peec-integration-mark--logo">
                    <img src={integration.logo} alt="" />
                  </div>
                  <div className="vector-peec-integration-name">
                    {integration.name}
                  </div>
                </article>
              ))}
              {comingSoonSlots.map((i) => (
                <article
                  key={`soon-${i}`}
                  className="vector-peec-integration-card vector-peec-integration-card--soon"
                  aria-label="Integration coming soon"
                >
                  <p className="vector-peec-integration-coming-soon">
                    Coming soon
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="vector-peec-cta-band" id="cta">
          <div className="vector-peec-hero-container">
            <div className="vector-peec-cta-panel">
              <h2>
                Stop guessing.
                <br />
                Start listening.
              </h2>
              <p>
                Join product teams using Vector to build what customers actually
                want. 
              </p>

              <div className="vector-peec-cta-band-actions">
                <Link to="/register" className="vector-peec-cta-band-button primary">
                  Get Started Free
                  <ArrowRight className="size-5" />
                </Link>
                <Link to="/login" className="vector-peec-cta-band-button secondary">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="vector-peec-footer">
          <div className="vector-peec-hero-container">
            <div className="vector-peec-footer-inner">
              <div className="vector-peec-footer-brand">
                <LogoWordmark />
                <p>
                  Customer intelligence for teams that want cleaner signal, faster
                  prioritization, and less guesswork.
                </p>
              </div>

              <div className="vector-peec-footer-links">
                {footerColumns.map((column) => (
                  <div key={column.title} className="vector-peec-footer-column">
                    <div className="vector-peec-footer-heading">{column.title}</div>
                    {column.links.map((link) =>
                      link.href.startsWith("/") ? (
                        <Link
                          key={link.label}
                          to={link.href}
                          className="vector-peec-footer-link"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          key={link.label}
                          href={link.href}
                          className="vector-peec-footer-link"
                        >
                          {link.label}
                        </a>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="vector-peec-footer-bottom">
              <span>© 2026 Vector. All rights reserved.</span>
              <div className="vector-peec-footer-meta">
                <a href="#">Privacy</a>
                <a href="#">Terms</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
