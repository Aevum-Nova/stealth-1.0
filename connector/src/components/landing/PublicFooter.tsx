import { Link } from "react-router-dom";
import { LogoWordmark } from "./PublicNav";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/#hero" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Changelog", href: "/resources" },
      { label: "Guides", href: "/resources" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Home", href: "/" },
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/register" },
    ],
  },
] as const;

export default function PublicFooter() {
  return (
    <footer className="vector-public-footer">
      <div className="vector-public-container">
        <div className="vector-public-footer-top">
          <div className="vector-public-footer-brand">
            <Link to="/">
              <LogoWordmark />
            </Link>
            <p>
              Customer intelligence for teams that want cleaner signal, faster
              prioritization, and less guesswork.
            </p>
          </div>

          <div className="vector-public-footer-columns">
            {footerColumns.map((col) => (
              <div key={col.title} className="vector-public-footer-col">
                <div className="vector-public-footer-heading">{col.title}</div>
                {col.links.map((link) =>
                  link.href.includes("#") ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="vector-public-footer-link"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      to={link.href}
                      className="vector-public-footer-link"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="vector-public-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Vector. All rights reserved.</span>
          <div className="vector-public-footer-meta">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
