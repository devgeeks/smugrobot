export function deriveTitleFromMarkdown(md: string): string {
  const first = md.split('\n').find((l) => l.trim().length > 0)
  if (!first) return 'Untitled'
  return first.replace(/^#{1,6}\s*/, '').trim() || 'Untitled'
}

export function previewFromMarkdown(md: string, maxChars = 120): string {
  return md
    .split('\n')
    .slice(1)
    .join(' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}
