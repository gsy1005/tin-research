/* 其他有色页 · 图表渲染 */
window.METALS = (function(){
  function col(arr,i){ return arr.map(function(r){return r[i];}); }
  function lab(arr){ return arr.map(function(r){return r[0].slice(2);}); }
  function baseOpts(dual){
    var o = { responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{ legend:{labels:{boxWidth:10,boxHeight:10,padding:10,usePointStyle:true,pointStyle:'line'}},
        tooltip:{backgroundColor:'#141b28',borderColor:'#262d3d',borderWidth:1,titleColor:'#eef2f8',bodyColor:'#d7dde8',padding:10} },
      scales:{ x:{grid:{display:false},ticks:{maxTicksLimit:10,maxRotation:0}},
        y:{position:'left',grid:{color:'rgba(38,45,61,.55)'},ticks:{maxTicksLimit:6}} } };
    if(dual) o.scales.y1 = {position:'right',grid:{display:false},ticks:{maxTicksLimit:6}};
    return o;
  }
  function ds(label,data,color,extra){
    return Object.assign({label:label,data:data,borderColor:color,backgroundColor:color,borderWidth:1.7,pointRadius:0,tension:.25,spanGaps:true},extra||{});
  }
  function mk(id,cfg){ var el=document.getElementById(id); if(el) new Chart(el,cfg); }

  function render(D){
    Chart.defaults.color='#8a94a6'; Chart.defaults.borderColor='rgba(38,45,61,.6)';
    Chart.defaults.font.family='-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
    Chart.defaults.font.size=11; Chart.defaults.animation=false;

    var px=D.cu_px.slice(-66);
    mk('c-cu-price',{type:'line',data:{labels:lab(px),datasets:[
      ds('沪铜主力（元/吨·左）',col(px,2),'#f0883e',{yAxisID:'y'}),
      ds('LME铜3M（美元/吨·右）',col(px,1),'#58a6ff',{yAxisID:'y1'})]},options:baseOpts(true)});

    var inv=D.inv3m.slice(-60);
    mk('c-cu-inv3',{type:'bar',data:{labels:lab(inv),datasets:[
      ds('COMEX（万吨）',col(inv,2),'#d4a944',{stack:'s',backgroundColor:'rgba(212,169,68,.75)',borderWidth:0}),
      ds('LME（万吨）',col(inv,3),'#58a6ff',{stack:'s',backgroundColor:'rgba(88,166,255,.7)',borderWidth:0}),
      ds('SHFE（万吨）',col(inv,1),'#f0524f',{stack:'s',backgroundColor:'rgba(240,82,79,.75)',borderWidth:0})]},
      options:(function(){var o=baseOpts();o.scales.x.stacked=true;o.scales.y.stacked=true;return o;})()});

    mk('c-cu-tc',{type:'line',data:{labels:lab(D.tc),datasets:[
      ds('铜精矿现货TC（美元/干吨）',col(D.tc,1),'#f0524f',{fill:true,backgroundColor:'rgba(240,82,79,.12)'})]},options:baseOpts()});

    var ys=D.ys.slice(-66), st=D.st.slice(-66);
    mk('c-cu-ys',{type:'line',data:{labels:lab(ys),datasets:[
      ds('洋山铜溢价（美元/吨·左）',col(ys,1),'#d4a944',{yAxisID:'y'}),
      ds('国内现货升贴水均值（元/吨·右）',col(st,1),'#3fb950',{yAxisID:'y1'})]},options:baseOpts(true)});

    mk('c-cu-jf',{type:'bar',data:{labels:lab(D.jf.slice(-44)),datasets:[
      ds('佛山精废铜价差（元/吨）',col(D.jf.slice(-44),1),'#bc8cff',{backgroundColor:'rgba(188,140,255,.6)',borderWidth:0,borderRadius:2})]},options:baseOpts()});

    var rod=D.cu_rod.slice(-30), rodre=D.cu_rod_re.slice(-30);
    mk('c-cu-rod',{type:'line',data:{labels:lab(rod),datasets:[
      ds('电解铜杆开工率（%·周）',col(rod,1),'#58a6ff',{borderWidth:2}),
      ds('再生铜杆开工率（%·周）',col(rodre,1),'#f0883e')]},options:baseOpts()});

    var cg=D.cugold.slice(-130), gs=D.goldsilver.slice(-130);
    mk('c-cu-ratio',{type:'line',data:{labels:lab(cg),datasets:[
      ds('铜金比（沪铜/沪金·左）',col(cg,1),'#d4a944',{yAxisID:'y',borderWidth:2}),
      ds('金银比（沪金/沪银·右）',col(gs,1),'#8a94a6',{yAxisID:'y1'})]},options:baseOpts(true)});

    var sc=D.sncu.slice(-130);
    mk('c-cu-sncu',{type:'line',data:{labels:lab(sc),datasets:[
      ds('锡铜比（沪锡/沪铜）',col(sc,1),'#2dd4bf',{borderWidth:2,fill:true,backgroundColor:'rgba(45,212,191,.08)'})]},options:baseOpts()});

    var li=D.lmeidx.slice(-66);
    mk('c-cu-lmeidx',{type:'line',data:{labels:lab(li),datasets:[
      ds('LME基本金属指数（左）',col(li,1),'#d4a944',{yAxisID:'y',borderWidth:2}),
      ds('LME铜3M（美元/吨·右）',col(px,1),'#58a6ff',{yAxisID:'y1'})]},options:baseOpts(true)});
  }
  return {render:render};
})();
