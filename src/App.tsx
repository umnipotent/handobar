import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

function App() {
  const [usage, setUsage] = useState("Loading...");

  const refreshUsage = async () => {
    try {
      const result = await invoke<string>("get_usage_summary");
      setUsage(result);
    } catch (error) {
      console.error(error);
      setUsage("Failed to load usage");
    }
  };

  useEffect(() => {
    refreshUsage();

    const unlistenPromise = listen("usage-refresh-requested", () => {
      refreshUsage();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <main className="container">
      <h1>AI Usage Monitor</h1>

      <section className="card">
        <div className="label">Current Usage</div>
        <p>{usage}</p>
        <button onClick={refreshUsage}>Refresh</button>
      </section>
    </main>
  );
}

export default App;
