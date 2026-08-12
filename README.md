# hbmodelstore Skills

供 AI Agent 查询 hbmodelstore 公开模型数据的 Agent Skills。

当前提供 [`hbmodelstore-query`](skills/hbmodelstore-query/)，用于发现、查询和解释已经发布的
模型数据。查询通过公开只读 API 完成，无需直接连接数据库。

## 安装

先克隆仓库：

```bash
git clone https://github.com/DeliriumKey/hbmodelstore-skills.git
```

根据所使用的 Agent harness，将 `skills/hbmodelstore-query/` 复制到该框架识别的 Skills
目录。安装后重新启动或刷新 Agent。

## 更新

拉取最新版本后，重新复制 `skills/hbmodelstore-query/`：

```bash
git -C hbmodelstore-skills pull
```

## 文档

- [使用文档](https://api.delirium.com.cn/docs)
- [五分钟开始](https://api.delirium.com.cn/docs/quickstart)
- [API Reference](https://api.delirium.com.cn/docs/api-reference)
