export function generateId(prefix: string): string {
  return (
    prefix +
    "-" +
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
