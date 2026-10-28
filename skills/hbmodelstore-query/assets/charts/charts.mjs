import { prepareOption, theme, FONT, PALETTE } from './style.mjs';
export {pairedComparison, pairedComparisonLayout} from './paired.mjs';
export const ratioToPercent = value => value == null ? '—' : `${+(Number(value)*100).toFixed(2)}%`;
const escape = v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format = (unit='', digits=2) => value => value == null || !Number.isFinite(Number(value)) ? '—' : `${+Number(value).toFixed(digits)}${unit}`;

export function cartesian(spec, context={}) {
  const t=theme(context.dark), axes=spec.axes??[{unit:spec.unit??''}];
  const horizontal=spec.horizontal??false;
  const measure=axes.map((a,i)=>({type:'value',name:a.unit==='%'?'':a.unit??'',min:a.min,max:a.max,scale:a.scale??false,
    axisLabel:{formatter:a.formatter??(a.unit==='%'?'{value}%':'{value}')},splitLine:{show:i===0}}));
  const dimension={type:spec.x.type??'category',data:spec.x.data,name:spec.x.name??'',min:spec.x.min,max:spec.x.max,
    boundaryGap:spec.series.some(s=>s.type==='bar'),splitLine:{show:false}};
  const color=(s,i)=>s.color?(context.dark && PALETTE.includes(s.color)?t.palette[PALETTE.indexOf(s.color)]:s.color):t.palette[i%t.palette.length];
  const series=spec.series.map((s,i)=>({name:s.name,type:s.type??'line',data:s.data,stack:s.stack,
    ...(horizontal?{xAxisIndex:s.axis??0}:{yAxisIndex:s.axis??0}),
    itemStyle:{color:color(s,i)},lineStyle:{color:color(s,i),width:1.8,type:s.lineType??'solid'},
    ...(s.area?{areaStyle:{opacity:0.13}}:{}),barMaxWidth:30,
    showSymbol:s.showSymbol??s.type==='scatter',showAllSymbol:s.showAllSymbol,
    symbol:s.symbol,symbolSize:s.symbolSize,smooth:false,connectNulls:false,
    tooltip:{valueFormatter:axes[s.axis??0].formatter??format(axes[s.axis??0].unit)},emphasis:{disabled:true}}));
  const scatter=spec.series.some(s=>s.type==='scatter');
  return prepareOption({animation:false,textStyle:{fontFamily:FONT},
    xAxis:horizontal?measure:dimension,yAxis:horizontal?{...dimension,inverse:true}:measure,
    legend:{show:series.length>1,data:series.map(s=>s.name)},
    tooltip:{trigger:scatter?'item':'axis',...(scatter?{formatter:p=>{
      const values=Array.isArray(p.value)?p.value:[p.name,p.value],a=axes[spec.series[p.seriesIndex].axis??0];
      return `${escape(p.seriesName)}<br>${escape(spec.x.name??'横轴')}：${escape(format(spec.x.unit)(values[0]))}<br>${escape(a.name??'纵轴')}：${escape((a.formatter??format(a.unit))(values[1]))}`;
    }}:{})},series},
    {...context,dateLabels:spec.dateLabels??'auto',lineTypes:'preserve'});
}

// Opt-in preset; semantic roles are supplied by the caller, never inferred from names.
export function barLine(spec, context={}) {
  const bars=spec.series.filter(s=>s.type==='bar'),lines=spec.series.filter(s=>s.type==='line');
  if (bars.length < 1 || bars.length > 2 || lines.length !== 1 || spec.series.length !== bars.length+1)
    throw new Error('柱线组合需要一至两组柱和一条折线');
  let barIndex=0;
  return cartesian({...spec,series:spec.series.map(s=>s.type==='bar'
    ? {axis:0,color:theme(context.dark).palette[barIndex++],...s}
    : {axis:1,color:context.dark?'#e5e5e5':'#000000',
      showSymbol:true,showAllSymbol:true,symbol:'emptyCircle',symbolSize:5,...s})},context);
}

