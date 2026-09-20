# MCP 使用说明

服务名 `hbmodelstore`，Streamable HTTP 地址：`https://api.delirium.com.cn/mcp`。
公开只读，无 API Key。连接的是远程服务，不在客户电脑启动 MCP Server，不安装本项目后端。

## 安装与检查

安装 Skill 与连接 MCP 是两件事。`agents/openai.yaml` 已声明依赖；部分 Harness 会据此引导连接，
不保证每种客户端都自动配置。用户要求安装这套能力时，先看当前工具是否已经可用，再使用当前
Harness 的原生 MCP 设置添加这一个服务；保留其他配置，不关闭审批或信任提示。

Codex CLI 可使用：

```bash
codex mcp add hbmodelstore --url https://api.delirium.com.cn/mcp
codex mcp get hbmodelstore
```

配置方式参见 [Codex 官方 MCP 说明](https://developers.openai.com/codex/mcp/)。

其他 Harness 使用其原生“添加远程 MCP”入口，填同一地址和 Streamable HTTP，不照搬 Codex
配置路径。没有配置权限或不支持远程 MCP 时说明连接条件。
只要求查数不等于授权改客户端全局配置，不静默修改。

验收以工具发现和一次 `list_models` 成功为准，不以下载 ZIP、配置文件存在或浏览器打开地址
为准。MCP 地址是协议入口，不是网页，普通 GET 不一定返回页面。必要时刷新客户端连接。

## 文档查询

文档与数据共用这一个 MCP，无需另装文档服务：

- `list_docs()` 列出文档标题、`path` 和原文链接。
- `search_docs(query=..., limit=8)` 搜索正文及按配置分块的实验，支持中文，最多20条结果。
  优先把返回的 `read_args` 原样用于 `get_doc`，不从搜索摘要推断完整实验结论。
- `get_doc(path=..., start_line=1, max_lines=200)` 读取 Markdown，最多400行；只接受目录中的
  `/docs/...` 路径，不传完整 URL。首段的 `sections` 列出标题和起始行，可直达某组实验；
  `next_line` 非空时用它继续读取，不把首段当作全文。
- `get_doc(path=..., section=...)` 只读一组实验。`section` 取搜索结果或正文首页的 `experiments[].id`；
  此时 `start_line`、`next_line` 相对该实验，不会续读到下一组配置。不同观察窗口、调仓周期、入选比例分别保留。
- 更新历史：`get_doc(path="/docs/changelog")`。引用文档时保留返回的来源链接。

例如“利率债基金 60 日调仓 5% 入选”对应 `section="portfolio-rate-60d-top5"`，
“利率债基金 60 日观察窗口 Rank IC”对应 `section="rank-ic-rate-60d"`，两者不是同一实验。
计算说明和字段解释直接读本 Skill 的模型 Reference；网页文档用于模型构建与验证研究。

实验文档提供各配置的收益、回撤、成本和压力区间；净值仅有首末摘要，不是完整日度路径。
文档中的日期是实验截止日，最新基金数据用数据工具查询。

## 数据查询

工具短名由 `capabilities.json` 的 `mcp_tools` 登记，真实调用名称可能带 Harness 前缀，
可调用工具及参数以客户端实际发现的工具定义为准。不要求每次查数都重新拉模型目录和全局日期。

- 已发布模型列表用 `list_models()`。
- 基金搜索用 `search_funds(q=...)`，不是 CLI 的 `--query`。
- 历史查询用 `fund_code`、可选 `start` / `end`。MCP 每次查询一只基金；CLI 的多基金封装
  与客户端 `--alpha-weight` 不是 MCP 参数。
- 久期截面与 Alpha 截面日期参数均为 `model_date`；只有 Alpha 截面支持
  `sample_type` 和 `duration_bucket` 过滤。
- Brinson 先确认已有报告期；批量工具用 `period_ends`，最多40个不重复半年期。

MCP 返回原始 API 对象，保留 `points`、`rows`、覆盖信息和原精度；不带文件脚本的
`ok/data` 或 `data.series` 外壳，也不计算 Alpha 混合得分或 Brinson 跨期链接。
这些派生与图表仍由 Skill 的已有脚本完成。Brinson 的三份完整 MCP 导出可直接交给
`analyze.py`，导入方法见[跨期计算](../models/fund-brinson-attribution/references/multi-period.md)。

复算或绘图需要完整数据：优先使用客户端的结构化结果/文件导出；无法完整导出时用已有 REST
脚本保存 JSON，不从截断的工具输出重建数据。

## 故障

MCP 返回 `isError=true` 表示查询失败，不是基金无数据。

- `422`：检查参数格式、范围和枚举。
- `429`：按返回提示等待。
- `503` 或连接超时：重试一次，仍失败则说明当前查询未完成。
- 工具未连接：按上文“安装与检查”确认连接。

成功响应中的空数组才表示当前条件没有已发布结果。
