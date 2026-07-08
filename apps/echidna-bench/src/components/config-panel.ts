import type { BenchConfig, DataType, AdapterId, KeySourceId } from '../state/types.js'
import { showToast } from '../utils/toast.js'

const DATA_TYPE_OPTIONS: Array<{ id: DataType; label: string; hint?: string }> = [
  { id: 'json', label: 'JSON blob' },
  { id: 'text', label: 'Text document' },
  { id: 'image', label: 'Image (binary)', hint: 'Throughput includes base64 encode/decode, not just cipher speed' },
]

const SIZE_OPTIONS: Array<{ bytes: number; label: string }> = [
  { bytes: 1_024, label: '1 KB' },
  { bytes: 100_000, label: '100 KB' },
  { bytes: 1_000_000, label: '1 MB' },
  { bytes: 10_000_000, label: '10 MB' },
]

export class ConfigPanel {
  el: HTMLElement
  private selectedDataTypes = new Set<DataType>(['json', 'text', 'image'])
  private selectedSizes = new Set<number>([1_024, 100_000, 1_000_000, 10_000_000])
  private adapter: AdapterId = 'memory'
  private keySource: KeySourceId = 'raw'
  private iterations = 5
  private runBtn: HTMLElement

  constructor(private onRun: (config: BenchConfig) => void) {
    this.el = document.createElement('vault-card')
    this.el.setAttribute('border', '')
    this.el.className = 'config-panel'

    this.el.innerHTML = `
      <h2 class="config-heading">Benchmark configuration</h2>

      <fieldset class="config-group">
        <legend class="config-group-label">Data types</legend>
        <div class="toggle-row" data-group="data-type">
          ${DATA_TYPE_OPTIONS.map(
            (opt) =>
              `<vault-toggle data-value="${opt.id}" label="${opt.label}" ${
                opt.hint ? `hint="${opt.hint}"` : ''
              } checked></vault-toggle>`,
          ).join('')}
        </div>
      </fieldset>

      <fieldset class="config-group">
        <legend class="config-group-label">Payload sizes</legend>
        <div class="toggle-row" data-group="size">
          ${SIZE_OPTIONS.map(
            (opt) =>
              `<vault-toggle data-value="${opt.bytes}" label="${opt.label}" ${
                this.selectedSizes.has(opt.bytes) ? 'checked' : ''
              }></vault-toggle>`,
          ).join('')}
        </div>
      </fieldset>

      <div class="config-row">
        <vault-select label="Storage adapter" value="memory">
          <option value="memory">Memory (pure cipher speed)</option>
          <option value="indexeddb">IndexedDB (browser persistence)</option>
        </vault-select>
        <vault-select label="Key source" value="raw">
          <option value="raw">Raw key (skip KDF)</option>
          <option value="passphrase">Passphrase (scrypt)</option>
        </vault-select>
        <vault-input label="Iterations" type="number" value="5" min="1"></vault-input>
      </div>

      <vault-button variant="primary" id="run-btn">Run benchmark</vault-button>
    `

    this.el
      .querySelector('[data-group="data-type"]')!
      .addEventListener('vault-change', (e) => {
        const target = e.target as HTMLElement & { getAttribute(name: string): string | null }
        const value = target.getAttribute('data-value') as DataType
        const checked = (e as CustomEvent<{ checked: boolean }>).detail.checked
        if (checked) this.selectedDataTypes.add(value)
        else this.selectedDataTypes.delete(value)
      })

    this.el.querySelector('[data-group="size"]')!.addEventListener('vault-change', (e) => {
      const target = e.target as HTMLElement & { getAttribute(name: string): string | null }
      const value = Number(target.getAttribute('data-value'))
      const checked = (e as CustomEvent<{ checked: boolean }>).detail.checked
      if (checked) this.selectedSizes.add(value)
      else this.selectedSizes.delete(value)
    })

    const [adapterSelect, keySourceSelect] = this.el.querySelectorAll('vault-select')
    adapterSelect!.addEventListener('vault-change', (e) => {
      this.adapter = (e as CustomEvent<{ value: string }>).detail.value as AdapterId
    })
    keySourceSelect!.addEventListener('vault-change', (e) => {
      this.keySource = (e as CustomEvent<{ value: string }>).detail.value as KeySourceId
    })

    const iterationsInput = this.el.querySelector('vault-input')!
    iterationsInput.addEventListener('vault-change', (e) => {
      const value = Number((e as CustomEvent<{ value: string }>).detail.value)
      this.iterations = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
    })

    this.runBtn = this.el.querySelector('#run-btn')!
    this.runBtn.addEventListener('click', () => this.handleRun())
  }

  private handleRun(): void {
    if (this.selectedDataTypes.size === 0) {
      showToast('Select at least one data type.', 'danger')
      return
    }
    if (this.selectedSizes.size === 0) {
      showToast('Select at least one payload size.', 'danger')
      return
    }

    this.onRun({
      dataTypes: [...this.selectedDataTypes],
      sizes: [...this.selectedSizes].sort((a, b) => a - b),
      adapter: this.adapter,
      keySource: this.keySource,
      iterations: this.iterations,
    })
  }

  setRunning(running: boolean): void {
    if (running) {
      this.runBtn.setAttribute('loading', '')
      this.runBtn.setAttribute('disabled', '')
    } else {
      this.runBtn.removeAttribute('loading')
      this.runBtn.removeAttribute('disabled')
    }
  }
}
