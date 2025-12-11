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

  socket.on("audio_meta", (meta) => {
    if (meta && typeof meta.sampleRate === "number" && meta.sampleRate > 0) {
      sampleRate = meta.sampleRate;
      console.log("session", socket.id, "sampleRate=", sampleRate);
    }
  });

  async function processNext() {
    if (queue.length === 0) {
      inflight = false;
      return;
    }
    inflight = true;
    const buffer = queue.shift();
    // call AI microservice to process this chunk (non-blocking)
    try {
      const resp = await axiosClient.post(
        `${AI_SERVICE_HTTP}/transcribe_chunk`,
        buffer,
        {
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Session-Id": socket.id,
            "X-Sample-Rate": String(sampleRate),
          },
          timeout: 5000,
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
        try {
          const preview = String(data.final).replace(/\s+/g, " ").slice(0, 120);
          console.log("final from ai:", preview);
        } catch (e) {}
        socket.emit("final_transcript", {
          text: data.final,
          intent: data.intent || null,
        });
      }
    } catch (err) {
      console.error("AI service error", err.message);
    } finally {
      setImmediate(processNext);
    }
  }

  socket.on("audio_chunk", async (arrayBuffer) => {
    const filename = path.join(sessionDir, `chunk_${chunkIndex++}.pcm`);
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length === 0) {
      console.warn("Received empty audio chunk");
      return;
    }
    if (chunkIndex % 10 === 0) {
      console.log("audio_chunk bytes=", buffer.length);
    }
    fs.writeFileSync(filename, buffer);
    queue.push(buffer);
    if (!inflight) processNext();
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
