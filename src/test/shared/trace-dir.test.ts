import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { homedir } from "node:os";
import { TraceDirResolver } from "../../shared/trace-dir";

describe("TraceDirResolver", () => {
  it("prefers the explicit traceDir option", () => {
    assert.equal(
      TraceDirResolver.resolve(
        { traceDir: "/custom/traces" },
        { AGENT_MONITOR_DIR: "/env/traces", XDG_CONFIG_HOME: "/xdg" },
      ),
      "/custom/traces",
    );
  });

  it("falls back to AGENT_MONITOR_DIR", () => {
    assert.equal(
      TraceDirResolver.resolve(
        {},
        { AGENT_MONITOR_DIR: "/env/traces", XDG_CONFIG_HOME: "/xdg" },
      ),
      "/env/traces",
    );
  });

  it("ignores empty option and env values", () => {
    assert.equal(
      TraceDirResolver.resolve(
        { traceDir: "" },
        { AGENT_MONITOR_DIR: "", XDG_CONFIG_HOME: "/xdg" },
      ),
      join("/xdg", "opencode", ".tracing"),
    );
  });

  it("uses XDG_CONFIG_HOME for the default directory", () => {
    assert.equal(
      TraceDirResolver.defaultDir({ XDG_CONFIG_HOME: "/xdg" }),
      join("/xdg", "opencode", ".tracing"),
    );
  });

  it("falls back to ~/.config when XDG_CONFIG_HOME is unset", () => {
    assert.equal(
      TraceDirResolver.defaultDir({}),
      join(homedir(), ".config", "opencode", ".tracing"),
    );
  });
});
