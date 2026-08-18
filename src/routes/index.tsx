import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { checkAuth, logout } from "../lib/auth.server";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "MP3Flow — Ferramenta pessoal" },
      {
        name: "description",
        content: "Ferramenta privada de uso pessoal.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Index,
});

type Conversion = {
  id: string;
  remoteId?: string;
  title: string;
  duration: string;
  date: number;
  status: "completed" | "processing";
  audioUrl: string;
  thumbnail?: string | undefined;
};

const STORAGE_KEY = "mp3flow_history";

// Files now live on the backend's persistent disk (see mp3flow-backend), so
// audioUrl is a real server URL that survives a page refresh — it just expires
// after the backend's RETENTION_DAYS window.
const BACKEND_URL = import.meta.env['VITE_BACKEND_URL'] as string | undefined;
const BACKEND_KEY = import.meta.env['VITE_BACKEND_API_KEY'] as string | undefined;

function formatDuration(totalSeconds: number) {
  if (!totalSeconds || totalSeconds <= 0) return "--:--";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return "agora";
  if (diff < 60) return `há ${diff} min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

function youtubeId(link: string) {
  const m = link.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function Index() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Conversion[]>([]);
  const [track, setTrack] = useState<Conversion | null>(null);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState<Conversion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored) as Conversion[]);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const persist = (next: Conversion[]) => {
    setHistory(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const convert = async () => {
    if (!url.trim() || loading) return;
    if (!BACKEND_URL || !BACKEND_KEY) {
      setError("Backend não configurado (VITE_BACKEND_URL / VITE_BACKEND_API_KEY ausentes).");
      return;
    }

    setError(null);
    setLoading(true);
    const link = url.trim();
    const id = crypto.randomUUID();
    const vid = youtubeId(link);
    const pending: Conversion = {
      id,
      title: link.replace(/^https?:\/\//, "").slice(0, 60),
      duration: "--:--",
      date: Date.now(),
      status: "processing",
      audioUrl: "",
      thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : undefined,
    };
    const withPending = [pending, ...history];
    persist(withPending);
    setUrl("");
    setCurrent(pending);
    // Real progress isn't available from a single fetch response, so this is
    // an indeterminate "still working" indicator, not a true percentage.
    setProgress(8);
    const tick = setInterval(() => setProgress((p) => Math.min(p + 4, 90)), 800);

    try {
      const res = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BACKEND_KEY,
        },
        body: JSON.stringify({ url: link }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error || `Falha na conversão (HTTP ${res.status})`);
      }

      const payload = (await res.json()) as {
        id: string;
        title: string;
        duration: number;
        url: string;
      };
      const audioUrl = `${BACKEND_URL.replace(/\/$/, "")}${payload.url}`;

      const done: Conversion = {
        ...pending,
        remoteId: payload.id,
        title: payload.title || pending.title,
        duration: formatDuration(payload.duration),
        status: "completed",
        audioUrl,
      };

      clearInterval(tick);
      setProgress(100);
      persist(withPending.map((c) => (c.id === id ? done : c)));
      setCurrent(done);
      setTimeout(() => setProgress(0), 600);
    } catch (err) {
      clearInterval(tick);
      setProgress(0);
      setError(err instanceof Error ? err.message : "Falha na conversão.");
      persist(withPending.filter((c) => c.id !== id));
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  };

  const doLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const remove = (id: string) => {
    const item = history.find((c) => c.id === id);
    persist(history.filter((c) => c.id !== id));
    setTrack((t) => (t?.id === id ? null : t));
    setCurrent((c) => (c?.id === id ? null : c));
    if (item?.remoteId && BACKEND_URL && BACKEND_KEY) {
      fetch(`${BACKEND_URL.replace(/\/$/, "")}/files/${item.remoteId}`, {
        method: "DELETE",
        headers: { "x-api-key": BACKEND_KEY },
      }).catch(() => {
        /* best-effort — the backend's retention job will clean it up eventually */
      });
    }
  };

  const sorted = [...history].sort((a, b) => b.date - a.date);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[820px] rounded-[2rem] border border-border/60 bg-card/75 p-8 shadow-[var(--shadow-panel)] backdrop-blur-xl sm:rounded-[3rem] sm:p-12">
        <div className="flex items-center justify-between">
          <span className="inline-block rounded-full border border-primary/25 bg-primary/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
            🎧 conversor de áudio · uso pessoal
          </span>
          <button
            onClick={doLogout}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Sair
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="animate-pulse text-3xl">🎵</span>
          <h1 className="bg-[image:var(--gradient-title)] bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl">
            MP3Flow
          </h1>
        </div>
        <p className="mb-8 mt-2 border-l-[3px] border-primary pl-4 text-base text-muted-foreground">
          Converta vídeos do YouTube para MP3 —{" "}
          <strong className="font-semibold text-accent">só para o seu uso pessoal</strong>
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
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 active:scale-[0.97] disabled:opacity-60 sm:py-3"
          >
            {loading ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Convertendo
              </>
            ) : (
              <>⬇️ Converter</>
            )}
          </button>
        </div>

        {error && <p className="mt-3 px-1.5 text-sm text-danger">⚠️ {error}</p>}

        <div className="mb-8 mt-6 flex flex-col gap-2 px-1.5 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {["🎛️ 320 kbps", "📁 MP3", "⚡ Rápido"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-secondary px-3.5 py-1 text-xs font-semibold text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
          <span>🔒 uso privado</span>
        </div>

        {current && (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-surface px-5 py-4">
            <div
              className="h-[160px] w-full flex-shrink-0 rounded-xl border border-border bg-secondary bg-cover bg-center sm:h-[68px] sm:w-[120px]"
              style={
                current.thumbnail ? { backgroundImage: `url(${current.thumbnail})` } : undefined
              }
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-foreground">{current.title}</p>
              <p className="text-[13px] text-muted-foreground">
                {current.status === "completed" ? "Pronto para download" : "Processando áudio…"}
              </p>
            </div>
          </div>
        )}

        {progress > 0 && (
          <div className="mb-5 h-[3px] w-full overflow-hidden rounded bg-secondary">
            <div
              className="h-full rounded bg-[image:var(--gradient-progress)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {track && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-surface px-5 py-3.5 sm:rounded-full">
            <span className="max-w-[200px] truncate text-sm font-semibold text-foreground">
              {track.title}
            </span>
            <audio
              key={track.id}
              controls
              autoPlay
              src={track.audioUrl}
              className="order-3 h-10 w-full flex-1 sm:order-none sm:w-auto"
            >
              Seu navegador não suporta áudio.
            </audio>
          </div>
        )}

        <div className="mb-7 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="mb-4 flex items-center justify-between text-sm">
          <h2 className="font-semibold text-foreground">📋 Conversões recentes</h2>
          <button
            onClick={() => {
              if (BACKEND_URL && BACKEND_KEY) {
                for (const item of history) {
                  if (item.remoteId) {
                    fetch(`${BACKEND_URL.replace(/\/$/, "")}/files/${item.remoteId}`, {
                      method: "DELETE",
                      headers: { "x-api-key": BACKEND_KEY },
                    }).catch(() => {});
                  }
                }
              }
              persist([]);
              setTrack(null);
            }}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpar tudo
          </button>
        </div>

        <p className="mb-3 px-1.5 text-xs text-muted-foreground/70">
          Os arquivos ficam guardados por um tempo limitado no servidor e depois são apagados
          automaticamente.
        </p>

        <div className="flex flex-col gap-2.5">
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground/80">
              <div className="mb-3 text-5xl opacity-60">🎵</div>
              <p className="text-sm">
                Nenhuma conversão ainda.
                <br />
                Cole um link e comece!
              </p>
            </div>
          ) : (
            sorted.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-surface px-5 py-3 transition-colors hover:border-border hover:bg-secondary/60 sm:flex-nowrap sm:rounded-full"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3.5 overflow-hidden">
                  <div
                    className={`flex size-11 flex-shrink-0 items-center justify-center rounded-xl border bg-secondary text-lg ${
                      item.status === "completed" ? "border-primary" : "border-border"
                    }`}
                  >
                    {item.status === "completed" ? "✅" : "⏳"}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>⏱️ {item.duration}</span>
                      <span>{timeAgo(item.date)}</span>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${
                          item.status === "completed"
                            ? "border-success/25 bg-success/15 text-success"
                            : "animate-pulse border-warning/25 bg-warning/15 text-warning"
                        }`}
                      >
                        {item.status === "completed" ? "Concluído" : "Processando"}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-shrink-0 justify-end gap-1.5 border-t border-border/60 pt-2 sm:w-auto sm:border-0 sm:pt-0">
                  <button
                    aria-label="Reproduzir"
                    onClick={() => setTrack(item)}
                    disabled={item.status !== "completed"}
                    className="rounded-full px-3 py-1.5 text-lg text-success transition-colors hover:bg-secondary disabled:opacity-40"
                  >
                    ▶️
                  </button>
                  <a
                    aria-label="Baixar"
                    href={item.audioUrl}
                    download
                    className="rounded-full px-3 py-1.5 text-lg text-accent transition-colors hover:bg-secondary"
                  >
                    ⬇️
                  </a>
                  <button
                    aria-label="Excluir"
                    onClick={() => remove(item.id)}
                    className="rounded-full px-3 py-1.5 text-lg text-danger transition-colors hover:bg-secondary"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          ⚡ Ferramenta pessoal ·{" "}
          <span className="font-semibold text-primary">MP3Flow</span>
        </p>
      </div>
    </main>
  );
}
