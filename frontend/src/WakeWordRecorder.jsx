import React, { useEffect, useMemo, useRef, useState } from "react";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WakeWordRecorder() {
  const [status, setStatus] = useState("idle");
  const [label, setLabel] = useState("wake");
  const [seconds, setSeconds] = useState(1.0);
  const [count, setCount] = useState(0);

  const mediaRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (mediaRef.current) {
        mediaRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const start = async () => {
    setStatus("requesting_mic");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;

    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${label}_${ts}_${count}.webm`;
      downloadBlob(blob, filename);
      setCount((c) => c + 1);
      setStatus("saved");
    };

    rec.start();
    setStatus("recording");

    setTimeout(() => {
      rec.stop();
      setStatus("stopping");
    }, Math.max(200, seconds * 1000));
  };

  return (
    <div className='min-h-screen bg-slate-950 text-slate-100 p-8'>
      <div className='max-w-xl mx-auto rounded-2xl border border-white/10 bg-white/5 p-6'>
        <h1 className='text-xl font-semibold'>Wake Word Dataset Recorder</h1>
        <p className='mt-2 text-sm text-slate-300'>
          Record short clips. Save files into:
          <span className='font-mono text-slate-100'> wakeword_data/wake </span>
          or
          <span className='font-mono text-slate-100'>
            {" "}
            wakeword_data/not_wake
          </span>
        </p>

        <div className='mt-5 grid gap-4'>
          <label className='text-sm'>
            Label
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className='mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2'
            >
              <option value='wake'>wake (say your wake phrase)</option>
              <option value='not_wake'>not_wake (anything else)</option>
            </select>
          </label>

          <label className='text-sm'>
            Clip length (seconds)
            <input
              type='number'
              min='0.5'
              step='0.1'
              value={seconds}
              onChange={(e) => setSeconds(parseFloat(e.target.value || "1"))}
              className='mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2'
            />
          </label>

          <button
            onClick={start}
            className='rounded-2xl border border-white/10 bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-3 font-semibold text-white'
          >
            Record 1 Clip
          </button>

          <div className='text-xs text-slate-400'>
            Status: <span className='text-slate-200'>{status}</span> • Count:{" "}
            <span className='text-slate-200'>{count}</span>
          </div>

          <div className='rounded-xl bg-white/5 p-3 text-xs text-slate-300 ring-1 ring-white/10'>
            <div className='font-semibold text-slate-200'>Tips</div>
            <ul className='mt-2 list-disc pl-5 space-y-1'>
              <li>Record ~150–300 “wake” clips (your phrase).</li>
              <li>Record ~300–800 “not_wake” clips (random speech/noise).</li>
              <li>Use different distances, volume, and speed.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
