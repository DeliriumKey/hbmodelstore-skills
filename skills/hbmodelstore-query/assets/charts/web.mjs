import { prepareOption, FONT, theme } from './style.mjs';
import { bindBarHover } from './hover.mjs';
export function mountChart({echarts,element,build,height=280,title='',note='',dark=false,static:isStatic=false}) {
  const add=(tag,text='',parent=element)=>{const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;};
  const heading=title?add('h3',title):null;
  if(heading) heading.style.cssText='font-size:15px;font-weight:600;line-height:1.4;margin:0 0 8px';
  const figure=add('div'); figure.style.cssText=`position:relative;width:100%;height:${height}px;min-width:0`;
  const canvas=add('div','',figure); canvas.style.cssText='width:100%;height:100%';
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title||'研究图表');
  const labels=add('div','',figure);labels.style.cssText='position:absolute;inset:0;pointer-events:none';
  const caption=note?add('p',note):null;
  if(caption)caption.style.cssText='font-size:12px;line-height:1.5;margin:8px 0 0';
  element.style.fontFamily=FONT;
  const chart=echarts.init(canvas,null,{renderer:'svg'});
  const hover=isStatic?null:bindBarHover({chart,echarts,isDark:()=>dark});
  let disposed=false;
  const draw=()=>{
    if(disposed || !canvas.clientWidth)return;
    const selected=chart.getOption()?.legend?.[0]?.selected;
    const context={width:canvas.clientWidth,height,dark,static:isStatic};
    const built=build(context),result=built.option?built:prepareOption(built,context);
    if(selected && result.option.legend)for(const legend of [].concat(result.option.legend))legend.selected=selected;
    chart.resize({width:context.width,height});chart.setOption(result.option,{notMerge:true});
    hover?.clear();
    labels.replaceChildren();
    for(const item of result.panelLabels??[]){const el=add('span',item.text,labels);el.style.cssText='position:absolute;font-size:12px';
      el.style.left=typeof item.left==='number'?`${item.left}px`:item.left;
      el.style.top=typeof item.top==='number'?`${item.top}px`:item.top;}
    element.style.color=theme(dark).ink;if(caption)caption.style.color=theme(dark).muted;
  };
  const observer=new ResizeObserver(draw);observer.observe(canvas);draw();
  return {chart,figure,redraw:draw,setTheme(value){dark=Boolean(value);draw();},
    dispose(){disposed=true;observer.disconnect();hover?.dispose();chart.dispose();element.replaceChildren();}};
}
