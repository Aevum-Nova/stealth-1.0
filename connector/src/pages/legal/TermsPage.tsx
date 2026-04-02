import { Badge } from "@/components/ui/badge";

const lastUpdated = "April 1, 2026";

export default function TermsPage() {
  return (
    <main className="vector-legal">
      <div className="vector-public-container">
        <div className="vector-legal-header">
          <Badge variant="secondary">Legal</Badge>
          <h1>Terms of Service</h1>
          <p className="vector-legal-updated">Last updated: {lastUpdated}</p>
        </div>

        <div className="vector-legal-content">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Vector ("the Service"), you agree to be
              bound by these Terms of Service ("Terms"). If you are using the
              Service on behalf of an organization, you represent that you have
              authority to bind that organization to these Terms.
            </p>
            <p>
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              Vector is a customer intelligence platform that ingests customer
              feedback from connected communication tools and manual uploads,
              synthesizes that data into actionable signals and feature requests,
              and generates pull requests via an AI agent. The Service includes
              the web application, API, connectors, synthesis engine, and agent.
            </p>
          </section>

          <section>
            <h2>3. Accounts</h2>
            <p>
              You must create an account to use the Service. You are responsible
              for maintaining the security of your account credentials and for
              all activity that occurs under your account. You must notify us
              immediately of any unauthorized use.
            </p>
            <p>
              You must provide accurate and complete information when creating
              your account and keep it up to date.
            </p>
          </section>

          <section>
            <h2>4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload or transmit malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to infringe on the intellectual property rights of others</li>
              <li>Resell or redistribute the Service without prior written consent</li>
            </ul>
          </section>

          <section>
            <h2>5. Customer Data</h2>
            <p>
              You retain ownership of all data you upload or connect to the
              Service ("Customer Data"). By using the Service, you grant us a
              limited license to process, analyze, and store your Customer Data
              solely for the purpose of providing the Service to you.
            </p>
            <p>
              You are responsible for ensuring you have the necessary rights and
              permissions to share Customer Data with the Service, including any
              required consents from individuals whose data may be included.
            </p>
          </section>

          <section>
            <h2>6. AI-Generated Content</h2>
            <p>
              The Service uses artificial intelligence to generate signals,
              feature requests, product context, and code (including pull
              requests). AI-generated content is provided "as is" and may
              contain errors or inaccuracies.
            </p>
            <p>
              You are responsible for reviewing all AI-generated content before
              using it, including reviewing generated pull requests before
              merging them into your codebase. Vector is not liable for any
              issues arising from AI-generated code that is merged without
              adequate review.
            </p>
          </section>

          <section>
            <h2>7. Third-Party Integrations</h2>
            <p>
              The Service integrates with third-party platforms (e.g., Slack,
              GitHub). Your use of these integrations is subject to the
              respective third party's terms of service and privacy policies.
              We are not responsible for the availability, accuracy, or
              practices of third-party services.
            </p>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>
              The Service, including its design, features, code, documentation,
              and branding, is owned by Vector and protected by intellectual
              property laws. These Terms do not grant you any rights to our
              trademarks, logos, or brand assets.
            </p>
            <p>
              Code generated by the Vector agent for your repositories is
              assigned to you upon creation of the pull request.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Vector shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages, including loss of profits, data, or business
              opportunities, arising from your use of the Service.
            </p>
            <p>
              Our total liability for any claims related to the Service shall
              not exceed the amount you paid us in the 12 months preceding the
              claim.
            </p>
          </section>

          <section>
            <h2>10. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" and "as available" without
              warranties of any kind, whether express or implied, including
              warranties of merchantability, fitness for a particular purpose,
              and non-infringement. We do not warrant that the Service will be
              uninterrupted, error-free, or secure.
            </p>
          </section>

          <section>
            <h2>11. Termination</h2>
            <p>
              You may terminate your account at any time. We may suspend or
              terminate your access to the Service if you violate these Terms
              or if we discontinue the Service, with reasonable notice where
              possible.
            </p>
            <p>
              Upon termination, your right to use the Service ceases
              immediately. We will delete your Customer Data within 30 days of
              termination unless legally required to retain it.
            </p>
          </section>

          <section>
            <h2>12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of
              material changes by posting the updated Terms on the Service and
              updating the "Last updated" date. Continued use of the Service
              after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2>13. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the
              laws of the State of Delaware, without regard to conflict of law
              principles.
            </p>
          </section>

          <section>
            <h2>14. Contact</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a href="mailto:legal@tryvector.app" className="vector-legal-link">
                legal@tryvector.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
