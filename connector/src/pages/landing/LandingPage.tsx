import { Link } from "react-router-dom";
import {
  ArrowRight,
  Zap,
  BarChart3,
  MessageSquare,
  GitMerge,
  Layers,
  Target,
  CheckCircle2,
  ChevronRight,
  Headphones,
  Slack,
  Github,
  Mail,
  Globe,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Flat Design System — Vector Landing Page

   Core principles:
   • Zero shadows, zero gradients
   • Solid, saturated color blocks
   • Crisp state changes (no easing)
   • Geometric precision, bold typography
   ───────────────────────────────────────────── */

const COLORS = {
  blue: "#2563EB",
  blueHover: "#1D4ED8",
  coral: "#F97316",
  coralHover: "#EA580C",
  teal: "#0D9488",
  purple: "#7C3AED",
  yellow: "#EAB308",
  rose: "#E11D48",
  dark: "#18181B",
  darkSoft: "#27272A",
  white: "#FFFFFF",
  offWhite: "#FAFAFA",
  gray100: "#F4F4F5",
  gray200: "#E4E4E7",
  gray500: "#71717A",
  gray700: "#3F3F46",
  gray900: "#18181B",
} as const;

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ── Nav ─────────────────────────────────── */

function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 h-16"
      style={{ background: COLORS.white, borderBottom: `2px solid ${COLORS.gray200}` }}
    >
      <div className="flex items-center gap-8">
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: COLORS.dark }}
        >
          vector
        </span>
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => scrollTo("features")}
            className="text-sm font-medium"
            style={{ color: COLORS.gray700 }}
          >
            Features
          </button>
          <button
            onClick={() => scrollTo("how-it-works")}
            className="text-sm font-medium"
            style={{ color: COLORS.gray700 }}
          >
            How It Works
          </button>
          <button
            onClick={() => scrollTo("integrations")}
            className="text-sm font-medium"
            style={{ color: COLORS.gray700 }}
          >
            Integrations
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="hidden sm:inline-flex text-sm font-medium px-4 py-2"
          style={{ color: COLORS.dark }}
        >
          Log in
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5"
          style={{
            background: COLORS.blue,
            color: COLORS.white,
            borderRadius: 4,
          }}
        >
          Get Started
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>
    </nav>
  );
}

/* ── Hero ────────────────────────────────── */

