---
name: hbmodelstore-query
description: 通过 hbmodelstore 统一公网 API 发现和查询公开模型数据，包括基金Brinson市场、行业与个股归因、基金与复合基准净值曲线，以及纯债基金修正久期、因子暴露和Alpha信号；在用户询问模型构建逻辑、方法选择、版本演进或验证时自动读取网页端最新机器可读文档。无需 API Key，不直接连接 PostgreSQL，不用于模型接入、数据库管理、生产任务或服务器运维。
---

# hbmodelstore 模型查询

只通过 `https://api.delirium.com.cn` 的公开只读 API 查询。不要连接数据库、拼接 SQL、读取
数据库凭据，或调用生产、管理员和运维流程。

## 先确定能力

1. 读取 [`capabilities.json`](./capabilities.json)，用 `id` 找到能力、Reference、可视化入口与
   边界。`status` 不是在线健康检查；需要确认公网实时可用性时仍调用对应命令。
2. 按 `model_key` 读取 `models/<model_key>/MODEL.md`，再只读目标能力的 Reference。不要一次
   加载所有字段和能力说明。
3. 不确定模型是否在线可发现时，运行 `list-models`。

## 基金身份解析

模型以初始基金代码为稳定实体。用户给基金名称、A/C 等子份额或不确定代码时：

1. 用 `search-funds` 搜索全市场份额并让用户确认具体候选。
2. 搜索结果已有非空 `initial_fund_code` 时直接使用，不再重复请求。
3. 用户给出精确份额代码或结果缺少初始代码时，用 `resolve-fund`。
4. 只有准备执行某个具体模型查询时，才用该模型目录的 `search-funds` 确认初始份额的最近
   模型日在近两年内；若用户只问主份额映射，或尚未指定目标模型，到第 3 步即停止。

不得把名称相近、`initial_fund_code=null` 或仅存在于全市场参考表的份额自动当成模型样本。
详细口径见 [fund-reference/MODEL.md](./models/fund-reference/MODEL.md)。

## 查询与可视化

- 使用目标模型目录的 `scripts/query.py`，不要手写 API URL。
- 用户要图时优先使用 `scripts/visualize.py`。独立 HTML 只是外壳，必须复用 capability manifest
  指向的同一 ECharts renderer，确保与网页 Skill 预览同口径。
- 默认使用返回数据的完整已发布区间；用户明确指定起止日期时才裁剪。
- 返回结果时遵守目标 Reference 的解释边界；空数组或空点集不解释为零。

## 模型文档问答

用户询问构建逻辑、方法选择、版本演进、验证或消融时，运行 `model-docs`，阅读网页端最新的
机器可读内容后直接回答。网页未披露的内容明确说明未披露，不从本地代码、旧副本或记忆反推。

```bash
python3 skills/hbmodelstore-query/scripts/client.py model-docs \
  --model-key bond-fund-timeseries-factor
```

## 查询入口

```bash
python3 skills/hbmodelstore-query/scripts/client.py --help
```

在本仓库也可用 `uv run python` 替代 `python3`。完整命令只保留在各能力 Reference；入口示例：

```bash
python3 skills/hbmodelstore-query/scripts/client.py list-models
python3 skills/hbmodelstore-query/scripts/client.py search-funds --query 永赢诚益
python3 skills/hbmodelstore-query/scripts/client.py resolve-fund --fund-code 005952.OF
```

API 参数、状态码与网络故障处理见 [api.md](./references/api.md)。

## 边界

- 只执行 API 已发布的固定、有限查询。
- 不尝试任意 SQL、任意表名、全库导出或绕过行数和日期限制。
- 不运行模型生产、回补、训练、写库、权限、部署或服务器操作。
- 不把估计结果描述为真实持仓，不直接给出投资建议。
- 网页模型文档是模型知识的唯一公开内容源。若当前文档无法取得，应说明无法验证最新细节，
  不以 Skill、本地模型代码或记忆替代网页文档。
- 新模型只有在 `/models` 可发现，且 manifest、API 路由、模型脚本、Reference 和必要 renderer
  均已发布后，才算对本 Skill 可用。
