const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(express.json());

const cors = require("cors");
app.use(cors({ origin: true, credentials: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

const AI_SERVICE_HTTP = process.env.AI_SERVICE_HTTP || "http://localhost:8000";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);

const MAX_QUEUE = Number(process.env.MAX_QUEUE || 40);
const SAVE_CHUNKS = String(process.env.SAVE_CHUNKS || "0") === "1";

const axiosClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
});

const MODELS_DIR_CANDIDATES = [
  path.join(__dirname, "..", "models"),
  path.join(__dirname, "models"),
  path.join(process.cwd(), "models"),
];

function resolveModelsDir() {
  for (const d of MODELS_DIR_CANDIDATES) {
    try {
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
    } catch (_) {}
  }
  return null;
}

function listModels() {
  const modelsDir = resolveModelsDir();
  if (!modelsDir) return [];

  let files = [];
  try {
    files = fs.readdirSync(modelsDir);
  } catch (_) {
    return [];
  }

  const out = [];
  for (const filename of files) {
    if (!/^ggml-.*\.bin$/i.test(filename)) continue;
    const full = path.join(modelsDir, filename);

    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(full).size;
    } catch (_) {}

    const key = filename.replace(/^ggml-/i, "").replace(/\.bin$/i, "");
    out.push({
      key,
      label: key,
      filename,
      sizeBytes,
    });
  }

  out.sort((a, b) => a.sizeBytes - b.sizeBytes || a.key.localeCompare(b.key));
  return out;
}

function pickDefaultModelKey(models) {
  const envDefault = (process.env.DEFAULT_MODEL_KEY || "").trim();
  if (envDefault && models.some((m) => m.key === envDefault)) return envDefault;

  const base =
    models.find((m) => m.key === "base.en") ||
    models.find((m) => m.key === "base");
  if (base) return base.key;

  return models[0]?.key || "";
}

app.get("/models", (req, res) => {
  const models = listModels();
  res.json({
    models,
    modelsDir: resolveModelsDir(),
    defaultKey: pickDefaultModelKey(models),
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  console.log("client connected", socket.id);

  const sessionDir = path.join(__dirname, "sessions", socket.id);
  fs.mkdirSync(sessionDir, { recursive: true });

  let chunkIndex = 0;
  let sampleRate = 48000;

  // Model selection
  const availableAtConnect = listModels();
  let modelKey = pickDefaultModelKey(availableAtConnect);

  let wakeMode = "ptt";
  const queue = [];
  let inflight = false;
  let pendingFlush = false;

  socket.on("audio_meta", (meta) => {
    // sample rate
    if (meta && typeof meta.sampleRate === "number" && meta.sampleRate > 0) {
      sampleRate = meta.sampleRate;
      console.log("session", socket.id, "sampleRate=", sampleRate);
    }

    // modelKey
    if (meta && typeof meta.modelKey === "string") {
      const requested = meta.modelKey.trim();
      if (requested) {
        const models = listModels();
        if (models.some((m) => m.key === requested)) {
          modelKey = requested;
          console.log("session", socket.id, "modelKey=", modelKey);
        } else if (
          requested === "base" &&
          models.some((m) => m.key === "base.en")
        ) {
          modelKey = "base.en";
          console.log(
            "session",
            socket.id,
            "modelKey=",
            modelKey,
            "(alias from 'base')"
          );
        } else if (requested === "") {
        } else {
          console.warn("session", socket.id, "unknown modelKey:", requested);
        }
      }
    }

    if (meta) {
      if (typeof meta.wakeMode === "string") {
        const m = meta.wakeMode.trim().toLowerCase();
        if (m === "wake" || m === "ptt") {
          wakeMode = m;
          console.log("session", socket.id, "wakeMode=", wakeMode);
          socket.emit("wake_mode", { mode: wakeMode });
        }
      } else if (typeof meta.wakeMode === "boolean") {
        wakeMode = meta.wakeMode ? "wake" : "ptt";
        console.log("session", socket.id, "wakeMode=", wakeMode);
        socket.emit("wake_mode", { mode: wakeMode });
      }
    }
  });

  async function doFlush() {
    try {
      const resp = await axiosClient.post(`${AI_SERVICE_HTTP}/flush`, null, {
        headers: {
          "X-Session-ID": socket.id,
          "X-Model-Key": modelKey,
        },
        timeout: AI_TIMEOUT_MS,
      });

      const data = resp.data || {};
      socket.emit("final_transcript", {
        text: data.final || "",
        intent: data.intent || null,
        intent_details: data.intent_details || null,
        done: true,
        reason: data.final ? "flush_final" : "flush_empty",
      });
    } catch (err) {
      console.error("flush error:", err?.message || err);
      socket.emit("final_transcript", {
        text: "",
        intent: null,
        intent_details: null,
        done: true,
        reason: "flush_error",
      });
    }
  }

  async function processNext() {
    if (queue.length === 0) {
      inflight = false;
      if (pendingFlush) {
        pendingFlush = false;
        await doFlush();
      }
      return;
    }

    inflight = true;
    const buffer = queue.shift();

    try {
      const resp = await axiosClient.post(
        `${AI_SERVICE_HTTP}/transcribe_chunk`,
        buffer,
        {
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Session-ID": socket.id,
            "X-Sample-Rate": String(sampleRate),
            "X-Model-Key": modelKey,
            "X-Wake-Mode": wakeMode, // "wake" or "ptt"
          },
          timeout: AI_TIMEOUT_MS,
        }
      );

      const data = resp.data || {};
      if (data.wake === "detected") {
        socket.emit("wake_event", {
          type: "detected",
          prob: data.wake_prob ?? null,
          awake_for_sec: data.awake_for_sec ?? null,
        });
      } else if (data.wake === "listening") {
      }

      // partial transcript
      if (data.partial) {
        socket.emit("partial_transcript", {
          text: data.partial,
          awake: data.awake ?? null,
        });
      }

      if (Object.prototype.hasOwnProperty.call(data, "final")) {
        socket.emit("final_transcript", {
          text: data.final || "",
          intent: data.intent || null,
          intent_details: data.intent_details || null,
          done: false,
          reason:
            data.reason || (data.final ? "segment_final" : "segment_empty"),
          awake: data.awake ?? null,
        });
      }
    } catch (err) {
      console.error("AI service error:", err?.message || err);
    } finally {
      setImmediate(processNext);
    }
  }

  socket.on("audio_chunk", (arrayBuffer) => {
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length === 0) return;

    if (SAVE_CHUNKS) {
      try {
        const filename = path.join(sessionDir, `chunk_${chunkIndex++}.pcm`);
        fs.writeFileSync(filename, buffer);
      } catch (_) {}
    }

    queue.push(buffer);
    if (queue.length > MAX_QUEUE) {
      queue.splice(0, queue.length - MAX_QUEUE);
    }

    if (!inflight) processNext();
  });

  socket.on("audio_end", () => {
    pendingFlush = true;
    if (!inflight && queue.length === 0) {
      pendingFlush = false;
      doFlush();
    }
  });

  socket.on("disconnect", () => {
    console.log("client disconnected", socket.id);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (_) {}
  });
});

server.listen(3000, () => {
  console.log("Gateway listening on :3000");
  console.log("Models endpoint: http://localhost:3000/models");
});