function Hero() {
  return (
    <section
      className="pt-32 pb-20 md:pt-40 md:pb-28 px-6 md:px-10"
      style={{ background: COLORS.white }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 mb-8"
          style={{
            background: COLORS.yellow,
            color: COLORS.dark,
            borderRadius: 2,
          }}
        >
          <Zap size={12} strokeWidth={3} />
          Customer Intelligence Platform
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]"
          style={{ color: COLORS.dark }}
        >
          Every customer voice.
          <br />
          <span style={{ color: COLORS.blue }}>One clear signal.</span>
        </h1>

        <p
          className="mt-6 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
          style={{ color: COLORS.gray500 }}
        >
          Vector collects scattered feedback from every channel, synthesizes it
          with AI, and surfaces the feature requests that actually matter — so
          you build what customers need, not what&apos;s loudest.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 text-base font-bold px-8 py-4"
            style={{
              background: COLORS.blue,
              color: COLORS.white,
              borderRadius: 4,
            }}
          >
            Start Free Trial
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
          <button
            onClick={() => scrollTo("how-it-works")}
            className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4"
            style={{
              background: COLORS.gray100,
              color: COLORS.dark,
              borderRadius: 4,
              border: `2px solid ${COLORS.gray200}`,
            }}
          >
            See How It Works
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ── Metrics strip ── */}
        <div
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 max-w-2xl mx-auto"
          style={{ borderTop: `2px solid ${COLORS.gray200}` }}
        >
          {[
            { value: "10k+", label: "Signals processed daily" },
            { value: "85%", label: "Faster prioritization" },
            { value: "3min", label: "Average setup time" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="py-6 px-4 text-center"
              style={{ borderRight: `2px solid ${COLORS.gray200}` }}
            >
              <div
                className="text-2xl md:text-3xl font-bold"
                style={{ color: COLORS.dark }}
              >
                {stat.value}
              </div>
              <div
                className="text-xs font-medium uppercase tracking-wider mt-1"
                style={{ color: COLORS.gray500 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────── */

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Signal Collection",
    desc: "Pull customer feedback from Slack, support tickets, GitHub issues, surveys, and more — automatically. Every voice captured, nothing slips through.",
    color: COLORS.coral,
    bg: COLORS.coral,
  },
  {
    icon: Layers,
    title: "AI Synthesis",
    desc: "Our AI clusters related feedback, identifies themes, and generates structured feature requests from raw noise. Pattern recognition at scale.",
    color: COLORS.teal,
    bg: COLORS.teal,
  },
  {
    icon: Target,
    title: "Smart Prioritization",
    desc: "Rank feature requests by customer impact, revenue weight, and strategic alignment. Data-driven roadmap decisions, not gut feelings.",
    color: COLORS.purple,
    bg: COLORS.purple,
  },
] as const;

function Features() {
  return (
    <section
      id="features"
      className="py-20 md:py-28 px-6 md:px-10"
      style={{ background: COLORS.dark, scrollMarginTop: 64 }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 mb-4"
            style={{
              background: COLORS.darkSoft,
              color: COLORS.coral,
              borderRadius: 2,
            }}
          >
            Core Features
          </span>
          <h2
            className="text-3xl md:text-5xl font-bold tracking-tight"
            style={{ color: COLORS.white }}
          >
            From noise to clarity
          </h2>
          <p
            className="mt-4 text-base md:text-lg max-w-xl mx-auto"
            style={{ color: COLORS.gray500 }}
          >
            Three powerful systems working together to transform how you listen
            to customers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-8 md:p-10 flex flex-col"
              style={{
                background: COLORS.darkSoft,
                borderLeft: `4px solid ${f.bg}`,
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-6"
                style={{ background: f.bg, borderRadius: 4 }}
              >
                <f.icon size={22} strokeWidth={2.5} color={COLORS.white} />
              </div>
              <h3
                className="text-xl font-bold mb-3"
                style={{ color: COLORS.white }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.gray500 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ────────────────────────── */

const STEPS = [
  {
    num: "01",
    title: "Connect your sources",
    desc: "Link Slack, Intercom, GitHub, email, and more. Vector begins pulling feedback in real time — no manual tagging, no CSV uploads.",
    accent: COLORS.blue,
  },
  {
    num: "02",
    title: "AI does the heavy lifting",
    desc: "Our synthesis engine reads every signal, clusters similar feedback, and generates structured feature requests with customer context attached.",
    accent: COLORS.teal,
  },
  {
    num: "03",
    title: "Prioritize and ship",
    desc: "See what matters most by customer impact and revenue weight. Make confident roadmap decisions backed by real data, not anecdotes.",
    accent: COLORS.coral,
  },
] as const;

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 px-6 md:px-10"
      style={{ background: COLORS.white, scrollMarginTop: 64 }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 mb-4"
            style={{
              background: COLORS.blue,
              color: COLORS.white,
              borderRadius: 2,
            }}
          >
            How It Works
          </span>
          <h2
            className="text-3xl md:text-5xl font-bold tracking-tight"
            style={{ color: COLORS.dark }}
          >
            Three steps. Zero guesswork.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="relative p-8 md:p-10"
              style={{
                background: COLORS.offWhite,
                borderBottom: `4px solid ${s.accent}`,
              }}
            >
              <span
                className="text-6xl font-black leading-none"
                style={{ color: s.accent, opacity: 0.15 }}
              >
                {s.num}
              </span>
              <h3
                className="text-lg font-bold mt-4 mb-3"
                style={{ color: COLORS.dark }}
              >
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.gray500 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats Banner ────────────────────────── */

function StatsBanner() {
  const stats = [
    { value: "50+", label: "Integrations", icon: GitMerge },
    { value: "2M+", label: "Signals Analyzed", icon: BarChart3 },
    { value: "500+", label: "Teams Using Vector", icon: Headphones },
    { value: "99.9%", label: "Uptime SLA", icon: CheckCircle2 },
  ];

  return (
    <section
      className="py-16 md:py-20 px-6 md:px-10"
      style={{ background: COLORS.coral }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-0">
        {stats.map((s) => (
          <div key={s.label} className="text-center py-6 px-4">
            <s.icon
              size={24}
              strokeWidth={2.5}
              className="mx-auto mb-3"
              style={{ color: COLORS.white, opacity: 0.7 }}
            />
            <div
              className="text-3xl md:text-4xl font-black"
              style={{ color: COLORS.white }}
            >
              {s.value}
            </div>
            <div
              className="text-xs font-bold uppercase tracking-wider mt-1"
              style={{ color: COLORS.white, opacity: 0.8 }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Integrations ────────────────────────── */

const INTEGRATIONS = [
  { name: "Slack", icon: Slack, color: "#E01E5A" },
  { name: "GitHub", icon: Github, color: "#24292F" },
  { name: "Email", icon: Mail, color: "#2563EB" },
  { name: "Intercom", icon: MessageSquare, color: "#1F8DED" },
  { name: "Zendesk", icon: Headphones, color: "#03363D" },
  { name: "Web Widget", icon: Globe, color: "#0D9488" },
];

function Integrations() {
  return (
    <section
      id="integrations"
      className="py-20 md:py-28 px-6 md:px-10"
      style={{ background: COLORS.gray100, scrollMarginTop: 64 }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <span
          className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 mb-4"
          style={{
            background: COLORS.teal,
            color: COLORS.white,
            borderRadius: 2,
          }}
        >
          Integrations
        </span>
        <h2
          className="text-3xl md:text-5xl font-bold tracking-tight"
          style={{ color: COLORS.dark }}
        >
          Plugs into your stack
        </h2>
        <p
          className="mt-4 text-base md:text-lg max-w-xl mx-auto mb-12"
          style={{ color: COLORS.gray500 }}
        >
          Connect the tools your team already uses. Feedback flows in
          automatically — no copy-paste, no context switching.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-0">
          {INTEGRATIONS.map((int) => (
            <div
              key={int.name}
              className="flex flex-col items-center justify-center py-8 px-4"
              style={{
                background: COLORS.white,
                border: `2px solid ${COLORS.gray200}`,
                marginLeft: -2,
                marginTop: -2,
              }}
            >
              <int.icon
                size={28}
                strokeWidth={2}
                style={{ color: int.color }}
              />
              <span
                className="text-xs font-bold mt-3 uppercase tracking-wider"
                style={{ color: COLORS.gray700 }}
              >
                {int.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonial ─────────────────────────── */

function Testimonial() {
  return (
    <section
      className="py-20 md:py-28 px-6 md:px-10"
      style={{ background: COLORS.white }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 mb-8"
          style={{ background: COLORS.purple, borderRadius: 4 }}
        >
          <MessageSquare size={28} strokeWidth={2.5} color={COLORS.white} />
        </div>
        <blockquote
          className="text-2xl md:text-3xl font-bold leading-snug tracking-tight"
          style={{ color: COLORS.dark }}
        >
          &ldquo;We went from 6 hours of weekly feedback triage to 20 minutes.
          Vector didn&apos;t just save us time — it changed what we build and
          why.&rdquo;
        </blockquote>
        <div className="mt-8">
          <div
            className="text-sm font-bold"
            style={{ color: COLORS.dark }}
          >
            Sarah Chen
          </div>
          <div
            className="text-sm mt-0.5"
            style={{ color: COLORS.gray500 }}
          >
            VP of Product, CloudScale
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── CTA ─────────────────────────────────── */

function CTA() {
  return (
    <section
      className="py-20 md:py-28 px-6 md:px-10"
      style={{ background: COLORS.blue }}
    >
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="text-3xl md:text-5xl font-bold tracking-tight"
          style={{ color: COLORS.white }}
        >
          Stop guessing.
          <br />
          Start listening.
        </h2>
        <p
          className="mt-4 text-base md:text-lg max-w-lg mx-auto"
          style={{ color: COLORS.white, opacity: 0.8 }}
        >
          Join hundreds of product teams using Vector to build what customers
          actually want. Free for up to 1,000 signals per month.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 text-base font-bold px-8 py-4"
            style={{
              background: COLORS.white,
              color: COLORS.blue,
              borderRadius: 4,
            }}
          >
            Get Started Free
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4"
            style={{
              background: "transparent",
              color: COLORS.white,
              borderRadius: 4,
              border: `2px solid rgba(255,255,255,0.4)`,
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────── */

function Footer() {
  return (
    <footer
      className="py-10 px-6 md:px-10"
      style={{
        background: COLORS.dark,
        borderTop: `4px solid ${COLORS.blue}`,
      }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: COLORS.white }}
        >
          vector
        </span>
        <div className="flex items-center gap-6">
          {["Privacy", "Terms", "Docs", "Status"].map((link) => (
            <a
              key={link}
              href="#"
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: COLORS.gray500 }}
            >
              {link}
            </a>
          ))}
        </div>
        <span className="text-xs" style={{ color: COLORS.gray500 }}>
          &copy; {new Date().getFullYear()} Vector. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

/* ── Page ─────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="w-full min-h-screen" style={{ background: COLORS.white }}>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <StatsBanner />
      <Integrations />
      <Testimonial />
      <CTA />
      <Footer />
    </div>
  );
}