// One metric across named objects. Highlights are point styles, not extra series.
export function categoryBars(spec, context={}) {
  const rows=spec.rows??[], t=theme(context.dark), unit=spec.unit??'', name=spec.name??'';
  const keys=rows.map(row=>row.key??row.label), highlights=new Set(spec.highlight??[]);
  if(new Set(keys).size!==keys.length)throw new Error('分类比较需要唯一的对象 key');
  if(rows.some(row=>row.value!=null && !Number.isFinite(row.value)))throw new Error('分类比较数值需为有限数字或 null');
  const hasHighlights=keys.some(key=>highlights.has(key));
  const selected=i=>highlights.has(keys[i]);
  const built=cartesian({x:{type:'category',data:rows.map(row=>row.label)},axes:[{unit}],
    dateLabels:'preserve',series:[{name,type:'bar',data:rows.map((row,i)=>({
      name:row.label,value:row.value,
      itemStyle:{color:hasHighlights&&!selected(i)?t.palette[1]:t.palette[0]}
    }))}]},context);
  const o=built.option, width=context.width??800;
  const longest=Math.max(0,...rows.map(row=>[...String(row.label)].reduce((n,c)=>n+(c.charCodeAt(0)>255?12:7),0)));
  const slot=Math.max(1,width-o.grid.left-o.grid.right)/Math.max(1,rows.length);
  const vertical=longest+12>slot;
  const labelLines=value=>String(value).match(/[A-Za-z0-9]+|[^A-Za-z0-9]/gu)??[];
  const lineCount=Math.max(1,...rows.map(row=>labelLines(row.label).length));
  const labelStep=Math.max(1,Math.ceil(18/slot));
  o.xAxis.axisLabel={...o.xAxis.axisLabel,rotate:0,lineHeight:16,align:'center',verticalAlign:'top',
    formatter:vertical?value=>labelLines(value).join('\n'):undefined,
    interval:slot>=15?0:index=>selected(index)||index%labelStep===0||index===rows.length-1,
    color:(_label,index)=>selected(index)?t.palette[0]:t.ink};
  o.xAxis.axisLine.onZero=false;
  o.yAxis[0].axisLine.onZero=false;
  o.grid.bottom=24+(vertical?lineCount*16:16);
  o.tooltip.formatter=params=>{
    const p=Array.isArray(params)?params[0]:params,row=rows[p?.dataIndex];
    return row?`${escape(row.label)}${row.code?` ${escape(row.code)}`:''}<br>${escape(name)}：${escape(format(unit)(row.value))}`:'';
  };
  if(rows.some(row=>row.value<0)&&rows.some(row=>row.value>0)){
    o.series[0].markLine={silent:true,symbol:'none',label:{show:false},
      lineStyle:{color:t.muted,type:'solid',width:1},data:[{yAxis:0}]};
  }
  built.layout={...built.layout,kind:'category-bars',categoryRotation:0,
    categoryLabelDirection:vertical?'vertical':'horizontal'};
  return built;
}

export function heatmap(spec, context={}) {
  const t=theme(context.dark);
  return prepareOption({
    xAxis:{type:'category',data:spec.x,splitArea:{show:false}},
    yAxis:{type:'category',data:spec.y,inverse:true},
    visualMap:{type:'continuous',min:spec.min,max:spec.max,orient:'horizontal',left:'center',bottom:0,
      itemWidth:10,itemHeight:140,calculable:false,inRange:{color:spec.colors??['#ffffff','#f3a9b4','#d80012']},
      formatter:format(spec.unit)},
    tooltip:{trigger:'item',formatter:p=>`${escape(spec.y[p.value[1]])} · ${escape(spec.x[p.value[0]])}<br>${escape(format(spec.unit)(p.value[2]))}`},
    series:[{type:'heatmap',data:spec.data.filter(p=>p[2]!=null),label:{show:false},itemStyle:{borderWidth:0},
      emphasis:{itemStyle:{borderColor:t.ink,borderWidth:1}}}],
  },{...context,dateLabels:spec.dateLabels??'auto'});
}
