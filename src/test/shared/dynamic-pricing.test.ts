import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MOD_PATH = path.resolve(
  import.meta.dirname,
  "../../shared/dynamic-pricing.ts",
);

function fresh() {
  delete require.cache[MOD_PATH];
  return require(MOD_PATH);
}

function makeCachePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pricing-fetcher-"));
  return path.join(dir, "pricing_cache.json");
}

const SAMPLE_OUTPUT = `opencode/big-pickle
{
  "id": "big-pickle",
  "providerID": "opencode",
  "name": "Big Pickle",
  "cost": {
    "input": 0,
    "output": 0,
    "cache": {
      "read": 0,
      "write": 0
    }
  }
}
github-copilot/claude-sonnet-4.5
{
  "id": "claude-sonnet-4.5",
  "providerID": "github-copilot",
  "name": "Claude Sonnet 4.5",
  "cost": {
    "input": 3,
    "output": 15,
    "cache": {
      "read": 0.3,
      "write": 0
    }
  }
}
github-copilot/gpt-5.4
{
  "id": "gpt-5.4",
  "providerID": "github-copilot",
  "name": "GPT-5.4",
  "cost": {
    "input": 2.5,
    "output": 15,
    "cache": {
      "read": 0.25,
      "write": 0
    }
  }
}
opencode/big-pickle-free
{
  "id": "big-pickle-free",
  "providerID": "opencode",
  "name": "Big Pickle Free"
}
`;

describe("DynamicPricingFetcher.parseOutput", () => {
  it("parses a multi-model verbose output into pricing entries", () => {
    mock.restoreAll();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher();
    const models = fetcher.parseOutput(SAMPLE_OUTPUT);

    assert.equal(models.length, 3);
    assert.deepEqual(models[0], {
      provider: "opencode",
      model: "big-pickle",
      input1M: 0,
      output1M: 0,
      cacheRead1M: 0,
    });
    assert.deepEqual(models[1], {
      provider: "github-copilot",
      model: "claude-sonnet-4.5",
      input1M: 3,
      output1M: 15,
      cacheRead1M: 0.3,
    });
    assert.deepEqual(models[2], {
      provider: "github-copilot",
      model: "gpt-5.4",
      input1M: 2.5,
      output1M: 15,
      cacheRead1M: 0.25,
    });
  });

  it("skips models without cost metadata", () => {
    mock.restoreAll();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher();
    const models = fetcher.parseOutput(SAMPLE_OUTPUT);

    const freeModel = models.find((m) => m.model === "big-pickle-free");
    assert.equal(freeModel, undefined);
  });

  it("returns empty array for empty input", () => {
    mock.restoreAll();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher();
    assert.deepEqual(fetcher.parseOutput(""), []);
  });
});

describe("DynamicPricingFetcher cache TTL", () => {
  it("treats a fresh cache as valid", () => {
    mock.restoreAll();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher();
    const cache = { timestamp: Date.now() - 1000, models: [] };
    assert.equal(fetcher.isCacheValid(cache), true);
  });

  it("treats a stale cache as invalid", () => {
    mock.restoreAll();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher();
    const cache = {
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
      models: [],
    };
    assert.equal(fetcher.isCacheValid(cache), false);
  });
});

describe("DynamicPricingFetcher.getCached / saveCache", () => {
  it("round-trips a cache file", () => {
    mock.restoreAll();
    const cachePath = makeCachePath();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher(cachePath);

    const models = [
      {
        provider: "openai",
        model: "gpt-4o",
        input1M: 2.5,
        output1M: 10.0,
        cacheRead1M: 1.25,
      },
    ];
    fetcher.saveCache({ timestamp: 1234567890, models });

    const loaded = fetcher.getCached();
    assert.deepEqual(loaded, { timestamp: 1234567890, models });
  });

  it("returns null when no cache file exists", () => {
    mock.restoreAll();
    const cachePath = makeCachePath();
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher(cachePath);
    assert.equal(fetcher.getCached(), null);
  });

  it("returns null for malformed cache content", () => {
    mock.restoreAll();
    const cachePath = makeCachePath();
    fs.writeFileSync(cachePath, "not json at all");
    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher(cachePath);
    assert.equal(fetcher.getCached(), null);
  });
});

