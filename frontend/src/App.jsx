import React from "react";
import AssistantWidget from "./components/AssistantWidget";

export default function App() {
  return (
    <div className='min-h-screen bg-slate-950 text-slate-100'>
      <div className='pointer-events-none fixed inset-0 opacity-40'>
        <div className='absolute -top-24 -right-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl' />
        <div className='absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl' />
      </div>

      <main className='relative mx-auto max-w-5xl px-6 py-10'>
        <header className='space-y-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Test Page for Voice Assistant
          </h1>
          <p className='text-sm text-slate-300'>
            Hold the button and speak. Partial captions show while listening.
          </p>
        </header>

        <section className='mt-8 rounded-2xl border border-white/10 bg-white/5 p-6'>
          <h2 className='text-sm font-semibold text-slate-200'>Demo Area</h2>
          <p className='mt-2 text-sm text-slate-300'>
            Try commands like{" "}
            <span className='text-slate-100 font-medium'>“open youtube”</span>,{" "}
            <span className='text-slate-100 font-medium'>“scroll down”</span>,{" "}
            <span className='text-slate-100 font-medium'>“search for cat”</span>
            ,{" "}
            <span className='text-slate-100 font-medium'>
              “what time is it”
            </span>
            .
          </p>
        </section>
      </main>

      {/* Floating assistant */}
      <AssistantWidget />
    </div>
  );
}
