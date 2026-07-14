import { useEffect, useRef, useState } from "react";
import { StickyNote, Trash2, X } from "lucide-react";
import type { Annotation, HighlightColor, NormRect, Tool } from "@/lib/annotations";
import { HIGHLIGHT_COLORS, newId } from "@/lib/annotations";

interface Props {
  pageNumber: number;
  width: number; // scaled px
  height: number; // scaled px
  tool: Tool;
  highlightColor: HighlightColor;
  annotations: Annotation[];
  textLayerEl: HTMLElement | null;
  onAdd: (a: Annotation) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}

export function AnnotationLayer({
  pageNumber,
  width,
  height,
  tool,
  highlightColor,
  annotations,
  textLayerEl,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);

  // Highlight: listen for text selection mouseup on the text layer of this page
  useEffect(() => {
    if (tool !== "highlight" || !textLayerEl || !rootRef.current) return;
    const pageEl = rootRef.current.parentElement; // the page container
    if (!pageEl) return;

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      // Ensure selection is within this page's text layer
      if (!textLayerEl.contains(range.startContainer) && !textLayerEl.contains(range.endContainer)) return;

      const pageRect = pageEl.getBoundingClientRect();
      const clientRects = Array.from(range.getClientRects());
      if (clientRects.length === 0) return;

      const rects: NormRect[] = clientRects
        .filter((r) => r.width > 1 && r.height > 1)
        .map((r) => ({
          x: (r.left - pageRect.left) / pageRect.width,
          y: (r.top - pageRect.top) / pageRect.height,
          w: r.width / pageRect.width,
          h: r.height / pageRect.height,
        }));
      if (rects.length === 0) return;

      onAdd({
        id: newId(),
        page: pageNumber,
        type: "highlight",
        color: highlightColor,
        rects,
      });
      sel.removeAllRanges();
    };

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [tool, highlightColor, textLayerEl, pageNumber, onAdd]);

  const handleLayerClick = (e: React.MouseEvent) => {
    if (tool !== "note" && tool !== "text") return;
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (tool === "note") {
      const id = newId();
      onAdd({ id, page: pageNumber, type: "note", x, y, text: "" });
      setOpenNote(id);
    } else {
      onAdd({
        id: newId(),
        page: pageNumber,
        type: "text",
        x,
        y,
        w: 0.35,
        text: "Testo",
        fontSize: 14,
      });
    }
  };

  const overlayInteractive = tool === "note" || tool === "text";

  return (
    <div
      ref={rootRef}
      className="annotation-layer absolute inset-0"
      style={{
        width,
        height,
        pointerEvents: overlayInteractive ? "auto" : "none",
        cursor: tool === "note" ? "copy" : tool === "text" ? "text" : "default",
      }}
      onClick={handleLayerClick}
    >
      {/* Highlights (behind text visually, but text layer is transparent so it works) */}
      {annotations
        .filter((a) => a.type === "highlight")
        .map((a) => {
          if (a.type !== "highlight") return null;
          const color = HIGHLIGHT_COLORS[a.color].css;
          return (
            <div key={a.id} className="group">
              {a.rects.map((r, i) => (
                <div
                  key={i}
                  className="absolute rounded-[1px] transition-shadow"
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    background: color,
                    pointerEvents: "auto",
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDelete(a.id);
                  }}
                  title="Clic destro per eliminare evidenziazione"
                />
              ))}
            </div>
          );
        })}

      {/* Notes */}
      {annotations
        .filter((a) => a.type === "note")
        .map((a) => {
          if (a.type !== "note") return null;
          return (
            <div
              key={a.id}
              className="absolute"
              style={{
                left: `${a.x * 100}%`,
                top: `${a.y * 100}%`,
                pointerEvents: "auto",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenNote(openNote === a.id ? null : a.id);
                }}
                className="-translate-y-1 flex items-center justify-center h-6 w-6 rounded-sm bg-yellow-300 text-yellow-900 shadow-md ring-1 ring-yellow-500/50 hover:scale-110 transition-transform"
                title={a.text || "Nota"}
              >
                <StickyNote className="h-3.5 w-3.5" />
              </button>
              {openNote === a.id && (
                <div
                  className="absolute z-20 top-6 left-0 w-64 rounded-md border border-border bg-popover text-popover-foreground shadow-xl p-2"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Nota</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onDelete(a.id);
                          setOpenNote(null);
                        }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                        title="Elimina nota"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setOpenNote(null)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                        title="Chiudi"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    autoFocus
                    value={a.text}
                    onChange={(e) => onUpdate(a.id, { text: e.target.value })}
                    placeholder="Scrivi un commento…"
                    className="w-full h-24 text-sm p-1.5 rounded border border-input bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          );
        })}

      {/* Text annotations */}
      {annotations
        .filter((a) => a.type === "text")
        .map((a) => {
          if (a.type !== "text") return null;
          // fontSize is in PDF points; the page container is at CSS pixels ≈ points * scale.
          // We derive css font size from height ratio: pageHeightPx / pageHeightPt = scale.
          // Since we don't have scale here, approximate via height/(1/scale). Simpler:
          // font size percent of page height:
          const cssFontSize = (a.fontSize / (height / heightPtRatio(height, width))) * height;
          void cssFontSize; // fallback below uses element height instead
          return (
            <TextAnnotation
              key={a.id}
              a={a}
              pageHeightPx={height}
              onUpdate={(patch) => onUpdate(a.id, patch)}
              onDelete={() => onDelete(a.id)}
            />
          );
        })}
    </div>
  );
}

