#!/usr/bin/env node
// Export selected ECharts figures from an existing HTML without changing the file.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {launchBrowser} from './render.mjs';

export async function exportInline({html, outputDir, selectors=[], clicks=[], width=800, height, scale=2, list=false}) {
  for (const value of [width, scale, ...(height===undefined?[]:[height])]) {
    if (!Number.isFinite(value) || value<=0) throw new Error('图片尺寸与倍率必须为正数');
  }
  const input=path.resolve(html), source=await fs.readFile(input);
  if (!list && (!outputDir || !selectors.length)) throw new Error('用 --list 查看图形，再通过 --chart 选择需要插入正文的图');
  const browser=await launchBrowser();
  try {
    const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:scale,colorScheme:'light'});
    await page.goto(pathToFileURL(input).href);
    await page.waitForFunction(()=>window.echarts && [...document.querySelectorAll('div')].some(el=>echarts.getInstanceByDom(el)),{},{timeout:15000});
    for (const selector of clicks) await page.locator(selector).click();
    await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const available=await page.evaluate(()=>{
      let index=0;
      return [...document.querySelectorAll('div')].flatMap(el=>{
        const chart=echarts.getInstanceByDom(el);
        if (!chart) return [];
        // ECharts instance IDs change on reload. DOM chart order is stable for
        // the same HTML and controls, so --list selectors survive a later export.
        const key=String(++index);
        if (!el.id) el.dataset.hbInlineChart=key;
        return [{selector:el.id?'#'+CSS.escape(el.id):`[data-hb-inline-chart="${key}"]`,
          label:el.getAttribute('aria-label')||'',width:chart.getWidth(),height:chart.getHeight(),
          series:chart.getOption().series.map(s=>s.name||'')}];
      });
    });
    if (list) return {html:input,charts:available};
    const out=path.resolve(outputDir);await fs.mkdir(out,{recursive:true});
    const figures=[];
    for (const [index,selector] of selectors.entries()) {
      const locator=page.locator(selector);
      if (await locator.count()!==1) throw new Error(`图形选择器应恰好对应一个元素：${selector}`);
      const evidence=await locator.evaluate(async(el,{width,height})=>{
        const chart=echarts.getInstanceByDom(el);
        if (!chart) throw new Error('所选元素不是 ECharts 绘图区');
        const before=chart.getOption(), chartHeight=height??chart.getHeight();
        // Retain data, selected legends, and the current zoom window. Remove only presentation chrome.
        const values=o=>JSON.stringify({dataset:o.dataset,series:o.series.map(s=>({name:s.name,data:s.data})),
          selected:o.legend?.map(l=>l.selected),zoom:o.dataZoom?.map(z=>({start:z.start,end:z.end,startValue:z.startValue,endValue:z.endValue}))});
        const beforeValues=values(before);
        el.style.width=width+'px';el.style.maxWidth='none';el.style.height=chartHeight+'px';
        chart.dispatchAction({type:'hideTip'});chart.dispatchAction({type:'downplay'});
        chart.setOption({animation:false,backgroundColor:'#ffffff',
          title:(before.title||[]).map(()=>({show:false})),
          toolbox:(before.toolbox||[]).map(()=>({show:false})),
          tooltip:(before.tooltip||[]).map(()=>({show:false})),
          axisPointer:{show:false},
          dataZoom:(before.dataZoom||[]).map(()=>({show:false})),
        });
        chart.resize({width,height:chartHeight,animation:{duration:0}});
        await document.fonts.ready;
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const after=chart.getOption();
        if (values(after)!==beforeValues) throw new Error('导出改变了图表数据或选择范围');
        return {width,height:chartHeight,series:after.series.map(s=>({name:s.name,type:s.type,points:s.data?.length??null})),
          dataUnchanged:true,titleHidden:after.title?.every(t=>t.show===false)??true,
          controls:[...document.querySelectorAll('button[aria-pressed="true"]')].map(b=>b.textContent.trim())};
      },{width,height});
      const name=selector.replace(/^#/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,64)||'chart';
      const png=path.join(out,`${String(index+1).padStart(2,'0')}-${name}.png`);
      await locator.screenshot({path:png,animations:'disabled'});
      figures.push({selector,png,scale,...evidence});
    }
    const result={html:input,htmlSha256:createHash('sha256').update(source).digest('hex'),figures};
    await fs.writeFile(path.join(out,'inline-images.json'),JSON.stringify(result,null,2)+'\n');
    return result;
  } finally {await browser.close();}
}

if (process.argv[1] && (await fs.realpath(process.argv[1]).catch(()=>null))===fileURLToPath(import.meta.url)) {
  try {
    const args={selectors:[],clicks:[]};
    for(let i=2;i<process.argv.length;i++) {
      const flag=process.argv[i];
      if(flag==='--list') {args.list=true;continue;}
      if(!['--html','--output-dir','--chart','--click','--width','--height','--scale'].includes(flag) || !process.argv[i+1]) throw new Error(`未知或缺值参数：${flag}`);
      const value=process.argv[++i];
      if(flag==='--chart') args.selectors.push(value);
      else if(flag==='--click') args.clicks.push(value);
      else if(['--width','--height','--scale'].includes(flag)) args[flag.slice(2)]=Number(value);
      else args[flag==='--output-dir'?'outputDir':'html']=value;
    }
    if(!args.html) throw new Error('需要 --html /path/component.html');
    console.log(JSON.stringify(await exportInline(args),null,2));
  } catch(error) {console.error(error.stack);process.exitCode=1;}
}
