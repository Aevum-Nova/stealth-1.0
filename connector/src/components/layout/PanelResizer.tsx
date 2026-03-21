import { useCallback, useEffect, useRef, useState } from "react";

interface PanelResizerProps {
  onResize: (deltaX: number) => void;
  /** Called once when the drag ends (commit width to React state / storage here). */
  onResizeEnd?: () => void;
  side: "left" | "right";
}

export default function PanelResizer({ onResize, onResizeEnd, side }: PanelResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    lastXRef.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      // right resizer: invert so drag-right = grow right panel (matches expected scroll/read direction)
      onResize(side === "right" ? -delta : delta);
    };

    const handleMouseUp = () => {
      onResizeEnd?.();
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, onResize, onResizeEnd, side]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={handleMouseDown}
      className={`absolute top-0 bottom-0 z-10 w-1.5 shrink-0 cursor-col-resize transition-colors xl:block ${
        side === "left"
          ? "right-0 translate-x-1/2"
          : "left-0 -translate-x-1/2"
      } ${
        isDragging
          ? "bg-[var(--ink)]/30"
          : "bg-transparent hover:bg-[var(--line-soft)]"
      }`}
      style={{ touchAction: "none" }}
    />
  );
}
