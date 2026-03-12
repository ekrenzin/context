import type { AiProvider } from "./client.js";

interface UsageRecord {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

interface ProviderUsage {
  requests: number[];
  tokens: UsageRecord[];
  totalInput: number;
  totalOutput: number;
}

const WINDOW_MS = 60_000;
const DEFAULT_RPM = 30;

let limiterInstance: RateLimiter | null = null;

class RateLimiter {
  private usage: Record<AiProvider, ProviderUsage> = {
    anthropic: this.empty(),
    openai: this.empty(),
  };
  private maxRpm: number;

  constructor(maxRpm = DEFAULT_RPM) {
    this.maxRpm = maxRpm;
  }

  private empty(): ProviderUsage {
    return { requests: [], tokens: [], totalInput: 0, totalOutput: 0 };
  }

  private prune(list: number[]): number[] {
    const cutoff = Date.now() - WINDOW_MS;
    return list.filter((t) => t > cutoff);
  }

  async acquire(provider: AiProvider): Promise<void> {
    const u = this.usage[provider];
    u.requests = this.prune(u.requests);

    if (u.requests.length >= this.maxRpm) {
      const oldest = u.requests[0];
      const waitMs = oldest + WINDOW_MS - Date.now();
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      u.requests = this.prune(u.requests);
    }

    u.requests.push(Date.now());
  }

  record(provider: AiProvider, inputTokens: number, outputTokens: number): void {
    const u = this.usage[provider];
    u.tokens.push({ timestamp: Date.now(), inputTokens, outputTokens });
    u.totalInput += inputTokens;
    u.totalOutput += outputTokens;
  }

  stats(provider: AiProvider): { rpm: number; totalInput: number; totalOutput: number } {
    const u = this.usage[provider];
    u.requests = this.prune(u.requests);
    return {
      rpm: u.requests.length,
      totalInput: u.totalInput,
      totalOutput: u.totalOutput,
    };
  }

  setMaxRpm(rpm: number): void {
    this.maxRpm = rpm;
  }
}

export function getRateLimiter(): RateLimiter {
  if (!limiterInstance) limiterInstance = new RateLimiter();
  return limiterInstance;
}

export type { RateLimiter };
