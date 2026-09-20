# hbmodelstore Skills

供 AI Agent 查询 hbmodelstore 公开模型数据的 Agent Skills。

当前提供 [`hbmodelstore-query`](skills/hbmodelstore-query/)，用于发现、查询和解释已经发布的
模型数据。普通查询优先通过远程 MCP 使用同一套公开只读 API，无需直接连接数据库。

## 安装

下载[官方 ZIP](https://api.delirium.com.cn/docs/downloads/hbmodelstore-query.zip)，解压后将
`hbmodelstore-query` 文件夹放入所用 Agent 的 Skills 目录，再刷新或重启 Agent。
同时在当前 Agent 的 MCP 设置中添加 `hbmodelstore`，使用 Streamable HTTP 地址
`https://api.delirium.com.cn/mcp`。Skill 声明了依赖，但连接是否自动完成取决于客户端。
无需 API Key 或 Wind 账号；普通 MCP 查询不需要 Python，本地分析、绘图与更新需要 Python 3.11+。

图表默认生成为交互 HTML，推荐在 Agent Harness 的侧边栏打开；不支持时在浏览器打开，
静态图片按需导出。

## 更新

告诉 Agent：`$hbmodelstore-query 更新到官网最新版本。`
Skill 会校验官方 ZIP 后只替换自身，保留旧安装；不会在普通查询时自动覆盖文件。
公开版本以安装包 `version.json` 为准，不与内部模型版本或部署修订号联动。

## 文档

- [使用文档](https://api.delirium.com.cn/docs)
- [API Reference](https://api.delirium.com.cn/docs/api-reference)
