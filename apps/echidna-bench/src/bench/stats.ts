import type { OperationStats } from '../state/types.js'

export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export function throughputMBs(bytes: number, durationMs: number): number {
  if (durationMs <= 0) return Infinity
  return bytes / (durationMs / 1000) / (1024 * 1024)
}

export function summarize(durationsMs: number[], bytes: number): OperationStats {
  const meanMs = mean(durationsMs)
  return {
    meanMs,
    medianMs: median(durationsMs),
    throughputMBs: throughputMBs(bytes, meanMs),
  }
}

export function formatSizeLabel(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(bytes % 1_000_000 === 0 ? 0 : 1)} MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(bytes % 1_000 === 0 ? 0 : 1)} KB`
  return `${bytes} B`
}
