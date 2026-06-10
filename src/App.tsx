import { useMemo, useRef, useState, type PointerEvent } from "react";
import { CLAUDE_USAGE_PROVIDER } from "./features/claudeUsage/provider";
import { CODEX_USAGE_PROVIDER } from "./features/codexUsage/provider";
import { UsagePanel, type UsageProvider } from "./features/usage/UsagePanel";
import { loadPanelOrder, savePanelOrder } from "./features/usage/storage";
import "./App.css";

const USAGE_PROVIDERS = [CLAUDE_USAGE_PROVIDER, CODEX_USAGE_PROVIDER] as const;
const DEFAULT_PANEL_ORDER = USAGE_PROVIDERS.map((provider) => provider.id);
const DRAG_START_THRESHOLD_PX = 6;

interface PanelDragState {
  active: boolean;
  lastTargetPanelId: string | null;
  panelId: string;
  pointerId: number;
  startX: number;
  startY: number;
}

function sortProvidersByOrder(providers: readonly UsageProvider[], order: readonly string[]) {
  const priority = new Map(order.map((id, index) => [id, index]));
  return [...providers].sort((left, right) => {
    return (priority.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (priority.get(right.id) ?? Number.MAX_SAFE_INTEGER);
  });
}

function App() {
  const [panelOrder, setPanelOrder] = useState(() => loadPanelOrder(DEFAULT_PANEL_ORDER));
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null);
  const panelDragRef = useRef<PanelDragState | null>(null);
  const orderedProviders = useMemo(() => sortProvidersByOrder(USAGE_PROVIDERS, panelOrder), [panelOrder]);

  function movePanel(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;

    setPanelOrder((currentOrder) => {
      const nextOrder = [...currentOrder];
      const fromIndex = nextOrder.indexOf(draggedId);
      const toIndex = nextOrder.indexOf(targetId);

      if (fromIndex < 0 || toIndex < 0) return currentOrder;

      nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, draggedId);
      savePanelOrder(nextOrder);
      return nextOrder;
    });
  }

  function resetPanelDrag() {
    panelDragRef.current = null;
    setDraggedPanelId(null);
    setDropTargetPanelId(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>, providerId: string) {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("button, select, input, textarea, a, label")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    panelDragRef.current = {
      active: false,
      lastTargetPanelId: null,
      panelId: providerId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.active && distance < DRAG_START_THRESHOLD_PX) return;

    if (!drag.active) {
      drag.active = true;
      setDraggedPanelId(drag.panelId);
    }

    event.preventDefault();

    const targetPanel = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-panel-id]");
    const targetPanelId = targetPanel?.dataset.panelId ?? null;

    if (!targetPanelId || targetPanelId === drag.panelId) {
      drag.lastTargetPanelId = null;
      setDropTargetPanelId(null);
      return;
    }

    if (targetPanelId === drag.lastTargetPanelId) return;

    drag.lastTargetPanelId = targetPanelId;
    setDropTargetPanelId(targetPanelId);
    movePanel(drag.panelId, targetPanelId);
  }

  return (
    <main className="container">
      {orderedProviders.map((provider) => (
        <div
          key={provider.id}
          className={[
            "panel-shell",
            provider.id === draggedPanelId ? "dragging" : "",
            provider.id === dropTargetPanelId ? "drop-target" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-panel-id={provider.id}
          onPointerDown={(event) => handlePointerDown(event, provider.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={resetPanelDrag}
          onPointerCancel={resetPanelDrag}
        >
          <UsagePanel {...provider} />
        </div>
      ))}
    </main>
  );
}

export default App;
