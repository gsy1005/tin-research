/* 日报专用：周度供需 + 日度变化 + 周度/日度策略。全部可直接编辑。 */
(function(){
  'use strict';
  var STORE_WEEK='TIN_DAILY_WEEKLY_EDITS_V1';
  var STORE_DAY='TIN_DAILY_DAY_EDITS_V1';
  var STORE_WS='TIN_DAILY_WEEKLY_STRATEGY_V1';
  var STORE_DS='TIN_DAILY_DAILY_STRATEGY_V1';
  var archive=window.DAILY_ARCHIVE||null;
  var input=archive?null:(window.TIN_DAILY_INPUT||null);
  var keyMap={'价格':'price','宏观':'macro','美股·半导体 AI':'ai','供给·矿端':'mine','供给·冶炼端':'smelt','需求·焊料':'demand','现货·贸易':'spot','月差结构':'spread','库存':'inventory','持仓·席位':'position','风险点':'risk'};
  var fallback={
    rows:[
      {key:'price',cat:'价格',related:'Mysteel 现货均价 378,750（10/16）→ 374,000（10/23），周 -1.3%；周内最高 390,000（10/21），随后回落至 374,000；SMM 1#锡 10/23 为 371,900',conclusion:'反弹未能站稳 39 万附近，符合短期顶部区间判断；但低库存与近月 Back 仍限制低位追空的赔率',signal:'中性'},
      {key:'macro',cat:'宏观',related:'近期中东局势有所缓和，但协议可能仅为暂时，选举前后仍有反复风险；油价接近 120 美元前高压力位。今晚关注 FOMC，基准情形是不加息，重点关注沃什讲话',conclusion:'中东缓和与不加息基准预期支撑风险偏好，但油价前高压力、协议持续性及沃什表态仍可能带来双向扰动',signal:'利多'},
      {key:'ai',cat:'美股·半导体 AI',related:'Anthropic 招股书及三星、海力士三季报获得市场较正面反馈；SOX 10/23 为 10,779 点，10/26 最新为 11,083.47 点，较 10/23 上涨约 2.8%',conclusion:'AI 收入兑现与存储景气预期改善，叠加 SOX 反弹，对锡的情绪端构成支持；后续继续跟踪 SOX 变化和科技股财报验证',signal:'利多'},
      {key:'mine',cat:'供给·矿端',related:'TC 云南 17,000 / 江西 13,000 元/金属吨，上周均下调 500，本周维稳；锡价回落同步降低与价格挂钩的冶炼损耗成本',conclusion:'矿端当前偏宽松。上周锡价 41→37 万对应损耗成本减负约 1,000–1,500 元/吨，大于 TC 500 元/吨的名义降幅，剔除价格折旧后实际加工收益不降反升；本周 TC 维稳，矿端并未进一步收紧',signal:'偏空'},
      {key:'smelt',cat:'供给·冶炼端',related:'SMM 两省开工率（10/23 周）合计 27.11%（-2.25pct），云南 25.56 / 江西 29.47；两省周产量 1,440 吨，上周 1,560 吨；近期部分炼厂有减产意愿',conclusion:'云锡点火后供应恢复预期升温，后续产量大概率回升；下游月度销量相对稳定，若稳定产出兑现，供需边际将转向宽松',signal:'偏空'},
      {key:'demand',cat:'需求·焊料',related:'本周下游成交 1,445 吨，较上周减少 997 吨；10 月 Mysteel 焊料总开工率 69.35%（环比 -0.65pct），大型 82.56 / 中型 72.85 / 小型 52.63',conclusion:'周度成交回落说明高价下主动补库不足；后续必须验证下游终端订单能否接续，不能把低价补库或库存下降直接等同于终端需求转强',signal:'中性'},
      {key:'spot',cat:'现货·贸易',related:'本周成交 1,904 吨（下游 1,445＋贸易商 459），周降 41.6%；云锡升水 3,000 → 3,500，云字 3,000 / 小牌 2,500；进口盈亏修复至 -253 元/吨，LME Cash-3M 为 +60.77 美元/吨',conclusion:'升水继续抬升、进口窗口接近打平且外盘转为升水，现货偏紧仍未缓解；但成交缩量表明高价抑制采购，紧现货与弱成交并存',signal:'利多'},
      {key:'spread',cat:'月差结构',related:'连一－连二 +900 → +2,340，Back 加深',conclusion:'近月结构明显走强，正套逻辑仍在；最新价差已高于 1,000–2,000 入场参考区间，等待回落更合适',signal:'利多'},
      {key:'inventory',cat:'库存',related:'SMM 社库 7,770 → 6,689（周 -1,081 / -13.9%，沪 2,151 / 苏 2,480 / 粤 2,058）；Mysteel 社库 7,968 → 7,103（-865 / -10.9%）；全球显性 11,148（周 -880）；SHFE 仓单 2,136（周 -724）；LME 4,045',conclusion:'两口径社库、仓单与全球显性库存共同去化，可交割货源趋紧，预计本周仍有去库和逼仓风险；这是正套优于单边追空的核心依据',signal:'利多'},
      {key:'position',cat:'持仓·席位',related:'净空单周变化（10/23→10/28，手）：sn2611 银河 640→435（-205）、东海 585→313（-272）；sn2612 银河 920→1,170（+250）、东海 377→380（+3）；sn2701 银河 469→208（-261）、光大 605→626（+21）。其余未上榜项不按零值计算',conclusion:'银河、东海、光大主要为云锡席位；今日 sn2611 三席位合计净空单 988 手（银河 435、东海 313、光大 240），大概率对应云锡后续 11 月交仓单数量，重点跟踪仓单注册兑现',signal:'双向'},
      {key:'risk',cat:'风险点',related:'上行风险：中东进一步缓和、FOMC 不加息或 AI 财报与 SOX 继续改善；下行风险：协议仅为暂时、选举前后局势反复、油价突破前高或沃什表态偏鹰',conclusion:'宏观与 AI 支撑和偏弱实物成交并存，左侧单需控制仓位；同时关注基差回落和库存变化，避免把低位点价去库等同于终端消费改善',signal:'双向'}
    ],
    final:'近期中东局势有所缓和，今晚 FOMC 基准情形是不加息，重点关注沃什讲话；AI 财报反馈与 SOX 反弹提供情绪支持。SN 换月基差开始走弱，11 月及 12 月挺价力度不足，正套逻辑边际减弱。左侧单维持轻仓，收盘破 39 万止损；成交重回 400 吨上方或收盘收复 41 万再加满。后续关注贸易商交仓或移仓至 12 月挺价，以及消费和库存验证。'
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
  function inputValue(key){if(!input||input.date!==dayStamp)return '';return String(input[key]||'').trim();}
  function inputSignal(key,fallback){if(!input||input.date!==dayStamp||!input.signals)return fallback;return input.signals[key]||fallback;}
  function changeText(cur,pre,unit){if(!cur||!pre)return '暂无可比值';var d=cur[1]-pre[1];return '较'+(pre[0].slice(5).replace('-','/'))+(d===0?'持平':(d>0?'增加 ':'减少 ')+fmt(Math.abs(d))+(unit||''));}
  function context(){
    var wh=last('d339'),lme=last('d334'),down=last('d72'),trade=last('d71'),price=last('d0'),prem=last('d65'),sox=last('d557');
    var day=[wh,lme,down,trade,price,prem,sox].filter(Boolean).map(function(p){return p[0];}).sort().pop()||'';
    var pDown=prev('d72'),pTrade=prev('d71'),pPrem=prev('d65'),pWh=prev('d339'),pLme=prev('d334'),pSox=prev('d557');
    var total=down&&trade?down[1]+trade[1]:null;
    var oldTotal=pDown&&pTrade?pDown[1]+pTrade[1]:null;
    return {day:day,label:day?dayLabel(day):'今日',wh:wh,pWh:pWh,lme:lme,pLme:pLme,down:down,pDown:pDown,trade:trade,pTrade:pTrade,price:price,prem:prem,pPrem:pPrem,sox:sox,pSox:pSox,total:total,oldTotal:oldTotal};
  }
  function soxDaily(c){
    if(!c.sox)return 'SOX 暂无收盘读数';
    var text='SOX 最新为 '+fmt(c.sox[1])+' 点（'+dayLabel(c.sox[0])+'）';
    if(c.pSox){var diff=c.sox[1]-c.pSox[1],pct=c.pSox[1]?diff/c.pSox[1]*100:0;text+='，较 '+dayLabel(c.pSox[0])+(diff>=0?'上涨 ':'下跌 ')+fmt(Math.abs(diff))+' 点（'+signed(pct)+'%）';}
    return text;
  }
  function dailyText(key,c){
    var d=c.label;
    if(key==='price'){
      var note=(window.TIN_SUMMARY_NOTE&&window.TIN_SUMMARY_NOTE.B)||'';
      var m=note.match(/SMM 1#锡\s*([\d,]+)\s*元\/吨，日(涨|跌)\s*([\d,]+)/);
      return (c.price?dayLabel(c.price[0]):d)+' SMM 1#锡 '+(c.price?fmt(c.price[1]):'—')+' 元/吨'+(m?'，日'+m[2]+' '+m[3]+' 元/吨':'');
    }
    if(key==='macro'){var mt=inputValue('macroToday'),mw=inputValue('macroWatch');if(mt||mw)return d+' 今日变化：'+mt+'；后续关注：'+mw;return d+' 近期中东局势有所缓和，但仍需防范协议仅为暂时、选举前后局势反复；油价接近 120 美元前高压力位。今晚关注 FOMC，基准情形是不加息，重点关注沃什讲话';}
    if(key==='ai')return soxDaily(c)+'；'+(inputValue('ai')||'Anthropic 招股书及三星、海力士三季报获得市场较正面反馈，继续跟踪 SOX 变化');
    if(key==='position')return inputValue('position')||'10/28 云锡三席位 sn2611 合计净空单 988 手（银河 435、东海 313、光大 240），较 10/27 合计减少 298 手';
    if(key==='mine')return inputValue('mine')?d+' '+inputValue('mine'):'10/28 矿端点价约千吨，锭端点价较少，主要为此前已交货但未定价的货源；天马矿明年配额可能存在问题，目前待核实';
    if(key==='smelt'){var sm=[inputValue('smelt'),inputValue('fundamentals')].filter(Boolean).join('；');return sm?d+' '+sm:d+' 云锡已开始点火，后续关注能否稳定产出产品；周度开工与产量继续跟踪';}
    if(key==='demand')return d+' 下游成交 '+(c.down?fmt(c.down[1]):'—')+' 吨，'+changeText(c.down,c.pDown,' 吨')+'；'+(inputValue('demand')||'本周消费整体偏弱，此前去库仍主要依赖低位点价');
    if(key==='spot')return d+' 总成交 '+(c.total===null?'—':fmt(c.total))+' 吨'+(c.total!==null&&c.oldTotal!==null?'，较前日 '+signed(c.total-c.oldTotal)+' 吨':'')+'；云锡升水最新为 '+(c.prem?fmt(c.prem[1]):'—')+' 元/吨'+(c.prem?'（'+dayLabel(c.prem[0])+'）':'')+'；'+(inputValue('spot')||'关注贸易商是交仓，还是继续移仓至 12 月挺价');
    if(key==='spread'){var sp=inputValue('spread')||inputValue('other');return sp?d+' '+sp:'10/28 SN 换月基差走弱，12 月挺价力度不足，11 月也在走弱；最新价差数值待补充';}
    if(key==='inventory')return d+' SHFE 仓单 '+(c.wh?fmt(c.wh[1]):'—')+' 吨（'+(c.wh?dayLabel(c.wh[0]):'—')+'），'+changeText(c.wh,c.pWh,' 吨')+'；LME '+(inputValue('lme')||'今日未更新库存，最新仍为 '+(c.lme?fmt(c.lme[1]):'—')+' 吨'+(c.lme?'（'+dayLabel(c.lme[0])+'）':''))+'；周频社库不变';
    if(key==='risk'){var rk=inputValue('risk');if(rk)return d+' '+rk;return c.wh&&c.pWh&&c.wh[1]<c.pWh[1]&&c.total!==null&&c.oldTotal!==null&&c.total<c.oldTotal?d+' 仓单下降但成交缩量，云锡点火复产与近月低库存并存，双向波动风险仍高':d+' 关注仓单、成交与宏观消息的反向扰动，避免单边追涨杀跌';}
    return '';
  }
  function dailyView(key,c){
    if(key==='price')return {text:'中东缓和与不加息基准预期对风险偏好有支撑，但成交仍弱，左侧单维持轻仓；收盘破 39 万止损，成交重回 400 吨上方或收盘收复 41 万再加满',signal:inputSignal('price','双向')};
    if(key==='macro'){var mt=inputValue('macroToday'),mw=inputValue('macroWatch');return {text:mt||mw?('今日变化：'+mt+'；后续关注：'+mw):'中东缓和与不加息基准预期支撑风险偏好；但协议持续性、选举前后反复、油价前高压力及沃什表态仍可能带来双向扰动',signal:inputSignal('macro','利多')};}
    if(key==='ai')return {text:soxDaily(c)+'；'+(inputValue('ai')||'Anthropic 招股书和三星、海力士三季报反馈偏正面，AI 硬件链情绪改善，对锡构成情绪支持'),signal:inputSignal('ai','利多')};
    if(key==='position')return {text:inputValue('position')||'银河、东海、光大主要为云锡席位；今日 sn2611 三席位合计净空单 988 手（银河 435、东海 313、光大 240），大概率对应云锡后续 11 月交仓单数量，重点跟踪仓单注册兑现',signal:inputSignal('position','双向')};
    if(key==='mine')return {text:inputValue('mine')||'矿端点价约千吨，挺价惜售情绪进一步松动；点价以此前已交货但未定价货源为主，锭端点价较少',signal:inputSignal('mine','偏空')};
    if(key==='smelt'){var sm=[inputValue('smelt'),inputValue('fundamentals')].filter(Boolean).join('；');return {text:sm||'云锡点火后供应恢复预期升温，后续产量大概率回升；下游月度销量相对稳定，若稳定产出兑现，供需边际将转向宽松',signal:inputSignal('smelt','偏空')};}
    if(key==='demand')return {text:inputValue('demand')||'本周消费整体偏弱，今日下游成交继续缩量；此前去库主要由低位点价贡献，不能直接等同于终端需求改善',signal:inputSignal('demand','偏空')};
    if(key==='spot')return {text:inputValue('spot')||'11 月和 12 月挺价力度均走弱，重点关注贸易商选择交仓，还是继续移仓至 12 月挺价',signal:inputSignal('spot','双向')};
    if(key==='spread')return {text:inputValue('spread')||inputValue('other')||'SN 换月基差开始走弱，11 月及 12 月挺价力度均不足，正套逻辑边际减弱，等待最新价差和贸易商行为验证',signal:inputSignal('spread','偏空')};
    if(key==='inventory')return {text:'SHFE 仓单'+changeText(c.wh,c.pWh,' 吨')+'，关注库存边际变化及 LME 最新库存',signal:inputSignal('inventory',c.wh&&c.pWh&&c.wh[1]>c.pWh[1]?'偏空':'利多')};
    if(key==='risk')return {text:inputValue('risk')||'仓单转增、换月基差走弱与低库存并存，关注贸易商交仓或移仓选择，避免把低位点价去库等同于消费改善',signal:inputSignal('risk','双向')};
    return {text:'',signal:'中性'};
  }
  function autoStrategy(c){
    if(inputValue('strategy'))return inputValue('strategy');
    var deals=c.total!==null&&c.oldTotal!==null?'当日两类成交 '+fmt(c.total)+' 吨，较前日 '+signed(c.total-c.oldTotal)+' 吨':'当日成交可比数据不足';
    var warehouse=c.wh?'SHFE 仓单 '+fmt(c.wh[1])+' 吨（'+dayLabel(c.wh[0])+'）':'SHFE 仓单暂无读数';
    return c.label+' 日度策略：近期中东局势有所缓和，但仍需防范协议仅为暂时、选举前后反复；油价接近 120 美元前高压力位。今晚 FOMC 基准情形是不加息，重点关注沃什讲话。AI 财报反馈偏正面，'+soxDaily(c)+'。SN 换月基差开始走弱，11 月及 12 月挺价力度均不足，正套逻辑边际减弱。'+deals+'，'+warehouse+'；本周消费偏弱，此前去库主要由低位点价贡献，后续关注贸易商是交仓，还是继续移仓至 12 月挺价。左侧单维持轻仓，收盘破 39 万止损；成交重回 400 吨上方或收盘收复 41 万再加满。评分只反映日度边际，不替代周度供需框架。';
  }
  function signalScore(s){
    if(s==='强多')return 2;if(s==='利多'||s==='结构多')return 1;if(s==='中性略偏多')return 0.5;
    if(s==='强空')return -2;if(s==='偏空')return -1;if(s==='中性略偏空')return -0.5;return 0;
  }
  function scoreLabel(value){return value>=1.25?'强多':(value>=0.5?'偏多':(value>0.1?'中性略偏多':(value>=-0.1?'中性':(value>-0.5?'中性略偏空':(value>-1.25?'偏空':'强空')))));}
  function scoreValue(dims){return Math.max(-2,Math.min(2,dims.reduce(function(sum,d){return sum+d.score*d.weight/100;},0)));}
  function scoreModel(c){
    var dealPct=c.down&&c.pDown&&c.pDown[1]?(c.down[1]-c.pDown[1])/c.pDown[1]*100:null;
    var dealScore=dealPct===null?0:(dealPct>=20?2:(dealPct>=5?1:(dealPct<=-20?-2:(dealPct<=-5?-1:0))));
    var macroSignal=dailyView('macro',c).signal,aiSignal=dailyView('ai',c).signal,inventorySignal=dailyView('inventory',c).signal,spotSignal=dailyView('spot',c).signal;
    var dims=[{name:'宏观',score:signalScore(macroSignal),weight:25},{name:'AI',score:signalScore(aiSignal),weight:10},{name:'成交需求',score:dealScore,weight:25},{name:'库存',score:signalScore(inventorySignal),weight:25},{name:'升贴水',score:signalScore(spotSignal),weight:15}];
    var value=scoreValue(dims);
    return {value:value,label:scoreLabel(value),dims:dims,dealPct:dealPct,inventorySignal:inventorySignal,spotSignal:spotSignal};
  }
  function weeklyScoreModel(){
    var rows={};source.rows.forEach(function(row){rows[row.key]=row;});
    var dims=[{key:'macro',name:'宏观',weight:25},{key:'ai',name:'AI',weight:10},{key:'demand',name:'成交需求',weight:25},{key:'inventory',name:'库存',weight:25},{key:'spot',name:'升贴水',weight:15}];
    dims.forEach(function(d){d.signal=rows[d.key]?rows[d.key].signal:'中性';d.score=signalScore(d.signal);});
    var value=scoreValue(dims);return {value:value,label:scoreLabel(value),dims:dims};
  }
  function scoreMarkup(m){
    var text=(m.value>0?'+':'')+m.value.toFixed(2),color=m.value>0?'#C00000':(m.value<0?'#1F4E79':'#173554');
    return '<div class="score-top"><span class="score-number" style="color:'+color+'">'+text+'</span><span class="score-label" style="color:'+color+'">'+m.label+'</span></div><div class="score-track"><i class="score-marker" style="left:'+((m.value+2)/4*100)+'%"></i></div><div class="score-ticks"><span>-2 强空</span><span>-1</span><span>0</span><span>+1</span><span>+2 强多</span></div>';
  }
  function renderScore(c){
    var el=document.getElementById('dailyScore');if(!el)return;
    el.innerHTML=scoreMarkup(scoreModel(c));
  }
  function renderWeeklyScore(){
    var el=document.getElementById('weeklyScore');if(!el)return;
    el.innerHTML=scoreMarkup(weeklyScoreModel());
  }
  function saveWeekly(){
    var values={};
    document.querySelectorAll('#weeksumBody [data-field]').forEach(function(td){var label=td.querySelector('.signal-label');values[td.dataset.key+'|'+td.dataset.field]=(label?label.textContent:td.textContent).trim();});
    writeStore(STORE_WEEK,{stamp:stamp,values:values});
  }
  function saveDailyCells(){
    var values={};
    document.querySelectorAll('#weeksumBody [data-daily-key]').forEach(function(td){values['change:'+td.dataset.dailyKey]=td.textContent.trim();});
    document.querySelectorAll('#weeksumBody [data-daily-conclusion-key]').forEach(function(td){values['conclusion:'+td.dataset.dailyConclusionKey]=td.textContent.trim();});
    document.querySelectorAll('#weeksumBody [data-daily-signal-key]').forEach(function(td){var label=td.querySelector('.signal-label');values['signal:'+td.dataset.dailySignalKey]=(label?label.textContent:td.textContent).trim();});
    writeStore(STORE_DAY,{date:dayStamp,values:values});
  }
  function updateDaily(){
    var c=context();dayStamp=c.day;
    var hasInput=!!(input&&input.date===dayStamp);
    var edits=readStore(STORE_DAY),values=!hasInput&&edits&&edits.date===dayStamp?edits.values:{};
    source.rows.forEach(function(row){
      var td=document.querySelector('#weeksumBody [data-daily-key="'+row.key+'"]');
      if(td)td.textContent=values['change:'+row.key]||values[row.key]||dailyText(row.key,c);
      var view=dailyView(row.key,c);
      var conclusion=document.querySelector('#weeksumBody [data-daily-conclusion-key="'+row.key+'"]');
      if(conclusion)conclusion.textContent=values['conclusion:'+row.key]||view.text;
      var signal=document.querySelector('#weeksumBody [data-daily-signal-key="'+row.key+'"]');
      if(signal){
        var signalText=values['signal:'+row.key]||view.signal,value=signalScore(signalText);
        signal.textContent='';var label=document.createElement('span');label.className='signal-label';label.textContent=signalText;signal.appendChild(label);
        var badge=document.createElement('span');badge.className='direction-score '+(value>0?'pos':(value<0?'neg':'flat'));badge.textContent='评分 '+((value>0?'+':'')+value.toFixed(2));signal.appendChild(badge);
      }
    });
    renderScore(c);
    var title=document.getElementById('dailyStrategyTitle');if(title)title.textContent='日度策略 · '+c.label;
    var el=document.getElementById('dailyStrategyText'),saved=readStore(STORE_DS);
    if(el)el.textContent=!hasInput&&saved&&saved.date===dayStamp&&saved.text?saved.text:autoStrategy(c);
  }
  function render(next){
    source=next;stamp=hash(JSON.stringify(next));
    var body=document.getElementById('weeksumBody');body.textContent='';
    var edits=readStore(STORE_WEEK),values=edits&&edits.stamp===stamp?edits.values:{};
    source.rows.forEach(function(row){
      var tr=document.createElement('tr');
      [['cat','wcat'],['related',''],['conclusion',''],['signal','wsignal']].forEach(function(part){
        var td=document.createElement('td');td.className=part[1];td.dataset.key=row.key;td.dataset.field=part[0];td.contentEditable=archive?'false':'true';
        var savedValue=values[row.key+'|'+part[0]],freshRow=!!(input&&input.date&&['macro','ai','risk'].indexOf(row.key)>=0);
        td.textContent=(!freshRow&&savedValue)||row[part[0]];
        if(part[0]==='conclusion')td.dataset.dailyConclusionKey=row.key;
        if(part[0]==='signal')td.dataset.dailySignalKey=row.key;
        tr.appendChild(td);
        if(part[0]==='conclusion'){
          var daily=document.createElement('td');daily.className='wdaily';daily.dataset.dailyKey=row.key;daily.contentEditable=archive?'false':'true';tr.insertBefore(daily,td);
        }
      });
      body.appendChild(tr);
    });
    var ws=readStore(STORE_WS),weeklyEl=document.getElementById('weeklyStrategyText');
    weeklyEl.textContent=ws&&ws.stamp===stamp&&ws.text?ws.text:source.final;
    renderWeeklyScore();
    if(archive)document.querySelectorAll('#dailyStrategyBlock [contenteditable]').forEach(function(el){el.contentEditable='false';});
    updateDaily();
  }
  function fetchWeekly(){
    if(!window.fetch||location.protocol==='file:')return;
    fetch('weekly_full.html',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('weekly');return r.text();}).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html'),rows=[];
      doc.querySelectorAll('#sumsec table.sum tbody tr:not(.final)').forEach(function(tr,i){
        var c=tr.querySelectorAll('td');if(c.length<4)return;
        var cat=c[0].textContent.trim(),hasDaily=c.length>=5&&c[2].classList.contains('daily');
        rows.push({key:keyMap[cat]||('row'+i),cat:cat,related:c[1].textContent.trim(),conclusion:c[hasDaily?3:2].textContent.trim(),signal:c[hasDaily?4:3].textContent.trim()});
      });
      var position=fallback.rows.find(function(row){return row.key==='position';}),riskIndex=rows.findIndex(function(row){return row.key==='risk';});
      if(position&&riskIndex>=0)rows.splice(riskIndex,0,position);
      /* 周报原文保留为历史存档；日报中的宏观、AI、风险与策略使用最新框架。 */
      ['macro','ai','risk'].forEach(function(key){var current=fallback.rows.find(function(row){return row.key===key;}),index=rows.findIndex(function(row){return row.key===key;});if(current&&index>=0)rows[index]=current;});
      if(rows.length)render({rows:rows,final:fallback.final});
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
    if(t.matches('#weeksumBody [data-daily-key], #weeksumBody [data-daily-conclusion-key], #weeksumBody [data-daily-signal-key]'))saveDailyCells();
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
