import {prepareOption, theme, FONT} from './style.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const escape = value => String(value).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The same logical row spacing is used for web and report exports.
export function pairedComparisonLayout(rowCount, {width=800, widthMm=180}={}) {
  if (!Number.isInteger(rowCount) || rowCount < 1) throw new Error('配对点图至少需要一行');
  if (!(width > 0 && widthMm > 0)) throw new Error('图宽必须为正数');
  const height = rowCount * 38 + 62;
  return {width, height, webHeight:height, widthMm, heightMm:height / width * widthMm, rowHeight:38};
}

export function pairedComparison(spec, context={}) {
  const {rows, primary, baseline, reference, axis={}, tooltipFormatter, hover='point'} = spec;
  const layout = pairedComparisonLayout(rows.length, {width:context.width ?? 800});
  if (!primary || !baseline) throw new Error('请提供主对象与对照对象的名称');
  const t=theme(context.dark), values=rows.flatMap(row =>
    [row.primary, row.baseline, ...(reference ? [row.reference] : [])].filter(finite));
  if (!values.length) throw new Error('配对点图没有可绘制的数值');
  const low=Math.min(...values), high=Math.max(...values);
  const padding=(high-low || Math.abs(high) || 1)*0.1;
  const min=axis.min ?? low-padding, max=axis.max ?? high+padding;
  const format=axis.formatter ?? (v => `${+v.toFixed(2)}${axis.unit ?? ''}`);
  const formatTip=axis.tooltipFormatter ?? format;
  const roles=[['primary',primary,10,t.palette[0]], ['baseline',baseline,9,t.palette[1]],
    ...(reference ? [['reference',reference,11,t.palette[2]]] : [])];
  const tooltip = params => {
    const point=Array.isArray(params)?params.find(p=>p.seriesType==='scatter'):params;
    const index=point?.value?.[1], row=rows[index];
    if (!row) return '';
    if (tooltipFormatter) return tooltipFormatter(row,index);
    return [escape(row.label),...roles.map(([key,name]) =>
      `${escape(name)}：${finite(row[key])?escape(formatTip(row[key])):'—'}`)].join('<br/>');
  };
  const points=roles.map(([key,name,size,color]) => ({
    id:key, name, type:'scatter', symbol:'circle', symbolSize:size,
    data:rows.flatMap((row,index)=>finite(row[key])?[[row[key],index]]:[]),
    itemStyle:{color:key==='reference'?t.background:color,
      borderColor:key==='reference'?color:t.background,
      borderWidth:key==='reference'?2:1.5, opacity:0.8},
    label:{show:false}, emphasis:{disabled:true}, z:key==='baseline'?2:3,
  }));
  // Zero is a semantic reference, not an instruction to expand the axis range.
  if (spec.zeroLine && min <= 0 && max >= 0) points[0].markLine={
    silent:true, symbol:'none', label:{show:false},
    lineStyle:{color:context.dark?'#e5e5e5':'#000000',width:1,type:'solid'},
    data:[{xAxis:0}],
  };
  const connectors={
    id:'paired-connectors', type:'custom', silent:true, z:0,
    tooltip:{show:false}, encode:{x:[0,2],y:1},
    data:rows.map((row,index)=>[
      finite(row.baseline)?row.baseline:null,index,
      finite(row.primary)?row.primary:null,Boolean(row.summary),
    ]),
    renderItem:(params,api)=>{
      const row=rows[params.dataIndex], y=api.coord([min,params.dataIndex])[1];
      const children=[];
      if (row.summary) children.push({type:'rect',shape:{
        x:params.coordSys.x,y:y-19,width:params.coordSys.width,height:38,
      },style:{fill:context.dark?'#2b2b2b':'#f5f5f5'}});
      if (finite(row.primary) && finite(row.baseline)) {
        const a=api.coord([row.baseline,params.dataIndex]), b=api.coord([row.primary,params.dataIndex]);
        children.push({type:'line',shape:{x1:a[0],y1:a[1],x2:b[0],y2:b[1]},
          style:{stroke:context.dark?'#888888':'#bfbfbf',lineWidth:row.summary?2.5:2}});
      }
      return {type:'group',children};
    },
  };
  const result=prepareOption({
    grid:{top:8,left:spec.labelWidth ?? 76,right:20,height:rows.length*38,containLabel:false},
    legend:{left:'center',bottom:2,selectedMode:false,
      itemGap:16,itemWidth:16,itemHeight:9,data:roles.map(([,name])=>name)},
    tooltip:{trigger:hover==='row'?'axis':'item',formatter:tooltip,
      ...(hover==='row'?{axisPointer:{type:'line',axis:'y'}}:{})},
    xAxis:{type:'value',min,max,interval:axis.interval,splitNumber:axis.splitNumber ?? 4,
      position:'bottom',axisLine:{show:true,onZero:false},axisTick:{show:false},
      axisLabel:{formatter:format},splitLine:{show:true}},
    yAxis:{type:'category',inverse:true,boundaryGap:true,data:rows.map(row=>row.label),
      axisLine:{show:false},axisTick:{show:false},splitLine:{show:false},
      axisLabel:{margin:12,lineHeight:18,
        formatter:(label,index)=>rows[index]?.summary?`{summary|${label}}`:
          spec.rowLabelFormatter?.(label,index) ?? label,
        rich:{summary:{fontWeight:700,fontFamily:FONT,color:t.ink}}}},
    series:[connectors,...points],
  },{...context,height:layout.height,layout:'preserve',dateLabels:'preserve'});
  // Category labels are not a second numerical axis. A requested zero line is separate.
  result.option.yAxis.axisLine.show=false;
  return {...result,layout:{...result.layout,...layout}};
}