// Helper (kept for future use); currently unused.
function heightPtRatio(hPx: number, _wPx: number) {
  return hPx; // no-op placeholder
}

function TextAnnotation({
  a,
  pageHeightPx,
  onUpdate,
  onDelete,
}: {
  a: Extract<Annotation, { type: "text" }>;
  pageHeightPx: number;
  onUpdate: (patch: Partial<Annotation>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // The page container is scaled from unscaled PDF points. We stored fontSize in points.
  // pageHeightPx corresponds to (unscaled page height in pt) * scale.
  // We don't know scale/pageHeightPt separately here — but the ratio (pageHeightPx / pageHeightPt)
  // equals scale. Since text annotations use points, and we render inside a container whose
  // pixel size already includes scale, the css font-size in px == fontSize * scale
  //   = fontSize * (pageHeightPx / pageHeightPt).
  // We don't have pageHeightPt in this layer; expose fontSize as % of page height instead
  // by using CSS var trick: font-size relative to container.
  // Simpler: pass through an inline size using em on parent set via font-size:
  //   parent font-size = pageHeightPx px, child font-size = (fontSize/pageHeightPt) em
  // But we still miss pageHeightPt. Practical compromise: assume A4-ish so 1pt ≈ pageHeightPx/842.
  // For visual fidelity we instead let user resize via the drag handle; store fontSize proportionally to page height.
  const fontPx = (a.fontSize / 842) * pageHeightPx;

  return (
    <div
      className="absolute group"
      style={{
        left: `${a.x * 100}%`,
        top: `${a.y * 100}%`,
        width: `${a.w * 100}%`,
        pointerEvents: "auto",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {editing ? (
        <textarea
          autoFocus
          value={a.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onBlur={() => setEditing(false)}
          style={{ fontSize: fontPx, lineHeight: 1.2 }}
          className="w-full min-h-[2em] p-1 border border-primary/60 bg-background/95 text-foreground rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ fontSize: fontPx, lineHeight: 1.2 }}
          className="whitespace-pre-wrap px-1 py-0.5 rounded-sm border border-transparent hover:border-primary/40 hover:bg-primary/5 text-black dark:text-black bg-white/0 cursor-text"
          title="Doppio clic per modificare"
        >
          {a.text}
        </div>
      )}
      <button
        onClick={onDelete}
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow"
        title="Elimina"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
