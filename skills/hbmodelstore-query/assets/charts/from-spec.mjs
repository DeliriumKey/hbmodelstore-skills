import {cartesian,barLine,categoryBars,heatmap,pairedComparison} from './charts.mjs';

export function buildChart(spec,context){
  if(spec.type==='category-bars')return categoryBars(spec,context);
  if(spec.type==='paired')return pairedComparison(spec,context);
  if(spec.type==='bar-line')return barLine(spec,context);
  return spec.type==='heatmap'?heatmap(spec,context):cartesian(spec,context);
}
