import React from "react";
import AssistantWidget from "./components/AssistantWidget";
import ActionScreen from "./components/ActionScreen";

export default function App() {
  return (
    <div className='min-h-screen bg-[rgb(33,33,33)] text-white'>
      {/* Center Action Screen */}
      <ActionScreen />
      <main className='relative mx-auto max-w-5xl px-6 py-10'>
        <header className='space-y-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Test Page for Voice Assistant
          </h1>
          <p className='text-sm text-white/70'>
            Hold the button and speak. Partial captions show while listening.
          </p>
        </header>

        <section className='mt-8 rounded-2xl border border-white/10 bg-white/5 p-6'>
          <h2 className='text-sm font-semibold text-white/80'>Demo Area</h2>
          <p className='mt-2 text-sm text-white/70'>
            Try: <span className='text-white font-medium'>“open youtube”</span>,{" "}
            <span className='text-white font-medium'>“scroll down”</span>,{" "}
            <span className='text-white font-medium'>“search for cat”</span>,{" "}
            <span className='text-white font-medium'>“what time is it”</span>.
          </p>
        </section>
      </main>
      <AssistantWidget />
      {/* <div className='min-h-screen bg-slate-950 text-slate-100'>
        <div className='p-4'>
          <button
            onClick={() =>
              setMode(mode === "assistant" ? "recorder" : "assistant")
            }
            className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10'
          >
            Switch to: {mode === "assistant" ? "Recorder" : "Assistant"}
          </button>
        </div>

        {mode === "recorder" ? <WakeWordRecorder /> : <AssistantWidget />}
      </div> */}
    </div>
  );
}
