# Changelog

## 1.0.0 - 2026-09-20

- 提供基金份额映射、纯债基金久期与 Alpha 历史、截面和可用模型日期查询。
- 提供 Brinson 单期明细、净值数据及跨期收益来源分析，明确完整期、缺期与贡献口径。
- 支持从官网 ZIP 自助更新 Skill，校验文件后仅替换当前安装。
- 数据查询与文档检索共用远程 MCP，补齐修正久期截面查询和 Alpha 暴露分位。
- 支持从完整 MCP 数据快照进行本地分析；统一 Skill 与网页的交互图表、筛选与分页。
- 按模型组织分析场景，新增 Skills 架构说明与问题反馈页面。
- 公开版本与内部模型版本、部署修订号分离；新增独立的更新历史页面。

## 旧版开发记录

以下为公共版本线重新确立前的开发记录，保留供追溯，不作为当前用户版的更新序列。

### 3.0.0 - 2026-09-07

- Add four-asset Brinson attribution with Wind convertible bonds and fitted NAV data.
- Document practical Brinson analysis workflows, source-backed interpretation and model boundaries without changing Skill previews.
- Ship migration-safe direct model releases without a private Actions runner.

### 2.2.0 - 2026-09-01

- 新增基金Brinson归因模型、历史归因、单期明细与净值对比查询能力

### 2.1.0 - 2026-08-27

- 新增 Alpha 单基历史、截面排行与联动图查询能力
- 完善久期与 Alpha 核心验证文档及 Skill 使用指引
- 完成 Linux 生产运行迁移并强化只读预检与回滚流程

### 2.0.0 - 2026-08-17

- 统一纯债基金时序多因子模型身份并发布截面与历史查询
- 新增按模型分支及纯债基金类型拆分的修正久期中位数历史
- 升级模型任务至 1.2.0 并保持跨版本历史连续

### 1.0.0 - 2026-08-13

- init
