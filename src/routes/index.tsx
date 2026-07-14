import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const PdfViewer = lazy(() =>
  import("@/components/pdf/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lettore PDF" },
      {
        name: "description",
        content:
          "Lettore PDF moderno, ultra-veloce e fluido. Anteprime, indice, ricerca e modalità scura. I file rimangono sul tuo dispositivo.",
      },
      { property: "og:title", content: "Lettore PDF" },
      {
        property: "og:description",
        content:
          "Lettore PDF moderno, ultra-veloce e fluido. Anteprime, indice, ricerca e modalità scura. I file rimangono sul tuo dispositivo.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-viewer-bg text-muted-foreground">
          Caricamento…
        </div>
      }
    >
      <PdfViewer />
    </Suspense>
  );
}
