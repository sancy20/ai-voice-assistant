import * as PorcupineWeb from "@picovoice/porcupine-web";
import { WebVoiceProcessor } from "@picovoice/web-voice-processor";

export async function createWakeWord(detectorCallback) {
  const ACCESS_KEY = import.meta.env?.VITE_PORCUPINE_ACCESS_KEY || "";
  if (!ACCESS_KEY) {
    console.warn(
      "Porcupine access key missing: set VITE_PORCUPINE_ACCESS_KEY in .env"
    );
  }
  console.log("Porcupine init origin:", window.location.origin);
  console.log(
    "Porcupine key prefix:",
    ACCESS_KEY ? ACCESS_KEY.slice(0, 6) : "(none)"
  );

  const builtinKeyword =
    PorcupineWeb.BuiltInKeyword?.Jarvis ??
    PorcupineWeb.BuiltInKeyword?.Porcupine ??
    "Jarvis";
  const model = { publicPath: "/porcupine_params.pv" };
  const options = {
    sensitivity: 0.8,
    processErrorCallback: (error) => {
      console.warn("Porcupine process error:", error);
    },
  };

  try {
    const onWake = (keyword) => {
      const label =
        keyword?.label || (typeof keyword === "string" ? keyword : "wake");
      console.log("Wake word detected:", label);
      try {
        detectorCallback(label);
      } catch (_) {}
    };
    const porcupine = await PorcupineWeb.Porcupine.create(
      ACCESS_KEY,
      builtinKeyword,
      onWake,
      model,
      options
    );
    const engine = {
      onmessage: async (e) => {
        if (e?.data?.command === "process" && e.data.inputFrame) {
          try {
            await porcupine.process(e.data.inputFrame);
          } catch (_) {}
        }
      },
    };
    await WebVoiceProcessor.subscribe(engine);
    return {
      terminate: async () => {
        try {
          await WebVoiceProcessor.unsubscribe(engine);
        } catch (_) {}
        try {
          await WebVoiceProcessor.reset();
        } catch (_) {}
        try {
          await porcupine?.release?.();
        } catch (_) {}
      },
    };
  } catch (err) {
    console.error("Failed to initialize Porcupine (non-worker)", err);
    throw err;
  }
}
