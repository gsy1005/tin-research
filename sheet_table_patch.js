/* 数据日报主表展示补丁：仅改变 DOM 展示，不修改任何历史序列或图表。 */
(function () {
  'use strict';

  var DB = Array.isArray(window.DB_DATA) ? window.DB_DATA : [];
  var table = document.getElementById('dtable');
  if (!table || !DB.length) return;

  function series(key) {
    var item = DB.find(function (x) { return x.k === key; });
    return item && Array.isArray(item.s) ? item.s : [];
  }

  function rowByLabel(label) {
    var rows = table.querySelectorAll('tr');
    for (var i = 1; i < rows.length; i++) {
      var cells = rows[i].cells;
      for (var j = 0; j < Math.min(cells.length, 2); j++) {
        if (cells[j].textContent.trim() === label) return rows[i];
      }
    }
    return null;
  }

  function displayDates() {
    var header = table.querySelector('tr');
    if (!header) return [];
    /* 表头只有 MM/DD；以本机当前年份为锚，跨年时按倒序列递减。 */
    var year = new Date().getFullYear();
    var previous = '';
    return Array.prototype.map.call(header.cells, function (cell, index) {
      if (index < 2) return null;
      var match = cell.textContent.match(/(\d{2})\/(\d{2})/);
      if (!match) return null;
      var selected = year + '-' + match[1] + '-' + match[2];
      if (previous && selected > previous) {
        year -= 1;
        selected = year + '-' + match[1] + '-' + match[2];
      }
      previous = selected;
      return selected;
    });
  }

  function valueOnOrBefore(points, date) {
    if (!date) return null;
    for (var i = points.length - 1; i >= 0; i--) {
      if (points[i][0] <= date && typeof points[i][1] === 'number') {
        return { date: points[i][0], value: points[i][1] };
      }
    }
    return null;
  }

  function setText(cell, text) {
    if (cell.textContent !== text) cell.textContent = text;
  }

  function fillRow(row, key, decimals) {
    if (!row) return;
    var points = series(key);
    var dates = displayDates();
    var offset = row.cells.length - (dates.length - 2);
    for (var column = 2; column < dates.length; column++) {
      var cell = row.cells[column - 2 + offset];
      if (!cell) continue;
      var result = valueOnOrBefore(points, dates[column]);
      setText(cell, result ? result.value.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }) : '—');
      cell.classList.toggle('dimv', !!result && result.date !== dates[column]);
      cell.classList.remove('newv');
      cell.classList.remove('neg');
      if (result && result.value < 0) cell.classList.add('neg');
      cell.title = result && result.date !== dates[column] ? '最近历史值：' + result.date : '';
    }
  }

  function apply() {
    var cashRow = rowByLabel('LME锡3M·美元') || rowByLabel('LME Cash-3M·美元/吨');
    if (cashRow) {
      setText(cashRow.cells[1], 'LME Cash-3M·美元/吨');
      cashRow.dataset.seriesKey = 'd737';
      fillRow(cashRow, 'd737', 2);
    }

    var peerRow = rowByLabel('同业成交·吨');
    if (!peerRow) return;
    var indonesiaRow = rowByLabel('印尼交易所成交·吨');
    if (!indonesiaRow) {
      indonesiaRow = peerRow.cloneNode(true);
      indonesiaRow.dataset.tablePatch = 'indonesia';
      peerRow.parentNode.insertBefore(indonesiaRow, peerRow.nextSibling);
    }
    indonesiaRow.dataset.seriesKey = 'd480';
    setText(indonesiaRow.cells[0], '印尼交易所成交·吨');
    indonesiaRow.cells[0].className = 'lb';
    fillRow(indonesiaRow, 'd480', 0);

    var downstreamRow = rowByLabel('下游成交·吨');
    if (downstreamRow && downstreamRow.cells[0].textContent.trim() === '现货成交') {
      downstreamRow.cells[0].rowSpan = 3;
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(function () {
      scheduled = false;
      apply();
      if (window.TIN_SHEET_CUSTOMS_REFRESH) window.TIN_SHEET_CUSTOMS_REFRESH();
    }, 0);
  }

  apply();
  new MutationObserver(schedule).observe(table, { childList: true, subtree: true });
})();
