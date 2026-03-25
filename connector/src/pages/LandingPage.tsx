import {
  Activity,
  ArrowRight,
  Menu,
  Monitor,
  Pause,
  Play,
  Quote,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/use-auth";

const productCards = [
  {
    title: "Capture faster",
    description:
      "Pull customer feedback from Slack, support tickets, GitHub issues, forms, and CRM notes automatically. Every voice captured, nothing slips through.",
  },
  {
    title: "Connect smarter",
    description:
      "Cluster related conversations, link repeat requests across channels, and turn scattered anecdotes into a single customer signal.",
  },
  {
    title: "Prioritize clearly",
    description:
      "Rank feature requests by urgency, customer concentration, and strategic fit so roadmap calls are backed by evidence instead of instinct.",
  },
] as const;

const heroStats = [
  { value: "10k+", label: "Signals processed daily" },
  { value: "85%", label: "Faster prioritization" },
  { value: "3 min", label: "Average setup time" },
] as const;

const integrations = [
  { name: "Slack", color: "#E01E5A" },
  { name: "GitHub", color: "#24292F" },
  { name: "Email", color: "#2563EB" },
  { name: "Intercom", color: "#1F8DED" },
  { name: "Zendesk", color: "#03363D" },
  { name: "Forms", color: "#0D9488" },
] as const;

const useCases = [
  {
    title: "Product",
    description:
      "Turn raw customer language into roadmap-ready requests and synthesized opportunity areas.",
    icon: ShieldCheck,
  },
  {
    title: "Support",
    description:
      "Identify recurring friction, escalation themes, and broken workflows before they become systemic.",
    icon: Users,
  },
  {
    title: "Operations",
    description:
      "Spot the process gaps hiding inside inbound conversations, handoffs, and manual workarounds.",
    icon: Activity,
  },
  {
    title: "Leadership",
    description:
      "See the signal landscape clearly with evidence trails that make prioritization easier to trust.",
    icon: Monitor,
  },
] as const;

const waveformBars = [
  28, 40, 54, 62, 48, 36, 30, 44, 58, 70, 64, 46, 32, 28, 38, 50, 66, 72, 58,
  42, 34, 30, 44, 60, 68, 56, 40, 32, 28, 42, 55, 64, 74, 60, 44, 34, 30, 46,
  60, 66, 54, 42, 36, 30, 40, 52, 58, 48, 36, 30,
] as const;

const heroLines = [
  [
    { text: "Customer", direction: "from-left" },
    { text: "signals,", direction: "from-center" },
  ],
  [
    { text: "on", direction: "from-right" },
    { text: "autopilot.", direction: "from-left" },
  ],
] as const;

const remoteVideoUrl = "https://wayco.ai/Lawyer%20Career%20Video.mp4";
const remoteAudioUrl =
  "https://wayco.ai/audio-for-conversation-conv-2301kk6vbeh4f4z95k4ta33gwsw1_AUk5YUv4.mp3";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function LogoWordmark() {
  return (
    <div className="vector-landing-wordmark">
      <span className="vector-landing-wordmark-mark">V</span>
      <span className="vector-landing-wordmark-text">Vector</span>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const heroActionsRef = useRef<HTMLDivElement | null>(null);
  const heroFeatureRef = useRef<HTMLDivElement | null>(null);
  const heroFeatureCopyRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [navCtaVisible, setNavCtaVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioProgress = duration > 0 ? currentTime / duration : 0;

  const visibleBars = useMemo(
    () => Math.round(audioProgress * waveformBars.length),
    [audioProgress],
  );

  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );

    document.querySelectorAll(".js-reveal").forEach((element) => {
      revealObserver.observe(element);
    });

    const heroActionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setNavCtaVisible(!entry.isIntersecting);
        });
      },
      { threshold: 0 },
    );

    if (heroActionsRef.current) {
      heroActionObserver.observe(heroActionsRef.current);
    }

    const handleScroll = () => {
      if (!heroFeatureRef.current || !heroFeatureCopyRef.current) {
        return;
      }

      const rect = heroFeatureRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const fadeStart = viewportHeight * 0.35;
      const fadeEnd = viewportHeight * -0.05;
      const progress = Math.max(
        0,
        Math.min(1, (fadeStart - rect.top) / (fadeStart - fadeEnd)),
      );

      heroFeatureCopyRef.current.style.opacity = `${1 - progress}`;
      heroFeatureCopyRef.current.style.transform = `translateY(${progress * 16}px)`;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      revealObserver.disconnect();
      heroActionObserver.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      audio?.pause();
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar || duration === 0) {
      return;
    }

    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[rgb(254,254,252)]">
        <LoadingSpinner label="Loading" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="vector-landing">
      <a
        href="https://wayco.ai/"
        target="_blank"
        rel="noreferrer"
        className="vector-landing-banner"
      >
        <span className="vector-landing-banner-mark">W</span>
        <span className="vector-landing-banner-text">
          Built by the team behind Wayco AI
        </span>
        <span className="vector-landing-banner-arrow">→</span>
      </a>

      <nav className="vector-landing-nav">
        <div className="vector-landing-nav-inner">
          <Link
            to="/"
            className="vector-landing-nav-brand"
            aria-label="Vector home"
          >
            <LogoWordmark />
          </Link>

          <div className="vector-landing-nav-links">
            {[
              { href: "#product", label: "Product" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#integrations", label: "Integrations" },
              { href: "#vision", label: "Vision" },
              { href: "/login", label: "Log in", external: false },
              { href: "/register", label: "Start free", external: false },
            ].map((item, index) => (
              <div
                key={item.label}
                className="vector-landing-nav-link-wrap"
                style={{ animationDelay: `${0.05 + index * 0.05}s` }}
              >
                {item.external === false ? (
                  <Link to={item.href} className="vector-landing-nav-link">
                    {item.label}
                  </Link>
                ) : (
                  <a href={item.href} className="vector-landing-nav-link">
                    {item.label}
                  </a>
                )}
                <div className="vector-landing-nav-underline" />
              </div>
            ))}
            <Link
              to="/register"
              className={`vector-landing-nav-cta ${navCtaVisible ? "visible" : ""}`}
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="vector-landing-nav-mobile"
            aria-label="Menu"
          >
            <Menu className="size-4" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      <main>
        <header className="vector-landing-hero" id="hero">
          <h1
            className="vector-landing-hero-headline"
            aria-label="Customer signals, on autopilot."
          >
            {heroLines.map((line, lineIndex) => (
              <span
                key={`line-${lineIndex}`}
                className="vector-landing-hero-line"
              >
                {line.map((word, wordIndex) => (
                  <span
                    key={`${word.text}-${wordIndex}`}
                    className={`vector-landing-hero-word ${word.direction}`}
                    style={{
                      animationDelay: `${0.15 + (lineIndex * 2 + wordIndex) * 0.09}s`,
                    }}
                  >
                    {word.text}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p className="vector-landing-hero-sub">
            Vector collects scattered feedback from every channel, synthesizes
            it with AI, and surfaces the feature requests that actually matter
            so you build what customers need, not what is loudest.
          </p>

          <div className="vector-landing-hero-actions" ref={heroActionsRef}>
            <Link
              to="/register"
              className="vector-landing-btn vector-landing-btn-dark"
            >
              Start free trial
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#product"
              className="vector-landing-btn vector-landing-btn-white"
            >
              See the platform
            </a>
          </div>

          <div
            className="vector-landing-hero-feature"
            id="product"
            ref={heroFeatureRef}
          >
            <video autoPlay muted loop playsInline>
              <source src={remoteVideoUrl} type="video/mp4" />
            </video>
            <div className="vector-landing-hero-feature-gradient" />
            <div
              className="vector-landing-hero-feature-copy"
              ref={heroFeatureCopyRef}
            >
              <div className="vector-landing-eyebrow">Platform</div>
              <div className="vector-landing-hero-feature-title">
                The customer intelligence workspace
              </div>
            </div>
          </div>

          <div className="vector-landing-stats-strip">
            {heroStats.map((stat, index) => (
              <div
                key={stat.label}
                className={`vector-landing-stat-item ${index < heroStats.length - 1 ? "has-divider" : ""}`}
              >
                <div className="vector-landing-stat-value">{stat.value}</div>
                <div className="vector-landing-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="vector-landing-section vector-landing-product-section">
          <div className="vector-landing-container">
            <div className="vector-landing-section-header js-reveal">
              <div className="vector-landing-eyebrow">
                Smarter tools, better product calls
              </div>
              <p className="vector-landing-section-description">
                Three systems work together to transform how your team listens
                to customers: signal capture, AI synthesis, and evidence-backed
                prioritization.
              </p>
            </div>

            <div className="vector-landing-product-grid">
              {productCards.map((card, index) => (
                <article
                  key={card.title}
                  className={`vector-landing-product-card js-reveal ${index > 0 ? `reveal-d${index}` : ""}`}
                >
                  <div
                    className={`vector-landing-product-visual card-visual-${index + 1}`}
                  >
                    <div className="vector-landing-card-mock">
                      <div className="mock-row w50" />
                      <div className="mock-row w90" />
                      <div className="mock-row w30 accent" />
                      <div className="mock-table">
                        {Array.from({ length: 8 }, (_, cellIndex) => (
                          <div
                            key={cellIndex}
                            className={`mock-cell ${cellIndex % 3 === 1 ? "hi" : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="vector-landing-product-copy">
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="vector-landing-voice-section" id="how-it-works">
          <div className="vector-landing-container vector-landing-voice-inner">
            <div className="vector-landing-voice-copy js-reveal">
              <div className="vector-landing-eyebrow">Signal AI</div>
              <h2 className="vector-landing-section-title">
                Three steps. Zero guesswork.
              </h2>
              <p className="vector-landing-section-description">
                Connect your sources, let AI do the heavy lifting, and
                prioritize what matters most with customer context attached to
                every decision.
              </p>
            </div>

            <div className="vector-landing-voice-player-area">
              <div
                className={`vector-landing-voice-glow ${isPlaying ? "active" : ""}`}
              />
              <div className="vector-landing-voice-card js-reveal reveal-d1">
                <div className="vector-landing-voice-top">
                  <div>
                    <div className="vector-landing-eyebrow">Live demo</div>
                    <div className="vector-landing-voice-title">
                      Vector Signal AI
                    </div>
                  </div>
                </div>

                <div className="vector-landing-waveform" aria-hidden>
                  {waveformBars.map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className={`vector-landing-waveform-bar ${index <= visibleBars ? "active" : ""}`}
                      style={{ height }}
                    />
                  ))}
                </div>

                <div className="vector-landing-voice-controls">
                  <button
                    type="button"
                    className={`vector-landing-play-button ${isPlaying ? "playing" : ""}`}
                    onClick={() => void togglePlayback()}
                    aria-label={isPlaying ? "Pause audio" : "Play audio"}
                  >
                    {isPlaying ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play
                        className="size-4 translate-x-[1px]"
                        fill="currentColor"
                      />
                    )}
                  </button>

                  <div className="vector-landing-voice-progress-wrap">
                    <div
                      ref={progressBarRef}
                      className="vector-landing-voice-progress"
                      onClick={handleSeek}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={duration || 0}
                      aria-valuenow={currentTime}
                    >
                      <div
                        className="vector-landing-voice-progress-fill"
                        style={{ width: `${audioProgress * 100}%` }}
                      />
                    </div>
                    <div className="vector-landing-voice-time">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                <audio ref={audioRef} preload="metadata">
                  <source src={remoteAudioUrl} type="audio/mpeg" />
                </audio>
              </div>
            </div>
          </div>
        </section>

        <section className="vector-landing-text-block">
          <div className="vector-landing-container">
            <div className="vector-landing-text-block-inner js-reveal">
              <p>
                <strong>
                  The customer intelligence layer built to fit cleanly into your
                  workflow.
                </strong>{" "}
                Vector connects inbound conversations, support history, and
                product evidence so teams can collaborate around the same truth
                instead of fragmented anecdotes.
              </p>
            </div>
          </div>
        </section>

        <section className="vector-landing-usecases" id="solutions">
          <div className="vector-landing-container">
            <div className="vector-landing-eyebrow js-reveal">
              Built for the teams closest to customer truth.
            </div>
            <div className="vector-landing-usecases-grid">
              {useCases.map((item, index) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className={`vector-landing-usecase-card js-reveal ${index > 0 ? `reveal-d${Math.min(index, 3)}` : ""}`}
                  >
                    <div className="vector-landing-usecase-visual">
                      <div
                        className={`vector-landing-usecase-gradient usecase-gradient-${index + 1}`}
                      />
                      <div className="vector-landing-usecase-icon">
                        <Icon />
                      </div>
                    </div>
                    <div className="vector-landing-usecase-copy">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="vector-landing-integrations" id="integrations">
          <div className="vector-landing-container">
            <div className="vector-landing-integrations-header js-reveal">
              <div className="vector-landing-eyebrow">Integrations</div>
              <h2 className="vector-landing-section-title">
                Plugs into your stack
              </h2>
              <p className="vector-landing-section-description">
                Connect the tools your team already uses. Feedback flows in
                automatically, without copy-paste or context switching.
              </p>
            </div>

            <div className="vector-landing-integrations-grid">
              {integrations.map((item, index) => (
                <div
                  key={item.name}
                  className={`vector-landing-integration-card js-reveal ${index > 0 ? `reveal-d${Math.min(index, 3)}` : ""}`}
                >
                  <div
                    className="vector-landing-integration-dot"
                    style={{ background: item.color }}
                  />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="vector-landing-vision" id="vision">
          <div className="vector-landing-container">
            <div className="vector-landing-eyebrow js-reveal">Our vision</div>
            <div className="vector-landing-vision-grid">
              <div>
                <blockquote className="vector-landing-vision-quote js-reveal">
                  Every growing product team deserves a system that makes
                  customer reality legible: what is being asked for, by whom,
                  how often, and why it matters now.
                </blockquote>
                <div className="vector-landing-vision-author js-reveal reveal-d1">
                  <div className="vector-landing-vision-author-name">
                    Vector Team
                  </div>
                  <div className="vector-landing-vision-author-role">
                    A product by Wayco AI
                  </div>
                  <div className="vector-landing-signature">Vector</div>
                </div>
              </div>

              <div className="vector-landing-vision-image js-reveal reveal-d2">
                <div className="vector-landing-vision-orb" />
                <div className="vector-landing-vision-panel">
                  <div className="vector-landing-panel-label">
                    Feature request synthesis
                  </div>
                  <div className="vector-landing-panel-title">
                    Repeated export & reporting demand across support + Slack
                  </div>
                  <div className="vector-landing-panel-meta">
                    <span>17 signals</span>
                    <span>6 accounts</span>
                    <span>High urgency</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vector-landing-testimonial">
          <div className="vector-landing-container">
            <div className="vector-landing-testimonial-inner">
              <div className="vector-landing-testimonial-stat js-reveal">
                <div className="vector-landing-testimonial-number">90%</div>
                <div className="vector-landing-testimonial-label">
                  less manual reading once customer feedback is captured,
                  clustered, and synthesized in one place.
                </div>
              </div>

              <div>
                <blockquote className="vector-landing-testimonial-quote js-reveal">
                  <Quote className="vector-landing-testimonial-quote-icon" />
                  The difference is not just speed. It is confidence. You stop
                  wondering whether you are missing the pattern because the
                  evidence is finally organized in a way the team can act on.
                </blockquote>
                <div className="vector-landing-testimonial-meta js-reveal reveal-d1">
                  <div className="vector-landing-testimonial-name">
                    Built for teams shipping in motion
                  </div>
                  <div className="vector-landing-testimonial-role">
                    Product, support, and operations
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vector-landing-cta" id="demo">
          <div className="vector-landing-cta-symbol" aria-hidden>
            <Stethoscope className="size-[220px]" strokeWidth={0.8} />
          </div>
          <div className="vector-landing-container">
            <div className="vector-landing-cta-inner">
              <h2 className="vector-landing-cta-heading js-reveal">
                Ready to replace noisy feedback review with signal clarity?
              </h2>
              <p className="vector-landing-cta-sub js-reveal reveal-d1">
                Join teams using Vector to build what customers actually want,
                with the conversations and evidence already attached.
              </p>
              <div className="vector-landing-cta-actions js-reveal reveal-d2">
                <Link
                  to="/register"
                  className="vector-landing-btn vector-landing-btn-white"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="vector-landing-footer">
        <div className="vector-landing-container">
          <div className="vector-landing-footer-grid">
            <div className="vector-landing-footer-brand">
              <LogoWordmark />
              <p>Customer signal infrastructure for modern product teams.</p>
            </div>

            <div className="vector-landing-footer-column">
              <h4>Product</h4>
              <ul>
                <li>
                  <a href="#product">Overview</a>
                </li>
                <li>
                  <a href="#product">Signal Capture</a>
                </li>
                <li>
                  <a href="#product">Synthesis</a>
                </li>
                <li>
                  <a href="#product">Evidence Trails</a>
                </li>
              </ul>
            </div>

            <div className="vector-landing-footer-column">
              <h4>Solutions</h4>
              <ul>
                <li>
                  <a href="#solutions">Product</a>
                </li>
                <li>
                  <a href="#solutions">Support</a>
                </li>
                <li>
                  <a href="#solutions">Operations</a>
                </li>
                <li>
                  <a href="#solutions">Leadership</a>
                </li>
              </ul>
            </div>

            <div className="vector-landing-footer-column">
              <h4>Company</h4>
              <ul>
                <li>
                  <a href="#vision">About</a>
                </li>
                <li>
                  <a href="https://wayco.ai/" target="_blank" rel="noreferrer">
                    Wayco AI
                  </a>
                </li>
                <li>
                  <Link to="/login">Log in</Link>
                </li>
                <li>
                  <Link to="/register">Get started</Link>
                </li>
              </ul>
            </div>

            <div className="vector-landing-footer-column">
              <h4>Legal</h4>
              <ul>
                <li>
                  <a href="#hero">Terms</a>
                </li>
                <li>
                  <a href="#hero">Privacy Policy</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="vector-landing-footer-bottom">
            <div className="vector-landing-footer-legal">
              <span>© {new Date().getFullYear()} Vector</span>
              <span>A Wayco AI product</span>
            </div>
            <div className="vector-landing-footer-social">
              <a href="https://wayco.ai/" target="_blank" rel="noreferrer">
                Wayco AI
              </a>
              <Link to="/register">Start free</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
