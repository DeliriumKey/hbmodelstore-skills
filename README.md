# hbmodelstore Skills

面向 AI Agent 的公开模型数据查询 Skill。它通过 hbmodelstore 的公开只读 API 发现、查询并解释
已经发布的模型数据，不需要 API Key，也不会直接连接数据库。

## 当前 Skill

### `hbmodelstore-query`

统一的模型查询入口。目前支持：

- 发现已经发布的模型；
- 查询纯债基金最新久期；
- 查询单只基金的历史久期；
- 查询当前久期截面和高久期样本；
- 解释模型日期、版本、有效性和回退标记。

## 安装

克隆仓库：

```bash
git clone https://github.com/DeliriumKey/hbmodelstore-skills.git
```

安装到 Codex：

```bash
cp -R hbmodelstore-skills/skills/hbmodelstore-query ~/.codex/skills/
```

安装到 Claude Code：

```bash
cp -R hbmodelstore-skills/skills/hbmodelstore-query ~/.claude/skills/
```

其他兼容 [Agent Skills](https://agentskills.io/) 的工具，请将
`skills/hbmodelstore-query/` 放入该工具的 Skill 目录。

## 使用示例

安装完成后，可以直接向 Agent 提问：

> 当前有哪些可用模型？

> 查询 000005.OF 最新的纯债基金久期，并说明数据日期和结果是否有效。

> 查询 000005.OF 在 2025 年的久期历史，并解释 fallback 标记。

Agent 会按需读取 Skill，运行其中的受限查询脚本，并依据模型说明解释结果。

## 直接验证

只需 Python 3，无额外依赖：

```bash
python skills/hbmodelstore-query/scripts/client.py list-models

python skills/hbmodelstore-query/models/bond-fund-duration/scripts/query.py \
  latest --fund-code 000005.OF
```

完整的人类文档和 API Reference：<https://api.delirium.com.cn/docs>

## 安全边界

- 只访问 `https://api.delirium.com.cn` 的公开只读接口；
- 不包含数据库凭证、内部地址或服务器配置；
- 不支持任意 SQL、写库、模型生产或服务器管理；
- 模型结果不构成投资建议。
