export type DataType = 'json' | 'text' | 'image'
export type AdapterId = 'memory' | 'indexeddb'
export type KeySourceId = 'raw' | 'passphrase'

export interface BenchConfig {
  dataTypes: DataType[]
  sizes: number[]
  adapter: AdapterId
  keySource: KeySourceId
  iterations: number
}

export interface OperationStats {
  meanMs: number
  medianMs: number
  throughputMBs: number
}

export interface BenchResult {
  dataType: DataType
  sizeLabel: string
  sizeBytes: number
  encrypt: OperationStats
  decrypt: OperationStats
}

export interface KdfTimingResult {
  keySource: string
  durationMs: number
}

export type BenchEvent =
  | { type: 'result'; result: BenchResult }
  | { type: 'kdf'; result: KdfTimingResult }

export interface AppState {
  config: BenchConfig
  running: boolean
  results: BenchResult[]
  kdfTiming: KdfTimingResult | null
  error: string | null
}

export type Action =
  | { type: 'RUN_STARTED' }
  | { type: 'RESULT_ADDED'; result: BenchResult }
  | { type: 'KDF_TIMING'; result: KdfTimingResult }
  | { type: 'RUN_COMPLETE' }
  | { type: 'RUN_FAILED'; message: string }
