import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YT2MP3 — Converta vídeos do YouTube em MP3" },
      {
        name: "description",
        content:
          "Cole o link do YouTube e converta em MP3 320 kbps em segundos. Rápido, seguro e sem cadastro.",
      },
      { property: "og:title", content: "YT2MP3 — Converta vídeos do YouTube em MP3" },
      {
        property: "og:description",
        content: "Cole o link do YouTube e converta em MP3 320 kbps em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Conversion = { id: string; title: string; size: string; time: string };

function Index() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Conversion[]>([]);

  const convert = () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    const link = url.trim();
    setTimeout(() => {
      setHistory((h) => [
        {
          id: crypto.randomUUID(),
          title: link.replace(/^https?:\/\//, "").slice(0, 48),
          size: "4.2 MB",
          time: "agora",
        },
        ...h,
      ]);
      setUrl("");
      setLoading(false);
    }, 1400);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[720px] rounded-[2.5rem] border border-border/60 bg-card/75 p-8 shadow-[var(--shadow-panel)] backdrop-blur-xl sm:p-12">
        <span className="inline-block rounded-full border border-primary/25 bg-primary/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
          🎧 conversor de áudio
        </span>

        <h1
          className="mt-5 bg-[image:var(--gradient-title)] bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl"
        >
          YouTube → MP3
        </h1>
        <p className="mb-8 mt-3 border-l-[3px] border-primary pl-4 text-base text-muted-foreground">
          Cole o link e converta em segundos
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:rounded-full sm:border sm:border-border sm:bg-surface sm:py-1 sm:pl-6 sm:pr-1 sm:transition-shadow sm:focus-within:border-primary sm:focus-within:shadow-[0_0_0_4px_oklch(0.51_0.22_275_/_0.2)]">
          <span className="hidden text-lg text-muted-foreground sm:block">▶️</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && convert()}
            placeholder="https://youtube.com/watch?v=..."
            aria-label="Link do vídeo do YouTube"
            className="w-full rounded-full border border-border bg-surface px-5 py-4 text-[15px] font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/70 sm:border-0 sm:bg-transparent sm:px-3 sm:py-4"
          />
          <button
            onClick={convert}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 active:scale-[0.97] disabled:opacity-70 sm:py-3"
          >
            {loading ? <span className="loading-dots">Convertendo</span> : <>⬇️ Converter</>}
          </button>
        </div>

        <div className="mb-8 mt-6 flex flex-col gap-2 px-1.5 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border bg-secondary px-3.5 py-1 text-xs font-semibold text-secondary-foreground">
              🎛️ 320 kbps
            </span>
            <span className="rounded-full border border-border bg-secondary px-3.5 py-1 text-xs font-semibold text-secondary-foreground">
              📁 MP3
            </span>
          </div>
          <span>🔒 100% seguro</span>
        </div>

        <div className="mb-7 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="mb-4 flex items-center justify-between text-sm">
          <h2 className="font-semibold text-foreground">📋 Conversões recentes</h2>
          <button
            onClick={() => setHistory([])}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpar tudo
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {history.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground/80">
              <div className="mb-3 text-5xl opacity-60">🎵</div>
              <p className="text-sm">
                Nenhuma conversão ainda.
                <br />
                Cole um link e comece!
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-full border border-border/70 bg-surface px-5 py-3 transition-colors hover:border-border hover:bg-secondary/60"
              >
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-lg">
                    🎵
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="flex gap-3 text-xs text-muted-foreground">
                      <span>{item.size}</span>
                      <span>{item.time}</span>
                    </span>
                  </div>
                </div>
                <button
                  aria-label="Baixar"
                  className="rounded-full px-3 py-1.5 text-lg text-accent transition-colors hover:bg-secondary"
                >
                  ⬇️
                </button>
              </div>
            ))
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          ⚡ Powered by yt2mp3 · apenas para uso pessoal
        </p>
      </div>
    </main>
  );
}
