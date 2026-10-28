import { prepareOption } from '../../../assets/charts/style.mjs';

// Keep business layouts, data and colors; share axes, grids and line styling.
export function researchOption(option, dark = false, width = 800) {
  const result = prepareOption(option, { dark, width, layout: 'preserve', dateLabels: 'preserve' }).option;
  // ECharts SSR writes font families into double-quoted SVG style attributes.
  function svgSafeFonts(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'fontFamily' && typeof child === 'string') value[key] = child.replaceAll('"', "'");
      else svgSafeFonts(child);
    }
  }
  svgSafeFonts(result);
  const series = [].concat(result.series ?? []);
  if (series.some(item => item.type === 'bar') && !series.some(item => item.type === 'line')) {
    // These figures contain only bars: the native band also works in offline HTML.
    const pointer = { type: 'shadow', shadowStyle: { color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } };
    result.tooltip = { ...result.tooltip, trigger: 'axis', axisPointer: pointer };
    for (const axis of [...[].concat(result.xAxis ?? []), ...[].concat(result.yAxis ?? [])]) {
      if (axis.type === 'category') axis.axisPointer = { ...axis.axisPointer, ...pointer };
    }
  }
  return result;
}
