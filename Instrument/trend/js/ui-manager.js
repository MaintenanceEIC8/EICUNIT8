/**
 * ==========================================================================
 * UI MANAGER
 * ==========================================================================
 * Menghubungkan DOM (index.html) dengan modul-modul lain. Tidak ada logic
 * data di sini — murni render + event wiring.
 *
 * MODE OVERLAY: tag yang DICENTANG (checkbox, bukan "diklik") tampil
 * bersama dalam 1 grafik combined (lihat chart-manager.js). Panel kanan
 * ("VALUES") menampilkan nilai tiap series tag yang dicentang, dan nilainya
 * ikut berubah mengikuti posisi cursor di grafik (seperti trend recorder
 * DCS/CEMS asli) — kembali ke nilai TERKINI saat cursor keluar area chart.
 * ==========================================================================
 */
(function () {
  'use strict';

  var els = {}; // cache DOM elements
  var tagIdFilter = null; // null = tampilkan semua tag; array = batasi tag list ke tag modul aktif

  function cacheEls() {
    els.clock = document.getElementById('clockValue');
    els.tagListBody = document.getElementById('tagListBody');
    els.tagSearch = document.getElementById('tagSearch');
    els.valuesBody = document.getElementById('valuesPanelBody');
    els.chartContainer = document.getElementById('trendChart');
    els.quickRangeBar = document.getElementById('quickRangeBar');
    els.startDate = document.getElementById('startDate');
    els.startTime = document.getElementById('startTime');
    els.endDate = document.getElementById('endDate');
    els.endTime = document.getElementById('endTime');
    els.loadDataBtn = document.getElementById('loadDataBtn');
    els.modeLiveBtn = document.getElementById('modeLiveBtn');
    els.modeHistBtn = document.getElementById('modeHistBtn');
    els.liveNotice = document.getElementById('liveModeNotice');
    els.historicalPanel = document.getElementById('historicalPanel');
    els.statusBar = document.getElementById('statusBar');
    els.chartTitle = document.getElementById('chartTitle');
    els.autoScaleBtn = document.getElementById('autoScaleBtn');
    els.clearPinsBtn = document.getElementById('clearPinsBtn');
    els.exportCsvBtn = document.getElementById('exportCsvBtn');
    els.exportJsonBtn = document.getElementById('exportJsonBtn');
    els.exportImgBtn = document.getElementById('exportImgBtn');
    els.loadingIndicator = document.getElementById('loadingIndicator');
    els.cursorReadout = document.getElementById('cursorReadout');
  }

  /* ------------------------------------------------------------------ */
  function tickClock() {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    if (els.clock) {
      els.clock.textContent = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
  }

  /* ------------------------------------------------------------------ */
  function renderTagList(filterText) {
    if (!els.tagListBody) return;
    var tags = window.TagManager.getAllTags();
    if (tagIdFilter) {
      tags = tags.filter(function (t) { return tagIdFilter.indexOf(t.id) >= 0; });
    }
    if (filterText) {
      var f = filterText.toLowerCase();
      tags = tags.filter(function (t) {
        return t.id.toLowerCase().indexOf(f) >= 0 || t.name.toLowerCase().indexOf(f) >= 0;
      });
    }
    els.tagListBody.innerHTML = '';
    if (!tags.length) {
      els.tagListBody.innerHTML = '<div class="tag-empty">Tidak ada tag.</div>';
      return;
    }
    tags.forEach(function (tag) {
      var row = document.createElement('div');
      row.className = 'tag-row' + (tag.visible ? ' tag-row-active' : '');
      row.dataset.tagId = tag.id;
      // Aksen kiri = warna series pertama tag ini, biar TAG LIST langsung
      // konsisten secara visual dengan warna garisnya sendiri di grafik.
      if (tag.series && tag.series[0] && tag.series[0].color) {
        row.style.setProperty('--tag-accent', tag.series[0].color);
      }
      row.innerHTML =
        '<div class="tag-row-top">' +
          '<input type="checkbox" class="tag-visible-cb" ' + (tag.visible ? 'checked' : '') + '>' +
          '<span class="tag-id">' + tag.id + '</span>' +
        '</div>' +
        '<div class="tag-name">' + tag.name + '</div>' +
        '<div class="tag-meta"><span class="tag-source">' + (tag.source || '') + '</span></div>';

      row.querySelector('.tag-visible-cb').addEventListener('change', function (e) {
        e.stopPropagation();
        onTagVisibilityToggle(tag.id, e.target.checked);
      });
      // Klik baris (di luar checkbox) = toggle juga, biar konsisten & gampang di tablet
      row.addEventListener('click', function (e) {
        if (e.target.classList.contains('tag-visible-cb')) return;
        var cb = row.querySelector('.tag-visible-cb');
        cb.checked = !cb.checked;
        onTagVisibilityToggle(tag.id, cb.checked);
      });
      els.tagListBody.appendChild(row);
    });
  }

  function onTagVisibilityToggle(tagId, visible) {
    window.DCSTrend.setTagVisibility(tagId, visible);
    renderTagList(els.tagSearch ? els.tagSearch.value : '');
    renderCombinedChart();
    updateStatusBar();
  }

  /* ------------------------------------------------------------------
   * COMBINED CHART + VALUES PANEL
   * ------------------------------------------------------------------ */
  function getVisibleTags() {
    return window.TagManager.getAllTags().filter(function (t) { return t.visible; });
  }

  function renderCombinedChart() {
    var visibleTags = getVisibleTags();
    var state = window.HistoricalManager.getState();
    window.ChartManager.renderCombined(visibleTags, state.lastLoadedSeries || {});

    if (els.chartTitle) {
      els.chartTitle.textContent = visibleTags.length
        ? 'TREND GRAPH — ' + visibleTags.length + ' TAG AKTIF'
        : 'TREND GRAPH';
    }

    renderValuesPanel(window.ChartManager.getLatestValues(), false);
  }

  /**
   * @param {Array} values - [{name,color,unit,tagId,value,pointTime}]
   * @param {Boolean} isCursorMode - true kalau nilai ini hasil hover cursor (bukan nilai terkini)
   */
  function renderValuesPanel(values, isCursorMode) {
    if (!els.valuesBody) return;
    if (!values.length) {
      els.valuesBody.innerHTML = '<div class="details-empty">Centang tag di panel kiri untuk menampilkan nilai.</div>';
      return;
    }
    els.valuesBody.innerHTML = '';
    values.forEach(function (v) {
      var row = document.createElement('div');
      row.className = 'value-row';
      // Aksen kiri = warna series ini sendiri (sama seperti garis di grafik).
      row.style.borderLeft = '3px solid ' + v.color;
      var displayVal = (v.value === null || v.value === undefined) ? '—' : formatNum(v.value);
      row.innerHTML =
        '<span class="value-label" style="color:' + v.color + '">' + v.name + '</span>' +
        '<span class="value-num">' + displayVal + ' <span class="value-unit">' + (v.unit || '') + '</span></span>';
      els.valuesBody.appendChild(row);
    });

    if (els.cursorReadout) {
      els.cursorReadout.style.display = isCursorMode ? 'block' : 'none';
      if (isCursorMode && values.length && values[0].pointTime) {
        els.cursorReadout.textContent = 'CURSOR TIME: ' + formatDateTime(values[0].pointTime);
      }
    }
  }

  function formatNum(n) {
    if (typeof n !== 'number') return n;
    return (Math.round(n * 100) / 100).toString();
  }

  function formatDateTime(t) {
    var d = new Date(t);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /* ------------------------------------------------------------------ */
  function renderQuickRangeBar() {
    if (!els.quickRangeBar) return;
    els.quickRangeBar.innerHTML = '';
    window.DCS_CONFIG.QUICK_RANGES.forEach(function (r) {
      var btn = document.createElement('button');
      btn.className = 'range-btn' + (r.key === window.DCS_CONFIG.DEFAULT_QUICK_RANGE ? ' range-btn-active' : '');
      btn.textContent = r.label;
      btn.dataset.rangeKey = r.key;
      btn.addEventListener('click', function () { onQuickRangeClick(r.key, btn); });
      els.quickRangeBar.appendChild(btn);
    });
  }

  function onQuickRangeClick(key, btnEl) {
    Array.prototype.forEach.call(els.quickRangeBar.children, function (b) { b.classList.remove('range-btn-active'); });
    btnEl.classList.add('range-btn-active');
    if (key === 'CUSTOM') {
      if (els.historicalPanel) els.historicalPanel.classList.add('custom-range-open');
      return;
    }
    if (els.historicalPanel) els.historicalPanel.classList.remove('custom-range-open');
    window.HistoricalManager.setQuickRange(key);
    triggerLoad();
  }

  function onLoadDataClick() {
    var activeBtn = els.quickRangeBar ? els.quickRangeBar.querySelector('.range-btn-active') : null;
    if (activeBtn && activeBtn.dataset.rangeKey === 'CUSTOM') {
      var start = new Date((els.startDate.value || '') + 'T' + (els.startTime.value || '00:00')).getTime();
      var end = new Date((els.endDate.value || '') + 'T' + (els.endTime.value || '23:59')).getTime();
      var res = window.HistoricalManager.setCustomRange(start, end);
      if (!res.ok) { alert('Rentang waktu tidak valid. Periksa tanggal/jam Start dan End.'); return; }
    }
    triggerLoad();
  }

  function triggerLoad() {
    setLoading(true);
    window.HistoricalManager.loadData(function () {
      setLoading(false);
      updateStatusBar();
      renderCombinedChart();
    }, function (err) {
      setLoading(false);
      alert('Gagal memuat data historical: ' + err.message);
    });
  }

  function setLoading(isLoading) {
    if (els.loadDataBtn) { els.loadDataBtn.disabled = isLoading; els.loadDataBtn.textContent = isLoading ? 'MEMUAT...' : 'LOAD DATA'; }
    if (els.loadingIndicator) els.loadingIndicator.style.display = isLoading ? 'inline' : 'none';
  }

  /* ------------------------------------------------------------------ */
  function updateStatusBar() {
    if (!els.statusBar) return;
    var tags = window.TagManager.getAllTags();
    var activeTrends = tags.filter(function (t) { return t.visible; }).length;
    var state = window.HistoricalManager.getState();
    var totalRecords = Object.keys(state.lastLoadedSeries || {}).reduce(function (sum, tagId) {
      var s = state.lastLoadedSeries[tagId];
      return sum + Object.keys(s).reduce(function (s2, k) { return s2 + s[k].length; }, 0);
    }, 0);
    els.statusBar.innerHTML =
      '<span>SYSTEM: RUNNING</span>' +
      '<span>MODE: HISTORICAL</span>' +
      '<span>DATA SOURCE: FIRESTORE (pm_records, read-only)</span>' +
      '<span class="status-conn">CONNECTION: <span class="dot dot-ok"></span> READY</span>' +
      '<span>TOTAL TAGS: ' + tags.length + '</span>' +
      '<span>ACTIVE TRENDS: ' + activeTrends + '</span>' +
      '<span>RECORDS: ' + totalRecords.toLocaleString('id-ID') + '</span>';
  }

  /* ------------------------------------------------------------------ */
  function onModeClick(mode) {
    if (mode === 'live') {
      els.modeLiveBtn.classList.add('mode-btn-active');
      els.modeHistBtn.classList.remove('mode-btn-active');
      if (els.liveNotice) els.liveNotice.style.display = 'block';
      if (els.historicalPanel) els.historicalPanel.style.display = 'none';
    } else {
      els.modeHistBtn.classList.add('mode-btn-active');
      els.modeLiveBtn.classList.remove('mode-btn-active');
      if (els.liveNotice) els.liveNotice.style.display = 'none';
      if (els.historicalPanel) els.historicalPanel.style.display = 'flex';
    }
  }

  function exportVisible(format) {
    var visibleTags = getVisibleTags();
    if (!visibleTags.length) { alert('Centang minimal 1 tag dulu.'); return; }
    window.ExportManager.exportTags(visibleTags.map(function (t) { return t.id; }), format);
  }

  function bindEvents() {
    if (els.tagSearch) els.tagSearch.addEventListener('input', function (e) { renderTagList(e.target.value); });
    if (els.loadDataBtn) els.loadDataBtn.addEventListener('click', onLoadDataClick);
    if (els.modeLiveBtn) els.modeLiveBtn.addEventListener('click', function () { onModeClick('live'); });
    if (els.modeHistBtn) els.modeHistBtn.addEventListener('click', function () { onModeClick('historical'); });
    if (els.autoScaleBtn) els.autoScaleBtn.addEventListener('click', function () { window.ChartManager.autoScale(); });
    if (els.clearPinsBtn) els.clearPinsBtn.addEventListener('click', function () { window.ChartManager.clearPins(); });
    if (els.exportCsvBtn) els.exportCsvBtn.addEventListener('click', function () { exportVisible('csv'); });
    if (els.exportJsonBtn) els.exportJsonBtn.addEventListener('click', function () { exportVisible('json'); });
    if (els.exportImgBtn) els.exportImgBtn.addEventListener('click', function () { window.ChartManager.exportImage('dcs_trend'); });

    window.addEventListener('dcsTagListChanged', function () {
      renderTagList(els.tagSearch ? els.tagSearch.value : '');
      renderCombinedChart();
    });

    // Legend nilai hidup: ikut posisi cursor di grafik, balik ke nilai terkini saat cursor keluar
    window.ChartManager.onCursorMove(function (time, values) { renderValuesPanel(values, true); });
    window.ChartManager.onCursorLeave(function () { renderValuesPanel(window.ChartManager.getLatestValues(), false); });
  }

  function init() {
    cacheEls();
    bindEvents();
    tickClock();
    setInterval(tickClock, 1000);
    renderQuickRangeBar();
    renderTagList();
    updateStatusBar();
    onModeClick('historical'); // default mode sesuai arahan
    renderCombinedChart();
  }

  window.UIManager = {
    init: init,
    renderTagList: renderTagList,
    updateStatusBar: updateStatusBar,
    triggerLoad: triggerLoad,
    renderCombinedChart: renderCombinedChart,
    // --- API tambahan untuk ModuleView (js/module-view.js) ---
    // Batasi tag list panel kiri ke tag milik modul aktif saja (visual/UI list
    // filter). TIDAK mengubah state `visible` tag mana pun — logic mana yang
    // nyala/mati saat pindah tab modul ada di module-view.js (perlu "ingat"
    // pilihan tiap modul, bukan cuma filter tampilan).
    filterTagsByIds: function (ids) { tagIdFilter = ids || null; renderTagList(els.tagSearch ? els.tagSearch.value : ''); },
    getVisibleTagIds: function () { return getVisibleTags().map(function (t) { return t.id; }); }
  };
})();
