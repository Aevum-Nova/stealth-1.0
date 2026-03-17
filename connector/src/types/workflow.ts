import type { Node, Edge } from "@xyflow/react";

export type StepType =
  | "plugin"
  | "ingestTrigger"
  | "synthesisTrigger"
  | "featureRequest"
  | "pullRequest";

export interface StepNodeData {
  stepType: StepType;
  label: string;
  description: string;
  configured: boolean;
  config: Record<string, string>;
  [key: string]: unknown;
}

export type StepNode = Node<StepNodeData, "step">;
export type WorkflowEdge = Edge;

export interface Workflow {
  id: string;
  name: string;
  nodes: StepNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export const STEP_META: Record<
  StepType,
  { label: string; description: string; color: string; icon: string }
> = {
  plugin: {
    label: "Plugin",
    description: "Connect a data source",
    color: "#8b5cf6",
    icon: "Boxes",
  },
  ingestTrigger: {
    label: "Ingest Trigger",
    description: "Define when to ingest data",
    color: "#f59e0b",
    icon: "Database",
  },
  synthesisTrigger: {
    label: "Synthesis Trigger",
    description: "Configure synthesis rules",
    color: "#3b82f6",
    icon: "Sparkles",
  },
  featureRequest: {
    label: "Feature Request",
    description: "Generate feature requests",
    color: "#10b981",
    icon: "Lightbulb",
  },
  pullRequest: {
    label: "Pull Request",
    description: "Create pull requests",
    color: "#8b5cf6",
    icon: "GitPullRequest",
  },
};
