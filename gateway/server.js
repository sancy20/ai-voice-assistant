const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(express.json());
const cors = require("cors");
app.use(cors({ origin: "http://localhost:5173" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const AI_SERVICE_HTTP = process.env.AI_SERVICE_HTTP || "http://localhost:8000";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);

const axiosClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
});

const MODELS_DIR_CANDIDATES = [
  path.join(__dirname, "..", "models"),
  // fallback: gateway/models
  path.join(__dirname, "models"),
  // fallback: process cwd
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

  // stable sort: small -> big, then name
  out.sort((a, b) => a.sizeBytes - b.sizeBytes || a.key.localeCompare(b.key));
  return out;
}

function pickDefaultModelKey(models) {
  const envDefault = (process.env.DEFAULT_MODEL_KEY || "").trim();
  if (envDefault && models.some((m) => m.key === envDefault)) return envDefault;

  // Prefer base.en if present, else first
  const base =
    models.find((m) => m.key === "base.en") ||
    models.find((m) => m.key === "base");
  if (base) return base.key;
  return models[0]?.key || "";
}

// HTTP: frontend uses this to populate a model dropdown
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

  // Keep per-socket session folder for debug
  const sessionDir = path.join(__dirname, "sessions", socket.id);
  fs.mkdirSync(sessionDir, { recursive: true });

  let chunkIndex = 0;
  let sampleRate = 48000;

  // model selection (from frontend)
  const availableAtConnect = listModels();
  let modelKey = pickDefaultModelKey(availableAtConnect);

  // Simple sequential queue so ai_service isn't hammered in parallel
  const queue = [];
  let inflight = false;
  let pendingFlush = false;

  socket.on("audio_meta", (meta) => {
    if (meta && typeof meta.sampleRate === "number" && meta.sampleRate > 0) {
      sampleRate = meta.sampleRate;
      console.log("session", socket.id, "sampleRate=", sampleRate);
    }

    if (meta && typeof meta.modelKey === "string") {
      const requested = meta.modelKey.trim();
      if (!requested) return;

      const models = listModels();
      if (models.some((m) => m.key === requested)) {
        modelKey = requested;
        console.log("session", socket.id, "modelKey=", modelKey);
      } else {
        console.warn("session", socket.id, "unknown modelKey:", requested);
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
          },
          timeout: AI_TIMEOUT_MS,
        }
      );

      const data = resp.data || {};

      if (data.partial) {
        socket.emit("partial_transcript", { text: data.partial });
      }

      if (data.final) {
        socket.emit("final_transcript", {
          text: data.final,
          intent: data.intent || null,
          intent_details: data.intent_details || null,
          done: false,
          reason: "segment_final",
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

    // Debug save
    try {
      const filename = path.join(sessionDir, `chunk_${chunkIndex++}.pcm`);
      fs.writeFileSync(filename, buffer);
    } catch (_) {}

    queue.push(buffer);
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
