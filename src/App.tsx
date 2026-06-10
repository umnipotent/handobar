import { CLAUDE_USAGE_PROVIDER } from "./features/claudeUsage/provider";
import { CODEX_USAGE_PROVIDER } from "./features/codexUsage/provider";
import { UsagePanel } from "./features/usage/UsagePanel";
import "./App.css";

function App() {
  return (
    <main className="container">
      <UsagePanel {...CLAUDE_USAGE_PROVIDER} />
      <UsagePanel {...CODEX_USAGE_PROVIDER} />
    </main>
  );
}

export default App;
