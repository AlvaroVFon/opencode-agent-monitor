import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";

const MOD_PATH = path.resolve(__dirname, "../../helpers/trace.helpers.ts");

function fresh() {
  delete require.cache[MOD_PATH];
  return require(MOD_PATH).TraceHelper;
}

describe("TraceHelper", () => {
  it("ensureDir creates directory when it does not exist", () => {
    mock.restoreAll();
    const mockExists = mock.fn(() => false);
    const mockMkdir = mock.fn();
    const mockAppend = mock.fn();

    mock.module("fs", {
      namedExports: {
        appendFileSync: mockAppend,
        existsSync: mockExists,
        mkdirSync: mockMkdir,
      },
    });
    mock.module("os", {
      namedExports: { homedir: mock.fn(() => "/tmp/fake-home") },
    });

    const TH = fresh();
    const h = new TH();
    h.ensureDir();

    assert.equal(mockExists.mock.calls.length, 1);
    assert.equal(mockMkdir.mock.calls.length, 1);
    assert.deepEqual(mockMkdir.mock.calls[0].arguments[1], {
      recursive: true,
    });
  });

  it("ensureDir skips mkdirSync when directory exists", () => {
    mock.restoreAll();
    const mockExists = mock.fn(() => true);
    const mockMkdir = mock.fn();
    const mockAppend = mock.fn();

    mock.module("fs", {
      namedExports: {
        appendFileSync: mockAppend,
        existsSync: mockExists,
        mkdirSync: mockMkdir,
      },
    });
    mock.module("os", {
      namedExports: { homedir: mock.fn(() => "/tmp/fake-home") },
    });

    const TH = fresh();
    const h = new TH();
    h.ensureDir();

    assert.equal(mockExists.mock.calls.length, 1);
    assert.equal(mockMkdir.mock.calls.length, 0);
  });

  it("writeTrace appends JSON lines to trace.jsonl", () => {
    mock.restoreAll();
    const mockAppend = mock.fn();

    mock.module("fs", {
      namedExports: {
        appendFileSync: mockAppend,
        existsSync: mock.fn(() => true),
        mkdirSync: mock.fn(),
      },
    });
    mock.module("os", {
      namedExports: { homedir: mock.fn(() => "/tmp/fake-home") },
    });

    const TH = fresh();
    const h = new TH();
    const ev = { type: "test_event", value: 42 };
    h.writeTrace(ev);

    assert.equal(mockAppend.mock.calls.length, 1);
    const [fp, ct] = mockAppend.mock.calls[0].arguments;
    assert.ok(fp.endsWith("trace.jsonl"));
    assert.equal(ct, JSON.stringify(ev) + "\n");
  });

  it("writeTrace calls writeTraceError when appendFileSync fails", () => {
    mock.restoreAll();
    let idx = 0;
    const mockAppend = mock.fn(() => {
      idx++;
      if (idx === 1) throw new Error("disk full");
    });

    mock.module("fs", {
      namedExports: {
        appendFileSync: mockAppend,
        existsSync: mock.fn(() => true),
        mkdirSync: mock.fn(),
      },
    });
    mock.module("os", {
      namedExports: { homedir: mock.fn(() => "/tmp/fake-home") },
    });

    const TH = fresh();
    const h = new TH();
    h.writeTrace({ type: "boom" });

    assert.equal(mockAppend.mock.calls.length, 2);
    const p = JSON.parse(mockAppend.mock.calls[1].arguments[1]);
    assert.equal(p.type, "write_trace_error");
    assert.equal(p.originalEventType, "boom");
    assert.ok(p.error.includes("disk full"));
  });

  it("writeTraceError silently swallows write errors", () => {
    mock.restoreAll();
    const mockAppend = mock.fn(() => {
      throw new Error("always fails");
    });

    mock.module("fs", {
      namedExports: {
        appendFileSync: mockAppend,
        existsSync: mock.fn(() => true),
        mkdirSync: mock.fn(),
      },
    });
    mock.module("os", {
      namedExports: { homedir: mock.fn(() => "/tmp/fake-home") },
    });

    const TH = fresh();
    const h = new TH();

    assert.doesNotThrow(() => {
      h.writeTraceError({ type: "test" });
    });
  });
});
