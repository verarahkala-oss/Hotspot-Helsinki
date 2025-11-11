import React from "react";

export default function App() {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Hotspot Helsinki</h1>
      <p>Dev server is running. Clicks: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Click me</button>
    </div>
  );
}