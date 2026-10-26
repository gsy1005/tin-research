/* 周报版本二 · 手机 PDF 阅读模式：复用原 A4 分页引擎，只做整页等比缩放。 */
(function(){
  'use strict';
  var active=false,building=false,originalPrint=null,bar=null,count=null,fitTimer=null;
  function qa(x){return Array.prototype.slice.call(x||[]);}
  function isPhone(){return window.innerWidth<=760;}
  function fit(){
    if(!active)return;
    var w=Math.min(760,document.documentElement.clientWidth-16);
    qa(document.querySelectorAll('body > .mpg')).forEach(function(host){
      var pg=host.querySelector('.pg');if(!pg)return;
      pg.style.transform='none';
      var pw=pg.offsetWidth,ph=pg.offsetHeight;if(!pw||!ph)return;
      var s=w/pw;
      host.style.width=w+'px';host.style.height=(ph*s)+'px';
      pg.style.transform='scale('+s+')';
    });
    updateCount();
  }
  function updateCount(){
    if(!count)return;
    var pages=qa(document.querySelectorAll('body > .mpg')),current=1;
    var y=window.scrollY+70;
    pages.forEach(function(p,i){if(p.offsetTop<=y)current=i+1;});
    count.textContent=current+' / '+pages.length;
  }
  function onResize(){clearTimeout(fitTimer);fitTimer=setTimeout(fit,100);}
  function finishBuild(){
    if(!building)return;
    building=false;
    if(originalPrint){window.print=originalPrint;originalPrint=null;}
    var pages=qa(document.querySelectorAll('body > .pg'));
    if(!pages.length)return;
    active=true;
    document.documentElement.classList.add('pgxmobile');
    pages.forEach(function(pg){
      var host=document.createElement('div');host.className='mpg';
      document.body.insertBefore(host,pg);host.appendChild(pg);
    });
    bar=document.createElement('div');bar.className='pgxmobilebar';
    bar.innerHTML='<span class="mtitle">锡研究周报 · 手机 PDF 版</span><span class="mcount"></span><button type="button" data-act="top">顶部</button><button type="button" data-act="exit">网页版</button>';
    document.body.appendChild(bar);count=bar.querySelector('.mcount');
    bar.addEventListener('click',function(e){
      var b=e.target.closest('button');if(!b)return;
      if(b.getAttribute('data-act')==='exit')close();
      else window.scrollTo({top:0,behavior:'smooth'});
    });
    window.addEventListener('resize',onResize);
    window.addEventListener('scroll',updateCount,{passive:true});
    window.scrollTo(0,0);fit();
  }
  function open(){
    if(active||building||!window.PGX)return;
    building=true;originalPrint=window.print;
    /* PGX 原本在分页完成后调用 print；手机模式在同一节点接管结果，不触发打印。 */
    window.print=function(){if(building)setTimeout(finishBuild,0);};
    try{window.PGX.go('a4');}catch(e){finishBuild();}
  }
  function close(){
    if(building){building=false;if(originalPrint){window.print=originalPrint;originalPrint=null;}}
    active=false;clearTimeout(fitTimer);
    window.removeEventListener('resize',onResize);window.removeEventListener('scroll',updateCount);
    qa(document.querySelectorAll('body > .mpg')).forEach(function(x){x.remove();});
    qa(document.querySelectorAll('body > .pg')).forEach(function(x){x.remove();});
    if(bar){bar.remove();bar=null;count=null;}
    document.documentElement.classList.remove('pgxmobile','pgxa4','pgxppt','pgxmeasure');
    try{sessionStorage.setItem('wkfull-mobile-off','1');}catch(e){}
    window.scrollTo(0,0);
  }
  window.MobilePDF={open:open,close:close,fit:fit,isActive:function(){return active;}};
  function addButton(){
    var meta=document.querySelector('.meta');if(!meta||meta.querySelector('.mobilepdf-open'))return;
    var b=document.createElement('button');b.type='button';b.className='mobilepdf-open';b.textContent='📱 手机 PDF 版';b.onclick=open;
    meta.appendChild(b);
  }
  addButton();
  var force=/[?&]mobile=1(?:&|$)/.test(location.search);
  var off=false;try{off=sessionStorage.getItem('wkfull-mobile-off')==='1';}catch(e){}
  if(force||(isPhone()&&!off&&!/[?&]mobile=0(?:&|$)/.test(location.search)))setTimeout(open,500);
})();
