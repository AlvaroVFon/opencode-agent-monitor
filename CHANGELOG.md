# [1.1.0](https://github.com/AlvaroVFon/opencode-agent-monitor/compare/v0.0.1...v1.1.0) (2026-06-26)


### Bug Fixes

* **dashboard:** render cost by-model breakdown as stacked bar chart ([#75](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/75)) ([bb1a654](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/bb1a65400f657bcd07de7b2021846e9a5a91653b))
* **test-prod:** update script to use global config, remove dead session id prop ([#31](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/31)) ([b37de33](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/b37de33d67b51b9dc436f87c6c6586ef533db9a4))
* **tool-call-handler:** replace string literals with parttype and partstatus enums ([#42](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/42)) ([e62481a](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/e62481a457f384c2985997c65ae1e9357452650e))
* **trace:** route child session events to parent file ([#69](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/69)) ([03d772a](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/03d772ad95d753b06be0554a11795415f110e348))
* **tui:** hoist collapsed state to module level to survive remounts ([#50](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/50)) ([af4ca75](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/af4ca75c1fefedc2d4fb87be4ac7207ee095c87a))
* **tui:** include child session agents in filtered view with real-time reactivity ([#57](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/57)) ([6cfb34f](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/6cfb34fe5dc9c6f0f226efa71e7757edcf4059c1))
* update pnpm action to v6, revert to default gha token ([5dfb7c6](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/5dfb7c6611dd71db6652a195b5f6234cf4489bd3))
* use gh_token for semantic-release git push ([8d49704](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8d497048810f5ebd16dd110d7d472693898b52fd))


### Features

* **agents:** add repo context files and opencode skills ([#29](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/29)) ([6e38a51](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/6e38a5126422f8e229a763cec19c329cac78bd6f))
* **cli:** add cost comparison tool ([#59](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/59)) ([9a111bd](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/9a111bd2414a532b0697bd417c8d053b57d30126))
* **cli:** add structured cli with commander subcommands and helpers ([#40](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/40)) ([94c9025](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/94c9025fe4f0df29872fbcf71461fb2c3fe0b7d9))
* **cli:** expose as bin in package.json and add $/call to markdown report ([#49](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/49)) ([010c825](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/010c825c059e66e8bef8e2ba73dd2f8816a42c1d))
* **dashboard:** add DashboardAggregator with unit tests ([#72](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/72)) ([aef0088](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/aef008899c7f56e9b3ac5b372981d489fa4d2076))
* **dashboard:** add html renderer with 5 chart panels and tests ([#73](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/73)) ([8516dba](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8516dba7dbad978b3c7fee6cb48fd5c64e649185))
* **dashboard:** add panel registry with 6 panel implementations ([#77](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/77)) ([1639c16](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/1639c16fe381bb9822b9cb0709ddab358002e35b)), closes [#1](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/1) [#2](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/2)
* **dashboard:** add theme flag and event metrics tests ([#78](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/78)) ([91b2d41](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/91b2d417fb3d993bacb3ff9db3cbff9d609c157e)), closes [#1](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/1) [#2](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/2) [#3](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/3)
* **dashboard:** add theme types, engine skeleton, and handlebars templates ([#76](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/76)) ([c5ad8a4](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c5ad8a49da9eac83d2f34d386231184f514a941f)), closes [#1](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/1)
* **dashboard:** add type contract for html dashboard export ([#71](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/71)) ([5454c5a](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/5454c5a617671f97c8097bf8263a27c23f1af20d))
* **dashboard:** wire dashboard command into cli ([#74](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/74)) ([254706b](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/254706b2a4cad5327d67d225bc883eb0a78b727d))
* **metrics:** add skill usage tracking (phase 2.7) ([#55](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/55)) ([eac039e](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/eac039ee9aad71223d9f444717af33be45b555b3)), closes [#32](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/32) [#29](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/29) [#30](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/30) [#31](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/31) [#34](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/34)
* **metrics:** add tool tracking, errors, filters and formatters to aggregator ([#30](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/30)) ([aad071b](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/aad071b7ea92244bb68592f8ac4984fd4d3b52f8))
* replace semantic-release with conventional-changelog and simplified release workflow ([#36](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/36)) ([28ab939](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/28ab9393a0751ce8e14420f27fdd76b6c9df87f2))
* **tracing:** add session class and rewrite tracehelper with streams ([#63](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/63)) ([489053d](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/489053d349c52c89697310596d1b49cf569e1e64))
* **tracing:** add session-fs helpers with oop singleton ([#62](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/62)) ([171cf73](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/171cf73178ea3fff4cb24ec3026d2764ed32347b))
* **tracing:** add sessionwatcher, batch ingest, rewrite tui read path ([#64](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/64)) ([72c0325](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/72c0325e99073546732db690c4498596228fd785))
* **tracing:** rewrite cli tracereader for per-session files ([#65](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/65)) ([c6e8ef5](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c6e8ef5c3cfa6eebf0eb724a9c6a7e8cacff2156))
* **tui:** add live session timer to sidebar panel ([#61](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/61)) ([c8bffc8](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c8bffc88a9dc03bcd70ea17278f00a7280cdc596))
* update installation docs in readme and add oop convention to agents.md ([#33](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/33)) ([c2b9f92](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/c2b9f92a7dad789f9301b1ca9956b785d1abaa84))


### Performance Improvements

* **trace:** cache directory existence checks and add improvements doc ([#46](https://github.com/AlvaroVFon/opencode-agent-monitor/issues/46)) ([8f9b4ce](https://github.com/AlvaroVFon/opencode-agent-monitor/commit/8f9b4ce8607fb795fed301462ea5b5b9ab99f67c))
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
