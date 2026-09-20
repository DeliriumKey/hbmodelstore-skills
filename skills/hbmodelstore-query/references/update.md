# 自助更新

用户说“更新 hbmodelstore-query”即可执行；只问是否有新版时仅检查，不覆盖文件。
`SKILL_DIR` 是正在使用的这份 Skill 的绝对目录，不猜测用户使用哪种 Harness。

只查更新历史用 MCP `get_doc(path="/docs/changelog")`。

```bash
# 只检查当前版与官网最新版
python3 "$SKILL_DIR/scripts/update.py" --check

# 用户要求更新时执行
python3 "$SKILL_DIR/scripts/update.py" --apply
```

脚本校验官网 ZIP 后替换本 Skill，保留旧目录并返回路径。更新后刷新或重启 Agent。

- 校验、下载或替换失败时保留原安装；不能改用任意第三方 ZIP 或跳过校验。
- 相同版本号也会比较内容；内容相同不重装，旧版本不降级。`--check` 可能下载 ZIP，但不覆盖安装。
- 拒绝替换 Git 开发目录、目录软链接或非本 Skill 目录。源码开发通过仓库管理，不使用安装更新。
- 自定义内容应放在 Skill 目录之外；这里是官方安装包的整包替换，不合并本地修改。
- 更新 Skill 不等于更新客户端 MCP 配置。更新后工具缺失时按 [MCP 连接](./mcp.md) 检查；
  保留既有连接，不因更新反复新增同名服务或覆盖其他配置。

旧版更新脚本若只按版本号判断，无法自行识别同版本修订。此时需按原安装流程下载官网 ZIP，
校验官网清单后替换一次本 Skill，后续即可自动识别同版本内容变化。
