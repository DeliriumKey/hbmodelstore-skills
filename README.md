# hbmodelstore Skills

供 AI Agent 查询 hbmodelstore 公开模型数据的 Agent Skills。

当前提供 [`hbmodelstore-query`](skills/hbmodelstore-query/)，用于发现、查询和解释已经发布的
模型数据。查询通过公开只读 API 完成，无需直接连接数据库。

## 安装

先克隆仓库：

```bash
git clone https://github.com/DeliriumKey/hbmodelstore-skills.git
```

### Codex

```bash
cp -R hbmodelstore-skills/skills/hbmodelstore-query ~/.codex/skills/
```

### Claude Code

```bash
cp -R hbmodelstore-skills/skills/hbmodelstore-query ~/.claude/skills/
```

其他兼容 [Agent Skills](https://agentskills.io/) 的工具，请将
`skills/hbmodelstore-query/` 复制到对应的 Skills 目录。安装后重新启动或刷新 Agent。

## 文档

- [使用文档](https://api.delirium.com.cn/docs)
- [开始使用](https://api.delirium.com.cn/docs/getting-started)
- [API Reference](https://api.delirium.com.cn/docs/api-reference)
- [更新历史](CHANGELOG.md)
