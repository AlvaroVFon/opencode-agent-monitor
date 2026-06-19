# [0.3.0](https://github.com/AlvaroVFon/opencode-agent-monitor/compare/v0.2.0...v0.3.0) (2026-06-19)

> [!NOTE]
> v0.3.0 is a re-release of the v0.2.0 changes under a new version. v0.2.0 could not be published to npm (the version was burned by a failed CI job), so the same changes are shipped as v0.3.0.

### Bug Fixes

* **test-prod:** update script to use global config, remove dead session id prop ([#31](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/31)) ([b37de33](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/b37de33d67b51b9dc436f87c6c6586ef533db9a4))
* **tool-call-handler:** replace string literals with parttype and partstatus enums ([#42](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/42)) ([e62481a](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/e62481a457f384c2985997c65ae1e9357452650e))
* **tui:** hoist collapsed state to module level to survive remounts ([#50](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/50)) ([af4ca75](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/af4ca75c1fefedc2d4fb87be4ac7207ee095c87a))
* update pnpm action to v6, revert to default gha token ([5dfb7c6](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/5dfb7c6611dd71db6652a195b5f6234cf4489bd3))
* use gh_token for semantic-release git push ([8d49704](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8d497048810f5ebd16dd110d7d472693898b52fd))

### Features

* **agents:** add repo context files and opencode skills ([#29](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/29)) ([6e38a51](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/6e38a5126422f8e229a763cec19c329cac78bd6f))
* **cli:** add structured cli with commander subcommands and helpers ([#40](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/40)) ([94c9025](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/94c9025fe4f0df29872fbcf71461fb2c3fe0b7d9))
* **cli:** expose as bin in package.json and add $/call to markdown report ([#49](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/49)) ([010c825](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/010c825c059e66e8bef8e2ba73dd2f8816a42c1d))
* **metrics:** add tool tracking, errors, filters and formatters to aggregator ([#30](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/30)) ([aad071b](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/aad071b7ea92244bb68592f8ac4984fd4d3b52f8))
* replace semantic-release with conventional-changelog and simplified release workflow ([#36](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/36)) ([28ab939](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/28ab9393a0751ce8e14420f27fdd76b6c9df87f2))
* update installation docs in readme and add oop convention to agents.md ([#33](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/33)) ([c2b9f92](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c2b9f92a7dad789f9301b1ca9956b785d1abaa84))

### Performance Improvements

* **trace:** cache directory existence checks and add improvements doc ([#46](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/46)) ([8f9b4ce](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8f9b4ce8607fb795fed301462ea5b5b9ab99f67c))

# [0.2.0](https://github.com/AlvaroVFon/opencode-agent-monitor/compare/v0.0.1...v0.2.0) (2026-06-19)


### Bug Fixes

* **test-prod:** update script to use global config, remove dead session id prop ([#31](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/31)) ([b37de33](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/b37de33d67b51b9dc436f87c6c6586ef533db9a4))
* **tool-call-handler:** replace string literals with parttype and partstatus enums ([#42](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/42)) ([e62481a](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/e62481a457f384c2985997c65ae1e9357452650e))
* **tui:** hoist collapsed state to module level to survive remounts ([#50](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/50)) ([af4ca75](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/af4ca75c1fefedc2d4fb87be4ac7207ee095c87a))
* update pnpm action to v6, revert to default gha token ([5dfb7c6](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/5dfb7c6611dd71db6652a195b5f6234cf4489bd3))
* use gh_token for semantic-release git push ([8d49704](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8d497048810f5ebd16dd110d7d472693898b52fd))


### Features

* **agents:** add repo context files and opencode skills ([#29](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/29)) ([6e38a51](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/6e38a5126422f8e229a763cec19c329cac78bd6f))
* **cli:** add structured cli with commander subcommands and helpers ([#40](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/40)) ([94c9025](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/94c9025fe4f0df29872fbcf71461fb2c3fe0b7d9))
* **cli:** expose as bin in package.json and add $/call to markdown report ([#49](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/49)) ([010c825](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/010c825c059e66e8bef8e2ba73dd2f8816a42c1d))
* **metrics:** add tool tracking, errors, filters and formatters to aggregator ([#30](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/30)) ([aad071b](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/aad071b7ea92244bb68592f8ac4984fd4d3b52f8))
* replace semantic-release with conventional-changelog and simplified release workflow ([#36](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/36)) ([28ab939](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/28ab9393a0751ce8e14420f27fdd76b6c9df87f2))
* update installation docs in readme and add oop convention to agents.md ([#33](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/33)) ([c2b9f92](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c2b9f92a7dad789f9301b1ca9956b785d1abaa84))


### Performance Improvements

* **trace:** cache directory existence checks and add improvements doc ([#46](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/46)) ([8f9b4ce](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8f9b4ce8607fb795fed301462ea5b5b9ab99f67c))
# [0.1.0](https://github.com/AlvaroVFon/opencode-agent-monitor/compare/v0.0.1...v0.1.0) (2026-06-18)


### Bug Fixes

* **test-prod:** update script to use global config, remove dead session id prop ([#31](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/31)) ([b37de33](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/b37de33d67b51b9dc436f87c6c6586ef533db9a4))
* update pnpm action to v6, revert to default gha token ([5dfb7c6](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/5dfb7c6611dd71db6652a195b5f6234cf4489bd3))
* use gh_token for semantic-release git push ([8d49704](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8d497048810f5ebd16dd110d7d472693898b52fd))


### Features

* **agents:** add repo context files and opencode skills ([#29](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/29)) ([6e38a51](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/6e38a5126422f8e229a763cec19c329cac78bd6f))
* **metrics:** add tool tracking, errors, filters and formatters to aggregator ([#30](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/30)) ([aad071b](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/aad071b7ea92244bb68592f8ac4984fd4d3b52f8))
* replace semantic-release with conventional-changelog and simplified release workflow ([#36](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/36)) ([28ab939](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/28ab9393a0751ce8e14420f27fdd76b6c9df87f2))
* update installation docs in readme and add oop convention to agents.md ([#33](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/33)) ([c2b9f92](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c2b9f92a7dad789f9301b1ca9956b785d1abaa84))
