export function dicebearUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/miniavs/svg?seed=${encodeURIComponent(seed)}`
}
