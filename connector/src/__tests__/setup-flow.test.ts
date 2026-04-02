import { deriveSetupFlowState } from "@/lib/setup-flow";
import type { Connector } from "@/types/connector";
import type { Trigger } from "@/types/trigger";

function makeConnector(overrides: Partial<Connector>): Connector {
  return {
    id: "connector-1",
    organization_id: "org-1",
    type: "slack",
    name: "Slack",
    enabled: true,
    auto_synthesize: false,
    config: {},
    credentials: { token: "secret" },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    id: "trigger-1",
    connector: {
      id: "connector-1",
      name: "Slack",
      type: "slack",
      display_name: "Slack",
      icon: "slack",
    },
    plugin_type: "slack",
    natural_language_description: "Capture bug reports",
    parsed_filter_criteria: {},
    scope: {},
    scope_summary: "",
    status: "active",
    buffer_config: {
      time_threshold_minutes: 60,
      count_threshold: 10,
      min_buffer_minutes: 5,
    },
    match_config: {
      confidence_threshold: 0.8,
    },
    stats: {
      matched_events_last_24h: 0,
      feature_request_count: 0,
      open_buffer_events: 0,
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveSetupFlowState", () => {
  it("starts with the data source step when nothing is connected", () => {
    const flow = deriveSetupFlowState({});

    expect(flow.currentStep).toBe("connect_data_source");
    expect(flow.completedSteps).toBe(0);
    expect(flow.steps[0]?.status).toBe("current");
  });

  it("advances to synthesis after connectors, triggers, and signals exist", () => {
    const flow = deriveSetupFlowState({
      connectors: [makeConnector({ type: "slack" })],
      triggers: [makeTrigger()],
      signalCount: 8,
    });

    expect(flow.currentStep).toBe("run_synthesis");
    expect(flow.completedSteps).toBe(3);
    expect(flow.steps[3]?.status).toBe("current");
  });

  it("keeps GitHub as the final incomplete step after synthesis has run", () => {
    const flow = deriveSetupFlowState({
      connectors: [makeConnector({ type: "slack" })],
      triggers: [makeTrigger()],
      signalCount: 8,
      synthesisRunCount: 1,
    });

    expect(flow.currentStep).toBe("connect_github");
    expect(flow.completedSteps).toBe(4);
  });

  it("marks setup complete when GitHub is also connected", () => {
    const flow = deriveSetupFlowState({
      connectors: [
        makeConnector({ id: "slack-1", type: "slack" }),
        makeConnector({ id: "github-1", type: "github", name: "GitHub" }),
      ],
      triggers: [makeTrigger()],
      signalCount: 8,
      synthesisRunCount: 1,
    });

    expect(flow.currentStep).toBe("complete");
    expect(flow.completedSteps).toBe(5);
    expect(flow.steps.every((step) => step.status === "complete")).toBe(true);
  });
});
