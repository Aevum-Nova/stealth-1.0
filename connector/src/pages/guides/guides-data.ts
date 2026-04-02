/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export interface GuideStep {
  title: string;
  detail: string;
}

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  asset?: string;
  steps?: GuideStep[];
  tip?: string;
}

export interface Guide {
  slug: string;
  category: string;
  title: string;
  subtitle: string;
  time: string;
  date: string;
  heroAsset: string;
  sections: GuideSection[];
}

/* ------------------------------------------------------------------ */
/*  Guide content                                                      */
/* ------------------------------------------------------------------ */

export const guides: Guide[] = [
  /* ---------------------------------------------------------------- */
  /*  1. Set up Vector in 5 minutes                                    */
  /* ---------------------------------------------------------------- */
  {
    slug: "setup-vector",
    category: "Quick Start",
    title: "Set up Vector in 5 minutes",
    subtitle:
      "Go from zero to your first customer signal in five minutes. This guide walks you through account creation, connecting Slack, and running your first synthesis.",
    time: "5 min read",
    date: "March 2026",
    heroAsset: "Screenshot: Vector dashboard overview after first setup",
    sections: [
      {
        heading: "Prerequisites",
        paragraphs: [
          "Before you begin, make sure you have admin access to a Slack workspace you'd like to monitor. You'll also need a GitHub account if you plan to use the agent for PR generation later.",
          "Vector is currently in free beta — no credit card required.",
        ],
      },
      {
        heading: "Step 1 — Create your account",
        paragraphs: [
          "Head to the Vector registration page and sign up with your email or Google account. You'll be dropped into the onboarding flow automatically.",
        ],
        asset: "Screenshot: Vector registration page",
        steps: [
          {
            title: "Enter your details",
            detail:
              "Provide your name, email, and a password. If you sign up with Google, this step is handled automatically.",
          },
          {
            title: "Confirm your email",
            detail:
              "Check your inbox for a verification link. Click it to activate your account.",
          },
          {
            title: "Complete onboarding",
            detail:
              "You'll be asked to name your workspace and choose your first data source. Select Slack to follow along with this guide.",
          },
        ],
      },
      {
        heading: "Step 2 — Connect Slack",
        paragraphs: [
          "Navigate to Connectors in the sidebar and click New Connector. Select Slack from the list of available integrations.",
          "You'll be redirected to Slack's OAuth flow. Authorize Vector to access your workspace and select the channels you'd like to monitor. Vector can read both public and private channels — choose the ones where customers are most active.",
        ],
        asset: "Screenshot: Slack OAuth authorization screen with channel selection",
        tip: "Start with 2–3 high-signal channels like #support or #feedback rather than connecting everything at once. You can always add more later.",
      },
      {
        heading: "Step 3 — Run your first synthesis",
        paragraphs: [
          "Once Slack is connected, Vector begins ingesting messages immediately. Give it a minute to pull in recent history, then head to the Triggers page and start a synthesis run.",
          "The synthesis engine will analyze every conversation, identify recurring themes, and cluster them into signals. Depending on how much data is in your channels, this typically takes 30 seconds to a few minutes.",
        ],
        asset: "Screenshot: Triggers page showing a synthesis run in progress",
      },
      {
        heading: "Step 4 — Review your signals",
        paragraphs: [
          "Navigate to the Signals tab to see what Vector found. Each signal shows a title, AI-generated summary, the original messages that contributed to it, and a priority score based on frequency, urgency, and impact.",
          "From here you can promote any signal to a Feature Request to start building product context around it. That's it — you're up and running.",
        ],
        asset: "Screenshot: Signals dashboard showing detected signals with scores",
      },
      {
        heading: "What's next?",
        paragraphs: [
          "Now that you have signals flowing, explore the rest of Vector. Promote a signal to a feature request, refine it with the built-in chat, connect GitHub, and let the agent generate your first pull request.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  2. Configuring Slack channel filters                             */
  /* ---------------------------------------------------------------- */
  {
    slug: "slack-channel-filters",
    category: "Configuration",
    title: "Configuring Slack channel filters",
    subtitle:
      "Control exactly which Slack messages reach Vector. Set up channel selection, exclusion rules, and message filters to reduce noise and improve signal quality.",
    time: "8 min read",
    date: "March 2026",
    heroAsset: "Screenshot: Connector detail page showing channel filter configuration",
    sections: [
      {
        heading: "Why filtering matters",
        paragraphs: [
          "Not every message in Slack is customer feedback. Team banter, standup threads, and bot notifications add noise that dilutes signal quality. Filtering lets you focus Vector on the conversations that matter.",
          "Good filters mean better signals, fewer false positives, and faster synthesis runs. It's worth spending a few minutes getting this right.",
        ],
      },
      {
        heading: "Selecting channels",
        paragraphs: [
          "When you first set up the Slack connector, you choose which channels to monitor. You can change this at any time from the connector detail page.",
          "Navigate to Connectors, click on your Slack connector, and you'll see the channel list. Toggle channels on or off as needed.",
        ],
        asset: "Screenshot: Channel selection toggle list on the connector detail page",
        steps: [
          {
            title: "Go to Connectors",
            detail:
              "Click Connectors in the sidebar to see all your connected integrations.",
          },
          {
            title: "Open your Slack connector",
            detail:
              "Click on the Slack connector card to open its detail page.",
          },
          {
            title: "Edit channel selection",
            detail:
              "In the Channels section, use the toggles to enable or disable individual channels. Changes take effect immediately.",
          },
        ],
        tip: "Group your channels by purpose. Monitor customer-facing channels like #support, #feedback, and #feature-requests. Skip internal channels like #engineering or #random.",
      },
      {
        heading: "Setting up exclusion rules",
        paragraphs: [
          "Exclusion rules let you filter out specific types of messages even within monitored channels. This is useful when a customer channel also contains bot notifications or automated alerts.",
          "You can exclude messages by author (e.g., filter out bot users), by keyword (e.g., ignore messages containing 'deploy'), or by thread type (e.g., skip threaded replies).",
        ],
        asset: "Screenshot: Exclusion rules configuration panel",
        steps: [
          {
            title: "Open the Filters tab",
            detail:
              "On the connector detail page, switch to the Filters tab.",
          },
          {
            title: "Add an exclusion rule",
            detail:
              "Click Add Rule and choose the rule type: Author, Keyword, or Thread.",
          },
          {
            title: "Configure the rule",
            detail:
              "Enter the author name, keyword pattern, or thread setting. You can add multiple rules — they are applied with OR logic (any match excludes the message).",
          },
          {
            title: "Save and verify",
            detail:
              "Save your rules and check the Activity log to confirm excluded messages are being filtered.",
          },
        ],
      },
      {
        heading: "Message filters for precision",
        paragraphs: [
          "Beyond exclusions, you can set positive filters that only allow messages matching certain criteria. For example, you might want to only ingest messages that mention specific product names or contain question marks.",
          "Positive filters are applied after exclusion rules. A message must pass exclusion rules AND match at least one positive filter (if any are set) to be ingested.",
        ],
        asset: "Screenshot: Positive filter configuration with keyword matching",
      },
      {
        heading: "Testing your filters",
        paragraphs: [
          "After configuring filters, run a test synthesis on a small time range to verify the results. Check the Signals tab — if you're seeing clean, customer-relevant signals, your filters are working.",
          "If signals still contain noise, iterate on your exclusion rules. It usually takes 2–3 adjustments to dial in the right balance.",
        ],
        tip: "Use the Activity log on the connector detail page to see exactly which messages are being ingested and which are being filtered out. This is the fastest way to debug filter issues.",
      },
      {
        heading: "Recommended filter presets",
        paragraphs: [
          "Here are some common filter configurations that work well for most teams:",
        ],
        steps: [
          {
            title: "Support-focused",
            detail:
              "Monitor: #support, #help, #customer-feedback. Exclude: bot users, messages containing 'resolved' or 'closed'.",
          },
          {
            title: "Product-focused",
            detail:
              "Monitor: #feature-requests, #product-feedback, #beta. Exclude: automated notifications, messages under 10 characters.",
          },
          {
            title: "Broad monitoring",
            detail:
              "Monitor: all customer-facing channels. Exclude: bot users, deploy notifications, standup threads.",
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  3. Maximizing signal quality                                     */
  /* ---------------------------------------------------------------- */
  {
    slug: "maximizing-signal-quality",
    category: "Best Practices",
    title: "Maximizing signal quality",
    subtitle:
      "Get the most accurate and actionable signals from your customer data. Tips for structuring your ingestion pipeline, tuning filters, and interpreting results.",
    time: "6 min read",
    date: "February 2026",
    heroAsset: "Screenshot: High-quality signals dashboard with strong scores",
    sections: [
      {
        heading: "What makes a good signal?",
        paragraphs: [
          "A good signal is specific, actionable, and backed by evidence. It clearly describes a customer need, links to the original conversations, and has a score that reflects real demand — not noise.",
          "Signal quality depends on three things: the quality of your input data, how well your filters are configured, and how much context the synthesis engine has to work with.",
        ],
      },
      {
        heading: "Principle 1 — More context, better signals",
        paragraphs: [
          "The synthesis engine performs best when it has rich, contextual conversations to analyze. Short messages like 'this is broken' produce weak signals. Detailed messages like 'the export button on the reports page times out when I select more than 500 rows' produce strong, actionable ones.",
          "You can't control what your customers write, but you can control which data sources you connect. Prioritize channels and sources where customers describe problems in detail.",
        ],
        asset: "Diagram: Comparison of weak vs. strong signal inputs",
        tip: "Support channels tend to produce the best signals because customers describe their problems in detail when asking for help.",
      },
      {
        heading: "Principle 2 — Clean input, clean output",
        paragraphs: [
          "Noise in your input data directly degrades signal quality. Bot messages, automated notifications, and off-topic conversations dilute the synthesis engine's ability to identify real patterns.",
          "Spend time configuring your Slack channel filters and exclusion rules. This is the single highest-leverage thing you can do to improve signal quality.",
        ],
        asset: "Screenshot: Before and after signal quality with proper filtering",
      },
      {
        heading: "Principle 3 — Volume matters",
        paragraphs: [
          "The synthesis engine identifies patterns across messages. The more data it has, the more confidently it can cluster related feedback and score signals accurately. A signal backed by 50 messages is more reliable than one backed by 2.",
          "If your signals feel sparse or low-confidence, consider connecting additional data sources. Use the Ingest page to upload historical support tickets, survey responses, or call notes.",
        ],
        steps: [
          {
            title: "Connect additional Slack channels",
            detail:
              "Go to your Slack connector and enable more customer-facing channels.",
          },
          {
            title: "Upload historical data",
            detail:
              "Export past support tickets or survey data as CSV and upload them on the Ingest page.",
          },
          {
            title: "Schedule regular synthesis runs",
            detail:
              "Set up recurring triggers so signals stay fresh as new data flows in.",
          },
        ],
      },
      {
        heading: "Principle 4 — Review and prune regularly",
        paragraphs: [
          "Not every signal the engine produces will be relevant. Some may be duplicates, some may be too vague, and some may reflect edge cases rather than real demand. Regularly reviewing your signals and dismissing low-quality ones helps keep your pipeline clean.",
          "When you promote a signal to a feature request, you're telling Vector that this signal is worth acting on. This feedback loop improves future synthesis runs.",
        ],
        asset: "Screenshot: Signal review workflow — promoting vs. dismissing signals",
      },
      {
        heading: "Measuring signal quality",
        paragraphs: [
          "Track these indicators to know if your signal quality is improving:",
        ],
        steps: [
          {
            title: "Promotion rate",
            detail:
              "What percentage of signals get promoted to feature requests? A healthy rate is 15–30%. If it's lower, your filters may need tuning.",
          },
          {
            title: "Evidence depth",
            detail:
              "How many source messages back each signal? Signals with 5+ messages are more reliable than those with 1–2.",
          },
          {
            title: "Actionability",
            detail:
              "Can your team act on the signal without additional research? If most signals require clarification, the input data may lack context.",
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  4. From signal to pull request                                   */
  /* ---------------------------------------------------------------- */
  {
    slug: "signal-to-pull-request",
    category: "Tutorial",
    title: "From signal to pull request",
    subtitle:
      "Walk through Vector's complete end-to-end workflow: detect a customer signal, promote it to a feature request, refine the product context, and generate a pull request with the agent.",
    time: "12 min read",
    date: "March 2026",
    heroAsset: "Diagram: End-to-end flow from Slack message to merged PR",
    sections: [
      {
        heading: "Overview",
        paragraphs: [
          "This tutorial walks through the full Vector pipeline from start to finish. By the end, you'll have taken a raw customer conversation, turned it into a structured feature request with full product context, and generated a pull request implementing the feature.",
          "We'll use a real example: customers requesting a dark mode toggle in the dashboard.",
        ],
      },
      {
        heading: "Part 1 — Detecting the signal",
        paragraphs: [
          "After connecting your Slack workspace and running a synthesis, Vector identifies that multiple customers have mentioned wanting dark mode. The synthesis engine clusters these messages into a single signal titled 'Dark mode for dashboard'.",
          "Navigate to the Signals tab to find it. You'll see the signal card with a title, AI-generated summary, priority score, and a list of the original Slack messages that contributed to it.",
        ],
        asset: "Screenshot: Signal detail view showing the dark mode signal with source messages",
        tip: "Click on any source message to see the full Slack thread for additional context.",
      },
      {
        heading: "Part 2 — Promoting to a feature request",
        paragraphs: [
          "This signal has a high priority score and clear customer demand. Click the Promote button on the signal detail page to turn it into a Feature Request.",
          "Vector will generate a full product context page with an AI-drafted problem statement, customer quotes, suggested scope, technical considerations, and acceptance criteria.",
        ],
        asset: "Screenshot: Feature request creation from signal promotion",
        steps: [
          {
            title: "Click Promote",
            detail:
              "On the signal detail page, click the Promote to Feature Request button.",
          },
          {
            title: "Review the generated context",
            detail:
              "Vector creates a product context page automatically. Review the problem statement, scope, and acceptance criteria.",
          },
          {
            title: "Check the linked evidence",
            detail:
              "The feature request links back to the original signal and source messages so you always have the customer evidence.",
          },
        ],
      },
      {
        heading: "Part 3 — Refining with chat",
        paragraphs: [
          "The AI-generated context is a strong starting point, but you'll likely want to refine it. Use the built-in chat on the product context page to make adjustments.",
          "You can ask the agent to narrow the scope, add specific requirements, adjust the acceptance criteria, or rewrite sections. Changes are reflected in the document in real time.",
        ],
        asset: "Screenshot: Chat-based refinement of product context page",
        steps: [
          {
            title: "Open the chat panel",
            detail:
              "On the product context page, the chat panel is on the right side. Type your refinement requests here.",
          },
          {
            title: "Refine the scope",
            detail:
              "Example: 'Limit this to a simple toggle in the settings page. Don't include per-component theming.'",
          },
          {
            title: "Add requirements",
            detail:
              "Example: 'The toggle should persist across sessions using localStorage. Default to the system preference.'",
          },
          {
            title: "Finalize acceptance criteria",
            detail:
              "Example: 'Add a criterion that the toggle must work on both desktop and mobile viewports.'",
          },
        ],
        tip: "Be specific in your chat messages. The more precise your instructions, the better the agent can refine the context.",
      },
      {
        heading: "Part 4 — Approving and generating the PR",
        paragraphs: [
          "When the product context is ready, click the Approve button. This triggers the Vector agent to read the full product context — problem statement, requirements, scope, and acceptance criteria — and generate a pull request.",
          "The agent analyzes your connected GitHub repository, understands the file structure and coding conventions, and generates meaningful code changes. It creates a feature branch and opens a PR with a descriptive title and body.",
        ],
        asset: "Screenshot: Approved feature request triggering agent PR generation",
      },
      {
        heading: "Part 5 — Reviewing the pull request",
        paragraphs: [
          "Head to your GitHub repository. You'll find a new PR from Vector with the implementation. The PR body includes the full product context, linked customer evidence, and implementation notes.",
          "Review it like any other PR. You can leave comments, request changes, or merge directly. If you need adjustments, go back to the product context page, refine the requirements, and regenerate.",
        ],
        asset: "Screenshot: Generated PR in GitHub with Vector context in the body",
        steps: [
          {
            title: "Open the PR in GitHub",
            detail:
              "Click the PR link from the feature request page, or find it in your repository's pull request list.",
          },
          {
            title: "Review the code changes",
            detail:
              "Check the diff, run tests, and verify the implementation matches the acceptance criteria.",
          },
          {
            title: "Merge or iterate",
            detail:
              "If the PR looks good, merge it. If it needs changes, leave review comments or regenerate from an updated product context.",
          },
        ],
      },
      {
        heading: "Recap",
        paragraphs: [
          "You've now completed the full Vector loop: customer conversations in Slack became a detected signal, which became a structured feature request with product context, which became a pull request implementing the feature. The entire workflow — from raw feedback to shipped code — is connected end to end.",
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  5. Understanding the synthesis engine                            */
  /* ---------------------------------------------------------------- */
  {
    slug: "synthesis-engine",
    category: "Deep Dive",
    title: "Understanding the synthesis engine",
    subtitle:
      "A deep dive into how Vector's AI processes thousands of messages to identify patterns, cluster related feedback, and score signals by priority.",
    time: "10 min read",
    date: "February 2026",
    heroAsset: "Diagram: High-level architecture of the synthesis pipeline",
    sections: [
      {
        heading: "What is the synthesis engine?",
        paragraphs: [
          "The synthesis engine is the core of Vector. It takes raw, unstructured customer conversations and transforms them into structured, prioritized signals that product teams can act on.",
          "Under the hood, the engine runs a multi-stage pipeline: ingestion, preprocessing, embedding, clustering, scoring, and output. Each stage refines the data until clear signals emerge.",
        ],
      },
      {
        heading: "Stage 1 — Ingestion",
        paragraphs: [
          "The pipeline starts with raw data from your connected sources. Slack messages stream in real time, while uploaded files (CSV, JSON, plain text) are processed in batch.",
          "Each message is normalized into a common format: content, author, timestamp, and source. This ensures the downstream stages work identically regardless of where the data came from.",
        ],
        asset: "Diagram: Data ingestion flow from multiple sources into the normalized format",
      },
      {
        heading: "Stage 2 — Preprocessing",
        paragraphs: [
          "Raw messages often contain noise: greetings, thank-yous, bot commands, and off-topic content. The preprocessing stage strips this away, leaving only the substantive content.",
          "Messages are also split into semantic units. A single long message might contain three distinct requests — the preprocessor identifies and separates them so each can be analyzed independently.",
        ],
        asset: "Diagram: Before and after preprocessing — noise removal and semantic splitting",
      },
      {
        heading: "Stage 3 — Embedding and clustering",
        paragraphs: [
          "Each preprocessed message segment is converted into a vector embedding — a numerical representation of its meaning. Segments with similar meanings end up close together in the embedding space.",
          "The clustering algorithm groups nearby embeddings into clusters. Each cluster represents a distinct theme or request that multiple customers are talking about. This is where individual messages become collective signals.",
        ],
        asset: "Diagram: 2D visualization of message embeddings forming clusters",
        tip: "The engine uses semantic similarity, not keyword matching. Messages like 'I wish there was dark mode' and 'The bright white screen hurts my eyes at night' end up in the same cluster.",
      },
      {
        heading: "Stage 4 — Scoring",
        paragraphs: [
          "Each cluster is scored on three dimensions to determine its priority. The three scores are then combined into a single priority score that determines the signal's ranking on your dashboard.",
        ],
        steps: [
          {
            title: "Frequency",
            detail:
              "How many distinct customers and messages mention this theme? Higher frequency indicates broader demand.",
          },
          {
            title: "Urgency",
            detail:
              "How urgent is the language used? Words like 'blocker', 'critical', and 'can't use' increase urgency. Casual mentions like 'it would be nice' score lower.",
          },
          {
            title: "Impact",
            detail:
              "What is the potential product impact? The engine estimates this based on the specificity of the request and the context of the conversations.",
          },
        ],
      },
      {
        heading: "Stage 5 — Output",
        paragraphs: [
          "The final stage generates the signal objects you see in the dashboard. Each signal includes a title, AI-generated summary, the priority score, and links to every source message that contributed to it.",
          "Signals are deduplicated against existing signals from previous runs. If a new run detects a theme that already has a signal, the existing signal is updated with the new evidence rather than creating a duplicate.",
        ],
        asset: "Screenshot: Final signal output in the dashboard with all metadata",
      },
      {
        heading: "Tuning synthesis performance",
        paragraphs: [
          "The synthesis engine is designed to work well out of the box, but there are a few things you can do to improve results:",
        ],
        steps: [
          {
            title: "Improve input quality",
            detail:
              "Better filters and more diverse data sources give the engine more to work with. See our guide on maximizing signal quality.",
          },
          {
            title: "Run synthesis frequently",
            detail:
              "Regular runs catch emerging trends early. Set up recurring triggers to run synthesis daily or weekly.",
          },
          {
            title: "Review and provide feedback",
            detail:
              "Promoting good signals and dismissing bad ones helps calibrate future runs.",
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  6. Connecting GitHub for PR generation                           */
  /* ---------------------------------------------------------------- */
  {
    slug: "github-pr-generation",
    category: "Integration",
    title: "Connecting GitHub for PR generation",
    subtitle:
      "Set up the GitHub connector so the Vector agent can analyze your codebase and create pull requests from approved feature requests.",
    time: "4 min read",
    date: "March 2026",
    heroAsset: "Screenshot: GitHub connector setup page in Vector",
    sections: [
      {
        heading: "Prerequisites",
        paragraphs: [
          "You'll need admin or maintainer access to the GitHub repository you want to connect. The repository can be public or private — Vector supports both.",
          "Make sure you have at least one feature request ready to go so you can test the integration end to end.",
        ],
      },
      {
        heading: "Step 1 — Create the GitHub connector",
        paragraphs: [
          "Navigate to Connectors in the sidebar and click New Connector. Select GitHub from the list of available integrations.",
        ],
        asset: "Screenshot: New connector page with GitHub option highlighted",
        steps: [
          {
            title: "Click New Connector",
            detail:
              "From the Connectors page, click the New Connector button in the top right.",
          },
          {
            title: "Select GitHub",
            detail:
              "Choose GitHub from the integration list. You'll be redirected to GitHub's OAuth authorization flow.",
          },
          {
            title: "Authorize Vector",
            detail:
              "Grant Vector access to the repositories you want to use. You can select specific repositories rather than granting access to all repos.",
          },
        ],
      },
      {
        heading: "Step 2 — Select your repository",
        paragraphs: [
          "After authorization, you'll be returned to Vector. Select the repository the agent should target for pull requests.",
          "The agent will analyze the repository's file structure, coding conventions, and existing patterns to generate code that fits naturally into your codebase.",
        ],
        asset: "Screenshot: Repository selection dropdown after GitHub OAuth",
        tip: "Connect the repository where your main product code lives. The agent works best with well-structured repositories that have clear file organization.",
      },
      {
        heading: "Step 3 — Configure branch settings",
        paragraphs: [
          "By default, the agent creates feature branches off your main branch and opens PRs targeting main. You can customize the base branch if your team uses a different workflow.",
          "Branch names are auto-generated based on the feature request title (e.g., feature/dark-mode-toggle). You can set a prefix or naming convention in the connector settings.",
        ],
        asset: "Screenshot: Branch configuration settings for the GitHub connector",
      },
      {
        heading: "Step 4 — Test the integration",
        paragraphs: [
          "The best way to verify everything is working is to approve a feature request and watch the agent generate a PR.",
        ],
        steps: [
          {
            title: "Go to Feature Requests",
            detail:
              "Navigate to Feature Requests and open one that's ready for implementation.",
          },
          {
            title: "Click Approve",
            detail:
              "Approve the feature request to trigger the agent. You'll see a status indicator showing the agent is working.",
          },
          {
            title: "Check GitHub",
            detail:
              "Within a few minutes, a new PR will appear in your repository. Verify the branch, title, body, and code changes.",
          },
        ],
        asset: "Screenshot: Generated PR in GitHub showing the agent's code changes",
      },
      {
        heading: "Troubleshooting",
        paragraphs: [
          "If the agent fails to create a PR, check these common issues:",
        ],
        steps: [
          {
            title: "Permission errors",
            detail:
              "Make sure Vector has write access to the repository. Re-authorize the GitHub connector if needed.",
          },
          {
            title: "Branch conflicts",
            detail:
              "If a branch with the same name already exists, the agent will fail. Delete the stale branch in GitHub and retry.",
          },
          {
            title: "Large repositories",
            detail:
              "Very large monorepos may take longer to analyze. The agent will still work, but PR generation may take a few extra minutes.",
          },
        ],
        tip: "Check the connector detail page for real-time status updates and error logs. Most issues can be diagnosed from there.",
      },
    ],
  },
];