describe("DynamicPricingFetcher.getPricing", () => {
  it("returns fresh data from opencode when cache is stale", async () => {
    mock.restoreAll();
    const cachePath = makeCachePath();
    const mockExec = mock.fn(() => SAMPLE_OUTPUT);
    mock.module("node:child_process", {
      namedExports: { execFileSync: mockExec },
    });

    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher(cachePath);
    const models = await fetcher.getPricing();

    assert.ok(models);
    assert.equal(models.length, 3);
    assert.ok(mockExec.mock.calls.length >= 1);
  });

  it("uses cache without invoking opencode when fresh", async () => {
    mock.restoreAll();
    const cachePath = makeCachePath();
    const models = [
      { provider: "openai", model: "gpt-4o", input1M: 2.5, output1M: 10.0 },
    ];
    fs.writeFileSync(
      cachePath,
      JSON.stringify({ timestamp: Date.now(), models }),
    );

    const mockExec = mock.fn(() => {
      throw new Error("should not be called");
    });
    mock.module("node:child_process", {
      namedExports: { execFileSync: mockExec },
    });

    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher(cachePath);
    const result = await fetcher.getPricing();

    assert.deepEqual(result, models);
    assert.equal(mockExec.mock.calls.length, 0);
  });

  it("falls back to stale cache when opencode exec fails", async () => {
    mock.restoreAll();
    const cachePath = makeCachePath();
    const models = [
      { provider: "openai", model: "gpt-4o", input1M: 2.5, output1M: 10.0 },
    ];
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        timestamp: Date.now() - 48 * 60 * 60 * 1000,
        models,
      }),
    );

    const mockExec = mock.fn(() => {
      throw new Error("opencode not installed");
    });
    mock.module("node:child_process", {
      namedExports: { execFileSync: mockExec },
    });

    const { DynamicPricingFetcher } = fresh();
    const fetcher = new DynamicPricingFetcher(cachePath);
    const result = await fetcher.getPricing();

    assert.deepEqual(result, models);
  });
});

describe("mergePricingRegistries", () => {
  it("puts primary entries first and appends fallback-only entries", () => {
    mock.restoreAll();
    const { mergePricingRegistries } = fresh();

    const fallback = [
      { provider: "openai", model: "gpt-4o", input1M: 99, output1M: 99 },
      { provider: "openai", model: "gpt-4o-mini", input1M: 1, output1M: 1 },
    ];
    const primary = [
      {
        provider: "github-copilot",
        model: "gpt-5.4",
        input1M: 2.5,
        output1M: 15,
      },
    ];
    const merged = mergePricingRegistries(fallback, primary);

    assert.equal(merged.length, 3);
    assert.equal(merged[0].provider, "github-copilot");
    assert.equal(merged[0].input1M, 2.5);
    assert.equal(merged[1].provider, "openai");
    assert.equal(merged[1].model, "gpt-4o");
    assert.equal(merged[1].input1M, 99);
    assert.equal(merged[2].provider, "openai");
    assert.equal(merged[2].model, "gpt-4o-mini");
  });

  it("prefers primary pricing when same key exists in both", () => {
    mock.restoreAll();
    const { mergePricingRegistries } = fresh();

    const fallback = [
      { provider: "openai", model: "gpt-4o", input1M: 99, output1M: 99 },
    ];
    const primary = [
      { provider: "openai", model: "gpt-4o", input1M: 2.5, output1M: 10 },
    ];
    const merged = mergePricingRegistries(fallback, primary);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].input1M, 2.5);
  });
});
