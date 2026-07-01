/**
 * Classarium Attendance Module
 * Daily attendance recording and attendance reports for teachers, class_managers, school_admin.
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

  var STATUS_OPTIONS = [
    { value: 'present', label: 'Present', cls: 'success' },
    { value: 'absent', label: 'Absent', cls: 'danger' },
    { value: 'late', label: 'Late', cls: 'warning' },
    { value: 'sick', label: 'Sick', cls: 'info' },
    { value: 'excused', label: 'Excused', cls: 'default' }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _mode = 'daily'; // 'daily' or 'reports'
  var _classes = [];
  var _students = [];
  var _attendanceRecords = [];
  var _sessions = [];
  var _terms = [];
  var _listeners = [];
  var _clickHandler = null;
  var _inputHandler = null;
  var _changeHandler = null;

  // Daily attendance state
  var _dailyFilter = {
    date: '',
    classId: '',
    arm: ''
  };

  // Reports state
  var _reportFilter = {
    classId: '',
    arm: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getTodayStr() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function getClassName(classId) {
    var c = _classes.find(function (x) { return x.id === classId; });
    return c ? (c.name || c.className || '—') : (classId || '—');
  }

  function getArmsForClass(classId) {
    var c = _classes.find(function (x) { return x.id === classId; });
    return (c && c.arms) ? c.arms : [];
  }

  function getStudentArms(classId, arm) {
    return _students.filter(function (s) {
      if (s.classId !== classId) return false;
      if (arm && s.arm !== arm) return false;
      return true;
    });
  }

  function statusBadge(status) {
    var map = {
      present: { text: 'Present', cls: 'success' },
      absent: { text: 'Absent', cls: 'danger' },
      late: { text: 'Late', cls: 'warning' },
      sick: { text: 'Sick', cls: 'info' },
      excused: { text: 'Excused', cls: 'default' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function statusSelectOptions(selected) {
    return STATUS_OPTIONS.map(function (opt) {
      return '<option value="' + opt.value + '"' + (selected === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
    }).join('');
  }

  function classOptions(selectedId) {
    return '<option value="">Select Class</option>'
      + _classes.map(function (c) {
        return '<option value="' + (c.id || '') + '"' + (selectedId === c.id ? ' selected' : '') + '>'
          + Utils.escapeHtml(c.name || c.className || 'Unnamed') + '</option>';
      }).join('');
  }

  function armOptions(classId, selectedArm) {
    var arms = getArmsForClass(classId);
    var html = '<option value="">All Arms</option>';
    arms.forEach(function (a) {
      html += '<option value="' + Utils.escapeHtml(a) + '"' + (selectedArm === a ? ' selected' : '') + '>' + Utils.escapeHtml(a) + '</option>';
    });
    return html;
  }

  function sessionOptions(selectedId) {
    return '<option value="">Select Session</option>'
      + _sessions.map(function (s) {
        return '<option value="' + (s.id || '') + '"' + (selectedId === s.id ? ' selected' : '') + '>'
          + Utils.escapeHtml(s.name || 'Unnamed') + '</option>';
      }).join('');
  }

  function termOptions(selectedId) {
    return '<option value="">Select Term</option>'
      + _terms.map(function (t) {
        return '<option value="' + (t.id || '') + '"' + (selectedId === t.id ? ' selected' : '') + '>'
          + Utils.escapeHtml(t.name || 'Unnamed') + '</option>';
      }).join('');
  }

  function computeSummary(records) {
    var present = 0, absent = 0, late = 0, sick = 0, excused = 0;
    records.forEach(function (r) {
      switch (r.status) {
        case 'present': present++; break;
        case 'absent': absent++; break;
        case 'late': late++; break;
        case 'sick': sick++; break;
        case 'excused': excused++; break;
      }
    });
    return { present: present, absent: absent, late: late, sick: sick, excused: excused, total: records.length };
  }

  /* ------------------------------------------------------------------ */
  /*  Render — Main Page                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    if (!_dailyFilter.date) {
      _dailyFilter.date = getTodayStr();
    }

    var html = '<div class="attendance-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Attendance</h1>'
      + '<p class="page-header-description">Record and track student attendance</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Date picker row
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-body">'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'
      + '<div style="min-width:180px">'
      + '<label class="form-label" style="margin-bottom:4px">Date</label>'
      + '<input type="date" id="attendance-date" class="form-input" value="' + Utils.escapeHtml(_dailyFilter.date) + '" style="width:100%">'
      + '</div>'
      + '<div style="min-width:200px">'
      + '<label class="form-label" style="margin-bottom:4px">Class</label>'
      + '<select id="attendance-class" class="form-select" style="width:100%">' + classOptions(_dailyFilter.classId) + '</select>'
      + '</div>'
      + '<div style="min-width:150px">'
      + '<label class="form-label" style="margin-bottom:4px">Arm</label>'
      + '<select id="attendance-arm" class="form-select" style="width:100%">' + armOptions(_dailyFilter.classId, _dailyFilter.arm) + '</select>'
      + '</div>'
      + '<div style="min-width:180px">'
      + '<label class="form-label" style="margin-bottom:4px">Session</label>'
      + '<select id="attendance-session" class="form-select" style="width:100%">' + sessionOptions('') + '</select>'
      + '</div>'
      + '<div style="min-width:180px">'
      + '<label class="form-label" style="margin-bottom:4px">Term</label>'
      + '<select id="attendance-term" class="form-select" style="width:100%">' + termOptions('') + '</select>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Mode switch tabs
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200)">'
      + '<button class="profile-tab' + (_mode === 'daily' ? ' active' : '') + '" data-action="switch-mode" data-mode="daily" style="padding:14px 24px;font-size:14px;font-weight:500;border:none;background:none;cursor:pointer;color:' + (_mode === 'daily' ? 'var(--primary-600)' : 'var(--gray-500)') + ';border-bottom:2px solid ' + (_mode === 'daily' ? 'var(--primary-600)' : 'transparent') + '">📋 Daily Attendance</button>'
      + '<button class="profile-tab' + (_mode === 'reports' ? ' active' : '') + '" data-action="switch-mode" data-mode="reports" style="padding:14px 24px;font-size:14px;font-weight:500;border:none;background:none;cursor:pointer;color:' + (_mode === 'reports' ? 'var(--primary-600)' : 'var(--gray-500)') + ';border-bottom:2px solid ' + (_mode === 'reports' ? 'var(--primary-600)' : 'transparent') + '">📊 Attendance Reports</button>'
      + '</div>'
      + '<div class="card-body" id="attendance-mode-content">'
      + (_mode === 'daily' ? renderDailyMode() : renderReportsMode())
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  DAILY ATTENDANCE MODE                                              */
  /* ================================================================== */

  function renderDailyMode() {
    var html = '';

    // Check if class is selected
    if (!_dailyFilter.classId) {
      html += '<div style="text-align:center;padding:60px 20px">'
        + '<div class="empty-state"><div class="empty-state-icon">📋</div>'
        + '<h3 class="empty-state-title">Select a Class</h3>'
        + '<p class="empty-state-description">Choose a class from the filter above to begin recording attendance.</p>'
        + '</div></div>';
      return html;
    }

    var students = getStudentArms(_dailyFilter.classId, _dailyFilter.arm);

    if (!students.length) {
      html += '<div style="text-align:center;padding:60px 20px">'
        + '<div class="empty-state"><div class="empty-state-icon">👥</div>'
        + '<h3 class="empty-state-title">No Students Found</h3>'
        + '<p class="empty-state-description">No students are enrolled in ' + Utils.escapeHtml(getClassName(_dailyFilter.classId))
        + (_dailyFilter.arm ? ' (' + Utils.escapeHtml(_dailyFilter.arm) + ')' : '')
        + '. Add students to this class first.</p>'
        + '</div></div>';
      return html;
    }

    // Load existing attendance for this date/class/arm to pre-populate
    var existingMap = {};
    _attendanceRecords.forEach(function (r) {
      if (r.date === _dailyFilter.date && r.classId === _dailyFilter.classId && (!_dailyFilter.arm || r.arm === _dailyFilter.arm)) {
        existingMap[r.studentId] = r;
      }
    });

    // Summary stats
    var prePopulatedStatuses = students.map(function (s) {
      var existing = existingMap[s.id];
      return existing ? existing.status : 'present';
    });
    var summary = computeSummary(prePopulatedStatuses.map(function (st) { return { status: st }; }));

    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:center">'
      + '<div style="display:flex;gap:16px;flex:1;flex-wrap:wrap">'
      + '<div style="font-size:14px"><strong style="color:var(--success-600)">' + summary.present + '</strong> <span style="color:var(--gray-500)">Present</span></div>'
      + '<div style="font-size:14px"><strong style="color:var(--danger-600)">' + summary.absent + '</strong> <span style="color:var(--gray-500)">Absent</span></div>'
      + '<div style="font-size:14px"><strong style="color:var(--warning-600)">' + summary.late + '</strong> <span style="color:var(--gray-500)">Late</span></div>'
      + '<div style="font-size:14px;color:var(--gray-400)">|</div>'
      + '<div style="font-size:14px;color:var(--gray-500)">Total: <strong>' + summary.total + '</strong></div>'
      + '</div>'
      + '<button class="btn btn-sm btn-ghost" data-action="mark-all-present" style="border:1px solid var(--success-200);color:var(--success-600)">✅ Mark All Present</button>'
      + '</div>';

    // Attendance table
    html += '<div class="data-table-wrapper"><table class="data-table" id="daily-attendance-table">'
      + '<thead><tr>'
      + '<th style="width:5%">#</th>'
      + '<th style="width:30%">Student Name</th>'
      + '<th style="width:18%">Admission No</th>'
      + '<th style="width:22%">Status</th>'
      + '<th style="width:25%">Note</th>'
      + '</tr></thead>'
      + '<tbody>';

    students.forEach(function (s, idx) {
      var existing = existingMap[s.id];
      var currentStatus = existing ? existing.status : 'present';
      var currentNote = existing ? (existing.note || '') : '';

      html += '<tr data-student-id="' + s.id + '">'
        + '<td style="color:var(--gray-500);font-size:13px">' + (idx + 1) + '</td>'
        + '<td>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<div class="avatar" style="width:32px;height:32px;flex-shrink:0;font-size:11px">' + Utils.getInitials(s.fullName || s.displayName || '—') + '</div>'
        + '<span style="font-weight:500;font-size:14px">' + Utils.escapeHtml(s.fullName || s.displayName || '—') + '</span>'
        + '</div></td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(s.admissionNumber || s.admissionNo || '—') + '</span></td>'
        + '<td>'
        + '<select class="form-select attendance-status-select" data-student-id="' + s.id + '" style="min-width:120px">'
        + statusSelectOptions(currentStatus)
        + '</select></td>'
        + '<td>'
        + '<input type="text" class="form-input attendance-note-input" data-student-id="' + s.id + '" placeholder="Optional note..." value="' + Utils.escapeHtml(currentNote) + '" style="width:100%">'
        + '</td></tr>';
    });

    html += '</tbody></table></div>';

    // Save button
    html += '<div style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px">'
      + '<button class="btn btn-ghost" data-action="reset-daily">Reset</button>'
      + '<button class="btn btn-primary" data-action="save-daily-attendance" style="min-width:160px">💾 Save Attendance</button>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  ATTENDANCE REPORTS MODE                                            */
  /* ================================================================== */

  function renderReportsMode() {
    var html = '';

    // Report filter bar
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--gray-200)">'
      + '<div style="min-width:180px">'
      + '<label class="form-label" style="margin-bottom:4px">Class</label>'
      + '<select id="report-filter-class" class="form-select" style="width:100%">' + classOptions(_reportFilter.classId) + '</select>'
      + '</div>'
      + '<div style="min-width:150px">'
      + '<label class="form-label" style="margin-bottom:4px">Arm</label>'
      + '<select id="report-filter-arm" class="form-select" style="width:100%">' + armOptions(_reportFilter.classId, _reportFilter.arm) + '</select>'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<label class="form-label" style="margin-bottom:4px">Date From</label>'
      + '<input type="date" id="report-filter-from" class="form-input" value="' + Utils.escapeHtml(_reportFilter.dateFrom) + '" style="width:100%">'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<label class="form-label" style="margin-bottom:4px">Date To</label>'
      + '<input type="date" id="report-filter-to" class="form-input" value="' + Utils.escapeHtml(_reportFilter.dateTo) + '" style="width:100%">'
      + '</div>'
      + '<div style="min-width:200px">'
      + '<label class="form-label" style="margin-bottom:4px">Search Student</label>'
      + '<input type="text" id="report-filter-search" class="form-input" placeholder="Name or admission no..." value="' + Utils.escapeHtml(_reportFilter.search) + '" style="width:100%">'
      + '</div>'
      + '<button class="btn btn-primary" data-action="apply-report-filter">Filter</button>'
      + '<button class="btn btn-ghost" data-action="clear-report-filter">Clear</button>'
      + '</div>';

    // Compute report data
    var filtered = getFilteredReportRecords();

    // Summary stats
    var summaryStats = computeReportSummary(filtered);

    html += '<div class="dashboard-grid grid-4" style="margin-bottom:20px">'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">📊</div><div class="stat-card-value">' + summaryStats.avgRate + '%</div><div class="stat-card-label">Avg. Attendance Rate</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#EFF6FF;color:#2563EB">📋</div><div class="stat-card-value">' + summaryStats.totalRecords + '</div><div class="stat-card-label">Total Records</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">❌</div><div class="stat-card-value">' + summaryStats.totalAbsent + '</div><div class="stat-card-label">Total Absences</div></div>'
      + '<div class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">⏰</div><div class="stat-card-value">' + summaryStats.totalLate + '</div><div class="stat-card-label">Total Late</div></div>'
      + '</div>';

    // Most absent students
    if (summaryStats.mostAbsent.length > 0) {
      html += '<div class="card" style="margin-bottom:20px">'
        + '<div class="card-header"><h3 class="card-title">Most Absent Students</h3></div>'
        + '<div class="card-body">'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      summaryStats.mostAbsent.slice(0, 10).forEach(function (item) {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px">'
          + '<div class="avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0">' + Utils.getInitials(item.name) + '</div>'
          + '<div>'
          + '<div style="font-size:13px;font-weight:500;color:var(--gray-800)">' + Utils.escapeHtml(item.name) + '</div>'
          + '<div style="font-size:11px;color:var(--danger-600)">' + item.count + ' absences</div>'
          + '</div></div>';
      });
      html += '</div></div></div>';
    }

    // Records table
    html += '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Attendance Records <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + filtered.length + ')</span></h3></div>'
      + '<div class="card-body" style="padding:0">'
      + '<div class="data-table-wrapper">'
      + '<table class="data-table">'
      + '<thead><tr>'
      + '<th style="width:25%">Student Name</th>'
      + '<th style="width:14%">Date</th>'
      + '<th style="width:14%">Status</th>'
      + '<th style="width:20%">Recorded By</th>'
      + '<th style="width:14%">Time</th>'
      + '<th style="width:13%">Note</th>'
      + '</tr></thead><tbody>';

    if (!filtered.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">📊</div>'
        + '<h3 class="empty-state-title">No records found</h3>'
        + '<p class="empty-state-description">Adjust the filters above to view attendance records.</p>'
        + '</div></td></tr>';
    } else {
      filtered.forEach(function (r) {
        var studentName = '—';
        var student = _students.find(function (s) { return s.id === r.studentId; });
        if (student) studentName = student.fullName || student.displayName || '—';

        html += '<tr>'
          + '<td style="font-weight:500;font-size:14px">' + Utils.escapeHtml(studentName) + '</td>'
          + '<td style="font-size:14px;color:var(--gray-600)">' + (r.date ? Utils.formatDate(r.date) : '—') + '</td>'
          + '<td>' + statusBadge(r.status) + '</td>'
          + '<td style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(r.recordedBy || r.recordedByName || '—') + '</td>'
          + '<td style="font-size:13px;color:var(--gray-500)">' + (r.recordedAt ? new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—') + '</td>'
          + '<td style="font-size:13px;color:var(--gray-500)">' + Utils.escapeHtml(r.note || '') + '</td>'
          + '</tr>';
      });
    }

    html += '</tbody></table></div></div></div>';

    return html;
  }

  function getFilteredReportRecords() {
    var q = (_reportFilter.search || '').toLowerCase();
    var from = _reportFilter.dateFrom;
    var to = _reportFilter.dateTo;

    return _attendanceRecords.filter(function (r) {
      // Class filter
      if (_reportFilter.classId && r.classId !== _reportFilter.classId) return false;
      // Arm filter
      if (_reportFilter.arm && r.arm !== _reportFilter.arm) return false;
      // Date range
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      // Student search
      if (q) {
        var student = _students.find(function (s) { return s.id === r.studentId; });
        var name = student ? (student.fullName || student.displayName || '').toLowerCase() : '';
        var admNo = student ? (student.admissionNumber || student.admissionNo || '').toLowerCase() : '';
        if (name.indexOf(q) === -1 && admNo.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function computeReportSummary(records) {
    var totalRecords = records.length;
    var totalPresent = 0;
    var totalAbsent = 0;
    var totalLate = 0;
    var absentByStudent = {};

    records.forEach(function (r) {
      if (r.status === 'present' || r.status === 'excused') totalPresent++;
      if (r.status === 'absent') {
        totalAbsent++;
        var student = _students.find(function (s) { return s.id === r.studentId; });
        var name = student ? (student.fullName || student.displayName || 'Unknown') : 'Unknown';
        if (!absentByStudent[name]) absentByStudent[name] = 0;
        absentByStudent[name]++;
      }
      if (r.status === 'late') totalLate++;
    });

    var avgRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

    // Sort most absent students
    var mostAbsent = Object.keys(absentByStudent).map(function (name) {
      return { name: name, count: absentByStudent[name] };
    }).sort(function (a, b) { return b.count - a.count; });

    return {
      avgRate: avgRate,
      totalRecords: totalRecords,
      totalAbsent: totalAbsent,
      totalLate: totalLate,
      mostAbsent: mostAbsent
    };
  }

  /* ================================================================== */
  /*  Daily Attendance Actions                                            */
  /* ================================================================== */

  function markAllPresent() {
    var selects = document.querySelectorAll('.attendance-status-select');
    selects.forEach(function (sel) {
      sel.value = 'present';
    });
    updateDailySummary();
    Toast.info('All students marked as present.');
  }

  function resetDaily() {
    var selects = document.querySelectorAll('.attendance-status-select');
    selects.forEach(function (sel) {
      sel.value = 'present';
    });
    var notes = document.querySelectorAll('.attendance-note-input');
    notes.forEach(function (inp) {
      inp.value = '';
    });
    updateDailySummary();
    Toast.info('Attendance form reset.');
  }

  function updateDailySummary() {
    // Read current statuses from the DOM
    var statuses = [];
    var selects = document.querySelectorAll('.attendance-status-select');
    selects.forEach(function (sel) {
      statuses.push({ status: sel.value });
    });
    var summary = computeSummary(statuses);

    // Find the summary container and update it
    var modeContent = document.getElementById('attendance-mode-content');
    if (!modeContent) return;

    var summaryHtml = '<div style="display:flex;gap:16px;flex:1;flex-wrap:wrap">'
      + '<div style="font-size:14px"><strong style="color:var(--success-600)">' + summary.present + '</strong> <span style="color:var(--gray-500)">Present</span></div>'
      + '<div style="font-size:14px"><strong style="color:var(--danger-600)">' + summary.absent + '</strong> <span style="color:var(--gray-500)">Absent</span></div>'
      + '<div style="font-size:14px"><strong style="color:var(--warning-600)">' + summary.late + '</strong> <span style="color:var(--gray-500)">Late</span></div>'
      + '<div style="font-size:14px;color:var(--gray-400)">|</div>'
      + '<div style="font-size:14px;color:var(--gray-500)">Total: <strong>' + summary.total + '</strong></div>'
      + '</div>';

    // Update summary row — find the first flex container that has the stats
    var summaryRow = modeContent.querySelector('div[style*="display:flex"]');
    // We'll re-render the entire daily mode instead for simplicity
    // But for better UX, update just the summary by targeting the first div with flex
  }

  function saveDailyAttendance() {
    var profile = window.App && window.App.state && window.App.state.profile;
    if (!profile) { Toast.error('Unable to identify current user.'); return; }

    var date = _dailyFilter.date;
    var classId = _dailyFilter.classId;
    var arm = _dailyFilter.arm;

    if (!date) { Toast.error('Please select a date.'); return; }
    if (!classId) { Toast.error('Please select a class.'); return; }

    var selects = document.querySelectorAll('.attendance-status-select');
    var noteInputs = document.querySelectorAll('.attendance-note-input');

    if (!selects.length) {
      Toast.warning('No students to record attendance for.');
      return;
    }

    var records = [];
    selects.forEach(function (sel, idx) {
      var studentId = sel.dataset.studentId;
      var status = sel.value;
      var note = noteInputs[idx] ? noteInputs[idx].value.trim() : '';
      records.push({
        studentId: studentId,
        classId: classId,
        arm: arm || null,
        date: date,
        status: status,
        note: note,
        schoolId: profile.schoolId,
        recordedBy: profile.uid,
        recordedByName: profile.displayName || '',
        sessionId: _getCurrentSessionId(),
        termId: _getCurrentTermId(),
        recordedAt: new Date().toISOString()
      });
    });

    Toast.info('Saving attendance (' + records.length + ' records)...');

    // Use DataService.recordAttendance or fall back to batch add
    var saveFn = DataService.recordAttendance || function (recs) {
      // Fallback: add each record individually
      var promises = recs.map(function (r) {
        return DataService.add('attendance', r);
      });
      return Promise.all(promises);
    };

    saveFn(records).then(function () {
      Toast.success('Attendance saved successfully for ' + records.length + ' students.');
      DataService.logAction('attendance_recorded', 'attendance', null, {
        date: date,
        classId: classId,
        arm: arm || 'all',
        count: records.length,
        className: getClassName(classId)
      });
    }).catch(function (err) {
      Toast.error('Failed to save attendance: ' + (err.message || 'Unknown error'));
    });
  }

  function _getCurrentSessionId() {
    var sel = document.getElementById('attendance-session');
    return sel ? sel.value : '';
  }

  function _getCurrentTermId() {
    var sel = document.getElementById('attendance-term');
    return sel ? sel.value : '';
  }

  /* ================================================================== */
  /*  Bind Events                                                       */
  /* ================================================================== */

  function bindEvents() {
    // Click delegation
    _clickHandler = function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      var mode = btn.dataset.mode;

      switch (action) {
        case 'switch-mode':
          e.preventDefault();
          e.stopPropagation();
          if (mode && mode !== _mode) {
            _mode = mode;
            _refreshModeContent();
            // Update tab button styles
            var tabContainer = btn.closest('.card');
            if (tabContainer) {
              tabContainer.querySelectorAll('.profile-tab').forEach(function (t) {
                var isActive = t.dataset.mode === mode;
                t.classList.toggle('active', isActive);
                t.style.color = isActive ? 'var(--primary-600)' : 'var(--gray-500)';
                t.style.borderBottom = isActive ? '2px solid var(--primary-600)' : '2px solid transparent';
              });
            }
          }
          break;

        case 'mark-all-present':
          e.preventDefault();
          e.stopPropagation();
          markAllPresent();
          break;

        case 'reset-daily':
          e.preventDefault();
          e.stopPropagation();
          resetDaily();
          break;

        case 'save-daily-attendance':
          e.preventDefault();
          e.stopPropagation();
          saveDailyAttendance();
          break;

        case 'apply-report-filter':
          e.preventDefault();
          e.stopPropagation();
          _readReportFilters();
          _refreshModeContent();
          break;

        case 'clear-report-filter':
          e.preventDefault();
          e.stopPropagation();
          _reportFilter = { classId: '', arm: '', dateFrom: '', dateTo: '', search: '' };
          _refreshModeContent();
          Toast.info('Report filters cleared.');
          break;
      }
    };

    document.addEventListener('click', _clickHandler);

    // Change/input events for filters and attendance selects
    _changeHandler = function (e) {
      var el = e.target;

      // Date change
      if (el.id === 'attendance-date') {
        _dailyFilter.date = el.value;
        if (_mode === 'daily') _refreshModeContent();
        return;
      }

      // Class change (main filter)
      if (el.id === 'attendance-class') {
        _dailyFilter.classId = el.value;
        _dailyFilter.arm = '';
        // Update arm dropdown
        var armSelect = document.getElementById('attendance-arm');
        if (armSelect) {
          armSelect.innerHTML = armOptions(el.value, '');
        }
        if (_mode === 'daily') _refreshModeContent();
        return;
      }

      // Arm change
      if (el.id === 'attendance-arm') {
        _dailyFilter.arm = el.value;
        if (_mode === 'daily') _refreshModeContent();
        return;
      }

      // Report class change — update arm dropdown
      if (el.id === 'report-filter-class') {
        _reportFilter.classId = el.value;
        _reportFilter.arm = '';
        var reportArmSelect = document.getElementById('report-filter-arm');
        if (reportArmSelect) {
          reportArmSelect.innerHTML = armOptions(el.value, '');
        }
        return;
      }

      // Status select change — update summary
      if (el.classList.contains('attendance-status-select')) {
        updateDailySummary();
        return;
      }
    };

    document.addEventListener('change', _changeHandler);

    // Debounced search for reports
    _inputHandler = Utils.debounce(function (e) {
      var el = e.target;
      if (el.id === 'report-filter-search') {
        _reportFilter.search = el.value.trim();
        _refreshModeContent();
      }
    }, 400);

    document.addEventListener('input', _inputHandler);
  }

  function _readReportFilters() {
    var classEl = document.getElementById('report-filter-class');
    var armEl = document.getElementById('report-filter-arm');
    var fromEl = document.getElementById('report-filter-from');
    var toEl = document.getElementById('report-filter-to');
    var searchEl = document.getElementById('report-filter-search');

    if (classEl) _reportFilter.classId = classEl.value;
    if (armEl) _reportFilter.arm = armEl.value;
    if (fromEl) _reportFilter.dateFrom = fromEl.value;
    if (toEl) _reportFilter.dateTo = toEl.value;
    if (searchEl) _reportFilter.search = searchEl.value.trim();
  }

  function _refreshModeContent() {
    var content = document.getElementById('attendance-mode-content');
    if (content) {
      content.innerHTML = _mode === 'daily' ? renderDailyMode() : renderReportsMode();
    }
  }

  /* ================================================================== */
  /*  Data Loading                                                      */
  /* ================================================================== */

  function loadAllData() {
    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    // Load classes
    if (typeof DataService.onSnapshot === 'function') {
      var unsubClass = DataService.onSnapshot('classes', function (data) {
        _classes = data || [];
      }, schoolId);
      if (typeof unsubClass === 'function') _listeners.push(unsubClass);
    }
    DataService.getBySchool('classes', schoolId).then(function (data) {
      _classes = data || [];
    }).catch(function () { /* ignore */ });

    // Load students
    var studentLoadFn = DataService.getStudents || function () { return DataService.getBySchool('students', schoolId); };
    studentLoadFn(schoolId).then(function (data) {
      _students = data || [];
      if (_mode === 'daily') {
        _refreshModeContent();
      }
    }).catch(function () { /* ignore */ });

    // Listen for student changes
    if (typeof DataService.onSnapshot === 'function') {
      var unsubStudents = DataService.onSnapshot('students', function (data) {
        _students = data || [];
        if (_mode === 'daily' && _dailyFilter.classId) {
          _refreshModeContent();
        }
      }, schoolId);
      if (typeof unsubStudents === 'function') _listeners.push(unsubStudents);
    }

    // Load attendance records
    if (typeof DataService.onSnapshot === 'function') {
      var unsubAtt = DataService.onSnapshot('attendance', function (data) {
        _attendanceRecords = data || [];
        if (_mode === 'reports') {
          _refreshModeContent();
        }
      }, schoolId);
      if (typeof unsubAtt === 'function') _listeners.push(unsubAtt);
    }

    // Initial attendance load (with date filtering if possible)
    var attLoadFn = DataService.getAttendance || function () { return DataService.getBySchool('attendance', schoolId); };
    attLoadFn(schoolId).then(function (data) {
      _attendanceRecords = data || [];
      if (_mode === 'reports') {
        _refreshModeContent();
      }
    }).catch(function () { /* ignore */ });

    // Load sessions (for filter)
    DataService.getBySchool('sessions', schoolId).then(function (data) {
      _sessions = data || [];
      var sel = document.getElementById('attendance-session');
      if (sel) sel.innerHTML = sessionOptions('');
    }).catch(function () { /* ignore */ });

    // Load terms (for filter)
    DataService.getBySchool('terms', schoolId).then(function (data) {
      _terms = data || [];
      var sel = document.getElementById('attendance-term');
      if (sel) sel.innerHTML = termOptions('');
    }).catch(function () { /* ignore */ });
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.attendance = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('attendance');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Attendance' }
      ]);
      return render();
    },

    bind: function () {
      setTimeout(function () {
        bindEvents();
        loadAllData();
      }, 0);
    },

    destroy: function () {
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

      _listeners.forEach(function (unsub) {
        if (typeof unsub === 'function') unsub();
      });
      _listeners = [];

      _mode = 'daily';
      _classes = [];
      _students = [];
      _attendanceRecords = [];
      _sessions = [];
      _terms = [];
      _dailyFilter = { date: '', classId: '', arm: '' };
      _reportFilter = { classId: '', arm: '', dateFrom: '', dateTo: '', search: '' };
    }
  };
})();