import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { login } from "../lib/auth.server";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();

  const submit = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await login({ data: { password } });
      if (result.ok) {
        await router.invalidate();
        navigate({ to: "/" });
      } else {
        setError(result.error);
      }
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-border/60 bg-card/75 p-8 shadow-[var(--shadow-panel)] backdrop-blur-xl">
        <h1 className="mb-1 text-2xl font-bold text-foreground">🔒 MP3Flow</h1>
        <p className="mb-6 text-sm text-muted-foreground">Área privada — só para uso pessoal.</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Senha"
          autoFocus
          className="mb-3 w-full rounded-full border border-border bg-surface px-5 py-3 text-[15px] font-medium text-foreground outline-none focus:border-primary"
        />

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-full bg-primary px-7 py-3 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </main>
  );
}
