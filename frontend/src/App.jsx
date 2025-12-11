import React from "react";
import AssistantWidget from "./components/AssistantWidget";

function App() {
  return (
    <div>
      <AssistantWidget />
      <main style={{ padding: 40 }}>
        <h1>Test Page for Voice Assistant</h1>
        <p>Hold the button and speak. Partial captions show in blue.</p>
      </main>
    </div>
  );
}

export default App;
