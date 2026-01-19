export async function createWakeWord(detectorCallback) {
  const onWake = (payload) => {
    try {
      detectorCallback(payload);
    } catch (_) {}
  };

  window.__wake_listener__ = onWake;

  return {
    terminate: async () => {
      if (window.__wake_listener__ === onWake) {
        delete window.__wake_listener__;
      }
    },
  };
}
