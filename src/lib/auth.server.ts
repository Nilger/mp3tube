import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "mp3flow_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

function expectedToken(): string {
  const secret = process.env.SITE_PASSWORD;
  if (!secret) {
    throw new Error(
      "SITE_PASSWORD is not set. Define it as an environment variable before starting the app.",
    );
  }
  return createHash("sha256").update(`mp3flow::${secret}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const session = getCookie(COOKIE_NAME);
  if (!session) return { authenticated: false };
  try {
    return { authenticated: safeEqual(session, expectedToken()) };
  } catch {
    return { authenticated: false };
  }
});

export const login = createServerFn({ method: "POST" })
  .validator((data: unknown) => data as { password: string })
  .handler(async ({ data }) => {
    const configured = process.env.SITE_PASSWORD;
    if (!configured) {
      throw new Error("SITE_PASSWORD is not set on the server.");
    }
    if (!safeEqual(data.password, configured)) {
      return { ok: false as const, error: "Senha incorreta." };
    }
    setCookie(COOKIE_NAME, expectedToken(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(COOKIE_NAME, { path: "/" });
  return { ok: true as const };
});
