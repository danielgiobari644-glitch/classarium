/**
 * Classarium Analytics Module
 * Analytics dashboard with tabbed views (Academic Performance, Attendance, Discipline, Enrollment).
 * Uses placeholder chart areas. Filter bar with session/term/class selectors.
 */
(function () {
  'use strict';

  window.Modules = window.Modules || {};

  var Utils = window.Utils;
  var Toast = window.Toast;
  var DataService = window.DataService;
  var SidebarComponent = window.SidebarComponent;
  var HeaderComponent = window.HeaderComponent;

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _activeTab = 'academic';
  var _filters = {
    session: '',
    term: '',
    classId: ''
  };
  var _sessions = [];
  var _terms = [];
  var _classes = [];

  /* ------------------------------------------------------------------ */
  /*  Tab Configuration                                                  */
  /* ------------------------------------------------------------------ */

  var TABS = [
    { id: 'academic', label: 'Academic Performance', icon: '📈' },
    { id: 'attendance', label: 'Attendance', icon: '📊' },
    { id: 'discipline', label: 'Discipline', icon: '⚖️' },
    { id: 'enrollment', label: 'Enrollment', icon: '👥' }
  ];

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function statCard(icon, iconBg, value, label, change, changeType) {
    var changeHtml = '';
    if (change) {
      var cls = changeType === 'up' ? 'text-success' : changeType === 'down' ? 'text-danger' : 'text-muted';
      changeHtml = '<div class="stat-card-change ' + cls + '">' + change + '</div>';
    }
    return '<div class="stat-card">'
      + '<div class="stat-card-icon" style="background:' + iconBg + '">' + icon + '</div>'
      + '<div class="stat-card-value">' + value + '</div>'
      + '<div class="stat-card-label">' + label + '</div>'
      + changeHtml
      + '</div>';
  }

  function card(id, title, actions, bodyHtml) {
    var actionsHtml = actions ? '<div class="card-header-actions">' + actions + '</div>' : '';
    return '<div class="card" ' + (id ? 'id="' + id + '"' : '') + '>'
      + '<div class="card-header"><h3 class="card-title">' + title + '</h3>' + actionsHtml + '</div>'
      + '<div class="card-body">' + (bodyHtml || '') + '</div>'
      + '</div>';
  }

  function chartPlaceholder(title, height) {
    var h = height || 300;
    return '<div class="analytics-chart-placeholder" style="height:' + h + 'px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--gray-50);border:2px dashed var(--gray-200);border-radius:8px;color:var(--gray-400);gap:8px">'
      + '<span style="font-size:32px">📊</span>'
      + '<span style="font-size:14px;font-weight:500">' + (title || 'Chart Area') + '</span>'
      + '<span style="font-size:12px;color:var(--gray-300)">Chart visualization will be rendered here</span>'
      + '</div>';
  }

  function tabHtml(activeTab) {
    return '<div class="analytics-tabs" style="display:flex;gap:4px;background:var(--gray-100);padding:4px;border-radius:8px;margin-bottom:20px">'
      + TABS.map(function (tab) {
        var isActive = tab.id === activeTab;
        return '<button class="btn analytics-tab-btn' + (isActive ? ' btn-primary' : ' btn-ghost') + '" data-tab="' + tab.id + '" style="flex:1;white-space:nowrap">'
          + '<span style="margin-right:6px">' + tab.icon + '</span>' + tab.label
          + '</button>';
      }).join('')
      + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Academic Performance Tab                                           */
  /* ------------------------------------------------------------------ */

  function academicContent() {
    var html = '';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">📈</div><div class="stat-card-value">--</div><div class="stat-card-label">Average Score</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">🏆</div><div class="stat-card-value">--</div><div class="stat-card-label">Highest Score</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">📉</div><div class="stat-card-value">--</div><div class="stat-card-label">Lowest Score</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">🎯</div><div class="stat-card-value">--</div><div class="stat-card-label">Pass Rate</div></div>'
      + '</div>';

    html += '<div class="dashboard-grid grid-2">';

    // Subject Performance Chart
    html += card('academic-subject-chart', 'Subject Performance', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Subject Performance Comparison')
    );

    // Grade Distribution Chart
    html += card('academic-grade-chart', 'Grade Distribution', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Grade Distribution (A, B, C, D, E, F)')
    );

    html += '</div>';

    // Class comparison chart
    html += card('academic-class-comparison', 'Class Performance Comparison', '',
      chartPlaceholder('Class-by-Class Average Performance', 350)
    );

    // Subject breakdown table
    html += card('academic-subject-table', 'Subject Breakdown', '<button class="btn btn-ghost btn-sm" data-action="export-academic">Export</button>',
      '<div class="data-table-wrapper"><table class="data-table">'
      + '<thead><tr><th>Subject</th><th>Avg Score</th><th>Highest</th><th>Lowest</th><th>Pass Rate</th><th>Total Students</th></tr></thead>'
      + '<tbody id="academic-subject-tbody">'
      + '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-400)">Loading subject data...</td></tr>'
      + '</tbody>'
      + '</table></div>'
    );

    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Attendance Tab                                                     */
  /* ------------------------------------------------------------------ */

  function attendanceContent() {
    var html = '';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Overall Attendance</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">📅</div><div class="stat-card-value">--</div><div class="stat-card-label">School Days</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">❌</div><div class="stat-card-value">--</div><div class="stat-card-label">Absent Days</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">⏰</div><div class="stat-card-value">--</div><div class="stat-card-label">Late Arrivals</div></div>'
      + '</div>';

    html += '<div class="dashboard-grid grid-2">';

    // Attendance Trend Chart
    html += card('attendance-trend-chart', 'Attendance Trend', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Daily/Weekly Attendance Trend')
    );

    // Class Attendance Comparison
    html += card('attendance-class-chart', 'Attendance by Class', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Class Attendance Comparison')
    );

    html += '</div>';

    // Students with low attendance
    html += card('attendance-low', 'Students with Low Attendance (< 75%)', '',
      '<div class="data-table-wrapper"><table class="data-table">'
      + '<thead><tr><th>Student</th><th>Class</th><th>Days Present</th><th>Total Days</th><th>Rate</th></tr></thead>'
      + '<tbody id="attendance-low-tbody">'
      + '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--gray-400)">Loading...</td></tr>'
      + '</tbody>'
      + '</table></div>'
    );

    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Discipline Tab                                                     */
  /* ------------------------------------------------------------------ */

  function disciplineContent() {
    var html = '';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">⚠️</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Incidents</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">📋</div><div class="stat-card-value">--</div><div class="stat-card-label">Open Cases</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Resolved</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">⏳</div><div class="stat-card-value">--</div><div class="stat-card-label">Pending Review</div></div>'
      + '</div>';

    html += '<div class="dashboard-grid grid-2">';

    // Incident Types Chart
    html += card('discipline-types-chart', 'Incidents by Type', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Incident Type Distribution (Pie/Donut)')
    );

    // Incidents Over Time Chart
    html += card('discipline-trend-chart', 'Incidents Over Time', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Incidents Trend Over Time (Line)')
    );

    html += '</div>';

    // Incidents by class
    html += card('discipline-class-chart', 'Incidents by Class', '',
      chartPlaceholder('Incidents Heatmap by Class', 280)
    );

    // Recent incidents table
    html += card('discipline-recent', 'Recent Incidents', '<button class="btn btn-ghost btn-sm">View All</button>',
      '<div class="data-table-wrapper"><table class="data-table">'
      + '<thead><tr><th>Student</th><th>Class</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>'
      + '<tbody id="discipline-recent-tbody">'
      + '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--gray-400)">Loading...</td></tr>'
      + '</tbody>'
      + '</table></div>'
    );

    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Enrollment Tab                                                     */
  /* ------------------------------------------------------------------ */

  function enrollmentContent() {
    var html = '';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">👥</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Enrolled</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">📈</div><div class="stat-card-value">--</div><div class="stat-card-label">New This Term</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">📉</div><div class="stat-card-value">--</div><div class="stat-card-label">Withdrawn</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">🔄</div><div class="stat-card-value">--</div><div class="stat-card-label">Transfer In/Out</div></div>'
      + '</div>';

    html += '<div class="dashboard-grid grid-2">';

    // Enrollment by Class Chart
    html += card('enrollment-class-chart', 'Enrollment by Class', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Student Count by Class (Bar)')
    );

    // Enrollment by Gender Chart
    html += card('enrollment-gender-chart', 'Gender Distribution', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Enrollment by Gender (Donut)')
    );

    html += '</div>';

    // Enrollment Trend
    html += card('enrollment-trend-chart', 'Enrollment Trend', '<button class="btn btn-ghost btn-sm">Fullscreen</button>',
      chartPlaceholder('Enrollment Trend Over Time (Area)', 300)
    );

    // Class capacity table
    html += card('enrollment-capacity', 'Class Capacity Overview', '<button class="btn btn-ghost btn-sm" data-action="export-enrollment">Export</button>',
      '<div class="data-table-wrapper"><table class="data-table">'
      + '<thead><tr><th>Class</th><th>Enrolled</th><th>Capacity</th><th>Utilization</th><th>Male</th><th>Female</th></tr></thead>'
      + '<tbody id="enrollment-capacity-tbody">'
      + '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-400)">Loading...</td></tr>'
      + '</tbody>'
      + '</table></div>'
    );

    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Tab Content Router                                                 */
  /* ------------------------------------------------------------------ */

  function getTabContent(tabId) {
    switch (tabId) {
      case 'academic': return academicContent();
      case 'attendance': return attendanceContent();
      case 'discipline': return disciplineContent();
      case 'enrollment': return enrollmentContent();
      default: return academicContent();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Main Render                                                        */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="analytics-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Analytics</h1>'
      + '<p class="page-header-description">Comprehensive school performance data and insights</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-ghost btn-sm" data-action="export-report">Export Report</button>'
      + '<button class="btn btn-primary btn-sm" data-action="print-report">Print</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Filter bar
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-body">'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'
      + '<div style="min-width:180px">'
      + '<label style="display:block;font-size:12px;font-weight:500;color:var(--gray-600);margin-bottom:4px">Session</label>'
      + '<select id="analytics-filter-session" class="form-select" style="width:100%">'
      + '<option value="">Select Session</option>'
      + '</select>'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<label style="display:block;font-size:12px;font-weight:500;color:var(--gray-600);margin-bottom:4px">Term</label>'
      + '<select id="analytics-filter-term" class="form-select" style="width:100%">'
      + '<option value="">Select Term</option>'
      + '</select>'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<label style="display:block;font-size:12px;font-weight:500;color:var(--gray-600);margin-bottom:4px">Class</label>'
      + '<select id="analytics-filter-class" class="form-select" style="width:100%">'
      + '<option value="">All Classes</option>'
      + '</select>'
      + '</div>'
      + '<div style="align-self:flex-end">'
      + '<button class="btn btn-primary btn-sm" data-action="apply-filters">Apply Filters</button>'
      + '</div>'
      + '<div style="align-self:flex-end">'
      + '<button class="btn btn-ghost btn-sm" data-action="clear-filters">Clear</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Tabs
    html += tabHtml(_activeTab);

    // Tab content area
    html += '<div id="analytics-tab-content">'
      + getTabContent(_activeTab)
      + '</div>';

    html += '</div>'; // analytics-page
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Bind Events                                                       */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    // Click delegation for tabs and actions
    document.addEventListener('click', _clickHandler);
  }

  function _clickHandler(e) {
    // Tab switching
    var tabBtn = e.target.closest('.analytics-tab-btn');
    if (tabBtn) {
      e.preventDefault();
      var tabId = tabBtn.dataset.tab;
      if (tabId && tabId !== _activeTab) {
        _activeTab = tabId;
        _refreshTabs();
        _refreshContent();
      }
      return;
    }

    // Actions
    var actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    var action = actionBtn.dataset.action;
    switch (action) {
      case 'apply-filters':
        e.preventDefault();
        _applyFilters();
        break;
      case 'clear-filters':
        e.preventDefault();
        _clearFilters();
        break;
      case 'export-report':
        e.preventDefault();
        Toast.info('Preparing analytics report for export...');
        Utils.exportCSV([], 'analytics-report-' + _activeTab);
        Toast.success('Report exported');
        break;
      case 'print-report':
        e.preventDefault();
        window.print();
        break;
      case 'export-academic':
        e.preventDefault();
        Toast.info('Exporting academic data...');
        Utils.exportCSV([], 'academic-report');
        Toast.success('Academic data exported');
        break;
      case 'export-enrollment':
        e.preventDefault();
        Toast.info('Exporting enrollment data...');
        Utils.exportCSV([], 'enrollment-report');
        Toast.success('Enrollment data exported');
        break;
    }
  }

  function _refreshTabs() {
    var tabContainer = document.querySelector('.analytics-tabs');
    if (!tabContainer) return;
    tabContainer.innerHTML = TABS.map(function (tab) {
      var isActive = tab.id === _activeTab;
      return '<button class="btn analytics-tab-btn' + (isActive ? ' btn-primary' : ' btn-ghost') + '" data-tab="' + tab.id + '" style="flex:1;white-space:nowrap">'
        + '<span style="margin-right:6px">' + tab.icon + '</span>' + tab.label
        + '</button>';
    }).join('');
  }

  function _refreshContent() {
    var container = document.getElementById('analytics-tab-content');
    if (container) {
      container.innerHTML = getTabContent(_activeTab);
    }
  }

  function _applyFilters() {
    var sessionEl = document.getElementById('analytics-filter-session');
    var termEl = document.getElementById('analytics-filter-term');
    var classEl = document.getElementById('analytics-filter-class');

    _filters.session = sessionEl ? sessionEl.value : '';
    _filters.term = termEl ? termEl.value : '';
    _filters.classId = classEl ? classEl.value : '';

    Toast.info('Applying filters...');
    _refreshContent();
    // In a real implementation, data would reload with the new filters
    setTimeout(function () {
      Toast.success('Analytics updated with selected filters');
    }, 300);
  }

  function _clearFilters() {
    _filters = { session: '', term: '', classId: '' };

    var sessionEl = document.getElementById('analytics-filter-session');
    var termEl = document.getElementById('analytics-filter-term');
    var classEl = document.getElementById('analytics-filter-class');
    if (sessionEl) sessionEl.value = '';
    if (termEl) termEl.value = '';
    if (classEl) classEl.value = '';

    Toast.info('Filters cleared');
    _refreshContent();
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadFilterOptions() {
    // Load sessions
    DataService.getBySchool('sessions', 20).then(function (sessions) {
      var select = document.getElementById('analytics-filter-session');
      if (!select) return;
      _sessions = sessions || [];
      _sessions.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.id || s.name || '';
        opt.textContent = s.name || s.id || 'Session';
        if (s.isCurrent) opt.selected = true;
        select.appendChild(opt);
      });
    }).catch(function () { });

    // Load terms
    DataService.getBySchool('terms', 10).then(function (terms) {
      var select = document.getElementById('analytics-filter-term');
      if (!select) return;
      _terms = terms || [];
      _terms.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t.id || t.name || '';
        opt.textContent = t.name || t.id || 'Term';
        if (t.isCurrent) opt.selected = true;
        select.appendChild(opt);
      });
    }).catch(function () { });

    // Load classes
    DataService.getBySchool('classes', 50).then(function (classes) {
      var select = document.getElementById('analytics-filter-class');
      if (!select) return;
      _classes = classes || [];
      _classes.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id || '';
        opt.textContent = c.name || 'Class';
        select.appendChild(opt);
      });
    }).catch(function () { });
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.analytics = {
    render: function () {
      // Reset tab to academic on fresh render
      _activeTab = 'academic';

      // Update sidebar and breadcrumb
      if (window.SidebarComponent) window.SidebarComponent.setActive('analytics');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'Analytics' }
      ]);

      return render();
    },

    bind: function () {
      setTimeout(function () {
        bindEvents();
        loadFilterOptions();
      }, 0);
    },

    destroy: function () {
      document.removeEventListener('click', _clickHandler);
      _activeTab = 'academic';
      _filters = { session: '', term: '', classId: '' };
      _sessions = [];
      _terms = [];
      _classes = [];
    }
  };
})();