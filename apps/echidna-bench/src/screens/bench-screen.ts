import { dispatch, getState, subscribe } from "../state/store.js";
import { runBenchmark } from "../bench/engine.js";
import { ConfigPanel } from "../components/config-panel.js";
import { ResultsTable } from "../components/results-table.js";
import { ResultsChart } from "../components/results-chart.js";
import { showToast } from "../utils/toast.js";
import { EchidnaJsError } from "echidna.js";
import type { BenchConfig } from "../state/types.js";

function describeBenchFailure(err: unknown): string {
  if (err instanceof EchidnaJsError) {
    if (err.code === "KDF_FAILED") {
      return "Key derivation failed while preparing the benchmark. This is usually a transient WebCrypto issue — try again.";
    }
    return `Benchmark failed: unexpected echidna.js error (${err.code}). Check the browser console for details.`;
  }
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    if (err.name === "QuotaExceededError") {
      return "Benchmark failed: browser storage quota exceeded. Try smaller sizes, fewer iterations, or the in-memory adapter.";
    }
    if (err.name === "VersionError" || err.name === "InvalidStateError") {
      return "Benchmark failed: IndexedDB is blocked. Close other tabs running this app and try again.";
    }
    return `Benchmark failed: browser storage error (${err.name}). Check the browser console for details.`;
  }
  if (err instanceof Error) {
    return `Benchmark failed: ${err.message}`;
  }
  return "Benchmark failed for an unknown reason. Check the browser console for details.";
}

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
        console.error("Benchmark run failed:", err);
        const message = describeBenchFailure(err);
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
