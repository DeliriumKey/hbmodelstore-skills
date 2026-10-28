#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url),here=path.dirname(fileURLToPath(import.meta.url));
const hash=text=>createHash('sha256').update(text).digest('hex');
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
export async function launchBrowser(){
  if(process.env.HB_ECHARTS_CHROME)return chromium.launch({headless:true,executablePath:process.env.HB_ECHARTS_CHROME});
  try{return await chromium.launch({headless:true});}catch(error){
    for(const executablePath of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium']){
      try{await fs.access(executablePath);}catch{continue;}
      return chromium.launch({headless:true,executablePath});
    }throw error;
  }
}
export async function bundleModule(modulePath){
  const result=await build({stdin:{contents:`import {buildChart} from ${JSON.stringify(path.resolve(modulePath))}; window.hbRecipe={buildChart};`,
    resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',platform:'browser',write:false,metafile:true});
  return {code:result.outputFiles[0].text,dependencies:await Promise.all(Object.keys(result.metafile.inputs).filter(p=>p!=='<stdin>').map(async p=>{
    const file=path.resolve(p);return {file,sha256:hash(await fs.readFile(file))};
  }))};
}
export function resolveSizes({width=800,height,widthMm=180,heightMm,webHeight=280,webMaxWidth=1080,dpi=300}={}){
  for(const n of [width,widthMm,webHeight,webMaxWidth,dpi,...[height,heightMm].filter(v=>v!==undefined)]){
    if(!Number.isFinite(n)||n<=0)throw new Error('画布尺寸与 DPI 必须为正数');
  }
  if(height!==undefined && heightMm!==undefined)throw new Error('图片高度用 --height-mm 或 --height 指定其一');
  const exportHeightMm=heightMm??(height===undefined?74:height/width*widthMm);
  return {width,height:height??width*exportHeightMm/widthMm,widthMm,heightMm:exportHeightMm,
    webHeight,webMaxWidth,dpi,pixelWidth:Math.round(widthMm*dpi/25.4)};
}
export async function render({module,input,inputData,output,requireFont=false,...settings}){
  const {width,height,widthMm,heightMm,webHeight,webMaxWidth,dpi,pixelWidth}=resolveSizes(settings);
  const contents=inputData===undefined?await fs.readFile(input,'utf8'):JSON.stringify(inputData);
  const payload=JSON.parse(contents),bundle=await bundleModule(module);
  const web=await build({entryPoints:[path.join(here,'web.mjs')],bundle:true,format:'iife',globalName:'hbWeb',write:false});
  const echartsCode=await fs.readFile(require.resolve('echarts/dist/echarts.min.js'),'utf8');
  const boot=`window.hbPayload=${JSON.stringify(payload).replace(/</g,'\\u003c')};
    window.hbView=hbWeb.mountChart({echarts,element:document.querySelector('main'),height:${webHeight},
    title:hbPayload.title,note:hbPayload.note,
    build:context=>hbRecipe.buildChart(hbPayload.data,context)});`;
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(payload.title)}</title>
    <style>*{box-sizing:border-box}body{margin:0;padding:clamp(18px,4vw,48px);background:#fff}main{width:100%;max-width:${webMaxWidth}px;margin:auto;min-width:0}</style>
    <main></main><script>${safeScript(echartsCode)}</script><script>${safeScript(web.outputFiles[0].text)}</script><script type="module">${safeScript(bundle.code)}\n${safeScript(boot)}</script></html>`;
  const stem=path.resolve(output);await fs.mkdir(path.dirname(stem),{recursive:true});await fs.writeFile(`${stem}.html`,html);
  const browser=await launchBrowser();
  try{
    const pixelRatio=pixelWidth/width;
    const page=await browser.newPage({viewport:{width:Math.ceil(width),height:Math.ceil(height)+160},deviceScaleFactor:pixelRatio});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`file://${stem}.html`);
    await page.waitForFunction(()=>Boolean(window.hbView)).catch(error=>{
      throw new Error(errors.length?errors.join('\n'):error.message);
    });
    // Rebuild at the report canvas size, not a screenshot of the responsive HTML.
    await page.evaluate(async({width,height})=>{
      hbView.dispose();document.body.style.padding='0';
      const element=document.querySelector('main');element.style.cssText=`width:${width}px;max-width:none;margin:0;min-width:0`;
      window.hbView=hbWeb.mountChart({echarts,element,height,static:true,
        build:context=>{window.hbBuilt=hbRecipe.buildChart(hbPayload.data,context);return hbBuilt;}});
      await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },{width,height});
    if(errors.length)throw new Error(errors.join('\n'));
    const svg=await page.evaluate(()=>{
      const root=hbView.figure.querySelector('svg').cloneNode(true),box=hbView.figure.getBoundingClientRect();
      for(const label of hbView.figure.querySelectorAll('span')){
        const r=label.getBoundingClientRect(),node=document.createElementNS('http://www.w3.org/2000/svg','text');
        node.setAttribute('x',String(r.left-box.left));node.setAttribute('y',String(r.top-box.top+12));
        node.setAttribute('font-family',getComputedStyle(label).fontFamily);node.setAttribute('font-size','12');
        node.setAttribute('fill',getComputedStyle(label).color);node.textContent=label.textContent;root.append(node);
      }
      return root.outerHTML;
    });
    await fs.writeFile(`${stem}.svg`,svg);
    await page.locator('main > div').first().screenshot({path:`${stem}.png`,animations:'disabled'});
    const details=await page.evaluate(()=>{
      const box=hbView.figure.getBoundingClientRect(),option=hbView.chart.getOption();
      const labels=[...hbView.figure.querySelectorAll('svg text,span')].map(e=>({text:e.textContent,box:e.getBoundingClientRect().toJSON()}));
      const outside=labels.filter(x=>x.box.left<box.left-1||x.box.right>box.right+1||x.box.top<box.top-1||x.box.bottom>box.bottom+1);
      const extent=kind=>option[kind]?.map((_,i)=>hbView.chart.getModel().getComponent(kind,i).axis.scale.getExtent());
      return {series:option.series.length,font:document.fonts.check('12px "Microsoft YaHei"'),
        textCount:labels.length,overflow:outside,layout:hbBuilt.layout,
        xExtents:extent('xAxis'),yExtents:extent('yAxis'),
        renderedSeries:option.series.map(s=>({name:s.name,type:s.type,color:s.lineStyle?.color??s.itemStyle?.color,
          line_type:s.lineStyle?.type,connect_nulls:s.connectNulls,stack:s.stack,yAxisIndex:s.yAxisIndex??0,data:s.data}))};
    });
    if(requireFont&&!details.font)throw new Error('Chromium未加载Microsoft YaHei，停止生成报告图');
    const metadata={renderer:'hb-research-echarts',title:payload.title,note:payload.note,
      input:input?path.resolve(input):null,inputSha256:hash(contents),module:path.resolve(module),dependencies:bundle.dependencies,
      width,height,widthMm,heightMm,dpi,pixelWidth,
      web:{width:'100%',pageMaxWidth:webMaxWidth,height:webHeight},
      browser:browser.version(),microsoftYaHei:details.font,series:details.series,evidence:details};
    await fs.writeFile(`${stem}.metadata.json`,JSON.stringify(metadata,null,2));
    return {html:`${stem}.html`,svg:`${stem}.svg`,png:`${stem}.png`,metadata:`${stem}.metadata.json`};
  }finally{await browser.close();}
}
if(process.argv[1]&&(await fs.realpath(process.argv[1]).catch(()=>null))===fileURLToPath(import.meta.url)){
  try{
    const args={};for(let i=2;i<process.argv.length;i+=2){if(!process.argv[i].startsWith('--')||!process.argv[i+1])throw new Error('参数需要 --名称 值');args[process.argv[i].slice(2)]=process.argv[i+1];}
    for(const key of ['module','input','output'])if(!args[key])throw new Error(`缺少 --${key}`);
    for(const key of ['width','height','dpi'])if(args[key])args[key]=Number(args[key]);
    for(const [flag,key] of [['width-mm','widthMm'],['height-mm','heightMm'],['web-height','webHeight'],['web-max-width','webMaxWidth']]){
      if(args[flag])args[key]=Number(args[flag]);
    }
    console.log(JSON.stringify(await render(args),null,2));
  }catch(error){console.error(error.stack);process.exitCode=1;}
}
