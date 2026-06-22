import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { ModelPricing } from "./pricing";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface OpenCodeModelRaw {
  id: string;
  providerID: string;
  cost?: {
    input?: number;
    output?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
}

export interface PricingCache {
  timestamp: number;
  models: ModelPricing[];
}

export class DynamicPricingFetcher {
  private readonly cachePath: string;

  constructor(cachePath?: string) {
    this.cachePath =
      cachePath ??
      join(homedir(), ".config", "opencode", ".tracing", "pricing_cache.json");
  }

  async getPricing(): Promise<ModelPricing[] | null> {
    const cached = this.getCached();
    if (cached && this.isCacheValid(cached)) {
      return cached.models;
    }

    try {
      const fresh = this.fetchFromOpenCode();
      if (fresh.length > 0) {
        this.saveCache({ timestamp: Date.now(), models: fresh });
        return fresh;
      }
    } catch {
      // fall through to cache
    }

    return cached?.models ?? null;
  }

  getCached(): PricingCache | null {
    try {
      if (!existsSync(this.cachePath)) return null;
      const content = readFileSync(this.cachePath, "utf-8");
      const parsed = JSON.parse(content) as PricingCache;
      if (!Array.isArray(parsed.models)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  isCacheValid(cache: PricingCache): boolean {
    return Date.now() - cache.timestamp < CACHE_TTL_MS;
  }

  saveCache(cache: PricingCache): void {
    try {
      const dir = dirname(this.cachePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.cachePath, JSON.stringify(cache), "utf-8");
    } catch {
      // best-effort
    }
  }

  fetchFromOpenCode(): ModelPricing[] {
    const output = execFileSync("opencode", ["models", "--verbose"], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return this.parseOutput(output);
  }

  parseOutput(output: string): ModelPricing[] {
    const models: ModelPricing[] = [];
    const lines = output.split("\n");
    let i = 0;

    while (i < lines.length) {
      const headerMatch = lines[i].match(/^([\w.-]+)\/([\w.-]+)\s*$/);
      if (!headerMatch) {
        i++;
        continue;
      }

      i++;
      const jsonLines: string[] = [];
      let braceDepth = 0;
      let started = false;
      while (i < lines.length) {
        const jsonLine = lines[i];
        for (const ch of jsonLine) {
          if (ch === "{") {
            braceDepth++;
            started = true;
          } else if (ch === "}") {
            braceDepth--;
          }
        }
        if (started) {
          jsonLines.push(jsonLine);
        }
        i++;
        if (started && braceDepth === 0) {
          break;
        }
      }

      try {
        const parsed = JSON.parse(jsonLines.join("\n")) as OpenCodeModelRaw;
        const pricing = this.toModelPricing(parsed);
        if (pricing) {
          models.push(pricing);
        }
      } catch {
        // skip malformed section
      }
    }

    return models;
  }

  private toModelPricing(raw: OpenCodeModelRaw): ModelPricing | null {
    if (
      !raw.cost ||
      raw.cost.input === undefined ||
      raw.cost.output === undefined
    ) {
      return null;
    }
    const pricing: ModelPricing = {
      provider: raw.providerID,
      model: raw.id,
      input1M: raw.cost.input,
      output1M: raw.cost.output,
    };
    if (raw.cost.cache?.read !== undefined) {
      pricing.cacheRead1M = raw.cost.cache.read;
    }
    return pricing;
  }
}

export const dynamicPricingFetcher = new DynamicPricingFetcher();

export function mergePricingRegistries(
  fallback: ModelPricing[],
  primary: ModelPricing[],
): ModelPricing[] {
  const primaryKeys = new Set(primary.map((m) => `${m.provider}/${m.model}`));
  const merged: ModelPricing[] = [...primary];
  for (const model of fallback) {
    const key = `${model.provider}/${model.model}`;
    if (!primaryKeys.has(key)) {
      merged.push(model);
    }
  }
  return merged;
}
