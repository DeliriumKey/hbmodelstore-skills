// Browser-safe styling. No fetching, model calculation or data conversion.
export const FONT = "Arial, 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif";
export const PALETTE = ['#d80012', '#7f7f7f', '#225395', '#8d0101', '#2b2b2b', '#0c2748', '#f3a9b4', '#bfbfbf', '#91a9ca'];
export const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
export const theme = dark => ({ ink: dark ? '#e5e5e5' : '#2b2b2b', grid: dark ? '#444444' : '#e5e5e5',
  background: dark ? '#202020' : '#ffffff', muted: dark ? '#bfbfbf' : '#7f7f7f',
  palette: dark ? ['#d80012','#bfbfbf','#91a9ca','#ec8089','#e5e5e5','#2d75b3','#f3a9b4','#7f7f7f','#225395'] : PALETTE });
const dimensions = new Set(['width','height','left','right','top','bottom','margin','nameGap','itemWidth','itemHeight','itemGap','length','distance','symbolSize','borderWidth','padding','lineHeight','barWidth','barMaxWidth','offset']);
const untouched = new Set(['data','dataset','encode','dimensions','min','max','interval','pieces']);
function clone(node, ratio = 1) {
  if (Array.isArray(node)) return node.map(v => clone(v, ratio));
  if (!node || typeof node !== 'object' || Object.getPrototypeOf(node) !== Object.prototype) return node;
  return Object.fromEntries(Object.entries(node).map(([key,value]) => [key,
    key === 'fontFamily' && typeof value === 'string' ? value.replaceAll('"', "'") :
    untouched.has(key) ? value : dimensions.has(key) && typeof value === 'number' ? value * ratio : clone(value, ratio)]));
}
export function dateLabel(value, mode = 'auto') {
  const v = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || mode === 'preserve') return v;
  if (mode === 'quarter') return `${v.slice(2,4)}Q${Math.ceil(Number(v.slice(5,7))/3)}`;
  if (mode === 'year') return v.slice(0,4);
  if (mode === 'full') return v.replaceAll('-','/');
  return v.slice(0,7).replace('-','/');
}
export function tickIndices(count, capacity) {
  const n = Math.min(count, Math.max(2, capacity));
  return new Set(Array.from({length:n}, (_,i) => Math.round(i * (count-1) / Math.max(1,n-1))));
}
const textWidth = value => [...String(value)].reduce((n,c)=>n + (c.charCodeAt(0)>255 ? 12 : 7), 0);

