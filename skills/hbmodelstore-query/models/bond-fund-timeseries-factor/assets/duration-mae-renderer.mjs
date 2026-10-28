import {pairedComparison} from '../../../assets/charts/paired.mjs';

export function buildChart({source},context){
  const {metadata,rows}=source;
  const values=rows.flatMap(row=>[row.current,row.baseline,row.reference].filter(Number.isFinite));
  return pairedComparison({
    primary:metadata.currentLabel,baseline:metadata.baselineLabel,reference:metadata.referenceLabel,
    hover:'row',zeroLine:false,
    rows:rows.map(row=>({...row,label:row.period,primary:row.current})),
    axis:{unit:metadata.unit,interval:0.1,
      min:Math.max(0,Math.floor((Math.min(...values)-0.05)*10)/10),
      max:Math.ceil((Math.max(...values)+0.05)*10)/10,
      formatter:value=>value.toFixed(2)},
    tooltipFormatter:row=>[
      `<strong>${row.period}</strong> · N=${row.sampleN.toLocaleString('zh-CN')}`,
      `${metadata.currentLabel}：${row.current.toFixed(3)} ${metadata.unit}`,
      `${metadata.baselineLabel}：${row.baseline.toFixed(3)} ${metadata.unit}`,
      ...(Number.isFinite(row.reference)?[`${metadata.referenceLabel}：${row.reference.toFixed(3)} ${metadata.unit}`]:[]),
    ].join('<br/>'),
  },context);
}
