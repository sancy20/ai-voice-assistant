class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) {
      return true;
    }

    const channelData = input[0]; // mono
    const len = channelData.length;
    const buffer = new ArrayBuffer(len * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < len; i++) {
      let s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    // Transfer the buffer for zero-copy to main thread
    this.port.postMessage(buffer, [buffer]);

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
