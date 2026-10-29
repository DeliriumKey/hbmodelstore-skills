# 绘图运行环境

模型图优先使用对应模型已有的 `visualize.py` 和 renderer。共用绘图模块已随本包放在 `assets/charts/`，无需安装 `hb-research-echarts` 或查找其他项目。

新增图的业务适配器用相对路径导入本包模块，例如 `models/<model>/assets/` 中：

```js
import {pairedComparison, pairedComparisonLayout} from '../../../assets/charts/paired.mjs';
```

`models/bond-fund-timeseries-factor/assets/duration-mae-renderer.mjs` 是久期验证配对点图的适配器，输入 `{source: {metadata, rows}}`。它使用原始 MAE、样本数与参照值；缺失参照不补零。

现有 Python 绘图命令照常使用，无需新增依赖。需要共用的 HTML/SVG/PNG 导出入口时，在本包安装运行依赖：

```bash
npm ci --prefix "$SKILL_DIR/assets/charts"
node "$SKILL_DIR/assets/charts/render.mjs" \
  --module "$SKILL_DIR/assets/charts/from-spec.mjs" \
  --input /path/input.json --output /path/chart
```

输入为 `{title, note, data}`；也可用 `--module` 指向模型适配器。浏览器使用已安装的 Chrome 或 Playwright Chromium。PDF 整页由报告项目组装。

## 面板展示区间

带历史区间切换的面板读取截至研究截止日的完整历史，分页读完后保存在 HTML 中。
本轮问题的起止日期用于设置默认展示窗口，不用于裁掉面板的历史数据；控件上的近一年、近三年和全部
都基于这份完整历史。具体初始区间参数见对应组件 Reference，API 的范围查询能力照常保留。

## 正文插图

个券等具名对象的单指标截面比较可用包内 `from-spec.mjs` 的 `type: "category-bars"`。
输入 `data` 示例：

```json
{
  "type": "category-bars", "name": "理论溢价率", "unit": "%",
  "highlight": ["118034.SH"],
  "rows": [
    {"key": "118034.SH", "label": "晶能转债", "code": "118034.SH", "value": -10.21},
    {"key": "127089.SZ", "label": "晶澳转债", "code": "127089.SZ", "value": -5.66}
  ]
}
```

每个对象沿横轴排列、竖柱显示数值。`key` 唯一，名称放横轴、代码留在悬停提示；
重点对象红色、其他对象灰色，在同一系列内变色。使用真实数值和已选定的排序，保留零与 null。
图高从 `--web-height 350 --height 350` 起步；标签密集时文字正向竖排、不倾斜，空间由绘图单元处理。

先用模型自带绘图命令生成交互 HTML，再选取支撑本轮判断的图导出 PNG。导出使用 HTML 中的同一份数据与 ECharts 实例，无需重画或重新取数。

```bash
node "$SKILL_DIR/assets/charts/export-inline.mjs" --html /path/component.html --list
node "$SKILL_DIR/assets/charts/export-inline.mjs" --html /path/component.html \
  --chart '#valuation' --chart '#groups' --output-dir /path/inline
```

先看 `--list` 返回的选择器和系列，再按需要传入一个或多个 `--chart`。默认宽度800逻辑像素、高度沿用原图、2倍清晰度；`--width/--height/--scale` 可调整正文图片尺寸，不使用 PDF 版心参数。
若正文讨论特定区间或分组，可先用 `--click 'button[data-years="1"]'` 操作现有控件再导出，输出的 `inline-images.json` 记录选择和原 HTML 哈希。原 HTML 文件保持完整。

PNG 只保留绘图区、图例、轴与单位，不带标题、数据来源、日期脚注、网页控件或额外图注。解释由图片前后的正文承接；完整来源、日期及交互留在 HTML。
用 `![图形含义](/absolute/path/chart.png)` 插在相关段落之间，并交付可在侧边栏打开的 HTML。
DeepSeek Harness 已验证支持本地绝对路径图片；WorkBuddy 本轮验证通过的是 HTTP 图片地址，本地路径未显示。需要本地 HTTP 时仅绑定 `127.0.0.1` 并保持服务运行；其他客户端按实际能力选择图片地址。

`vendor.json` 记录共用源码版本；普通绘图只使用包内副本。更新随本 Skill 发布，不在运行时下载或查找全局开发模块。
