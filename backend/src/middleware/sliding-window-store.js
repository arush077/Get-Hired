export class SlidingWindowStore {
  windows = new Map();

  constructor(windowMs) {
    this.windowMs = windowMs;
  }

  async increment(key) {
    const now = Date.now();
    let timestamps = this.windows.get(key) || [];

    timestamps = timestamps.filter((t) => now - t < this.windowMs);
    timestamps.push(now);
    this.windows.set(key, timestamps);

    const resetTime = new Date(timestamps[0] + this.windowMs);
    return { totalHits: timestamps.length, resetTime };
  }

  async decrement(key) {
    const timestamps = this.windows.get(key);
    if (timestamps && timestamps.length > 0) {
      timestamps.pop();
    }
  }

  async resetKey(key) {
    this.windows.delete(key);
  }

  async resetAll() {
    this.windows.clear();
  }
}
