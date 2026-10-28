/* Private SNL8 structure module. Render only after the weekly report's existing gate unlocks. */
(function () {
  'use strict';

  const PROFILE_LABELS = {
    day_2h_30m_5m: '波段链 · 日线 → 2H → 30m → 5m',
    day_1h_15m_3m: '战术链 · 日线 → 1H → 15m → 3m',
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmt = (value, digits) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const number = Number(value);
    const d = digits ?? (Math.abs(number) >= 1000 ? 0 : 2);
    return number.toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  };
  const shortTime = value => value ? String(value).replace('T', ' ').slice(0, 16) : '—';
  const directionClass = value => String(value).includes('多') ? 'long' : String(value).includes('空') ? 'short' : 'neutral';
  const directionPill = value => `<span class="sns-direction ${directionClass(value)}"><i></i>${esc(value)}</span>`;
  const statusClass = value => value === '已联动' ? 'linked' : value === '候选' ? 'candidate' : 'waiting';

  function linePath(bars, key, x, y) {
    let started = false;
    return bars.map((bar, index) => {
      if (!Number.isFinite(Number(bar[key]))) return '';
      const command = started ? 'L' : 'M'; started = true;
      return `${command}${x(index).toFixed(1)},${y(Number(bar[key])).toFixed(1)}`;
    }).join(' ');
  }

  function chartSvg(bars, level, structure = {}) {
    if (!bars?.length) return '<div class="sns-empty">当前级别没有图表数据</div>';
    const W = 960, H = 408, left = 68, right = 18, top = 30, priceH = 210, macdTop = 291, macdH = 62;
    const strokes = structure.strokes || [], zones = structure.zones || [], fractals = structure.fractals || [];
    const plotW = W - left - right, step = plotW / bars.length, bodyW = Math.max(2, Math.min(6, step * .62));
    const priceValues = bars.flatMap(bar => [Number(bar.h), Number(bar.l), Number(bar.ma21), Number(bar.ma55)]).filter(Number.isFinite);
    let high = Math.max(...priceValues), low = Math.min(...priceValues);
    const padding = (high - low) * .06 || 1; high += padding; low -= padding;
    const x = index => left + step * (index + .5), y = value => top + (high - value) / (high - low) * priceH;
    const macdMax = Math.max(...bars.flatMap(bar => [Math.abs(Number(bar.dif) || 0), Math.abs(Number(bar.dea) || 0), Math.abs(Number(bar.hist) || 0)]), 1);
    const my = value => macdTop + macdH / 2 - value / macdMax * (macdH / 2 - 3);
    const grid = Array.from({ length: 5 }, (_, index) => {
      const gy = top + priceH * index / 4, value = high - (high - low) * index / 4;
      return `<line x1="${left}" y1="${gy}" x2="${W - right}" y2="${gy}" class="sns-grid"/><text x="${left - 8}" y="${gy + 3}" text-anchor="end" class="sns-axis">${fmt(value)}</text>`;
    }).join('');
    const zoneMarkup = zones.map((zone, index) => {
      const zx = left + step * zone.from_i, zw = Math.max(step, (zone.to_i - zone.from_i + 1) * step);
      const zy = y(Number(zone.high)), zh = Math.max(2, y(Number(zone.low)) - zy);
      return `<rect data-chan-zone x="${zx}" y="${zy}" width="${zw}" height="${zh}" class="sns-chan-zone"/>${index === zones.length - 1 ? `<text x="${Math.min(zx + zw - 4, W - right - 4)}" y="${zy + 12}" text-anchor="end" class="sns-zone-label">中枢 ${fmt(zone.low)}–${fmt(zone.high)}</text>` : ''}`;
    }).join('');
    const candles = bars.map((bar, index) => {
      const up = Number(bar.c) >= Number(bar.o), cls = up ? 'up' : 'down';
      const yo = y(Number(bar.o)), yc = y(Number(bar.c));
      return `<line x1="${x(index)}" y1="${y(Number(bar.h))}" x2="${x(index)}" y2="${y(Number(bar.l))}" class="sns-wick ${cls}"/><rect x="${x(index) - bodyW / 2}" y="${Math.min(yo, yc)}" width="${bodyW}" height="${Math.max(1, Math.abs(yc - yo))}" class="sns-candle ${cls}"/>`;
    }).join('');
    const strokeMarkup = strokes.map(stroke => `<line data-chan-stroke data-direction="${esc(stroke.direction)}" x1="${x(stroke.from_i)}" y1="${y(stroke.from_p)}" x2="${x(stroke.to_i)}" y2="${y(stroke.to_p)}" class="sns-chan-stroke"/><circle cx="${x(stroke.from_i)}" cy="${y(stroke.from_p)}" r="2.3" class="sns-chan-point"/><circle cx="${x(stroke.to_i)}" cy="${y(stroke.to_p)}" r="2.3" class="sns-chan-point"/>`).join('');
    const fractalMarkup = fractals.map(fractal => {
      const fx = x(fractal.i), fy = y(fractal.price), topFractal = fractal.kind === 'top';
      const points = topFractal ? `${fx},${fy - 5} ${fx - 3.5},${fy + 1} ${fx + 3.5},${fy + 1}` : `${fx},${fy + 5} ${fx - 3.5},${fy - 1} ${fx + 3.5},${fy - 1}`;
      return `<polygon data-fractal="${topFractal ? 'top' : 'bottom'}" points="${points}" class="sns-fractal ${topFractal ? 'top' : 'bottom'}"/>`;
    }).join('');
    const hist = bars.map((bar, index) => {
      const value = Number(bar.hist) || 0, zero = my(0), vy = my(value);
      return `<rect x="${x(index) - bodyW / 2}" y="${Math.min(zero, vy)}" width="${bodyW}" height="${Math.max(1, Math.abs(vy - zero))}" class="sns-hist ${value >= 0 ? 'up' : 'down'}"/>`;
    }).join('');
    const crosses = bars.slice(1).map((bar, index) => {
      const previous = bars[index], before = Number(previous.dif) - Number(previous.dea), now = Number(bar.dif) - Number(bar.dea);
      if (!Number.isFinite(before) || !Number.isFinite(now) || before === 0 || before * now > 0) return '';
      return `<circle data-macd-cross="${now > 0 ? 'gold' : 'dead'}" cx="${x(index + 1)}" cy="${my(Number(bar.dif))}" r="3" class="sns-macd-cross ${now > 0 ? 'gold' : 'dead'}"/>`;
    }).join('');
    const firstDate = String(bars[0].t || '').slice(5, 10), lastDate = String(bars.at(-1).t || '').slice(5, 16), latest = bars.at(-1);
    return `<svg class="sns-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(level.label)} K线、缠论笔、中枢、均线与MACD图">
      <text x="${left}" y="16" class="sns-chart-title">${esc(level.label)} · 最近 ${bars.length} 根已收盘K线</text><text x="${W - right}" y="16" text-anchor="end" class="sns-chart-title">原算法坐标 · ${strokes.length} 笔 · ${zones.length} 个中枢候选</text>
      <g>${grid}</g><g>${zoneMarkup}</g><g>${candles}</g>
      <path d="${linePath(bars, 'ma21', x, y)}" class="sns-ma21"/><path d="${linePath(bars, 'ma55', x, y)}" class="sns-ma55"/>
      <g>${strokeMarkup}</g><g>${fractalMarkup}</g>
      <text x="${left}" y="${top + priceH + 18}" class="sns-axis">${esc(firstDate)}</text><text x="${W - right}" y="${top + priceH + 18}" text-anchor="end" class="sns-axis">${esc(lastDate)}</text>
      <text x="${left}" y="${macdTop - 7}" class="sns-chart-title">MACD (12,26,9)</text><text x="${W - right}" y="${macdTop - 7}" text-anchor="end" class="sns-axis">DIF ${fmt(latest.dif, 1)} · DEA ${fmt(latest.dea, 1)} · 柱 ${fmt(latest.hist, 1)}</text>
      <line x1="${left}" y1="${my(0)}" x2="${W - right}" y2="${my(0)}" class="sns-grid"/>
      <g>${hist}</g><path d="${linePath(bars, 'dif', x, my)}" class="sns-dif"/><path d="${linePath(bars, 'dea', x, my)}" class="sns-dea"/><g>${crosses}</g>
      <g class="sns-legend"><text x="${left}" y="382" class="sns-ma21-text">MA21</text><text x="${left + 48}" y="382" class="sns-ma55-text">MA55</text><text x="${left + 96}" y="382" class="sns-chan-text">━ 缠论笔</text><text x="${left + 166}" y="382" class="sns-zone-text">▧ 中枢候选</text><text x="${left + 250}" y="382" class="sns-fractal-text">△▽ 顶底分型</text><text x="${W - right}" y="382" text-anchor="end">笔与中枢沿用分析引擎原坐标，不作盘中预测</text>
      <text x="${left}" y="400" class="sns-dif-text">DIF</text><text x="${left + 38}" y="400" class="sns-dea-text">DEA</text><text x="${left + 82}" y="400" class="sns-macd-text">MACD柱</text><text x="${left + 148}" y="400" class="sns-macd-text">○ 交叉点</text><text x="${W - right}" y="400" text-anchor="end">红涨绿跌 · 图表只使用已收盘快照K线</text></g>
    </svg>`;
  }

  function chainMarkup(report, focused) {
    return `<div class="sns-chain">${report.levels.map((level, index) => `
      <button type="button" data-timeframe="${esc(level.timeframe)}" class="sns-chain-node ${focused.timeframe === level.timeframe ? 'active' : ''}">
        <span class="sns-node-role">0${index + 1} · ${['方向', '结构', '区域', '执行'][index]}</span>
        <span class="sns-node-title"><b>${esc(level.label)}</b>${directionPill(level.direction)}</span>
        <strong>${fmt(level.last_close)}</strong><span class="sns-node-structure">${esc(level.structure)}</span>
        <span class="sns-node-macd">${esc(String(level.macd).split('，')[0])}</span>
      </button>`).join('')}</div>`;
  }

  function macdPanel(report, focused) {
    const options = report.options_macd;
    if (!options) return '';
    const current = options.levels.find(level => level.timeframe === focused.timeframe);
    return `<section class="sns-panel sns-macd-panel" data-private-theory="macd">
      <div class="sns-panel-heading"><div><span>MACD CYCLE · SIX LINKED LOOPS</span><h3>MACD 循环 · 六组多级别联立</h3></div><b>六循环</b></div>
      <p class="sns-intro">逐对检查相邻级别；高级别前提未成立时，低级别形态只列为候选，不把规则评分包装成胜率。</p>
      <div class="sns-cycle-grid">${options.cycles.map(cycle => `<article class="sns-cycle-card">
        <div><span>循环 ${esc(cycle.id)} · ${esc(cycle.higher)} → ${esc(cycle.lower)}</span><b class="sns-cycle-status ${statusClass(cycle.status)}">${esc(cycle.status)}</b></div>
        <h4>${esc(cycle.title)}</h4><p>${esc(cycle.evidence)}</p>
        <details><summary>原规则与三组级别证据</summary><p>${esc(cycle.original_rule)}</p>${cycle.links.map(link => `<div class="sns-cycle-link"><b>${esc(link.higher)} → ${esc(link.lower)} · ${esc(link.status)}</b><p>${esc(link.evidence)}</p></div>`).join('')}</details>
      </article>`).join('')}</div>
      ${current ? `<div class="sns-special-grid"><article><span>AV / 1/2</span><b>${esc(current.overbought_oversold)}</b><p>${esc(current.half_position)}</p></article><article><span>风洞</span><b>${esc(current.wind_tunnel.kind || '等待形态')}</b><p>${esc(current.wind_tunnel.text)}</p></article><article><span>推土机</span><b>${esc(current.bulldozer.kind || '等待均线环境')}</b><p>${esc(current.bulldozer.text)}</p></article><article><span>真交叉与纠错</span><b>${esc(current.true_cross)}</b><p>${esc(current.correction)}</p></article></div>` : ''}
      <p class="sns-method-note">${esc(options.proxy_note)} ${esc(options.source_note)}</p>
    </section>`;
  }

  function theoryPanel(report, focused, kind) {
    const isChan = kind === 'chan';
    const blocks = focused.structure_blocks.filter(block => isChan ? /^(③|④|⑤|⑨)/.test(block.title) : /^⑧/.test(block.title));
    return `<section class="sns-panel" data-private-theory="${kind}">
      <div class="sns-panel-heading"><div><span>${isChan ? 'CHAN × SU · RECURSIVE STRUCTURE' : 'CHANBANG · AMA ENVIRONMENT'}</span><h3>${isChan ? '缠论 / 素论 · 结构与动力' : '缠邦 · AMA 六零线与类一 / 类二买卖'}</h3></div><b>${esc(focused.label)}</b></div>
      <div class="sns-theory-focus"><div><span>${isChan ? '当前结构' : 'AMA 环境'}</span><h4>${esc(isChan ? focused.structure : focused.ama_context || '等待 AMA 环境确认')}</h4><p>${esc(isChan ? focused.chan : focused.entry_signal || '等待上下级确认')}</p></div><div class="sns-theory-facts"><span>最近${focused.latest_fractal_kind === 'top' ? '顶' : '底'}分型 <b>${fmt(focused.latest_fractal_price)}</b></span><span>中枢候选 <b>${focused.zone ? `${fmt(focused.zone[0])} – ${fmt(focused.zone[1])}` : '暂未形成'}</b></span><span>AMA <b>${fmt(focused.ama)}</b></span></div></div>
      <div class="sns-evidence-grid">${blocks.map(block => `<article><h4>${esc(block.title)}</h4><ul>${block.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></article>`).join('') || '<p class="sns-empty">该级别暂无可展开证据。</p>'}</div>
    </section>`;
  }

  function signedPercent(value) {
    return `<span class="${Number(value) > 0 ? 'sns-positive' : Number(value) < 0 ? 'sns-negative' : ''}">${Number(value) > 0 ? '+' : ''}${fmt(value, 2)}%</span>`;
  }

  function unifiedStrategyPanel(report) {
    const [higher, middle, setup, execution] = report.levels;
    const linked = report.options_macd?.cycles.filter(cycle => cycle.status === '已联动').length || 0;
    const candidates = report.options_macd?.cycles.filter(cycle => cycle.status === '候选').length || 0;
    const sameDirection = higher.direction === middle.direction && ['多', '空'].includes(higher.direction);
    const posture = sameDirection
      ? `${higher.label}与${middle.label}同为${higher.direction}头，只顺着高级别方向等待低级别触发。`
      : '高低级别尚未形成同向过滤，不把次级别信号直接升级为趋势交易。';
    const theories = [
      ['道氏 · 高级别定势', higher.dow, `方向过滤采用${higher.label}与${middle.label}；当前结论为${higher.direction} / ${middle.direction}。`],
      ['价格行为 · 区域确认', setup.price_action, `执行前必须等待${execution.label}收盘确认，盘中穿越不单独构成入场。`],
      ['缠论 / 素论 · 中枢与分型', setup.structure, setup.zone ? `当前中枢候选 ${fmt(setup.zone[0])}–${fmt(setup.zone[1])}；离开与回抽共同确认，不凭单一分型预测。` : '当前没有稳定中枢候选，降低结构信号权重。'],
      ['MACD 六循环 · 动能过滤', report.options_macd?.summary || report.alignment, `六循环中 ${linked} 组已联动、${candidates} 组候选；候选不当作已确认。`],
      ['缠邦 · AMA 环境', middle.ama_context || '等待 AMA 环境确认', setup.entry_signal || '等待类一 / 类二与上下级共同确认。'],
      ['KDJ / ATR · 节奏与风控', `${execution.kdj}；执行级别 ATR ${fmt(execution.atr)}。`, '止损由结构失效与波动共同约束，失效后不摊平，不把小级别逆势信号当作加仓理由。'],
    ];
    return `<section class="sns-panel sns-plan-panel sns-unified-strategy" data-unified-strategy>
      <div class="sns-panel-heading"><div><span>UNIFIED THEORY STRATEGY</span><h3>全理论合成策略 · 先过滤，再触发</h3></div>${directionPill(report.plan.direction)}</div>
      <div class="sns-strategy-call"><div><span>当前操作状态</span><h4>${esc(report.plan.status)}</h4><p>${esc(posture)} ${esc(report.plan.why)}</p></div><div class="sns-strategy-bias"><span>合成方向</span><b>${esc(report.plan.direction)}</b><small>规则合成 · 非胜率</small></div></div>
      <div class="sns-theory-votes">${theories.map(([name, evidence, action]) => `<article><h4>${esc(name)}</h4><p>${esc(evidence)}</p><span>${esc(action)}</span></article>`).join('')}</div>
      <div class="sns-execution-box"><div><h4>执行条件 · 未触发就等待</h4><ol>${report.plan.conditions.map(item => `<li>${esc(item)}</li>`).join('')}</ol></div><div class="sns-price-plan"><span>观察触发 <b>${fmt(report.plan.entry)}</b></span><span>结构失效 <b>${fmt(report.plan.stop)}</b></span><span>目标1 · 1R <b>${fmt(report.plan.target1)}</b></span><span>目标2 · 2R <b>${fmt(report.plan.target2)}</b></span></div></div>
      <p class="sns-method-note">合成原则：高级别方向 > 中枢与价格区域 > MACD / AMA 过滤 > 低级别收盘触发。任何单一理论与其他证据冲突时，以等待和缩小风险为默认处理。</p>
    </section>`;
  }

  function strengthGroup(rows, kind, title) {
    const strongest = rows[0], weakest = rows.at(-1);
    const maxAbs = Math.max(...rows.map(row => Math.abs(row.score)), 1);
    const positives = rows.filter(row => row.score > 0).length, negatives = rows.filter(row => row.score < 0).length;
    return `<div class="sns-relative-group" data-strength-group="${kind}">
      <div class="sns-relative-group-title"><h4>${esc(title)}</h4><span>${esc(shortTime(strongest.as_of))} 截止</span></div>
      <div class="sns-relative-summary"><b>${esc(strongest.name)}相对最强 · ${esc(weakest.name)}相对最弱</b><p>正动量 ${positives} 个、负动量 ${negatives} 个；${negatives === rows.length ? '组内全部为负，排名第一不等于绝对做多信号。' : '排名只描述相对动量，仍需回到各自结构确认方向。'}</p></div>
      <div class="sns-relative-bars">${rows.map(row => {
        const width = Math.abs(row.score) / maxAbs * 50;
        const style = row.score >= 0 ? `left:50%;width:${width}%` : `left:${50 - width}%;width:${width}%`;
        return `<div class="sns-relative-row"><span><b>${row.rank}</b>${esc(row.name)}<small>${esc(row.group)}</small></span><div class="sns-relative-track"><i></i><em class="${row.score >= 0 ? 'positive' : 'negative'}" style="${style}"></em></div><strong>${signedPercent(row.score)}</strong></div>`;
      }).join('')}</div>
      <div class="sns-relative-table-wrap"><table class="sns-relative-table"><thead><tr><th>排名 / 品种</th><th>5根日K</th><th>20根日K</th><th>60根日K</th><th>综合动量</th><th>均线环境</th><th>结构参考</th></tr></thead><tbody>${rows.map(row => `<tr><td><b>${row.rank} · ${esc(row.name)}</b><small>${esc(row.group)}</small></td><td>${signedPercent(row.returns['5'])}</td><td>${signedPercent(row.returns['20'])}</td><td>${signedPercent(row.returns['60'])}</td><td><b>${signedPercent(row.score)}</b></td><td>${esc(row.trend)}</td><td>${esc(row.structure)}</td></tr>`).join('')}</tbody></table></div>
      <p class="sns-group-source">来源：${esc(strongest.source)} · 截止 ${esc(shortTime(strongest.as_of))}</p>
    </div>`;
  }

  function relativeStrengthPanel() {
    const data = window.TIN_RELATIVE_STRENGTH;
    if (!data?.nonferrous_rows?.length) return '';
    return `<section class="sns-panel sns-relative-panel" data-relative-strength>
      <div class="sns-panel-heading"><div><span>NONFERROUS UNIVERSE × PRECIOUS REFERENCE</span><h3>有色整体强弱 · 六大基本金属主连</h3></div><b>6 个有色 + 2 个贵金属</b></div>
      <p class="sns-intro">先比较铜、铝、锌、铅、镍、锡的有色内部动量，再把黄金、白银单独作为跨板块参照；不同分组不混排名。</p>
      ${strengthGroup(data.nonferrous_rows, 'nonferrous', '有色整体 · 铜 / 铝 / 锌 / 铅 / 镍 / 锡')}
      ${strengthGroup(data.precious_rows, 'precious', '贵金属参考 · 黄金 / 白银')}
      <p class="sns-method-note">${esc(data.formula)}。${esc(data.note)} 强弱比较不使用不同品种的价格、ATR 或 MACD 原始值直接相比。</p>
    </section>`;
  }

  function render(root, state) {
    const payload = window.TIN_STRUCTURE_DATA[state.profile], report = payload.report;
    const focused = report.levels.find(level => level.timeframe === state.timeframe) || report.levels.at(-1);
    const bars = payload.charts[focused.timeframe] || [];
    root.innerHTML = `<div class="sns-shell">
      <section class="sns-hero"><div><span class="sns-kicker">PRIVATE · TDX AFTER-HOURS STRUCTURE</span><h3>沪锡主连 · 结构联立</h3><p>高级别定方向，低级别找触发；价格结构先行，指标只做验证。</p></div><div class="sns-private-stamp"><b>私享</b><span>${esc(report.data_source.mode === 'local_only' ? '通达信本地K线' : '本地＋补线')}</span></div></section>
      <div class="sns-toolbar"><div class="sns-profile-tabs">${Object.entries(PROFILE_LABELS).map(([key, label]) => `<button type="button" data-profile="${key}" class="${state.profile === key ? 'active' : ''}">${label}</button>`).join('')}</div><span>快照截至 <b>${shortTime(report.data_cutoff)}</b></span></div>
      <div class="sns-warning">这是已收盘K线生成的结构快照，不是实时交易指令。切换级别只改变当前证据与图表，不改写原快照。</div>
      ${chainMarkup(report, focused)}
      <section class="sns-panel sns-chart-panel"><div class="sns-panel-heading"><div><span>PRICE × CHAN × MACD</span><h3>${esc(focused.label)} · K线 / 缠论笔 / 中枢 / MACD</h3></div>${directionPill(focused.direction)}</div>${chartSvg(bars, focused, payload.structures?.[focused.timeframe])}</section>
      ${unifiedStrategyPanel(report)}
      ${macdPanel(report, focused)}
      ${theoryPanel(report, focused, 'chan')}
      ${theoryPanel(report, focused, 'chanbang')}
      ${relativeStrengthPanel()}
      <section class="sns-panel"><div class="sns-panel-heading"><div><span>SOURCE & LIMITS</span><h3>数据来源与后续三种处理</h3></div><b>非胜率</b></div><div class="sns-source-grid"><div><p>${esc(report.data_source.message)}</p><span>本地分钟截止 <b>${shortTime(report.data_source.local_latest)}</b></span><span>远端补线截止 <b>${shortTime(report.data_source.remote_latest)}</b></span></div><ol>${report.scenarios.map(item => `<li>${esc(item)}</li>`).join('')}</ol></div><p class="sns-method-note">${esc(report.warning)}</p></section>
      <div class="sns-legacy-divider"><span>以下保留原锡研究日报指标体系</span></div>
    </div>`;
  }

  function mount(root) {
    if (!root || root.dataset.mounted === 'true') return;
    if (!window.TIN_STRUCTURE_DATA) {
      root.innerHTML = '<div class="sns-error">沪锡联立快照未加载，请检查 tin_structure_data.js。</div>'; return;
    }
    const state = { profile: 'day_2h_30m_5m', timeframe: '5m' };
    root.dataset.mounted = 'true';
    root.addEventListener('click', event => {
      const profile = event.target.closest('[data-profile]');
      const timeframe = event.target.closest('[data-timeframe]');
      if (profile) {
        state.profile = profile.dataset.profile;
        state.timeframe = window.TIN_STRUCTURE_DATA[state.profile].report.levels.at(-1).timeframe;
        render(root, state);
      } else if (timeframe) {
        state.timeframe = timeframe.dataset.timeframe;
        render(root, state);
      }
    });
    render(root, state);
  }

  window.TinStructure = { mount };
})();
