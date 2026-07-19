/**
 * Closes a vault-popover menu after the tapped option has had a moment to
 * show its pressed state. `menu.close()` hides the panel synchronously (no
 * fade-out), so calling it in the same tick as the click handler skips
 * straight to the next frame with the panel already gone — touch users never
 * see any tap feedback on the option they picked. Deferring by
 * `--duration-fast` (100ms) gives that frame time to render first.
 */
export function closeMenuAfterTap(menu: { close(): void }, action: () => void): void {
  setTimeout(() => {
    menu.close()
    action()
  }, 100)
}
