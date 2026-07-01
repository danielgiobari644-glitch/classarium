/**
 * Classarium Behavior Tracking Module
 * Record and analyze student behavior with positive/negative tracking,
 * behavior scores, and analytics dashboards.
 */
(function () {
  'use strict';

  window.Modules = window.Modules || {};

  var Utils = window.Utils;
  var Toast = window.Toast;
  var DataService = window.DataService;
  var Modal = window.Modal;
  var Router = window.Router;
  var SidebarComponent = window.SidebarComponent;
  var HeaderComponent = window.HeaderComponent;

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  var POSITIVE_CATEGORIES = ['Leadership', 'Teamwork', 'Punctuality', 'Respectfulness', 'Neatness', 'Helpfulness', 'Participation'];
  var NEGATIVE_CATEGORIES = ['Fighting', 'Bullying', 'Cheating', 'Disrespect', 'Lateness', 'Littering', 'Vandalism', 'Disobedience'];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _records = [];
  var _classes = [];
  var _students = [];
  var _staff = [];
  var _listeners = [];
  var _clickHandler = null;
  var _inputHandler = null;
  var _changeHandler = null;

  var _activeTab = 'records';  // 'records' | 'analytics'
  var _filter = {
    classId: '',
    search: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function getProfile() {
    return window.App.state.profile || {};
  }

  function getSchoolId() {
    return getProfile().schoolId || '';
  }

  function getUid() {
    return getProfile().uid || '';
  }

  function isAdmin() {
    var r = getProfile().role;
    return r === 'school_admin' || r === 'vice_principal';
  }

  function isTeacher() {
    return getProfile().role === 'teacher';
  }

  function canManage() {
    return isAdmin() || isTeacher();
  }

  function getClassName(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    return c ? (c.name || c.className || '\u2014') : '\u2014';
  }

  function getStudentName(id) {
    var s = _students.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || (s.firstName + ' ' + s.lastName) || '\u2014') : '\u2014';
  }

  function getStaffName(id) {
    var s = _staff.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || (s.firstName + ' ' + s.lastName) || '\u2014') : '\u2014';
  }

  function optionTag(value, label, selected) {
    return '<option value="' + (value || '') + '"' + (selected ? ' selected' : '') + '>'
      + Utils.escapeHtml(label || 'Select') + '</option>';
  }

  function emptyState(icon, title, desc) {
    return '<div class="empty-state"><div class="empty-state-icon">' + icon + '</div>'
      + '<h3 class="empty-state-title">' + title + '</h3>'
      + '<p class="empty-state-description">' + (desc || '') + '</p></div>';
  }

  function loadingSpinner() {
    return '<div class="loading-spinner" style="text-align:center;padding:40px">'
      + '<div class="spinner" style="width:36px;height:36px;border:3px solid var(--gray-200);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div>'
      + '<p style="margin-top:12px;color:var(--gray-500)">Loading\u2026</p></div>';
  }

  function statCard(icon, label, value, color) {
    return '<div class="card" style="padding:16px 20px">'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<div style="width:42px;height:42px;border-radius:10px;background:' + color + '15;display:flex;align-items:center;justify-content:center;font-size:18px">' + icon + '</div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--gray-900)">' + Utils.formatNumber(value) + '</div>'
      + '<div style="font-size:12px;color:var(--gray-500);margin-top:2px">' + label + '</div></div>'
      + '</div></div>';
  }

  function calculateBehaviorScore(studentId) {
    var total = 0;
    _records.forEach(function (r) {
      if (r.studentId === studentId) {
        total += (r.points || 0);
      }
    });
    return total;
  }

  function getFilteredRecords() {
    return _records.filter(function (r) {
      if (_filter.classId) {
        var student = _students.find(function (s) { return s.id === r.studentId || s.uid === r.studentId; });
        if (!student || student.classId !== _filter.classId) return false;
      }
      if (_filter.type && r.type !== _filter.type) return false;
      if (_filter.dateFrom && r.date && r.date < _filter.dateFrom) return false;
      if (_filter.dateTo && r.date && r.date > _filter.dateTo) return false;
      if (_filter.search) {
        var name = getStudentName(r.studentId).toLowerCase();
        var desc = (r.description || '').toLowerCase();
        var cat = (r.category || '').toLowerCase();
        var term = _filter.search.toLowerCase();
        if (name.indexOf(term) === -1 && desc.indexOf(term) === -1 && cat.indexOf(term) === -1) return false;
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    var promises = [
      DataService.getBySchool('classes', schoolId, { orderBy: 'name' }),
      DataService.getStudents(schoolId)
    ];

    if (isAdmin()) {
      promises.push(DataService.getBySchool('staff', schoolId));
    } else {
      promises.push(Promise.resolve([getProfile()]));
    }

    return Promise.all(promises).then(function (results) {
      _classes = results[0] || [];
      _students = results[1] || [];
      _staff = results[2] || [];
    });
  }

  function loadRecords() {
    var schoolId = getSchoolId();
    return DataService.getBySchool('behaviorRecords', schoolId, { orderBy: 'timestamp', orderDir: 'desc' })
      .then(function (data) {
        _records = data || [];
      });
  }

  /* ================================================================== */
  /*  Render — Main Entry                                                */
  /* ================================================================== */

  function render() {
    var container = document.getElementById('main-content');
    if (!container) return;

    cleanup();
    container.innerHTML = loadingSpinner();

    loadBaseData().then(function () {
      return loadRecords();
    }).then(function () {
      if (!canManage()) {
        container.innerHTML = emptyState('\uD83D\uDD12', 'Access Denied', 'You do not have permission to access behavior records.');
        bindEvents();
        return;
      }
      container.innerHTML = renderMainView();
      bindEvents();
    }).catch(function (err) {
      console.error('Error loading behavior module:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load behavior records. Please refresh.');
      Toast.error('Failed to load behavior records.');
    });
  }

  /* ================================================================== */
  /*  Main View with Tabs                                                */
  /* ================================================================== */

  function renderMainView() {
    var html = '<div class="behavior-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Behavior</h1>'
      + '<p class="page-header-description">Track and analyze student behavior</p>'
      + '</div>'
      + '<button class="btn btn-primary" data-action="add-record">+ Add Record</button>'
      + '</div>'
      + '</div>';

    // Stats
    var totalRecords = _records.length;
    var positiveRecords = _records.filter(function (r) { return r.type === 'positive'; }).length;
    var negativeRecords = _records.filter(function (r) { return r.type === 'negative'; }).length;
    var uniqueStudents = [];
    _records.forEach(function (r) {
      if (uniqueStudents.indexOf(r.studentId) === -1) uniqueStudents.push(r.studentId);
    });

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83D\uDCCB', 'Total Records', totalRecords, 'var(--primary-600)');
    html += statCard('\u2705', 'Positive', positiveRecords, 'var(--success-600)');
    html += statCard('\u274C', 'Negative', negativeRecords, 'var(--danger-600)');
    html += statCard('\uD83D\uDC65', 'Students Tracked', uniqueStudents.length, 'var(--info-600)');
    html += '</div>';

    // Tabs
    html += '<div style="display:flex;border-bottom:2px solid var(--gray-200);margin-bottom:20px">'
      + '<button class="behavior-tab' + (_activeTab === 'records' ? ' active' : '') + '" data-action="switch-tab" data-tab="records"'
      + ' style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;'
      + 'color:' + (_activeTab === 'records' ? 'var(--primary-600)' : 'var(--gray-500)')
      + ';border-bottom:2px solid ' + (_activeTab === 'records' ? 'var(--primary-600)' : 'transparent')
      + ';margin-bottom:-2px;transition:all 0.15s">Records</button>'
      + '<button class="behavior-tab' + (_activeTab === 'analytics' ? ' active' : '') + '" data-action="switch-tab" data-tab="analytics"'
      + ' style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;'
      + 'color:' + (_activeTab === 'analytics' ? 'var(--primary-600)' : 'var(--gray-500)')
      + ';border-bottom:2px solid ' + (_activeTab === 'analytics' ? 'var(--primary-600)' : 'transparent')
      + ';margin-bottom:-2px;transition:all 0.15s">Analytics</button>'
      + '</div>';

    // Filter bar
    html += renderFilterBar();

    // Tab content
    if (_activeTab === 'records') {
      html += renderRecordsTab();
    } else {
      html += renderAnalyticsTab();
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  Filter Bar                                                         */
  /* ================================================================== */

  function renderFilterBar() {
    var html = '<div class="card" style="padding:14px 20px;margin-bottom:20px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">';

    // Class filter
    html += '<div style="min-width:160px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Class</label>'
      + '<select class="form-control form-control-sm" data-filter="classId" style="font-size:13px">'
      + '<option value="">All Classes</option>'
      + _classes.map(function (c) {
        return optionTag(c.id, c.name || c.className, _filter.classId === c.id);
      }).join('')
      + '</select></div>';

    // Student search
    html += '<div style="min-width:200px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Student</label>'
      + '<input type="text" class="form-control form-control-sm" data-filter="search" placeholder="Search student..." value="' + Utils.escapeHtml(_filter.search) + '" style="font-size:13px">'
      + '</div>';

    // Type filter
    html += '<div style="min-width:150px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Type</label>'
      + '<select class="form-control form-control-sm" data-filter="type" style="font-size:13px">'
      + '<option value=""' + (!_filter.type ? ' selected' : '') + '>All Types</option>'
      + '<option value="positive"' + (_filter.type === 'positive' ? ' selected' : '') + '>Positive</option>'
      + '<option value="negative"' + (_filter.type === 'negative' ? ' selected' : '') + '>Negative</option>'
      + '</select></div>';

    // Date from
    html += '<div style="min-width:140px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">From</label>'
      + '<input type="date" class="form-control form-control-sm" data-filter="dateFrom" value="' + (_filter.dateFrom || '') + '" style="font-size:13px">'
      + '</div>';

    // Date to
    html += '<div style="min-width:140px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">To</label>'
      + '<input type="date" class="form-control form-control-sm" data-filter="dateTo" value="' + (_filter.dateTo || '') + '" style="font-size:13px">'
      + '</div>';

    // Clear button
    html += '<button class="btn btn-outline-secondary btn-sm" data-action="clear-filters" style="margin-bottom:0;white-space:nowrap">Clear</button>';

    html += '</div></div>';
    return html;
  }

  /* ================================================================== */
  /*  Records Tab                                                        */
  /* ================================================================== */

  function renderRecordsTab() {
    var filtered = getFilteredRecords();

    if (!filtered.length) {
      return emptyState('\uD83D\uDCCB', 'No Records Found', _records.length === 0
        ? 'Start by recording student behavior.'
        : 'Try adjusting your filters.');
    }

    var html = '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:800px">'
      + '<thead><tr>'
      + '<th>Student Name</th>'
      + '<th>Type</th>'
      + '<th>Category</th>'
      + '<th>Date</th>'
      + '<th>Recorded By</th>'
      + '<th>Description</th>'
      + '<th>Points</th>'
      + '<th>Actions</th>'
      + '</tr></thead><tbody>';

    filtered.forEach(function (r) {
      var isPositive = r.type === 'positive';
      var pointsDisplay = (r.points || 0) > 0
        ? '+' + (r.points || 0)
        : String(r.points || 0);

      html += '<tr>'
        + '<td><strong>' + Utils.escapeHtml(getStudentName(r.studentId)) + '</strong></td>'
        + '<td><span class="badge badge-' + (isPositive ? 'success' : 'danger') + '">'
        + Utils.capitalize(r.type || 'unknown') + '</span></td>'
        + '<td>' + Utils.escapeHtml(r.category || '\u2014') + '</td>'
        + '<td>' + (r.date ? Utils.formatDate(r.date) : '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(getStaffName(r.recordedBy)) + '</td>'
        + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + Utils.escapeHtml(r.description || '') + '">'
        + Utils.escapeHtml(r.description || '\u2014') + '</td>'
        + '<td><span style="font-weight:700;color:' + (isPositive ? 'var(--success-600)' : 'var(--danger-600)') + '">'
        + pointsDisplay + '</span></td>'
        + '<td>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="btn btn-sm btn-outline-primary" data-action="view-student-behavior" data-id="' + r.studentId + '" title="View Student Behavior">\uD83D\uDC64</button>'
        + '<button class="btn btn-sm btn-outline-danger" data-action="delete-record" data-id="' + r.id + '" title="Delete">\uD83D\uDDD1</button>'
        + '</div></td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    // Pagination summary
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">Showing ' + filtered.length + ' record' + (filtered.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Analytics Tab                                                      */
  /* ================================================================== */

  function renderAnalyticsTab() {
    var html = '';

    // --- Top Positive Behaviors Bar Chart ---
    var positiveCats = {};
    _records.forEach(function (r) {
      if (r.type === 'positive' && r.category) {
        positiveCats[r.category] = (positiveCats[r.category] || 0) + 1;
      }
    });
    var posEntries = Object.entries(positiveCats).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    var posMax = posEntries.length > 0 ? posEntries[0][1] : 1;

    html += '<div class="card" style="padding:20px;margin-bottom:20px">'
      + '<h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--gray-800)">\u2705 Top Positive Behaviors</h3>';

    if (!posEntries.length) {
      html += '<p style="color:var(--gray-400);font-size:13px">No positive behavior records yet.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      posEntries.forEach(function (entry) {
        var cat = entry[0];
        var count = entry[1];
        var pct = (count / posMax) * 100;
        html += '<div style="display:flex;align-items:center;gap:12px">'
          + '<div style="width:120px;font-size:13px;font-weight:500;color:var(--gray-700);text-align:right;flex-shrink:0">'
          + Utils.escapeHtml(cat) + '</div>'
          + '<div style="flex:1;height:28px;background:var(--gray-100);border-radius:4px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:var(--success-500);border-radius:4px;display:flex;align-items:center;padding-left:8px;min-width:fit-content">'
          + '<span style="font-size:12px;font-weight:600;color:white;white-space:nowrap">' + count + '</span>'
          + '</div></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // --- Top Negative Behaviors Bar Chart ---
    var negativeCats = {};
    _records.forEach(function (r) {
      if (r.type === 'negative' && r.category) {
        negativeCats[r.category] = (negativeCats[r.category] || 0) + 1;
      }
    });
    var negEntries = Object.entries(negativeCats).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    var negMax = negEntries.length > 0 ? negEntries[0][1] : 1;

    html += '<div class="card" style="padding:20px;margin-bottom:20px">'
      + '<h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--gray-800)">\u274C Top Negative Behaviors</h3>';

    if (!negEntries.length) {
      html += '<p style="color:var(--gray-400);font-size:13px">No negative behavior records yet.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      negEntries.forEach(function (entry) {
        var cat = entry[0];
        var count = entry[1];
        var pct = (count / negMax) * 100;
        html += '<div style="display:flex;align-items:center;gap:12px">'
          + '<div style="width:120px;font-size:13px;font-weight:500;color:var(--gray-700);text-align:right;flex-shrink:0">'
          + Utils.escapeHtml(cat) + '</div>'
          + '<div style="flex:1;height:28px;background:var(--gray-100);border-radius:4px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:var(--danger-500);border-radius:4px;display:flex;align-items:center;padding-left:8px;min-width:fit-content">'
          + '<span style="font-size:12px;font-weight:600;color:white;white-space:nowrap">' + count + '</span>'
          + '</div></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // --- Behavior Score Distribution ---
    var studentScores = {};
    _records.forEach(function (r) {
      if (!studentScores[r.studentId]) studentScores[r.studentId] = 0;
      studentScores[r.studentId] += (r.points || 0);
    });

    var scoreBuckets = {
      'High Negative (< -10)': 0,
      'Negative (-10 to -1)': 0,
      'Neutral (0)': 0,
      'Positive (1 to 10)': 0,
      'High Positive (> 10)': 0
    };

    Object.values(studentScores).forEach(function (score) {
      if (score < -10) scoreBuckets['High Negative (< -10)']++;
      else if (score < 0) scoreBuckets['Negative (-10 to -1)']++;
      else if (score === 0) scoreBuckets['Neutral (0)']++;
      else if (score <= 10) scoreBuckets['Positive (1 to 10)']++;
      else scoreBuckets['High Positive (> 10)']++;
    });

    var distMax = Math.max.apply(null, Object.values(scoreBuckets).concat([1]));

    html += '<div class="card" style="padding:20px;margin-bottom:20px">'
      + '<h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--gray-800)">\uD83D\uDCCA Behavior Score Distribution</h3>';

    if (Object.values(studentScores).length === 0) {
      html += '<p style="color:var(--gray-400);font-size:13px">No behavior data available for distribution analysis.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      var bucketColors = ['var(--danger-600)', 'var(--danger-400)', 'var(--gray-400)', 'var(--success-400)', 'var(--success-600)'];
      var bucketIdx = 0;
      Object.keys(scoreBuckets).forEach(function (label) {
        var count = scoreBuckets[label];
        var pct = (count / distMax) * 100;
        html += '<div style="display:flex;align-items:center;gap:12px">'
          + '<div style="width:180px;font-size:13px;font-weight:500;color:var(--gray-700);text-align:right;flex-shrink:0">'
          + label + '</div>'
          + '<div style="flex:1;height:28px;background:var(--gray-100);border-radius:4px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:' + bucketColors[bucketIdx] + ';border-radius:4px;display:flex;align-items:center;padding-left:8px;min-width:fit-content">'
          + '<span style="font-size:12px;font-weight:600;color:white;white-space:nowrap">' + count + ' student' + (count !== 1 ? 's' : '') + '</span>'
          + '</div></div></div>';
        bucketIdx++;
      });
      html += '</div>';
    }
    html += '</div>';

    // --- Students with Most Positive / Negative Records ---
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">';

    // Most positive
    var studentPosCount = {};
    _records.forEach(function (r) {
      if (r.type === 'positive') {
        studentPosCount[r.studentId] = (studentPosCount[r.studentId] || 0) + 1;
      }
    });
    var topPositive = Object.entries(studentPosCount)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 10);

    html += '<div class="card" style="padding:20px">'
      + '<h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--gray-800)">\uD83C\uDF1F Most Positive Students</h3>';

    if (!topPositive.length) {
      html += '<p style="color:var(--gray-400);font-size:13px">No data yet.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      topPositive.forEach(function (entry, idx) {
        var studentId = entry[0];
        var count = entry[1];
        var score = calculateBehaviorScore(studentId);
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--success-50);border-radius:6px">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<span style="width:24px;height:24px;border-radius:50%;background:var(--success-500);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">' + (idx + 1) + '</span>'
          + '<span style="font-size:14px;font-weight:500;color:var(--gray-800)">' + Utils.escapeHtml(getStudentName(studentId)) + '</span>'
          + '</div>'
          + '<div style="text-align:right">'
          + '<div style="font-size:14px;font-weight:700;color:var(--success-600)">+' + count + ' records</div>'
          + '<div style="font-size:11px;color:var(--gray-400)">Score: ' + (score >= 0 ? '+' : '') + score + '</div>'
          + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Most negative
    var studentNegCount = {};
    _records.forEach(function (r) {
      if (r.type === 'negative') {
        studentNegCount[r.studentId] = (studentNegCount[r.studentId] || 0) + 1;
      }
    });
    var topNegative = Object.entries(studentNegCount)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 10);

    html += '<div class="card" style="padding:20px">'
      + '<h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--gray-800)">\u26A0 Students Needing Attention</h3>';

    if (!topNegative.length) {
      html += '<p style="color:var(--gray-400);font-size:13px">No data yet.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      topNegative.forEach(function (entry, idx) {
        var studentId = entry[0];
        var count = entry[1];
        var score = calculateBehaviorScore(studentId);
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--danger-50);border-radius:6px">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<span style="width:24px;height:24px;border-radius:50%;background:var(--danger-500);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">' + (idx + 1) + '</span>'
          + '<span style="font-size:14px;font-weight:500;color:var(--gray-800)">' + Utils.escapeHtml(getStudentName(studentId)) + '</span>'
          + '</div>'
          + '<div style="text-align:right">'
          + '<div style="font-size:14px;font-weight:700;color:var(--danger-600)">' + count + ' records</div>'
          + '<div style="font-size:11px;color:var(--gray-400)">Score: ' + (score >= 0 ? '+' : '') + score + '</div>'
          + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // close grid

    return html;
  }

  /* ================================================================== */
  /*  Add Record Modal                                                   */
  /* ================================================================== */

  function openAddRecordModal() {
    var classOpts = '<option value="">Select Class (optional)</option>'
      + _classes.map(function (c) {
        return optionTag(c.id, c.name || c.className);
      }).join('');

    var formHtml = '<form id="behavior-add-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Student <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="studentId" id="behavior-student-select" required>'
      + '<option value="">Select Student</option>';

    // Group students by class
    var groupedByClass = {};
    _students.forEach(function (s) {
      var cls = s.classId || 'unassigned';
      if (!groupedByClass[cls]) groupedByClass[cls] = [];
      groupedByClass[cls].push(s);
    });

    _classes.forEach(function (c) {
      var students = groupedByClass[c.id] || [];
      if (!students.length) return;
      formHtml += '<optgroup label="' + Utils.escapeHtml(c.name || c.className) + '">';
      students.forEach(function (s) {
        var name = s.displayName || (s.firstName + ' ' + s.lastName);
        formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + '</option>';
      });
      formHtml += '</optgroup>';
    });

    // Unassigned students
    var unassigned = groupedByClass['unassigned'] || [];
    if (unassigned.length) {
      formHtml += '<optgroup label="Unassigned">';
      unassigned.forEach(function (s) {
        var name = s.displayName || (s.firstName + ' ' + s.lastName);
        formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + '</option>';
      });
      formHtml += '</optgroup>';
    }

    formHtml += '</select></div>';

    // Type
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Type <span style="color:var(--danger-500)">*</span></label>'
      + '<div style="display:flex;gap:16px;padding-top:6px">'
      + '<label class="form-check" style="display:flex;align-items:center;gap:6px;cursor:pointer">'
      + '<input type="radio" name="type" value="positive" checked style="accent-color:var(--success-500)"> '
      + '<span style="font-weight:500;color:var(--success-700)">Positive</span></label>'
      + '<label class="form-check" style="display:flex;align-items:center;gap:6px;cursor:pointer">'
      + '<input type="radio" name="type" value="negative" style="accent-color:var(--danger-500)"> '
      + '<span style="font-weight:500;color:var(--danger-700)">Negative</span></label>'
      + '</div></div>';

    // Category
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Category <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="category" id="behavior-category-select" required>'
      + '<option value="">Select Category</option>';
    POSITIVE_CATEGORIES.forEach(function (cat) {
      formHtml += '<option value="' + cat + '" data-type="positive">' + cat + '</option>';
    });
    NEGATIVE_CATEGORIES.forEach(function (cat) {
      formHtml += '<option value="' + cat + '" data-type="negative">' + cat + '</option>';
    });
    formHtml += '</select></div>';

    // Date
    var todayStr = new Date().toISOString().split('T')[0];
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Date</label>'
      + '<input type="date" class="form-control" name="date" value="' + todayStr + '">'
      + '</div>';

    // Description
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Description</label>'
      + '<textarea class="form-control" name="description" rows="3" placeholder="Describe the behavior incident..."></textarea>'
      + '</div>';

    // Points
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Points</label>'
      + '<input type="number" class="form-control" name="points" value="1" min="-100" max="100">'
      + '<p style="font-size:12px;color:var(--gray-400);margin:4px 0 0">Positive for good behavior, negative for bad behavior</p>'
      + '</div>';

    formHtml += '</form>';

    Modal.open({
      title: 'Add Behavior Record',
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="behavior-save-btn">Save Record</button>'
    });

    setTimeout(function () {
      // Toggle categories based on type
      var typeRadios = document.querySelectorAll('#behavior-add-form input[name="type"]');
      var categorySelect = document.getElementById('behavior-category-select');

      function updateCategories() {
        var selectedType = document.querySelector('#behavior-add-form input[name="type"]:checked');
        if (!selectedType || !categorySelect) return;
        var type = selectedType.value;
        var opts = categorySelect.querySelectorAll('option');
        opts.forEach(function (opt) {
          if (!opt.value) return;
          var optType = opt.dataset.type;
          opt.style.display = optType === type ? '' : 'none';
        });
        // Reset selection if hidden
        var selectedOpt = categorySelect.querySelector('option:checked');
        if (selectedOpt && selectedOpt.value && selectedOpt.dataset.type !== type) {
          categorySelect.value = '';
        }

        // Auto-set points based on type
        var pointsInput = document.querySelector('#behavior-add-form input[name="points"]');
        if (pointsInput) {
          pointsInput.value = type === 'positive' ? '1' : '-1';
        }
      }

      typeRadios.forEach(function (radio) {
        radio.addEventListener('change', updateCategories);
      });
      updateCategories();

      // Save
      var saveBtn = document.getElementById('behavior-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('behavior-add-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var recordData = {
            schoolId: getSchoolId(),
            studentId: fd.get('studentId'),
            type: fd.get('type'),
            category: fd.get('category'),
            date: fd.get('date') || todayStr,
            description: fd.get('description'),
            points: parseInt(fd.get('points')) || (fd.get('type') === 'positive' ? 1 : -1),
            recordedBy: getUid(),
            timestamp: Date.now()
          };

          DataService.add('behaviorRecords', recordData).then(function () {
            Modal.close();
            Toast.success('Behavior record added.');
            DataService.logAction('behavior_add', 'Recorded ' + recordData.type + ' behavior: ' + recordData.category + ' for ' + getStudentName(recordData.studentId));
            loadRecords().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
            });
          }).catch(function (err) {
            console.error('Error saving behavior record:', err);
            Toast.error('Failed to save record.');
          });
        });
      }
    }, 50);
  }

  /* ================================================================== */
  /*  View Student Behavior Modal                                        */
  /* ================================================================== */

  function openStudentBehaviorModal(studentId) {
    var studentRecords = _records.filter(function (r) { return r.studentId === studentId; });
    var studentName = getStudentName(studentId);

    var totalPositive = 0;
    var totalNegative = 0;
    studentRecords.forEach(function (r) {
      if (r.type === 'positive') totalPositive += Math.abs(r.points || 0);
      else totalNegative += Math.abs(r.points || 0);
    });
    var behaviorScore = totalPositive - totalNegative;

    var html = '<div>';

    // Score summary
    html += '<div style="text-align:center;margin-bottom:20px">'
      + '<div style="width:80px;height:80px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;'
      + (behaviorScore >= 0
        ? 'background:var(--success-100);color:var(--success-700)'
        : 'background:var(--danger-100);color:var(--danger-700)')
      + '">' + (behaviorScore >= 0 ? '+' : '') + behaviorScore + '</div>'
      + '<h3 style="margin:0;font-size:18px">' + Utils.escapeHtml(studentName) + '</h3>'
      + '<p style="margin:4px 0 0;font-size:13px;color:var(--gray-500)">Behavior Score</p>'
      + '</div>';

    // Positive / Negative summary
    html += '<div style="display:flex;gap:16px;justify-content:center;margin-bottom:20px">'
      + '<div style="text-align:center;padding:14px 24px;background:var(--success-50);border-radius:8px;min-width:100px">'
      + '<div style="font-size:22px;font-weight:700;color:var(--success-700)">+' + totalPositive + '</div>'
      + '<div style="font-size:12px;color:var(--success-600)">Positive Points</div></div>'
      + '<div style="text-align:center;padding:14px 24px;background:var(--danger-50);border-radius:8px;min-width:100px">'
      + '<div style="font-size:22px;font-weight:700;color:var(--danger-700)">-' + totalNegative + '</div>'
      + '<div style="font-size:12px;color:var(--danger-600)">Negative Points</div></div>'
      + '</div>';

    // Category breakdown
    var catBreakdown = {};
    studentRecords.forEach(function (r) {
      if (!catBreakdown[r.category]) catBreakdown[r.category] = { type: r.type, count: 0, points: 0 };
      catBreakdown[r.category].count++;
      catBreakdown[r.category].points += (r.points || 0);
    });

    var catEntries = Object.entries(catBreakdown);
    if (catEntries.length > 0) {
      html += '<div style="margin-bottom:20px">'
        + '<h4 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--gray-700)">Category Breakdown</h4>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      catEntries.forEach(function (entry) {
        var cat = entry[0];
        var data = entry[1];
        html += '<span class="badge badge-' + (data.type === 'positive' ? 'success' : 'danger') + '" style="font-size:12px;padding:5px 10px">'
          + Utils.escapeHtml(cat) + ' <strong>(' + data.count + ')</strong></span>';
      });
      html += '</div></div>';
    }

    // Timeline
    html += '<h4 style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--gray-700)">Behavior Timeline</h4>';

    if (!studentRecords.length) {
      html += '<p style="text-align:center;color:var(--gray-400);font-size:13px">No behavior records found.</p>';
    } else {
      var sorted = studentRecords.slice().sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
      html += '<div style="max-height:350px;overflow-y:auto;padding-right:4px">';
      sorted.forEach(function (r) {
        var isPos = r.type === 'positive';
        html += '<div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--gray-100);align-items:flex-start">'
          + '<div style="width:10px;height:10px;border-radius:50%;margin-top:6px;flex-shrink:0;background:'
          + (isPos ? 'var(--success-500)' : 'var(--danger-500)') + '"></div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
          + '<div style="display:flex;align-items:center;gap:6px">'
          + '<span class="badge badge-' + (isPos ? 'success' : 'danger') + '" style="font-size:11px">' + Utils.escapeHtml(r.category || '') + '</span>'
          + '<span style="font-size:12px;color:var(--gray-400)">\u2022 ' + (r.date ? Utils.formatDate(r.date) : '') + '</span>'
          + '</div>'
          + '<span style="font-size:13px;font-weight:700;color:' + (isPos ? 'var(--success-600)' : 'var(--danger-600)') + '">'
          + (isPos ? '+' : '') + (r.points || 0) + ' pts</span>'
          + '</div>'
          + (r.description ? '<p style="margin:4px 0 0;font-size:13px;color:var(--gray-600);line-height:1.4">' + Utils.escapeHtml(r.description) + '</p>' : '')
          + '<p style="margin:2px 0 0;font-size:11px;color:var(--gray-400)">Recorded by: ' + Utils.escapeHtml(getStaffName(r.recordedBy)) + '</p>'
          + '</div></div>';
      });
      html += '</div>';
    }

    html += '</div>';

    Modal.open({
      title: 'Student Behavior Profile',
      content: html,
      size: 'lg',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Close</button>'
    });
  }

  /* ================================================================== */
  /*  Event Binding                                                      */
  /* ================================================================== */

  function bindEvents() {
    _clickHandler = function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      var id = btn.dataset.id;
      var tab = btn.dataset.tab;

      switch (action) {
        case 'switch-tab':
          e.preventDefault();
          e.stopPropagation();
          _activeTab = tab || 'records';
          var container = document.getElementById('main-content');
          if (container) container.innerHTML = renderMainView();
          break;

        case 'add-record':
          e.preventDefault();
          e.stopPropagation();
          openAddRecordModal();
          break;

        case 'delete-record':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Delete this behavior record?').then(function (confirmed) {
            if (confirmed) {
              DataService.remove('behaviorRecords', getSchoolId(), id).then(function () {
                Toast.success('Record deleted.');
                loadRecords().then(function () {
                  var c = document.getElementById('main-content');
                  if (c) c.innerHTML = renderMainView();
                });
              });
            }
          });
          break;

        case 'view-student-behavior':
          e.preventDefault();
          e.stopPropagation();
          openStudentBehaviorModal(id);
          break;

        case 'clear-filters':
          e.preventDefault();
          e.stopPropagation();
          _filter = { classId: '', search: '', type: '', dateFrom: '', dateTo: '' };
          var c2 = document.getElementById('main-content');
          if (c2) c2.innerHTML = renderMainView();
          break;
      }
    };

    document.addEventListener('click', _clickHandler);

    // Filter change/input handlers
    _changeHandler = function (e) {
      var el = e.target;
      if (!el || !el.dataset.filter) return;

      var filterKey = el.dataset.filter;
      _filter[filterKey] = el.value;

      // Debounced re-render for text input
      if (filterKey === 'search') return; // handled by input handler

      var container = document.getElementById('main-content');
      if (container) {
        // Only re-render the records/analytics content, not the whole page
        if (_activeTab === 'records') {
          var recordsContainer = container.querySelector('.card:last-of-type');
          // For simplicity, re-render main view
        }
        container.innerHTML = renderMainView();
        // Re-bind events after re-render
        bindEvents();
      }
    };

    _inputHandler = Utils.debounce(function (e) {
      var el = e.target;
      if (!el || !el.dataset.filter) return;

      var filterKey = el.dataset.filter;
      _filter[filterKey] = el.value;

      // Re-render just the tab content
      var container = document.getElementById('main-content');
      if (container) {
        container.innerHTML = renderMainView();
        bindEvents();
      }
    }, 300);

    document.addEventListener('change', _changeHandler);
    document.addEventListener('input', _inputHandler);
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  function cleanup() {
    if (_clickHandler) {
      document.removeEventListener('click', _clickHandler);
      _clickHandler = null;
    }
    if (_changeHandler) {
      document.removeEventListener('change', _changeHandler);
      _changeHandler = null;
    }
    if (_inputHandler) {
      document.removeEventListener('input', _inputHandler);
      _inputHandler = null;
    }
    _listeners.forEach(function (unsub) { if (typeof unsub === 'function') unsub(); });
    _listeners = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  window.Modules.behavior = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('behavior');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Behavior' }
      ]);
      _activeTab = 'records';
      _filter = { classId: '', search: '', type: '', dateFrom: '', dateTo: '' };
      render();
    },

    destroy: function () {
      cleanup();
      _records = [];
      _classes = [];
      _students = [];
      _staff = [];
      _activeTab = 'records';
      _filter = { classId: '', search: '', type: '', dateFrom: '', dateTo: '' };
    }
  };
})();