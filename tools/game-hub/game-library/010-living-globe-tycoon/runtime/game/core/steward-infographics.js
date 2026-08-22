(function (root) {
  'use strict';

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }
  function statusWord(value) { return value === 'RISK' ? 'needs care' : value === 'WATCH' ? 'watch' : value === 'GOOD' ? 'steady' : 'reading'; }
  function words(value) { return String(value || '').replace(/_/g, ' ').toLowerCase(); }
  function money(value) { var n = Number(value) || 0; return (n > 0 ? '+¤' : n < 0 ? '−¤' : '¤') + Math.abs(Math.round(n * 100) / 100); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function sparkline(series, tone) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 34'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Recent strategic-revision trend'); svg.classList.add('axm-metric-spark');
    var values = Array.isArray(series) ? series.filter(function (value) { return Number.isFinite(Number(value)); }).map(Number) : [];
    if (!values.length) values = [0, 0];
    if (values.length === 1) values.unshift(values[0]);
    var min = Math.min.apply(Math, values), max = Math.max.apply(Math, values), spread = Math.max(1, max - min);
    var points = values.map(function (value, index) { return (index / Math.max(1, values.length - 1) * 116 + 2).toFixed(2) + ',' + (30 - ((value - min) / spread) * 26).toFixed(2); }).join(' ');
    var area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    area.setAttribute('points', '2,32 ' + points + ' 118,32'); area.setAttribute('class', 'area ' + String(tone || 'INFO').toLowerCase());
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points); line.setAttribute('class', 'line ' + String(tone || 'INFO').toLowerCase());
    svg.appendChild(area); svg.appendChild(line); return svg;
  }

  function ring(metric) {
    var wrap = element('div', 'axm-metric-ring ' + String(metric.status || 'INFO').toLowerCase());
    wrap.style.setProperty('--axm-ring', Math.max(0, Math.min(100, Number(metric.barValue) || 0)) + '%');
    wrap.title = (metric.explanation || '') + (metric.source ? '\nSource: ' + metric.source : '');
    var core = element('div', 'axm-metric-ring-core'); core.appendChild(element('strong', '', metric.display)); core.appendChild(element('span', '', metric.label));
    wrap.appendChild(core); return wrap;
  }

  function metricRow(metric) {
    var row = element('div', 'axm-metric-row ' + String(metric.status || 'INFO').toLowerCase());
    var copy = element('div', 'axm-metric-row-copy'); copy.appendChild(element('span', '', metric.label));
    var value = element('strong', '', metric.display); copy.appendChild(value);
    if (metric.trend) {
      var trend = element('small', 'axm-trend ' + String(metric.trend.tone || 'INFO').toLowerCase(), metric.trend.display);
      trend.title = 'Compared with the prior recorded strategic revision'; copy.appendChild(trend);
    }
    var bar = element('div', 'axm-mini-bar'); var fill = element('i', ''); fill.style.width = Math.max(0, Math.min(100, Number(metric.barValue) || 0)) + '%'; bar.appendChild(fill);
    row.appendChild(copy); row.appendChild(bar); row.title = (metric.explanation || '') + (metric.source ? '\nSource: ' + metric.source : ''); return row;
  }

  function flowVisual(card) {
    var flow = card.flow || {}, wrap = element('div', 'axm-flow');
    var max = Math.max(1, Number(flow.income) || 0, Number(flow.expenses) || 0);
    [['income', flow.income, 'IN'], ['expenses', flow.expenses, 'OUT']].forEach(function (entry) {
      var line = element('div', 'axm-flow-line ' + entry[0]); line.appendChild(element('span', '', entry[2]));
      var rail = element('div', 'axm-flow-rail'); var fill = element('i', ''); fill.style.width = Math.max(3, Number(entry[1] || 0) / max * 100) + '%'; rail.appendChild(fill); line.appendChild(rail); line.appendChild(element('strong', '', '¤' + (Number(entry[1]) || 0))); wrap.appendChild(line);
    });
    var net = element('div', 'axm-flow-net ' + (flow.net < 0 ? 'risk' : flow.net > 0 ? 'good' : 'info'));
    net.appendChild(element('span', '', 'public net')); net.appendChild(element('strong', '', money(flow.net))); wrap.appendChild(net);
    var sectors = element('div', 'axm-sector-contrib');
    (flow.sectors || []).filter(function (sector) { return sector.id === 'industry' || sector.id === 'entertainment' || sector.id === 'commerce'; }).forEach(function (sector) {
      var chip = element('div', 'axm-sector-chip'); chip.appendChild(element('span', '', sector.label)); chip.appendChild(element('strong', '', 'sales ¤' + sector.grossRevenue)); chip.appendChild(element('small', '', 'to public books ' + money(sector.treasuryContribution))); sectors.appendChild(chip);
    });
    wrap.appendChild(sectors); return wrap;
  }

  function reserveVisual(card) {
    var wrap = element('div', 'axm-reserve-grid');
    (card.publicReserves || []).forEach(function (reserve) {
      var item = element('div', 'axm-reserve ' + String(reserve.status || 'INFO').toLowerCase());
      var head = element('div', ''); head.appendChild(element('span', '', reserve.label)); head.appendChild(element('strong', '', reserve.stock + '/' + reserve.capacity)); item.appendChild(head);
      var rail = element('div', 'axm-reserve-rail'); var fill = element('i', ''); fill.style.width = reserve.ratio + '%'; rail.appendChild(fill); item.appendChild(rail); item.appendChild(element('small', '', reserve.unit)); wrap.appendChild(item);
    });
    return wrap;
  }

  function missionVisual(card) {
    var wrap = element('div', 'axm-mission-graphic'), active = card.active;
    if (!active) { wrap.appendChild(element('div', 'axm-mission-wait', 'PALACE CLIPBOARD RESTING')); return wrap; }
    var human = Number(active.contributions && active.contributions.human) || 0, ai = Number(active.contributions && active.contributions.ai) || 0, goal = Math.max(1, Number(active.goal) || 1);
    var track = element('div', 'axm-contrib-track');
    var h = element('i', 'human'); h.style.width = Math.min(100, human / goal * 100) + '%'; track.appendChild(h);
    var a = element('i', 'ai'); a.style.width = Math.min(100 - human / goal * 100, ai / goal * 100) + '%'; track.appendChild(a); wrap.appendChild(track);
    var legend = element('div', 'axm-contrib-legend'); legend.appendChild(element('span', 'human', 'YOU ' + human)); legend.appendChild(element('span', 'ai', 'AI ' + ai)); legend.appendChild(element('strong', '', 'GOAL ' + goal)); wrap.appendChild(legend); return wrap;
  }

  function detailBlock(card) {
    var details = element('details', 'axm-card-details'); var summary = element('summary', '', 'Because… and what can I do?'); details.appendChild(summary);
    var columns = element('div', 'axm-because-grid');
    var why = element('div', ''); why.appendChild(element('h4', '', 'WHY THIS READING')); var whyList = element('ul', ''); (card.causes || []).forEach(function (line) { var li = element('li', '', line); whyList.appendChild(li); }); why.appendChild(whyList);
    var levers = element('div', ''); levers.appendChild(element('h4', '', 'STEWARD LEVERS')); var leverList = element('ol', ''); (card.levers || []).forEach(function (line) { var li = element('li', '', line); leverList.appendChild(li); }); levers.appendChild(leverList);
    columns.appendChild(why); columns.appendChild(levers); details.appendChild(columns); return details;
  }

  function renderCard(card) {
    var article = element('article', 'axm-infographic-card ' + card.id + ' status-' + String(card.primary.status || 'INFO').toLowerCase());
    article.id = 'axmBriefCard-' + card.id;
    var head = element('header', 'axm-card-head'); var title = element('div', ''); title.appendChild(element('span', 'axm-card-icon', card.icon));
    var wordsWrap = element('div', ''); wordsWrap.appendChild(element('h3', '', card.title)); wordsWrap.appendChild(element('p', '', card.subtitle)); title.appendChild(wordsWrap); head.appendChild(title);
    var badge = element('span', 'axm-status-badge ' + String(card.primary.status || 'INFO').toLowerCase(), statusWord(card.primary.status)); head.appendChild(badge); article.appendChild(head);
    var top = element('div', 'axm-card-primary'); top.appendChild(ring(card.primary));
    var history = element('div', 'axm-history'); history.appendChild(sparkline(card.primary.series, card.primary.status)); history.appendChild(element('small', '', 'RECORDED REVISIONS · ' + ((card.primary.series || []).length || 1))); top.appendChild(history); article.appendChild(top);
    if (card.visual === 'FLOW') article.appendChild(flowVisual(card));
    if (card.visual === 'RESERVES') article.appendChild(reserveVisual(card));
    if (card.visual === 'MISSION') article.appendChild(missionVisual(card));
    var grid = element('div', 'axm-metric-grid'); (card.metrics || []).forEach(function (entry) { grid.appendChild(metricRow(entry)); }); article.appendChild(grid);
    if (card.id === 'supply' && card.bottleneck) article.appendChild(element('div', 'axm-causal-callout', 'BOTTLENECK · ' + card.bottleneck.label + ' · price ¤' + card.bottleneck.price + ' / ref ¤' + card.bottleneck.referencePrice));
    if (card.id === 'people' && card.weakestFaction) article.appendChild(element('div', 'axm-causal-callout', card.weakestFaction.label.toUpperCase() + ' · “' + card.weakestFaction.request + '”'));
    article.appendChild(detailBlock(card)); return article;
  }

  function renderSignals(container, report) {
    clear(container);
    if (!report.signals || !report.signals.length) {
      var clearSignal = element('div', 'axm-signal good'); clearSignal.appendChild(element('span', '', '☀')); var copy = element('div', ''); copy.appendChild(element('strong', '', 'No threshold warning')); copy.appendChild(element('small', '', 'The cabinet has found nothing urgent. It remains emotionally prepared.')); clearSignal.appendChild(copy); container.appendChild(clearSignal); return;
    }
    report.signals.forEach(function (signal) {
      var item = element('div', 'axm-signal ' + String(signal.severity || 'INFO').toLowerCase()); item.appendChild(element('span', '', signal.severity === 'RISK' ? '!' : '•'));
      var copy = element('div', ''); copy.appendChild(element('strong', '', signal.headline)); copy.appendChild(element('small', '', signal.because)); copy.appendChild(element('em', '', 'TRY · ' + signal.lever)); item.appendChild(copy); container.appendChild(item);
    });
  }

  function renderBriefQuick(container, report) {
    clear(container);
    (report.quick || []).forEach(function (metric) {
      var button = element('button', 'axm-brief-quick-cell ' + String(metric.status || 'INFO').toLowerCase()); button.type = 'button';
      button.appendChild(element('span', '', metric.icon + ' ' + metric.label)); button.appendChild(element('strong', '', metric.value));
      var rail = element('div', 'axm-brief-quick-rail'); var fill = element('i', ''); fill.style.width = Math.max(0, Math.min(100, Number(metric.barValue) || 0)) + '%'; rail.appendChild(fill); button.appendChild(rail);
      button.addEventListener('click', function () { var target = document.getElementById('axmBriefCard-' + metric.id); if (target) target.scrollIntoView({ behavior: root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
      container.appendChild(button);
    });
  }

  function renderQuickStrip(container, report) {
    if (!container) return;
    clear(container); container.setAttribute('aria-label', 'AI steward shared island metrics');
    if (!report || !Array.isArray(report.quick)) { container.appendChild(element('span', 'axm-ai-metric-empty', 'island brief unavailable')); return; }
    report.quick.forEach(function (metric) {
      var cell = element('div', 'axm-ai-metric ' + String(metric.status || 'INFO').toLowerCase());
      var top = element('div', ''); top.appendChild(element('span', '', metric.icon + ' ' + metric.label)); top.appendChild(element('strong', '', metric.value)); cell.appendChild(top);
      var rail = element('div', 'axm-ai-metric-rail'); var fill = element('i', ''); fill.style.width = Math.max(0, Math.min(100, Number(metric.barValue) || 0)) + '%'; rail.appendChild(fill); cell.appendChild(rail); container.appendChild(cell);
    });
  }

  function mount(options) {
    var provider = options && options.provider;
    if (typeof provider !== 'function') throw new TypeError('steward metric provider required');
    var toggle = element('button', '', 'Brief'); toggle.id = 'axmMetricsToggle'; toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'axmMetricsPanel'); toggle.title = 'Open the shared Island Brief';
    var panel = element('aside', 'axm-metrics-panel'); panel.id = 'axmMetricsPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-hidden', 'true'); panel.setAttribute('aria-label', 'Shared Island Brief');
    panel.innerHTML = '<header class="axm-metrics-head"><div><div class="axm-brief-kicker">SHARED HUMAN + AI ISLAND BRIEF</div><h2>THE ISLAND, WITHOUT THE PALACE SPIN</h2><p id="axmBriefStamp"></p></div><button class="axm-metrics-close" type="button" aria-label="Close Island Brief">close</button></header><div class="axm-no-score"><b>NO OVERALL ISLAND SCORE</b><span>Ecology, people, public books, supply and missions stay separate so one success cannot hide another problem.</span></div><section><h3 class="axm-brief-label">FIVE AT A GLANCE · TAP TO INSPECT</h3><div class="axm-brief-quick" id="axmMetricQuick"></div></section><section><h3 class="axm-brief-label">WHAT NEEDS YOUR EYES</h3><div class="axm-signal-grid" id="axmMetricSignals"></div></section><section><h3 class="axm-brief-label">FIVE DIFFERENT TRUTHS</h3><div class="axm-infographic-grid" id="axmMetricCards"></div></section><footer class="axm-metrics-foot"><span>Every line comes from current strategic, mission or declared player-seat state.</span><span>Reading this screen advances nothing.</span></footer>';
    document.body.appendChild(toggle); document.body.appendChild(panel);
    var cards = panel.querySelector('#axmMetricCards'), signals = panel.querySelector('#axmMetricSignals'), quick = panel.querySelector('#axmMetricQuick'), stamp = panel.querySelector('#axmBriefStamp');
    var lastReport = null;

    function render() {
      var report = provider();
      if (!report || !Array.isArray(report.cards)) return null;
      lastReport = report; clear(cards);
      stamp.textContent = 'YEAR ' + (report.calendar.year || 1) + ' · Q' + (report.calendar.quarter || 1) + ' · ' + words(report.calendar.season || '') + ' · REV ' + report.sourceRevision;
      renderBriefQuick(quick, report); renderSignals(signals, report); report.cards.forEach(function (entry) { cards.appendChild(renderCard(entry)); }); return report;
    }
    function open() {
      render(); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); document.body.classList.add('axm-brief-open'); toggle.setAttribute('aria-expanded', 'true');
      try { root.dispatchEvent(new CustomEvent('axm-infographics-open')); } catch (error) {}
      panel.querySelector('.axm-metrics-close').focus();
    }
    function close(focusToggle) {
      panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); document.body.classList.remove('axm-brief-open'); toggle.setAttribute('aria-expanded', 'false'); if (focusToggle) toggle.focus();
    }
    toggle.addEventListener('click', function (event) { event.stopPropagation(); if (panel.classList.contains('open')) close(true); else open(); });
    panel.querySelector('.axm-metrics-close').addEventListener('click', function () { close(true); });
    ['pointerdown','pointerup','click','wheel','touchstart'].forEach(function (name) { panel.addEventListener(name, function (event) { event.stopPropagation(); }, { passive: name === 'wheel' || name === 'touchstart' }); });
    root.addEventListener('keydown', function (event) { if (event.key === 'Escape' && panel.classList.contains('open')) { event.preventDefault(); close(true); } });
    root.addEventListener('axm-palace-open', function () { close(false); });
    return { refresh: function () { return panel.classList.contains('open') ? render() : lastReport; }, open: open, close: function () { close(false); }, isOpen: function () { return panel.classList.contains('open'); }, observeRenderedReport: function () { return lastReport ? JSON.parse(JSON.stringify(lastReport)) : null; } };
  }

  root.AXMStewardInfographics = { mount: mount, renderQuickStrip: renderQuickStrip };
})(typeof globalThis !== 'undefined' ? globalThis : this);
