import { Badge } from "@/components/ui/badge";

const lastUpdated = "April 1, 2026";

export default function PrivacyPage() {
  return (
    <main className="vector-legal">
      <div className="vector-public-container">
        <div className="vector-legal-header">
          <Badge variant="secondary">Legal</Badge>
          <h1>Privacy Policy</h1>
          <p className="vector-legal-updated">Last updated: {lastUpdated}</p>
        </div>

        <div className="vector-legal-content">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Vector ("we", "our", or "us") is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use,
              disclose, and safeguard your information when you use our platform,
              including our website, connectors, synthesis engine, and agent
              services (collectively, the "Service").
            </p>
            <p>
              By using the Service, you agree to the collection and use of
              information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <h3>Account Information</h3>
            <p>
              When you create an account, we collect your name, email address,
              and authentication credentials. If you sign up via OAuth (e.g.,
              Google), we receive your profile information from the identity
              provider.
            </p>
            <h3>Customer Data</h3>
            <p>
              When you connect third-party services (e.g., Slack, GitHub) or
              upload data manually, we ingest and process the content you
              authorize. This may include messages, conversations, support
              tickets, and other customer feedback data ("Customer Data").
            </p>
            <h3>Usage Data</h3>
            <p>
              We automatically collect information about how you interact with
              the Service, including pages visited, features used, timestamps,
              and device/browser information.
            </p>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and synthesize Customer Data to generate signals and feature requests</li>
              <li>Generate pull requests via the Vector agent on your behalf</li>
              <li>Communicate with you about your account, updates, and support</li>
              <li>Monitor usage patterns to improve performance and reliability</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Processing & AI</h2>
            <p>
              Vector uses artificial intelligence to analyze Customer Data,
              detect patterns, and generate insights. Your Customer Data is
              processed solely to provide the Service to you. We do not use your
              Customer Data to train general-purpose AI models or share it with
              other customers.
            </p>
          </section>

          <section>
            <h2>5. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share information
              with:
            </p>
            <ul>
              <li>
                <strong>Service providers</strong> who assist in operating the
                Service (hosting, analytics, email delivery), bound by
                confidentiality obligations
              </li>
              <li>
                <strong>Third-party integrations</strong> you explicitly connect
                (e.g., GitHub for PR creation), limited to the data required for
                the integration to function
              </li>
              <li>
                <strong>Legal authorities</strong> when required by law,
                regulation, or legal process
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Data Retention</h2>
            <p>
              We retain your account information for as long as your account is
              active. Customer Data is retained for the duration of your
              subscription and deleted within 30 days of account termination,
              unless you request earlier deletion. You may request deletion of
              your data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2>7. Security</h2>
            <p>
              We implement industry-standard security measures to protect your
              data, including encryption in transit (TLS) and at rest,
              access controls, and regular security audits. However, no method
              of electronic transmission or storage is 100% secure.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Export your data in a portable format</li>
            </ul>
            <p>
              To exercise these rights, contact us at the email address provided
              below.
            </p>
          </section>

          <section>
            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              the Service and updating the "Last updated" date. Continued use
              of the Service after changes constitutes acceptance of the revised
              policy.
            </p>
          </section>

          <section>
            <h2>10. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or our data
              practices, please contact us at{" "}
              <a href="mailto:privacy@tryvector.app" className="vector-legal-link">
                privacy@tryvector.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
