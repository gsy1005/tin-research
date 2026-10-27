/* 日报专用：周度供需 + 日度变化 + 周度/日度策略。全部可直接编辑。 */
(function(){
  'use strict';
  var STORE_WEEK='TIN_DAILY_WEEKLY_EDITS_V1';
  var STORE_DAY='TIN_DAILY_DAY_EDITS_V1';
  var STORE_WS='TIN_DAILY_WEEKLY_STRATEGY_V1';
  var STORE_DS='TIN_DAILY_DAILY_STRATEGY_V1';
  var archive=window.DAILY_ARCHIVE||null;
  var keyMap={'价格':'price','宏观':'macro','美股·半导体 AI':'ai','供给·矿端':'mine','供给·冶炼端':'smelt','需求·焊料':'demand','现货·贸易':'spot','月差结构':'spread','库存':'inventory','风险点':'risk'};
  var fallback={
    rows:[
      {key:'price',cat:'价格',related:'Mysteel 现货均价 378,750（10/16）→ 374,000（10/23），周 -1.3%；周内最高 390,000（10/21），随后回落至 374,000；SMM 1#锡 10/23 为 371,900',conclusion:'反弹未能站稳 39 万附近，符合短期顶部区间判断；但低库存与近月 Back 仍限制低位追空的赔率',signal:'中性'},
      {key:'macro',cat:'宏观',related:'下周重点为以色列大选、FOMC、欧洲央行与欧元区 GDP；中东基准情形仍是大选前后先升级、再降级，油价高波动可能强化通胀约束；利率基准情形为 10 月不加息，后续仍保留收紧可能',conclusion:'宏观没有额外利好时，锡价 39 万附近偏空配；若中东升级与财报不及预期叠加，风险资产和锡价下行压力将加大',signal:'偏空'},
      {key:'ai',cat:'美股·半导体 AI',related:'SOX 10/23 为 10,779 点，周中波动显著；下周海力士、三星、谷歌、微软、亚马逊、英特尔等密集披露业绩或召开电话会。沿用宏观周报的验证链条：AI 订单与资本开支能否进一步转化为收入、利润和经营现金流',conclusion:'美股科技财报同时影响风险偏好和锡的算力链需求预期：云厂商收入兑现、存储厂利润改善才构成持续利好；若业绩或现金流不及预期，估值压缩与需求预期下修可能共振',signal:'双向'},
      {key:'mine',cat:'供给·矿端',related:'TC 云南 17,000 / 江西 13,000 元/金属吨，上周均下调 500，本周维稳；锡价回落同步降低与价格挂钩的冶炼损耗成本',conclusion:'矿端当前偏宽松。上周锡价 41→37 万对应损耗成本减负约 1,000–1,500 元/吨，大于 TC 500 元/吨的名义降幅，剔除价格折旧后实际加工收益不降反升；本周 TC 维稳，矿端并未进一步收紧',signal:'偏空'},
      {key:'smelt',cat:'供给·冶炼端',related:'SMM 两省开工率（10/23 周）合计 27.11%（-2.25pct），云南 25.56 / 江西 29.47；两省周产量 1,440 吨，上周 1,560 吨；近期部分炼厂有减产意愿',conclusion:'开工与周产量下降已与低库存形成印证；若减产意愿落地，锭端供应将进一步收紧。后续以实际开工、周产量和厂库验证减产幅度',signal:'利多'},
      {key:'demand',cat:'需求·焊料',related:'本周下游成交 1,445 吨，较上周减少 997 吨；10 月 Mysteel 焊料总开工率 69.35%（环比 -0.65pct），大型 82.56 / 中型 72.85 / 小型 52.63',conclusion:'周度成交回落说明高价下主动补库不足；后续必须验证下游终端订单能否接续，不能把低价补库或库存下降直接等同于终端需求转强',signal:'中性'},
      {key:'spot',cat:'现货·贸易',related:'本周成交 1,904 吨（下游 1,445＋贸易商 459），周降 41.6%；云锡升水 3,000 → 3,500，云字 3,000 / 小牌 2,500；进口盈亏修复至 -253 元/吨，LME Cash-3M 为 +60.77 美元/吨',conclusion:'升水继续抬升、进口窗口接近打平且外盘转为升水，现货偏紧仍未缓解；但成交缩量表明高价抑制采购，紧现货与弱成交并存',signal:'利多'},
      {key:'spread',cat:'月差结构',related:'连一－连二 +900 → +2,340，Back 加深',conclusion:'近月结构明显走强，正套逻辑仍在；最新价差已高于 1,000–2,000 入场参考区间，等待回落更合适',signal:'利多'},
      {key:'inventory',cat:'库存',related:'SMM 社库 7,770 → 6,689（周 -1,081 / -13.9%，沪 2,151 / 苏 2,480 / 粤 2,058）；Mysteel 社库 7,968 → 7,103（-865 / -10.9%）；全球显性 11,148（周 -880）；SHFE 仓单 2,136（周 -724）；LME 4,045',conclusion:'两口径社库、仓单与全球显性库存共同去化，可交割货源趋紧，预计本周仍有去库和逼仓风险；这是正套优于单边追空的核心依据',signal:'利多'},
      {key:'risk',cat:'风险点',related:'上行风险：去库超预期、仓单快速下降或宏观利好引发近月逼仓；下行风险：中东升级推高油价与通胀压力，同时科技财报不及预期，形成风险偏好与需求预期的双重压制',conclusion:'低库存使价格上下弹性都放大；正套需防价差继续走扩后的回撤，单边空配需防近月挤仓，单边追多则需防宏观双利空',signal:'双向'}
    ],
    final:'预计本周显性库存继续去化，低库存带来逼仓风险，正套优于单边：连一－连二价差 1,000–2,000 元/吨时择机买近抛远。单边仍看宏观，重点关注中东局势和美股财报；宏观没有额外利好时，39 万元/吨附近为短期顶部区间，可作为空配，但不宜在低库存环境中追空。'
  };
  var source=fallback,stamp='',dayStamp='';
  function readStore(key){if(archive)return null;try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}}
  function writeStore(key,value){if(archive)return;try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}}
  function hash(text){var h=5381;for(var i=0;i<text.length;i++)h=((h<<5)+h)^text.charCodeAt(i);return (h>>>0).toString(36);}
  function series(key){var x=(window.DB_DATA||[]).find(function(x){return x.k===key;});return x?x.s.filter(function(p){return typeof p[1]==='number';}):[];}
  function last(key){var s=series(key);return s.length?s[s.length-1]:null;}
  function prev(key){var s=series(key);return s.length>1?s[s.length-2]:null;}
  function fmt(x){return Number(x).toLocaleString('zh-CN',{maximumFractionDigits:1});}
  function signed(x){return (x>0?'+':'')+fmt(x);}
  function dayLabel(day){var p=day.split('-');return Number(p[1])+'/'+Number(p[2]);}
  function changeText(cur,pre,unit){if(!cur||!pre)return '暂无可比值';var d=cur[1]-pre[1];return '较'+(pre[0].slice(5).replace('-','/'))+(d===0?'持平':(d>0?'增加 ':'减少 ')+fmt(Math.abs(d))+(unit||''));}
  function context(){
    var wh=last('d339'),down=last('d72'),trade=last('d71'),price=last('d0'),prem=last('d65');
    var day=(wh&&wh[0])||(down&&down[0])||(price&&price[0])||'';
    var pDown=prev('d72'),pTrade=prev('d71'),pPrem=prev('d65'),pWh=prev('d339');
    var total=down&&trade?down[1]+trade[1]:null;
    var oldTotal=pDown&&pTrade?pDown[1]+pTrade[1]:null;
    return {day:day,label:day?dayLabel(day):'今日',wh:wh,pWh:pWh,down:down,pDown:pDown,trade:trade,pTrade:pTrade,price:price,prem:prem,pPrem:pPrem,total:total,oldTotal:oldTotal};
  }
  function dailyText(key,c){
    var d=c.label;
    if(key==='price'){
      var note=(window.TIN_SUMMARY_NOTE&&window.TIN_SUMMARY_NOTE.B)||'';
      var m=note.match(/SMM 1#锡\s*([\d,]+)\s*元\/吨，日(涨|跌)\s*([\d,]+)/);
      return d+' SMM 1#锡 '+(c.price?fmt(c.price[1]):'—')+' 元/吨'+(m?'，日'+m[2]+' '+m[3]+' 元/吨':'');
    }
    if(key==='macro')return d+' 宏观以日报上方最新表述为准，继续跟踪中东、利率与美股财报';
    if(key==='ai')return d+' AI 与半导体等待最新财报及高频数据验证，周度观察框架不变';
    if(key==='mine')return d+' TC 为周频指标，最新周度值不变';
    if(key==='smelt')return d+' 开工和周产量为周频指标，跟踪炼厂减产意愿是否兑现';
    if(key==='demand')return d+' 下游成交 '+(c.down?fmt(c.down[1]):'—')+' 吨，'+changeText(c.down,c.pDown,' 吨');
    if(key==='spot')return d+' 总成交 '+(c.total===null?'—':fmt(c.total))+' 吨'+(c.total!==null&&c.oldTotal!==null?'，较前日 '+signed(c.total-c.oldTotal)+' 吨':'')+'；云锡升水 '+(c.prem?fmt(c.prem[1]):'—')+' 元/吨，'+changeText(c.prem,c.pPrem,' 元/吨');
    if(key==='spread'){
      var a=last('d63'),b=last('d62');
      return a&&b&&a[0]===c.day&&b[0]===c.day?d+' 连一－连二 '+fmt(a[1]-b[1])+' 元/吨；对照正套参考区间 1,000–2,000 元/吨':d+' 价差以盘中连一－连二为准；正套等待 1,000–2,000 元/吨参考区间';
    }
    if(key==='inventory')return d+' SHFE 仓单 '+(c.wh?fmt(c.wh[1]):'—')+' 吨，'+changeText(c.wh,c.pWh,' 吨')+'；周频社库不变';
    if(key==='risk')return c.wh&&c.pWh&&c.wh[1]<c.pWh[1]&&c.total!==null&&c.oldTotal!==null&&c.total<c.oldTotal?d+' 仓单下降但成交缩量，近月支撑与高价抑制并存，双向波动风险上升':d+' 关注仓单、成交与宏观消息的反向扰动，避免单边追涨杀跌';
    return '';
  }
  function autoStrategy(c){
    var structure=c.wh&&c.pWh&&c.wh[1]<c.pWh[1]?'仓单继续去化，近月供应支撑仍在':'仓单未继续去化，近月支撑需要进一步验证';
    var demand=c.total!==null&&c.oldTotal!==null?(c.total<c.oldTotal?'成交较前日缩量，高价下采购偏谨慎':'成交较前日放量，需求承接有所改善'):'成交可比数据不足';
    var price=c.price&&c.price[1]>=390000?'价格进入 39 万元/吨附近参考区，单边空配赔率改善，但仍须防近月逼仓':'价格未进入或尚未站稳 39 万元/吨参考区，单边不追涨杀跌，继续由宏观决定方向';
    return c.label+' 日度策略：周度“正套优先、宏观决定单边”的框架不变。'+structure+'，'+demand+'；云锡升水 '+(c.prem?fmt(c.prem[1]):'—')+' 元/吨。'+price+'；正套仍等待连一－连二回落至 1,000–2,000 元/吨再择机入场。';
  }
  function saveWeekly(){
    var values={};
    document.querySelectorAll('#weeksumBody [data-field]').forEach(function(td){values[td.dataset.key+'|'+td.dataset.field]=td.textContent.trim();});
    writeStore(STORE_WEEK,{stamp:stamp,values:values});
  }
  function saveDailyCells(){
    var values={};
    document.querySelectorAll('#weeksumBody [data-daily-key]').forEach(function(td){values[td.dataset.dailyKey]=td.textContent.trim();});
    writeStore(STORE_DAY,{date:dayStamp,values:values});
  }
  function updateDaily(){
    var c=context();dayStamp=c.day;
    var edits=readStore(STORE_DAY),values=edits&&edits.date===dayStamp?edits.values:{};
    source.rows.forEach(function(row){var td=document.querySelector('#weeksumBody [data-daily-key="'+row.key+'"]');if(td)td.textContent=values[row.key]||dailyText(row.key,c);});
    var title=document.getElementById('dailyStrategyTitle');if(title)title.textContent='日度策略 · '+c.label;
    var el=document.getElementById('dailyStrategyText'),saved=readStore(STORE_DS);
    if(el)el.textContent=saved&&saved.date===dayStamp&&saved.text?saved.text:autoStrategy(c);
  }
  function render(next){
    source=next;stamp=hash(JSON.stringify(next));
    var body=document.getElementById('weeksumBody');body.textContent='';
    var edits=readStore(STORE_WEEK),values=edits&&edits.stamp===stamp?edits.values:{};
    source.rows.forEach(function(row){
      var tr=document.createElement('tr');
      [['cat','wcat'],['related',''],['conclusion',''],['signal','wsignal']].forEach(function(part){
        var td=document.createElement('td');td.className=part[1];td.dataset.key=row.key;td.dataset.field=part[0];td.contentEditable=archive?'false':'true';td.textContent=values[row.key+'|'+part[0]]||row[part[0]];tr.appendChild(td);
        if(part[0]==='conclusion'){
          var daily=document.createElement('td');daily.className='wdaily';daily.dataset.dailyKey=row.key;daily.contentEditable=archive?'false':'true';tr.insertBefore(daily,td);
        }
      });
      body.appendChild(tr);
    });
    var ws=readStore(STORE_WS),weeklyEl=document.getElementById('weeklyStrategyText');
    weeklyEl.textContent=ws&&ws.stamp===stamp&&ws.text?ws.text:source.final;
    if(archive)document.querySelectorAll('#dailyStrategyBlock [contenteditable]').forEach(function(el){el.contentEditable='false';});
    updateDaily();
  }
  function fetchWeekly(){
    if(!window.fetch||location.protocol==='file:')return;
    fetch('weekly_full.html',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('weekly');return r.text();}).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html'),rows=[];
      doc.querySelectorAll('#sumsec table.sum tbody tr:not(.final)').forEach(function(tr,i){
        var c=tr.querySelectorAll('td');if(c.length<4)return;
        var cat=c[0].textContent.trim();rows.push({key:keyMap[cat]||('row'+i),cat:cat,related:c[1].textContent.trim(),conclusion:c[2].textContent.trim(),signal:c[3].textContent.trim()});
      });
      var final=doc.querySelector('#sumsec table.sum tr.final td[colspan]');
      if(rows.length)render({rows:rows,final:final?final.textContent.trim():fallback.final});
    }).catch(function(){/* 离线或跨域时保留内置周度数据 */});
  }
  function exportStrategyPNG(){
    try{
      var original=document.getElementById('dailyStrategyBlock');if(!original)return;
      var width=1600,exportDate=dayStamp||(archive&&archive.date)||'';
      var clone=original.cloneNode(true);clone.style.width='auto';clone.style.margin='0';clone.style.background='#fff';
      clone.querySelectorAll('[contenteditable]').forEach(function(el){el.removeAttribute('contenteditable');});
      var wrap=clone.querySelector('.strategy-tablewrap');if(wrap)wrap.style.overflow='visible';
      var table=clone.querySelector('table.weeksum');if(table)table.style.minWidth='0';
      var note=clone.querySelector('.strategy-head span');if(note)note.textContent='周度框架定方向 · 日度数据跟踪边际变化';
      var weeklyTag=clone.querySelector('.strategy-card.weekly h3 span');if(weeklyTag)weeklyTag.textContent='周度框架';
      var dailyTag=clone.querySelector('.strategy-card.daily h3 span');if(dailyTag)dailyTag.textContent='日度更新';
      clone.querySelectorAll('td.wsignal').forEach(function(td){var t=td.textContent;td.style.color=/利多|结构多/.test(t)?'#C00000':(/偏空|利空/.test(t)?'#18734A':'#1F4E79');});
      var exportRoot=document.createElement('div');exportRoot.className='export-root';
      var title=document.createElement('div');title.className='export-title';
      title.innerHTML='<div><h1>锡产业供需与策略</h1><p>TIN SUPPLY · DEMAND &amp; STRATEGY</p></div><div class="meta"><b>中哲金属 · 甘思雨</b><span>数据日期　'+exportDate+'</span></div>';
      var foot=document.createElement('div');foot.className='export-foot';foot.innerHTML='<span>周度内容联动周报；日度变化依据最新成交、仓单与升贴水。</span><span>仅供内部研究参考</span>';
      exportRoot.appendChild(title);exportRoot.appendChild(clone);exportRoot.appendChild(foot);
      var css='*{box-sizing:border-box;margin:0;padding:0}body{background:#fff}.export-root{width:1600px;padding:30px 32px 22px;background:#fff;color:#18212b;font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",Arial,sans-serif}.export-title{display:flex;justify-content:space-between;align-items:flex-start;gap:30px;padding:0 0 17px;margin-bottom:18px;border-bottom:3px solid #C00000}.export-title h1{font-size:32px;letter-spacing:2px;line-height:1.35}.export-title p{margin-top:6px;font-size:12px;letter-spacing:2px;color:#7a828c}.export-title .meta{display:flex;flex-direction:column;align-items:flex-end;gap:8px;padding-top:3px;font-size:13px;white-space:nowrap}.export-title .meta b{color:#C00000;font-size:14px}.export-title .meta span{color:#59636f}.strategy-block{border:1px solid #cbd5df;background:#fff}.strategy-head{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:12px 16px;background:#EDF3F8;border-left:6px solid #1F4E79}.strategy-head h2{font-size:20px;letter-spacing:1px}.strategy-head span{font-size:13px;color:#66717d}table.weeksum{table-layout:fixed;border-collapse:collapse;width:100%}table.weeksum th{background:#1F4E79;color:#fff;border:1px solid #527a9e;padding:8px 9px;font-size:15px;font-weight:600;line-height:1.4;text-align:center}table.weeksum td{border:1px solid #d5dce3;padding:8px 9px;text-align:left;vertical-align:top;white-space:normal;overflow-wrap:break-word;line-height:1.55;font-size:15px;color:#18212b}table.weeksum tr:nth-child(even) td:not(.wcat):not(.wdaily){background:#FAFBFC}table.weeksum td.wcat{background:#EDF3F8;color:#1F4E79;text-align:center;font-weight:700}table.weeksum td.wdaily{background:#FFF7F7}table.weeksum td.wsignal{text-align:center;vertical-align:middle;font-weight:700}.strategy-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #cbd5df}.strategy-card{padding:14px 18px;min-width:0;line-height:1.7;font-size:16px}.strategy-card.weekly{background:#F3F7FB;border-right:1px solid #cbd5df}.strategy-card.daily{background:#FFF7F7}.strategy-card h3{font-size:17px;margin-bottom:7px;color:#1F4E79;letter-spacing:1px}.strategy-card.daily h3{color:#C00000}.strategy-card h3 span{display:block;margin:3px 0 0;font-size:11px;color:#7a828c;font-weight:400;letter-spacing:0}.export-foot{display:flex;justify-content:space-between;gap:24px;margin-top:14px;font-size:11px;line-height:1.6;color:#7a828c}';
      var measure=document.createElement('div');measure.style.cssText='position:fixed;left:-100000px;top:0;width:'+width+'px;background:#fff;visibility:hidden;';
      var exportStyle=document.createElement('style');exportStyle.textContent=css;measure.appendChild(exportStyle);measure.appendChild(exportRoot);document.body.appendChild(measure);
      var height=Math.ceil(exportRoot.getBoundingClientRect().height)+2;
      var markup=new XMLSerializer().serializeToString(exportRoot);measure.parentNode.removeChild(measure);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+css+'</style>'+markup+'</div></foreignObject></svg>';
      var img=new Image();
      img.onload=function(){
        var canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
        var ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        var name='锡供需策略_'+exportDate+'.png';
        var a=document.createElement('a');a.download=name;document.body.appendChild(a);
        a.href=canvas.toDataURL('image/png');a.click();a.parentNode.removeChild(a);
      };
      img.onerror=function(){alert('供需策略图片导出失败，请刷新后重试。');};
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    }catch(e){alert('供需策略图片导出失败，请刷新后重试。');}
  }
  var block=document.getElementById('dailyStrategyBlock');
  if(!block)return;
  if(archive){block.classList.add('is-archive');var headNote=block.querySelector('.strategy-head span');if(headNote)headNote.textContent='历史快照 · 只读；冻结当天的周度内容、日度变化和两种策略';}
  block.addEventListener('input',function(e){
    if(archive)return;
    var t=e.target;
    if(t.matches('#weeksumBody [data-daily-key]'))saveDailyCells();
    else if(t.matches('#weeksumBody [data-field]'))saveWeekly();
    else if(t.id==='weeklyStrategyText')writeStore(STORE_WS,{stamp:stamp,text:t.textContent.trim()});
    else if(t.id==='dailyStrategyText')writeStore(STORE_DS,{date:dayStamp,text:t.textContent.trim()});
  });
  render(archive&&archive.weekly?archive.weekly:fallback);if(!archive)fetchWeekly();
  if(window.TIN_SHEET&&typeof window.TIN_SHEET.render==='function'){
    var old=window.TIN_SHEET.render;window.TIN_SHEET.render=function(){var out=old.apply(this,arguments);updateDaily();return out;};
  }
  window.TIN_DAILY_STRATEGY={refresh:updateDaily,exportPNG:exportStrategyPNG};
})();
