import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, mkdir, readFile, writeFile, stat, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const PORT = process.env.PORT || 8080;
const API_SECRET = process.env.API_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const MAX_DURATION_SECONDS = Number(process.env.MAX_DURATION_SECONDS || 60 * 60 * 3); // 3h cap
const EXTRACTION_TIMEOUT_MS = 6 * 60 * 1000; // 6 min hard timeout per job
const DATA_DIR = process.env.DATA_DIR || "/data/files";
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 7);
const INDEX_PATH = path.join(DATA_DIR, "index.json");

if (!API_SECRET) {
  console.error("FATAL: API_SECRET env var is not set. Refusing to start.");
  process.exit(1);
}

const YOUTUBE_URL_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/;

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(",").map((s) => s.trim()),
  }),
);

// ---------- tiny persistent index (id -> metadata), writes serialized to avoid races ----------
let writeQueue = Promise.resolve();
async function withIndex(mutator) {
  writeQueue = writeQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    let entries = [];
    try {
      entries = JSON.parse(await readFile(INDEX_PATH, "utf8"));
    } catch {
      /* first run, no index yet */
    }
    const result = await mutator(entries);
    await writeFile(INDEX_PATH, JSON.stringify(entries, null, 2));
    return result;
  });
  return writeQueue;
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8"));
  } catch {
    return [];
  }
}

// ---------- retention cleanup ----------
async function cleanupExpired() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  await withIndex(async (entries) => {
    const keep = [];
    for (const e of entries) {
      if (e.createdAt < cutoff) {
        await rm(path.join(DATA_DIR, e.filename), { force: true });
      } else {
        keep.push(e);
      }
    }
    entries.length = 0;
    entries.push(...keep);
  });
}

// ---------- rate limiter (per IP) ----------
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== API_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function runProcess(cmd, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(0, 2000)}`));
    });
  });
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/convert", requireApiKey, async (req, res) => {
  const ip = req.ip;
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "too many requests, slow down" });
  }

  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!YOUTUBE_URL_RE.test(url)) {
    return res.status(400).json({ error: "invalid or unsupported youtube url" });
  }

  let workDir;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), "mp3flow-"));

    const meta = await runProcess(
      "yt-dlp",
      ["--no-warnings", "--skip-download", "--print", "%(title)s|||%(duration)s|||%(is_live)s", url],
      { timeoutMs: 30_000 },
    );
    const [title = "audio", durationRaw = "0", isLive = "False"] = meta.stdout
      .trim()
      .split("|||");
    const duration = Number(durationRaw) || 0;

    if (isLive.trim() === "True") {
      return res.status(400).json({ error: "live streams are not supported" });
    }
    if (duration > MAX_DURATION_SECONDS) {
      return res.status(400).json({ error: `video too long (max ${MAX_DURATION_SECONDS}s)` });
    }

    await runProcess(
      "yt-dlp",
      [
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--no-playlist",
        "--max-filesize",
        "200M",
        "-o",
        path.join(workDir, "%(id)s.%(ext)s"),
        url,
      ],
      { timeoutMs: EXTRACTION_TIMEOUT_MS },
    );

    const files = await readdir(workDir);
    const mp3File = files.find((f) => f.endsWith(".mp3"));
    if (!mp3File) {
      return res.status(500).json({ error: "extraction did not produce an mp3 file" });
    }

    // Move into persistent storage under a random id/token.
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString("hex");
    const storedFilename = `${id}.mp3`;
    await mkdir(DATA_DIR, { recursive: true });
    await rename(path.join(workDir, mp3File), path.join(DATA_DIR, storedFilename));

    const entry = {
      id,
      token,
      filename: storedFilename,
      title: title.trim(),
      duration,
      createdAt: Date.now(),
    };
    await withIndex(async (entries) => {
      entries.push(entry);
    });

    res.json({
      id,
      title: entry.title,
      duration: entry.duration,
      url: `/files/${id}.mp3?t=${token}`,
      expiresInDays: RETENTION_DAYS,
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "conversion failed", detail: String(err.message || err) });
    }
  } finally {
    if (workDir) rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

// Serves a stored file. Auth is the per-file token in the query string (not the
// API key), because <audio src> / <a download> can't send custom headers.
app.get("/files/:id.mp3", async (req, res) => {
  const { id } = req.params;
  const token = req.query.t;
  const entries = await readIndex();
  const entry = entries.find((e) => e.id === id);
  if (!entry || !token || token !== entry.token) {
    return res.status(404).json({ error: "not found" });
  }

  const filePath = path.join(DATA_DIR, entry.filename);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return res.status(404).json({ error: "file expired or removed" });
  }

  const safeTitle = entry.title.replace(/[^\w\s.-]/g, "").slice(0, 80) || "audio";
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.mp3"`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("X-Track-Title", encodeURIComponent(entry.title));
  res.setHeader("X-Track-Duration", String(entry.duration));

  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? Number(match[1]) : 0;
    const end = match && match[2] ? Number(match[2]) : fileStat.size - 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);
    res.setHeader("Content-Length", String(end - start + 1));
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader("Content-Length", String(fileStat.size));
    createReadStream(filePath).pipe(res);
  }
});

// Explicit delete, used by the "excluir" button in the frontend.
app.delete("/files/:id", requireApiKey, async (req, res) => {
  const { id } = req.params;
  let removed = false;
  await withIndex(async (entries) => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      const [entry] = entries.splice(idx, 1);
      await rm(path.join(DATA_DIR, entry.filename), { force: true });
      removed = true;
    }
  });
  res.json({ ok: true, removed });
});

cleanupExpired().catch((err) => console.error("initial cleanup failed", err));
setInterval(() => cleanupExpired().catch((err) => console.error("cleanup failed", err)), 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(
    `mp3flow-backend listening on :${PORT} (storage: ${DATA_DIR}, retention: ${RETENTION_DAYS}d)`,
  );
});
