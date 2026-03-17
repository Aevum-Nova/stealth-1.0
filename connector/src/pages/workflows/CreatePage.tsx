import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  BackgroundVariant,
  type ReactFlowInstance,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { StepNode, StepNodeData, StepType } from "@/types/workflow";
import StepNodeComponent from "@/components/workflows/StepNode";
import NodePalette from "@/components/workflows/NodePalette";
import ConfigPanel from "@/components/workflows/ConfigPanel";
import CanvasToolbar from "@/components/workflows/CanvasToolbar";

const nodeTypes = { step: StepNodeComponent };

let nodeId = 0;
function nextId() {
  return `step_${++nodeId}`;
}

function createStepNode(
  stepType: StepType,
  position: { x: number; y: number },
): StepNode {
  return {
    id: nextId(),
    type: "step",
    position,
    data: {
      stepType,
      label: "",
      description: "",
      configured: false,
      config: {},
    },
  };
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "var(--ink-muted)", strokeWidth: 1.5 },
};

export default function CreatePage() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<
    StepNode,
    Edge
  > | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<StepNode | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled workflow");
  const [isSaving, setIsSaving] = useState(false);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const stepType = event.dataTransfer.getData(
        "application/reactflow",
      ) as StepType;
      if (!stepType) return;

      if (!rfInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode = createStepNode(stepType, position);
      setNodes((nds) => [...nds, newNode]);
    },
    [rfInstance, setNodes],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: StepNode) => {
      setSelectedNode(node);
    },
    [],
  );

  const onNodeUpdate = useCallback(
    (id: string, data: Partial<StepNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      );
      setSelectedNode((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...prev.data, ...data } }
          : prev,
      );
    },
    [setNodes],
  );

  const allConfigured =
    nodes.length > 0 && nodes.every((n) => n.data.configured);

  const onSave = useCallback(() => {
    if (!rfInstance) return;
    setIsSaving(true);
    const flow = rfInstance.toObject();
    localStorage.setItem(
      "vector_workflow_draft",
      JSON.stringify({ name: workflowName, ...flow }),
    );
    setTimeout(() => setIsSaving(false), 600);
  }, [rfInstance, workflowName]);

  const onDeploy = useCallback(() => {
    // placeholder
  }, []);

  return (
    <div className="relative h-full w-full" ref={reactFlowWrapper}>
      <CanvasToolbar
        name={workflowName}
        onNameChange={setWorkflowName}
        onSave={onSave}
        onDeploy={onDeploy}
        canDeploy={allConfigured}
        isSaving={isSaving}
      />

      <div className="h-full w-full pt-12">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--line)"
          />
          <Controls
            showInteractive={false}
            className="!rounded-lg !border !border-[var(--line)] !bg-[var(--surface)] !shadow-sm [&>button]:!border-[var(--line)] [&>button]:!bg-[var(--surface)] [&>button]:hover:!bg-[var(--surface-subtle)]"
          />
          <MiniMap
            nodeColor={() => "var(--ink-muted)"}
            maskColor="var(--surface)"
            className="!rounded-lg !border !border-[var(--line)] !bg-[var(--surface)] !shadow-sm"
          />
        </ReactFlow>
      </div>

      <NodePalette />

      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          onUpdate={onNodeUpdate}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
