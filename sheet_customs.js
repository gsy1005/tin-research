/* 锡数据日报：海关最新进出口置顶、移除铜库存、升贴水局部坐标优化。 */
(function () {
  'use strict';
  var DB = window.DB_DATA || [];
  var RED = '#c00000', BLUE = '#1f4e79', BLACK = '#262626';
  function series(key) {
    var item = DB.find(function (x) { return x.k === key; });
    return item && Array.isArray(item.s) ? item.s : [];
  }
  function chartOf(canvas) {
    if (window.Chart.getChart) return window.Chart.getChart(canvas);
    var charts = Object.values(window.Chart.instances || {});
    return charts.find(function (c) { return c.canvas === canvas; });
  }
  function titleOf(box) {
    var el = box.querySelector('.ct span');
    return el ? el.textContent.trim() : '';
  }
  function removeCopperChart() {
    document.querySelectorAll('#charts .cbox').forEach(function (box) {
      if (/LME\s*铜库存/i.test(titleOf(box))) {
        var canvas = box.querySelector('canvas'), chart = canvas && chartOf(canvas);
        if (chart) chart.destroy();
        box.remove();
      }
    });
  }
  function recent(key, months) {
    return series(key).filter(function (p) {
      return p[0] >= (months || '2024-01-01') && typeof p[1] === 'number';
    });
  }
  function addCustomsChart(key, title, defs) {
    if (!window.Chart) return;
    var box = document.createElement('div');
    box.className = 'cbox customs-chart';
    box.innerHTML = '<div class="ct"><span></span></div><div class="cc"><canvas></canvas></div>';
    box.querySelector('.ct span').textContent = title;
    var host = document.getElementById('charts');
    host.insertBefore(box, host.firstChild);
    var labels = recent(key).map(function (p) { return p[0].slice(0, 7); });
    var datasets = defs.map(function (def) {
      var points = recent(def.key || key);
      return {
        label: def.label,
        data: points.map(function (p) { return def.abs ? Math.abs(p[1]) : p[1]; }),
        borderColor: def.color,
        backgroundColor: def.color + (def.fill ? '55' : 'cc'),
        borderWidth: def.type === 'bar' ? 0 : 2,
        pointRadius: def.type === 'bar' ? 0 : 2,
        pointHoverRadius: 4,
        tension: 0.2,
        fill: !!def.fill,
        type: def.type || 'line'
      };
    });
    /* 多序列月份标签以进口序列为准；两表均使用相同海关月度日期。 */
    if (defs.length > 1) labels = recent(defs[0].key || key).map(function (p) { return p[0].slice(0, 7); });
    new window.Chart(box.querySelector('canvas').getContext('2d'), {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, boxHeight: 8, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + '：' + Number(ctx.parsed.y).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' 吨';
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 10, maxRotation: 0 }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: function (v) { return Number(v).toLocaleString('zh-CN'); } } }
        }
      }
    });
  }
  function addCustomsCharts() {
    addCustomsChart('d483', '中国锡锭进出口（吨·月｜海关，最新 2026-09）', [
      { key: 'd483', label: '锡锭进口', color: RED, type: 'bar' },
      { key: 'd482', label: '锡锭出口', color: BLUE, abs: true }
    ]);
    addCustomsChart('d137', '中国锡矿砂及精矿进口（吨·月｜海关，最新 2026-09）', [
      { key: 'd137', label: '锡矿砂及精矿进口', color: BLUE, fill: true }
    ]);
  }
  function addIndonesiaChart() {
    if (!window.Chart) return;
    var pts = recent('d480', '2026-01-01');
    if (!pts.length) return;
    var cumulative = {};
    series('d481').forEach(function (p) { cumulative[p[0]] = p[1]; });
    var box = document.createElement('div');
    box.className = 'cbox customs-chart indonesia-chart';
    box.innerHTML = '<div class="ct"><span>印尼交易所成交（吨｜日成交＋月累计）</span></div><div class="cc"><canvas></canvas></div>';
    var host = document.getElementById('charts');
    var customs = host.querySelectorAll('.customs-chart');
    host.insertBefore(box, customs.length ? customs[customs.length - 1].nextSibling : host.firstChild);
    new window.Chart(box.querySelector('canvas').getContext('2d'), {
      data: {
        labels: pts.map(function (p) { return p[0]; }),
        datasets: [
          { type: 'bar', label: '当日成交', data: pts.map(function (p) { return p[1]; }), backgroundColor: RED + 'bb', borderWidth: 0, yAxisID: 'y' },
          { type: 'line', label: '月累计成交', data: pts.map(function (p) { return cumulative[p[0]]; }), borderColor: BLUE, backgroundColor: BLUE, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15, yAxisID: 'y1' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, boxHeight: 8, font: { size: 11 } } },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + '：' + Number(ctx.parsed.y).toLocaleString('zh-CN') + ' 吨'; } } }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 10, maxRotation: 0 }, grid: { display: false } },
          y: { beginAtZero: true, position: 'left', title: { display: true, text: '日成交' } },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '月累计' } }
        }
      }
    });
  }
  function tunePremiumChart() {
    document.querySelectorAll('#charts .cbox').forEach(function (box) {
      if (!/三档升贴水/.test(titleOf(box))) return;
      var chart = chartOf(box.querySelector('canvas'));
      if (!chart) return;
      /* 日频全历史会压平近期变化；折线/柱状默认只看近 120 个有效交易日。 */
      if (chart.config.type !== 'line' || !box.dataset.premiumTrimmed) {
        chart.data.datasets.forEach(function (ds, i) {
          var key = ['d65', 'd66', 'd67'][i], pts = series(key).slice(-120);
          ds.data = pts.map(function (p) { return p[1]; });
        });
        var pts = series('d65').slice(-120);
        chart.data.labels = pts.map(function (p) { return p[0]; });
        box.dataset.premiumTrimmed = '1';
      }
      var values = [];
      chart.data.datasets.forEach(function (ds) {
        ds.data.forEach(function (v) { if (typeof v === 'number' && isFinite(v)) values.push(v); });
      });
      if (!values.length) return;
      var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
      var pad = Math.max(150, (max - min) * 0.12);
      if (!chart.options.scales) chart.options.scales = {};
      if (!chart.options.scales.y) chart.options.scales.y = {};
      chart.options.scales.y.beginAtZero = false;
      chart.options.scales.y.min = Math.floor((min - pad) / 250) * 250;
      chart.options.scales.y.max = Math.ceil((max + pad) / 250) * 250;
      if (!chart.options.scales.y.ticks) chart.options.scales.y.ticks = {};
      chart.options.scales.y.ticks.stepSize = (max - min) > 3000 ? 500 : 250;
      chart.options.scales.y.ticks.callback = function (v) { return Number(v).toLocaleString('zh-CN'); };
      var title = box.querySelector('.ct span');
      if (title && !/近120/.test(title.textContent)) title.textContent = '三档升贴水（元/吨·近120个交易日）';
      chart.update('none');
      var select = box.querySelector('.cty');
      if (select && !select.dataset.premiumBound) {
        select.dataset.premiumBound = '1';
        select.addEventListener('change', function () { setTimeout(tunePremiumChart, 0); });
      }
    });
  }
  removeCopperChart();
  addCustomsCharts();
  addIndonesiaChart();
  tunePremiumChart();
})();
