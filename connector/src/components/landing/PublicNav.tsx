import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Product", href: "/#hero" },
  { label: "Docs", href: "/docs" },
  { label: "Resources", href: "/resources" },
  { label: "Integrations", href: "/integrations" },
] as const;

function LogoWordmark() {
  return (
    <div className="vector-logo">
      <span className="vector-logo-mark" aria-hidden />
      <span>Vector</span>
    </div>
  );
}

export default function PublicNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="vector-public-nav">
      <div className="vector-public-nav-container">
        <Link to="/" className="vector-public-nav-brand" aria-label="Vector home">
          <LogoWordmark />
        </Link>

        <nav className="vector-public-nav-links" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={cn(
                "vector-public-nav-link",
                location.pathname === link.href && "active"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="vector-public-nav-actions">
          <ThemeToggle compact />
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>

        <button
          type="button"
          className="vector-public-nav-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="vector-public-nav-mobile">
          <nav className="vector-public-nav-mobile-links">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="vector-public-nav-mobile-link"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="vector-public-nav-mobile-actions">
            <Link to="/login" onClick={() => setMobileOpen(false)}>
              <Button variant="secondary" className="w-full">
                Log in
              </Button>
            </Link>
            <Link to="/register" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Get Started</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export { LogoWordmark };
