import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  Images,
  ListTree,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  MousePointer2,
  Hand,
} from "lucide-react";

import { loadPdfjs } from "@/lib/pdfjs-loader";
import { useTheme } from "@/hooks/use-theme";
import { DropZone } from "./DropZone";
import { PdfPage } from "./PdfPage";
import { PdfThumbnail } from "./PdfThumbnail";
import { PdfOutline } from "./PdfOutline";

type SidebarTab = "thumbs" | "outline";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.1;

export function PdfViewer() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("thumbs");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageInput, setPageInput] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const openFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const task = pdfjs.getDocument({ data: buffer });
      const doc = await task.promise;
      setPdf(doc);
      setNumPages(doc.numPages);
      setFileName(file.name);
      setCurrentPage(1);
      setPageInput("1");
    } catch (e) {
      console.error(e);
      setError("Impossibile aprire il file. Assicurati che sia un PDF valido.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const registerPageRef = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(page, el);
    else pageRefs.current.delete(page);
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(2)));
  const handleZoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(2)));
  const handleFitPage = () => {
    if (!scrollRef.current || !pdf) return;
    pdf.getPage(currentPage).then((p) => {
      const vp = p.getViewport({ scale: 1 });
      const container = scrollRef.current!;
      const availH = container.clientHeight - 64;
      const availW = container.clientWidth - 64;
      const s = Math.min(availW / vp.width, availH / vp.height);
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, +s.toFixed(2))));
    });
  };

  // Ctrl/Cmd + wheel zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.005;
        setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(s + delta).toFixed(2))));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [pdf]);

  // Pinch zoom (touch)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = scale;
    const dist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.hypot(dx, dy);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = scale;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const d = dist(e.touches);
        const ratio = d / startDist;
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(startScale * ratio).toFixed(2))));
      }
    };
    el.addEventListener("touchstart", onStart);
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, [scale]);

  const handlePageVisible = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const pages = useMemo(() => {
    if (!pdf) return [];
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [pdf, numPages]);

  if (!pdf) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <TopBar
          isDark={isDark}
          onToggleTheme={toggleTheme}
          fileName=""
          hasPdf={false}
        />
        {error && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-viewer-bg text-muted-foreground">
            Caricamento del documento…
          </div>
        ) : (
          <DropZone onFile={openFile} />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar isDark={isDark} onToggleTheme={toggleTheme} fileName={fileName} hasPdf>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Nascondi barra laterale" : "Mostra barra laterale"}
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Attiva/disattiva barra laterale"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={handleZoomOut}
            title="Riduci zoom"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Riduci zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-toolbar-foreground w-12 text-center select-none">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            title="Aumenta zoom"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Aumenta zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleFitPage}
            title="Adatta alla pagina"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
            aria-label="Adatta alla pagina"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            title="Pagina precedente"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40"
            disabled={currentPage <= 1}
            aria-label="Pagina precedente"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-sm text-toolbar-foreground select-none">
            <span className="text-muted-foreground">Pagina</span>
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Math.max(1, Math.min(numPages, Number(pageInput) || 1));
                  scrollToPage(n);
                }
              }}
              onBlur={() => setPageInput(String(currentPage))}
              className="w-12 h-7 text-center rounded border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="Numero pagina"
            />
            <span className="text-muted-foreground">di {numPages}</span>
          </div>
          <button
            onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
            title="Pagina successiva"
            className="p-2 rounded-md hover:bg-accent text-toolbar-foreground disabled:opacity-40"
            disabled={currentPage >= numPages}
            aria-label="Pagina successiva"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="h-6 w-px bg-border mx-1" />
          <button
            onClick={() => setSearchOpen((v) => !v)}
            title="Cerca nel documento"
            className={`p-2 rounded-md hover:bg-accent text-toolbar-foreground ${
              searchOpen ? "bg-accent" : ""
            }`}
            aria-label="Cerca nel documento"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </TopBar>

      {searchOpen && (
        <div className="border-b border-border bg-toolbar px-4 py-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca nel documento…"
            className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
              aria-label="Cancella ricerca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="text-xs px-2 py-1 rounded hover:bg-accent text-toolbar-foreground"
          >
            Chiudi
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-64 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
            <div className="flex border-b border-border">
              <button
                onClick={() => setSidebarTab("thumbs")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === "thumbs"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Images className="h-4 w-4" />
                Anteprime
              </button>
              <button
                onClick={() => setSidebarTab("outline")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === "outline"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListTree className="h-4 w-4" />
                Indice
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {sidebarTab === "thumbs" ? (
                <div className="p-3 flex flex-col gap-3">
                  {pages.map((n) => (
                    <button
                      key={n}
                      onClick={() => scrollToPage(n)}
                      className={`rounded-md p-1 transition-colors ${
                        currentPage === n ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-sidebar-hover"
                      }`}
                    >
                      <PdfThumbnail pdf={pdf} pageNumber={n} />
                    </button>
                  ))}
                </div>
              ) : (
                <PdfOutline pdf={pdf} onNavigate={scrollToPage} />
              )}
            </div>
          </aside>
        )}

        <main
          ref={scrollRef}
          className="flex-1 overflow-auto scrollbar-thin bg-viewer-bg"
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="flex flex-col items-center gap-8 py-8 px-4">
            {pages.map((n) => (
              <PdfPage
                key={n}
                pdf={pdf}
                pageNumber={n}
                scale={scale}
                searchQuery={searchQuery}
                onVisible={handlePageVisible}
                registerRef={registerPageRef}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function TopBar({
  isDark,
  onToggleTheme,
  fileName,
  hasPdf,
  children,
}: {
  isDark: boolean;
  onToggleTheme: () => void;
  fileName: string;
  hasPdf: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="h-12 flex items-center px-3 gap-3 border-b border-border bg-toolbar text-toolbar-foreground shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm">Lettore PDF</span>
        {hasPdf && fileName && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground truncate max-w-xs" title={fileName}>
              {fileName}
            </span>
          </>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center">{children}</div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleTheme}
          title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
          className="p-2 rounded-md hover:bg-accent text-toolbar-foreground"
          aria-label="Attiva/disattiva tema scuro"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
