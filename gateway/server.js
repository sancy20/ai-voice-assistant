const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const AI_SERVICE_HTTP = "http://localhost:8000";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);

const axiosClient = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
});

io.on("connection", (socket) => {
  console.log("client connected", socket.id);

  const sessionDir = path.join(__dirname, "sessions", socket.id);
  fs.mkdirSync(sessionDir, { recursive: true });

  let chunkIndex = 0;
  let sampleRate = 48000;

  const queue = [];
  let inflight = false;
  let pendingFlush = false;

  socket.on("audio_meta", (meta) => {
    if (meta && typeof meta.sampleRate === "number" && meta.sampleRate > 0) {
      sampleRate = meta.sampleRate;
      console.log("session", socket.id, "sampleRate=", sampleRate);
    }
  });

  async function doFlush() {
    try {
      const resp = await axiosClient.post(`${AI_SERVICE_HTTP}/flush`, null, {
        headers: { "X-Session-ID": socket.id },
        timeout: AI_TIMEOUT_MS,
      });

      const data = resp.data;
      if (data?.final) {
        socket.emit("final_transcript", {
          text: data.final,
          intent: data.intent || null,
          intent_details: data.intent_details || null,
        });
      }
    } catch (err) {
      console.error("flush error:", err.message);
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
          },
          timeout: AI_TIMEOUT_MS,
        }
      );

      const data = resp.data;

      if (data?.rms !== undefined && data?.peak !== undefined) {
        if (chunkIndex % 10 === 0) {
          console.log("ai_service metrics:", {
            rms: data.rms,
            peak: data.peak,
            bytes: data.bytes,
          });
        }
      }

      if (data.partial) {
        socket.emit("partial_transcript", { text: data.partial });
      }

      if (data.final) {
        socket.emit("final_transcript", {
          text: data.final,
          intent: data.intent || null,
          intent_details: data.intent_details || null,
        });
      }
    } catch (err) {
      console.error("AI service error:", err.message);
    } finally {
      setImmediate(processNext);
    }
  }

  socket.on("audio_chunk", (arrayBuffer) => {
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length === 0) {
      console.warn("Received empty audio chunk");
      return;
    }

    const filename = path.join(sessionDir, `chunk_${chunkIndex++}.pcm`);
    fs.writeFileSync(filename, buffer);

    if (chunkIndex % 10 === 0) {
      console.log("audio_chunk bytes=", buffer.length);
    }

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
      fs.rmSync(path.join(__dirname, "sessions", socket.id), {
        recursive: true,
      });
    } catch (e) {}
  });
});

server.listen(3000, () => {
  console.log("Gateway listening on :3000");
});
