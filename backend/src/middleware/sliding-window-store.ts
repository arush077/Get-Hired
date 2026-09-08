import type { Store, ClientRateLimitInfo } from "express-rate-limit";

/**
 * Sliding window counter store — each request is allowed exactly `windowMs`
 * after the previous one (no fixed calendar boundary).
 */
export class SlidingWindowStore implements Store {
  private windows = new Map<string, number[]>();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = Date.now();
    let timestamps = this.windows.get(key) || [];

    // Prune timestamps outside the window
    timestamps = timestamps.filter((t) => now - t < this.windowMs);
    timestamps.push(now);
    this.windows.set(key, timestamps);

    // Reset time = oldest timestamp in window + windowMs
    const resetTime = new Date(timestamps[0] + this.windowMs);
    return { totalHits: timestamps.length, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const timestamps = this.windows.get(key);
    if (timestamps && timestamps.length > 0) {
      timestamps.pop();
    }
  }

  async resetKey(key: string): Promise<void> {
    this.windows.delete(key);
  }

  async resetAll(): Promise<void> {
    this.windows.clear();
  }
}
