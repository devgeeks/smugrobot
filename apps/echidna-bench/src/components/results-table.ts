import type { BenchResult, KdfTimingResult } from '../state/types.js'

const DATA_TYPE_LABELS: Record<string, string> = {
  json: 'JSON blob',
  text: 'Text document',
  image: 'Image (binary)',
}

function formatMs(ms: number): string {
  return ms < 1 ? `${ms.toFixed(3)} ms` : `${ms.toFixed(2)} ms`
}

function formatThroughput(mbs: number): string {
  return Number.isFinite(mbs) ? `${mbs.toFixed(2)} MB/s` : '—'
}

export class ResultsTable {
  el: HTMLElement
  private kdfNote: HTMLElement
  private tbody: HTMLElement

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'results-panel'
    this.el.innerHTML = `
      <p class="kdf-note" hidden></p>
      <table class="results-table">
        <thead>
          <tr>
            <th scope="col">Data type</th>
            <th scope="col">Size</th>
            <th scope="col">Encrypt (mean / median)</th>
            <th scope="col">Encrypt throughput</th>
            <th scope="col">Decrypt (mean / median)</th>
            <th scope="col">Decrypt throughput</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `
    this.kdfNote = this.el.querySelector('.kdf-note')!
    this.tbody = this.el.querySelector('tbody')!
  }

  render(results: BenchResult[], kdfTiming: KdfTimingResult | null): void {
    if (kdfTiming) {
      this.kdfNote.hidden = false
      this.kdfNote.textContent = `Key derivation (${kdfTiming.keySource}): ${formatMs(kdfTiming.durationMs)} — one-time cost, not included in per-item throughput.`
    } else {
      this.kdfNote.hidden = true
    }

    this.tbody.innerHTML = results
      .map(
        (r) => `
          <tr>
            <td>${DATA_TYPE_LABELS[r.dataType] ?? r.dataType}</td>
            <td>${r.sizeLabel}</td>
            <td>${formatMs(r.encrypt.meanMs)} / ${formatMs(r.encrypt.medianMs)}</td>
            <td>${formatThroughput(r.encrypt.throughputMBs)}</td>
            <td>${formatMs(r.decrypt.meanMs)} / ${formatMs(r.decrypt.medianMs)}</td>
            <td>${formatThroughput(r.decrypt.throughputMBs)}</td>
          </tr>
        `,
      )
      .join('')
  }
}