export function prepareOption(original, config = {}) {
  const { width = 800, height = config.static ? 329 : 280, dark = false, sourceWidth = width,
    layout = 'auto', axisLayout = 'preserve', colorMode = 'preserve', seriesColors = {}, dateLabels = 'auto',
    lineTypes = 'solid', barHover = 'overlay', static: isStatic = false } = config;
  const t = theme(dark), o = clone(original, width / sourceWidth);
  const xs = list(o.xAxis), ys = list(o.yAxis), grids = list(o.grid), legends = list(o.legend);
  const titles = list(o.title);
  const multi = grids.length > 1;
  delete o.title;
  delete o.dataZoom;
  o.animation = false; o.stateAnimation = { duration: 0 };
  o.backgroundColor = 'transparent'; o.textStyle = { ...o.textStyle, fontFamily: FONT, fontSize: 12, color: t.ink };
  o.color = colorMode === 'palette' ? t.palette : o.color ?? t.palette;
  o.aria = { ...o.aria, enabled: true };
  o.tooltip = { ...o.tooltip, className:o.tooltip?.className??'hb-tooltip', show: !isStatic, confine: true, transitionDuration: 0,
    backgroundColor: t.background, borderColor: t.grid,
    textStyle: { ...o.tooltip?.textStyle, fontFamily: FONT, fontSize: 12, color: t.ink } };
  const cartesianSeries = list(o.series).filter(s => !s.coordinateSystem || s.coordinateSystem === 'cartesian2d');
  const hasBars = cartesianSeries.some(s => s.type === 'bar');
  const barOnly = series => series.some(s => s.type === 'bar') &&
    !series.some(s => s.type === 'line' && !(s.silent && !s.name));
  const gridIndex = axis => axis?.gridId != null ? grids.findIndex(g => g.id === axis.gridId) : axis?.gridIndex ?? 0;
  const seriesGrid = s => gridIndex(s.xAxisId != null ? xs.find(a => a.id === s.xAxisId) : xs[s.xAxisIndex ?? 0]);
  const seriesOnGrid = a => cartesianSeries.filter(s => seriesGrid(s) === gridIndex(a));
  const pointerStyle = (p, hideLine = barOnly(cartesianSeries), hasPanelBars = hasBars) => {
    const result = { ...p, lineStyle: { ...p?.lineStyle,
      type:'dashed', color:dark?'#888888':'#aaaaaa', width:1, opacity:hideLine?0:1 } };
    // Keep the axis tooltip/event active even when pure bars only need the band.
    // The web mount adds the bar band separately so it can coexist with the line.
    if (hasBars && p?.type === 'shadow') result.type = 'line';
    if (barHover === 'native' && hasPanelBars && (hideLine || p?.type === 'shadow')) {
      result.type = 'shadow';
      result.shadowStyle = { ...p?.shadowStyle,
        color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' };
    }
    if (p?.type === 'cross' || p?.crossStyle) result.crossStyle = {
      ...p.crossStyle, type:'dashed', color:dark?'#888888':'#aaaaaa', width:1, opacity:hideLine?0:1 };
    if (isStatic) Object.assign(result, { type:'none', show:false });
    return result;
  };
  o.axisPointer = Array.isArray(o.axisPointer) ? o.axisPointer.map(p => pointerStyle(p)) : pointerStyle(o.axisPointer);
  o.tooltip.axisPointer = pointerStyle(o.tooltip.axisPointer);
  if (barHover === 'native' && barOnly(cartesianSeries)) o.tooltip.trigger = 'axis';
  const horizontal = ys[0]?.type === 'category' && xs[0]?.type !== 'category';
  const legendNames = legends.flatMap(l => l.show === false ? [] : l.data ?? list(o.series).filter(s=>s.name).map(s=>s.name));
  const uniqueNames = [...new Set(legendNames.map(n => typeof n === 'string' ? n : n.name))];
  let legendRows = 1, used = 0;
  for (const name of uniqueNames) { const w = textWidth(name)+48; if (used && used+w > width-40) {legendRows++; used=0;} used+=w; }
  const hasLegend = legends.some(l=>l.show!==false);
  const legendHeight = hasLegend ? legendRows * 21 : 0;
  for (const l of legends) {
    if (layout !== 'preserve') {
      delete l.top; delete l.right;
      Object.assign(l, { left: 'center', bottom: 8, width: width - 32, type: 'plain', itemWidth: 20, itemHeight: 9, itemGap: 20 });
    }
    l.textStyle = { ...l.textStyle, fontFamily: FONT, fontSize: 12, color: t.ink };
    if (isStatic) l.selectedMode = false;
  }
  if (!multi && layout !== 'preserve' && xs.length && ys.length) {
    const categoryWidth = horizontal ? Math.max(70,...(ys[0].data??[]).map(textWidth))+16 : 58;
    const bottom = 36 + legendHeight + (xs.some(a=>a.name && a.nameLocation==='middle') ? 25 : 0) + (o.visualMap ? 18 : 0);
    o.grid = { ...grids[0], left: categoryWidth, right: horizontal ? 58 : ys.length>1 ? 60 : 24,
      top: ys.some(a=>a.name) ? 34 : 22, bottom, containLabel: false };
  }
  let panelLabels = titles.map(ti => ({text:ti.text, left:ti.left ?? 0, top:ti.top ?? 0}));
  if (layout === 'quad' && grids.length === 4) {
    const top=32,rowGap=76,footer=legendHeight+38;
    const panelH=(height-top-rowGap-footer)/2,secondTop=top+panelH+rowGap;
    o.grid = grids.map((g,i) => ({ ...g, left:(i%2)*width/2+52, right:i%2?24:width/2+24,
      top:i<2?top:secondTop, bottom:undefined, width:undefined, height:panelH, containLabel:false }));
    panelLabels = titles.map((ti,i)=>({text:ti.text, left:(i%2)*width/2+20, top:i<2?2:secondTop-30}));
  }
  for (const [kind, axes] of [['x',xs],['y',ys]]) for (const a of axes) {
    const panelSeries = seriesOnGrid(a);
    // Per-path/item tooltips do not activate ECharts' axis guide themselves.
    // Keep the single-item formatter; the independent X guide only tracks position.
    if (kind === 'x' && a.show !== false && a.axisPointer?.show !== false &&
        o.axisPointer?.show !== false && o.tooltip.trigger === 'item' &&
        panelSeries.length && panelSeries.every(s => s.type === 'line')) {
      a.axisPointer = { ...a.axisPointer, show:true, type:'line', snap:false,
        triggerTooltip:false, label:{ ...a.axisPointer?.label, show:false } };
    }
    if (a.axisPointer || isStatic || panelSeries.some(s => s.type === 'bar'))
      a.axisPointer = pointerStyle(a.axisPointer, barOnly(panelSeries),
        a.type === 'category' && panelSeries.some(s => s.type === 'bar'));
    if (axisLayout==='default') {
      // Opt-in migration of legacy report positioning; ECharts owns alignment.
      for (const key of ['nameLocation','nameGap','nameRotate']) delete a[key];
      for (const key of ['rotate','margin','align','verticalAlign','showMinLabel','showMaxLabel','width','overflow','padding']) {
        if (a.axisLabel) delete a.axisLabel[key];
      }
      for (const key of ['align','verticalAlign','padding']) {
        if (a.nameTextStyle) delete a.nameTextStyle[key];
      }
    }
    a.axisLabel = { ...a.axisLabel, fontFamily:FONT, fontSize:12, color:t.ink };
    a.nameTextStyle = { ...a.nameTextStyle, fontFamily:FONT, fontSize:12, color:t.ink };
    if (layout!=='preserve') a.axisTick = { ...a.axisTick, show:false };
    a.axisLine = { ...a.axisLine, show:a.show!==false,
      lineStyle: { ...a.axisLine?.lineStyle, color:dark?'#e5e5e5':'#000000', width:1, type:'solid', opacity:1 } };
    a.splitLine = { ...a.splitLine, lineStyle:{ ...a.splitLine?.lineStyle,color:t.grid,width:1,type:'solid',opacity:1 } };
    if (a.type==='category') a.splitLine.show=false;
    // Formatter closures and numerical/time-axis domains belong to the upstream component.
    if (kind==='x' && a.type==='category' && dateLabels!=='preserve' && a.data?.every(v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v)))) {
      a.axisLabel.interval = 'auto';
      a.axisLabel.formatter = value=>dateLabel(value,dateLabels);
    }
  }
  for (const vm of list(o.visualMap)) {
    vm.textStyle = { ...vm.textStyle, color:t.ink,fontFamily:FONT,fontSize:12 };
  }
  const reserved=new Set(Object.values(seriesColors)),candidates=t.palette.filter(c=>!reserved.has(c));
  const available=candidates.length?candidates:t.palette;
  let colorIndex=0;
  list(o.series).forEach(s=>{
    if (s.type === 'bar' && cartesianSeries.includes(s)) {
      const x = s.xAxisId != null ? xs.find(a => a.id === s.xAxisId) : xs[s.xAxisIndex ?? 0];
      const y = s.yAxisId != null ? ys.find(a => a.id === s.yAxisId) : ys[s.yAxisIndex ?? 0];
      const panel = cartesianSeries.filter(other => seriesGrid(other) === seriesGrid(s));
      if (x && (x.type == null || x.type === 'value') && y?.type === 'category' && panel.length === 1) {
        s.barWidth = 16;
        delete s.barMaxWidth;
        delete s.barMinWidth;
      }
    }
    if (s.tooltip?.axisPointer) s.tooltip = {
      ...s.tooltip, axisPointer:pointerStyle(s.tooltip.axisPointer,
        barOnly(cartesianSeries.filter(other => seriesGrid(other) === seriesGrid(s)))) };
    const guide=s.silent && !s.name;
    if (colorMode==='palette' && s.type!=='custom' && s.type!=='heatmap' && !guide) {
      const c = seriesColors[s.name] ?? available[colorIndex++ % available.length];
      s.itemStyle={...s.itemStyle,color:c,...(s.itemStyle?.borderColor?{borderColor:c}:{})}; s.lineStyle={...s.lineStyle,color:c};
    }
    if (s.type==='line') {
      s.lineStyle={...s.lineStyle,width:s.lineStyle?.width ?? (guide ? 1 : 1.8)};
      if (lineTypes !== 'preserve') s.lineStyle.type='solid';
      if (layout!=='preserve' && !guide && s.showSymbol===undefined && (s.data?.length??0)>16) s.showSymbol=false;
      if (s.showSymbol === true && s.symbolSize === undefined) s.symbolSize=5;
    }
    if (s.markLine && lineTypes !== 'preserve') s.markLine.lineStyle={...s.markLine.lineStyle,type:'solid'};
    if (s.label) s.label={...s.label,fontFamily:FONT,fontSize:12,color:s.label.color??t.ink};
  });
  return { option:o, panelLabels, layout:{width,height,legendRows} };
}
