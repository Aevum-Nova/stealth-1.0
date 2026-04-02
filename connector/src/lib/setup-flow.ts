import type { Connector } from "@/types/connector";
import type { Trigger } from "@/types/trigger";

export type SetupStepKey =
  | "connect_data_source"
  | "create_trigger"
  | "get_first_signals"
  | "run_synthesis"
  | "connect_github"
  | "complete";

export type SetupStepStatus = "complete" | "current" | "upcoming";

export interface SetupFlowStep {
  key: Exclude<SetupStepKey, "complete">;
  title: string;
  description: string;
  href: string;
  status: SetupStepStatus;
}

export interface SetupFlowState {
  hasDataSource: boolean;
  hasTrigger: boolean;
  hasSignals: boolean;
  hasSynthesisRun: boolean;
  hasGithub: boolean;
  currentStep: SetupStepKey;
  completedSteps: number;
  totalSteps: number;
  steps: SetupFlowStep[];
}

interface SetupFlowInput {
  connectors?: Connector[];
  triggers?: Trigger[];
  signalCount?: number;
  synthesisRunCount?: number;
  featureRequestCount?: number;
}

const STEP_ORDER: Array<Omit<SetupFlowStep, "status">> = [
  {
    key: "connect_data_source",
    title: "Connect a data source",
    description: "Add your first input connector so feedback can start flowing in.",
    href: "/connectors",
  },
  {
    key: "create_trigger",
    title: "Create a trigger",
    description: "Tell Vector what to capture from that source.",
    href: "/triggers",
  },
  {
    key: "get_first_signals",
    title: "Get your first signals",
    description: "Sync or send a test message to verify real evidence is arriving.",
    href: "/signals",
  },
  {
    key: "run_synthesis",
    title: "Run synthesis",
    description: "Turn raw signals into grouped product insights and requests.",
    href: "/triggers",
  },
  {
    key: "connect_github",
    title: "Connect GitHub",
    description: "Finish the handoff so approved requests can move toward code.",
    href: "/connectors",
  },
];

function isReadyConnector(connector: Connector) {
  return Boolean(connector.enabled);
}

export function deriveSetupFlowState({
  connectors = [],
  triggers = [],
  signalCount = 0,
  synthesisRunCount = 0,
  featureRequestCount = 0,
}: SetupFlowInput): SetupFlowState {
  const readyConnectors = connectors.filter(isReadyConnector);
  const hasDataSource = readyConnectors.some((connector) => connector.type !== "github");
  const hasGithub = readyConnectors.some((connector) => connector.type === "github");
  const hasTrigger = triggers.length > 0;
  const hasSignals = signalCount > 0;
  const hasSynthesisRun = synthesisRunCount > 0 || featureRequestCount > 0;

  let currentStep: SetupStepKey = "complete";
  if (!hasDataSource) currentStep = "connect_data_source";
  else if (!hasTrigger) currentStep = "create_trigger";
  else if (!hasSignals) currentStep = "get_first_signals";
  else if (!hasSynthesisRun) currentStep = "run_synthesis";
  else if (!hasGithub) currentStep = "connect_github";

  const completedSteps = [
    hasDataSource,
    hasTrigger,
    hasSignals,
    hasSynthesisRun,
    hasGithub,
  ].filter(Boolean).length;

  const steps = STEP_ORDER.map((step, index) => {
    const status: SetupStepStatus =
      index < completedSteps
        ? "complete"
        : step.key === currentStep
          ? "current"
          : "upcoming";

    return {
      ...step,
      status,
    };
  });

  return {
    hasDataSource,
    hasTrigger,
    hasSignals,
    hasSynthesisRun,
    hasGithub,
    currentStep,
    completedSteps,
    totalSteps: STEP_ORDER.length,
    steps,
  };
}
