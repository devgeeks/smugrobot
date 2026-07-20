import { dispatch, getState, subscribe } from "../state/store.js";
import { runBenchmark } from "../bench/engine.js";
import { ConfigPanel } from "../components/config-panel.js";
import { ResultsTable } from "../components/results-table.js";
import { ResultsChart } from "../components/results-chart.js";
import { showToast } from "../utils/toast.js";
import type { BenchConfig } from "../state/types.js";

export function mountBenchScreen(root: HTMLElement): () => void {
  root.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "bench-wrap";

  const header = document.createElement("header");
  header.className = "bench-header";
  header.innerHTML = `
    <h1 class="bench-title">Echidna bench</h1>
    <p class="bench-sub">Measure echidna.js encryption and decryption throughput across data types, sizes, and storage adapters.</p>
  `;
  wrap.appendChild(header);

  const configPanel = new ConfigPanel((config) => runFromUi(config));
  wrap.appendChild(configPanel.el);

  const resultsChart = new ResultsChart();
  wrap.appendChild(resultsChart.el);

  const resultsTable = new ResultsTable();
  wrap.appendChild(resultsTable.el);

  root.appendChild(wrap);

  function runFromUi(config: BenchConfig): void {
    dispatch({ type: "RUN_STARTED" });
    (async () => {
      try {
        for await (const event of runBenchmark(config)) {
          if (event.type === "result") dispatch({ type: "RESULT_ADDED", result: event.result });
          else dispatch({ type: "KDF_TIMING", result: event.result });
        }
        dispatch({ type: "RUN_COMPLETE" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Benchmark run failed.";
        dispatch({ type: "RUN_FAILED", message });
        showToast(message, "danger");
      }
    })();
  }

  return subscribe(() => {
    const state = getState();
    configPanel.setRunning(state.running);
    resultsTable.render(state.results, state.kdfTiming);
    resultsChart.render(state.results);
  });
}
