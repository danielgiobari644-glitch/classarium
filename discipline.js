/**
 * Classarium Discipline Management Module
 * Manage discipline cases with a structured workflow:
 * Teacher → Class Manager → Vice Principal → Action → Parent Notification.
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

  var INCIDENT_TYPES = ['Fighting', 'Bullying', 'Cheating', 'Dishonesty', 'Destruction', 'Vandalism', 'Truancy', 'Other'];
  var SEVERITY_LEVELS = ['Minor', 'Major', 'Critical'];
  var LOCATION_OPTIONS = ['Classroom', 'Corridor', 'Playground', 'Cafeteria', 'Other'];
  var STATUS_FLOW = ['Open', 'Under Investigation', 'Resolved', 'Closed'];
  var NOTIFICATION_METHODS = ['Phone Call', 'SMS', 'Email', 'In-Person Meeting', 'Letter'];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _cases = [];
  var _classes = [];
  var _students = [];
  var _staff = [];
  var _listeners = [];
  var _clickHandler = null;
  var _inputHandler = null;
  var _changeHandler = null;

  var _activeTab = 'incidents';
  var _selectedBlockId = '';
  var _filter = {
    status: '',
    severity: '',
    classId: '',
    dateFrom: '',
    dateTo: ''
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getProfile() {
    return window.App && window.App.state && window.App.state.profile || {};
  }

  function getSchoolId() {
    return getProfile().schoolId || '';
  }

  function getUid() {
    return getProfile().uid || '';
  }

  function getDisplayName() {
    return getProfile().displayName || '';
  }

  function getRole() {
    return getProfile().role || '';
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

  function getStudentName(id) {
    var s = _students.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ') || '\u2014') : '\u2014';
  }

  function getStaffName(id) {
    var s = _staff.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ') || '\u2014') : '\u2014';
  }

  function getClassName(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    return c ? (c.name || c.className || '\u2014') : '\u2014';
  }

  function getStudentClass(studentId) {
    var s = _students.find(function (x) { return x.id === studentId || x.uid === studentId; });
    return s ? (s.classId || '') : '';
  }

  function statusBadge(status) {
    var map = {
      'Open': { cls: 'warning' },
      'Under Investigation': { cls: 'info' },
      'Resolved': { cls: 'success' },
      'Closed': { cls: 'default' }
    };
    var s = map[status] || { cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + Utils.escapeHtml(status || 'Unknown') + '</span>';
  }

  function severityBadge(severity) {
    var map = {
      'Minor': { cls: 'info' },
      'Major': { cls: 'warning' },
      'Critical': { cls: 'danger' }
    };
    var s = map[severity] || { cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + Utils.escapeHtml(severity || 'Unknown') + '</span>';
  }

  function getFilteredCases() {
    return _cases.filter(function (c) {
      if (_filter.status && c.status !== _filter.status) return false;
      if (_filter.severity && c.severity !== _filter.severity) return false;
      if (_filter.classId) {
        var studentClass = getStudentClass(c.studentId);
        if (studentClass !== _filter.classId) return false;
      }
      if (_filter.dateFrom && c.date && c.date < _filter.dateFrom) return false;
      if (_filter.dateTo && c.date && c.date > _filter.dateTo) return false;
      return true;
    });
  }

  function getCasesByStatus(status) {
    return _cases.filter(function (c) { return c.status === status; });
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
    promises.push(DataService.getBySchool('staff', schoolId));
    return Promise.all(promises).then(function (results) {
      _classes = results[0] || [];
      _students = results[1] || [];
      _staff = results[2] || [];
    });
  }

  function loadCases() {
    var schoolId = getSchoolId();
    return DataService.getBySchool('disciplineCases', schoolId, { orderBy: 'timestamp', orderDir: 'desc' })
      .then(function (data) {
        _cases = data || [];
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
      return loadCases();
    }).then(function () {
      container.innerHTML = renderMainView();
      bindEvents();
    }).catch(function (err) {
      console.error('Error loading discipline module:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load discipline cases. Please refresh.');
      Toast.error('Failed to load discipline cases.');
    });
  }

  /* ================================================================== */
  /*  Main View                                                          */
  /* ================================================================== */

  function renderMainView() {
    var html = '<div class="discipline-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Discipline</h1>'
      + '<p class="page-header-description">Manage student discipline cases and workflow</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-primary" data-action="report-incident">Report Incident</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats
    var openCount = _cases.filter(function (c) { return c.status === 'Open'; }).length;
    var invCount = _cases.filter(function (c) { return c.status === 'Under Investigation'; }).length;
    var resCount = _cases.filter(function (c) { return c.status === 'Resolved'; }).length;
    var closedCount = _cases.filter(function (c) { return c.status === 'Closed'; }).length;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83D\uDD34', 'Open', openCount, 'var(--warning-600)');
    html += statCard('\uD83D\uDD35', 'Under Investigation', invCount, 'var(--info-600)');
    html += statCard('\u2705', 'Resolved', resCount, 'var(--success-600)');
    html += statCard('\uD83D\uDD35\uFE0F', 'Closed', closedCount, 'var(--gray-500)');
    html += '</div>';

    // Tabs
    html += '<div style="display:flex;border-bottom:2px solid var(--gray-200);margin-bottom:20px">'
      + tabButton('incidents', 'Incidents')
      + tabButton('workflow', 'Workflow')
      + '</div>';

    // Filter bar (Incidents tab only)
    if (_activeTab === 'incidents') {
      html += renderFilterBar();
    }

    // Tab content
    if (_activeTab === 'incidents') {
      html += renderIncidentsTab();
    } else {
      html += renderWorkflowTab();
    }

    html += '</div>';
    return html;
  }

  function tabButton(tab, label) {
    var isActive = _activeTab === tab;
    return '<button class="discipline-tab" data-action="switch-tab" data-tab="' + tab + '"'
      + ' style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;'
      + 'color:' + (isActive ? 'var(--primary-600)' : 'var(--gray-500)')
      + ';border-bottom:2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent')
      + ';margin-bottom:-2px;transition:all 0.15s">' + label + '</button>';
  }

  /* ================================================================== */
  /*  Filter Bar                                                         */
  /* ================================================================== */

  function renderFilterBar() {
    var html = '<div class="card" style="padding:14px 20px;margin-bottom:20px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">';

    // Status
    html += '<div style="min-width:160px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Status</label>'
      + '<select class="form-control form-control-sm" data-filter="status" style="font-size:13px">'
      + '<option value="">All Statuses</option>';
    STATUS_FLOW.forEach(function (s) {
      html += optionTag(s, s, _filter.status === s);
    });
    html += '</select></div>';

    // Severity
    html += '<div style="min-width:140px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Severity</label>'
      + '<select class="form-control form-control-sm" data-filter="severity" style="font-size:13px">'
      + '<option value="">All Severities</option>';
    SEVERITY_LEVELS.forEach(function (s) {
      html += optionTag(s, s, _filter.severity === s);
    });
    html += '</select></div>';

    // Class
    html += '<div style="min-width:160px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Class</label>'
      + '<select class="form-control form-control-sm" data-filter="classId" style="font-size:13px">'
      + '<option value="">All Classes</option>'
      + _classes.map(function (c) {
        return optionTag(c.id, c.name || c.className, _filter.classId === c.id);
      }).join('')
      + '</select></div>';

    // Date From
    html += '<div style="min-width:140px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">From</label>'
      + '<input type="date" class="form-control form-control-sm" data-filter="dateFrom" value="' + (_filter.dateFrom || '') + '" style="font-size:13px">'
      + '</div>';

    // Date To
    html += '<div style="min-width:140px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">To</label>'
      + '<input type="date" class="form-control form-control-sm" data-filter="dateTo" value="' + (_filter.dateTo || '') + '" style="font-size:13px">'
      + '</div>';

    // Clear
    html += '<button class="btn btn-outline-secondary btn-sm" data-action="clear-filters" style="margin-bottom:0;white-space:nowrap">Clear</button>';

    html += '</div></div>';
    return html;
  }

  /* ================================================================== */
  /*  Incidents Tab                                                      */
  /* ================================================================== */

  function renderIncidentsTab() {
    var filtered = getFilteredCases();

    if (!filtered.length) {
      return emptyState('\uD83D\uDD12', 'No Incidents Found', _cases.length === 0
        ? 'No discipline cases recorded yet. Click "Report Incident" to start.'
        : 'Try adjusting your filters.');
    }

    var html = '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:900px">'
      + '<thead><tr>'
      + '<th>Student</th>'
      + '<th>Incident Type</th>'
      + '<th>Severity</th>'
      + '<th>Date</th>'
      + '<th>Location</th>'
      + '<th>Status</th>'
      + '<th>Reported By</th>'
      + '<th>Actions</th>'
      + '</tr></thead><tbody>';

    filtered.forEach(function (c) {
      html += '<tr>'
        + '<td><strong>' + Utils.escapeHtml(getStudentName(c.studentId)) + '</strong></td>'
        + '<td>' + Utils.escapeHtml(c.type || '\u2014') + '</td>'
        + '<td>' + severityBadge(c.severity) + '</td>'
        + '<td>' + (c.date ? Utils.formatDate(c.date) : '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(c.location || '\u2014') + '</td>'
        + '<td>' + statusBadge(c.status) + '</td>'
        + '<td>' + Utils.escapeHtml(getStaffName(c.reportedBy)) + '</td>'
        + '<td>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="btn btn-sm btn-outline-primary" data-action="view-incident" data-id="' + c.id + '" title="View">\uD83D\uDC41</button>'
        + '</div></td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">Showing ' + filtered.length + ' case' + (filtered.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Workflow Tab (Kanban)                                              */
  /* ================================================================== */

  function renderWorkflowTab() {
    var statuses = [
      { key: 'Open', color: 'var(--warning-100)', border: 'var(--warning-300)', icon: '\uD83D\uDD34' },
      { key: 'Under Investigation', color: 'var(--info-100)', border: 'var(--info-300)', icon: '\uD83D\uDD0D' },
      { key: 'Resolved', color: 'var(--success-100)', border: 'var(--success-300)', icon: '\u2705' },
      { key: 'Closed', color: 'var(--gray-100)', border: 'var(--gray-300)', icon: '\uD83D\uDD35\uFE0F' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;min-height:400px">';

    statuses.forEach(function (col) {
      var cases = getCasesByStatus(col.key);
      html += '<div style="background:' + col.color + ';border:1px solid ' + col.border + ';border-radius:12px;padding:14px;display:flex;flex-direction:column">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'
        + '<span style="font-size:16px">' + col.icon + '</span>'
        + '<span style="font-weight:700;font-size:14px;color:var(--gray-800)">' + col.key + '</span>'
        + '<span style="background:var(--gray-600);color:white;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:auto">' + cases.length + '</span>'
        + '</div>'
        + '<div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px">';

      if (!cases.length) {
        html += '<div style="text-align:center;padding:30px 10px;color:var(--gray-400);font-size:13px">No cases</div>';
      }

      cases.forEach(function (c) {
        html += '<div class="card" style="padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'
          + '<strong style="font-size:13px;color:var(--gray-800)">' + Utils.escapeHtml(getStudentName(c.studentId)) + '</strong>'
          + severityBadge(c.severity)
          + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500);margin-bottom:4px">' + Utils.escapeHtml(c.type || '') + '</div>'
          + '<div style="font-size:11px;color:var(--gray-400);margin-bottom:10px">' + (c.date ? Utils.formatDate(c.date) : '') + '</div>';

        // Action buttons based on status
        if (c.status === 'Open') {
          html += '<button class="btn btn-sm btn-primary" style="width:100%" data-action="start-investigation" data-id="' + c.id + '">Start Investigation</button>';
        } else if (c.status === 'Under Investigation') {
          html += '<button class="btn btn-sm btn-success" style="width:100%" data-action="resolve-case" data-id="' + c.id + '">Resolve</button>';
        } else if (c.status === 'Resolved') {
          html += '<button class="btn btn-sm btn-outline-primary" style="width:100%" data-action="close-case" data-id="' + c.id + '">Close</button>';
        }

        html += '</div>';
      });

      html += '</div></div>';
    });

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  Report Incident Modal                                              */
  /* ================================================================== */

  function openReportIncidentModal() {
    var formHtml = '<form id="discipline-add-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Student <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" id="discipline-student-search" placeholder="Search student..." autocomplete="off">'
      + '<select class="form-control" name="studentId" id="discipline-student-select" required style="margin-top:6px">'
      + '<option value="">Select Student</option>';

    var groupedByClass = {};
    _students.forEach(function (s) {
      var cls = s.classId || 'unassigned';
      if (!groupedByClass[cls]) groupedByClass[cls] = [];
      groupedByClass[cls].push(s);
    });

    _classes.forEach(function (c) {
      var studs = groupedByClass[c.id] || [];
      if (!studs.length) return;
      formHtml += '<optgroup label="' + Utils.escapeHtml(c.name || c.className) + '">';
      studs.forEach(function (s) {
        var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
        formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + '</option>';
      });
      formHtml += '</optgroup>';
    });

    var unassigned = groupedByClass['unassigned'] || [];
    if (unassigned.length) {
      formHtml += '<optgroup label="Unassigned">';
      unassigned.forEach(function (s) {
        var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
        formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + '</option>';
      });
      formHtml += '</optgroup>';
    }

    formHtml += '</select></div>';

    // Incident Type
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Incident Type <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="type" required>'
      + '<option value="">Select Type</option>';
    INCIDENT_TYPES.forEach(function (t) {
      formHtml += optionTag(t, t);
    });
    formHtml += '</select></div>';

    // Severity
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Severity <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="severity" required>'
      + '<option value="">Select Severity</option>';
    SEVERITY_LEVELS.forEach(function (s) {
      formHtml += optionTag(s, s);
    });
    formHtml += '</select></div>';

    // Date
    var todayStr = new Date().toISOString().split('T')[0];
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" class="form-control" name="date" value="' + todayStr + '" required>'
      + '</div>';

    // Location
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Location <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="location" required>'
      + '<option value="">Select Location</option>';
    LOCATION_OPTIONS.forEach(function (l) {
      formHtml += optionTag(l, l);
    });
    formHtml += '</select></div>';

    // Description
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Description</label>'
      + '<textarea class="form-control" name="description" rows="3" placeholder="Describe the incident in detail..."></textarea>'
      + '</div>';

    // Evidence
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Evidence</label>'
      + '<input type="text" class="form-control" name="evidence" placeholder="Describe any evidence or file references...">'
      + '</div>';

    // Witnesses
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Witnesses</label>'
      + '<input type="text" class="form-control" name="witnesses" placeholder="Comma-separated names">'
      + '</div>';

    formHtml += '</form>';

    Modal.open({
      title: 'Report Incident',
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="discipline-save-btn">Submit Report</button>'
    });

    setTimeout(function () {
      // Searchable student dropdown
      var searchInput = document.getElementById('discipline-student-search');
      var studentSelect = document.getElementById('discipline-student-select');
      if (searchInput && studentSelect) {
        searchInput.addEventListener('input', function () {
          var q = this.value.toLowerCase();
          var opts = studentSelect.querySelectorAll('option');
          opts.forEach(function (opt) {
            if (!opt.value) return;
            opt.style.display = opt.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
        });
      }

      // Save
      var saveBtn = document.getElementById('discipline-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('discipline-add-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var caseData = {
            schoolId: getSchoolId(),
            studentId: fd.get('studentId'),
            type: fd.get('type'),
            severity: fd.get('severity'),
            date: fd.get('date'),
            location: fd.get('location'),
            description: fd.get('description'),
            evidence: fd.get('evidence'),
            witnesses: fd.get('witnesses'),
            status: 'Open',
            reportedBy: getUid(),
            assignedTo: '',
            resolution: '',
            actionTaken: '',
            penalty: '',
            parentNotified: false,
            timeline: [{
              action: 'Incident Reported',
              by: getUid(),
              date: new Date().toISOString(),
              note: 'Incident filed by ' + getDisplayName()
            }],
            timestamp: Date.now()
          };

          DataService.add('disciplineCases', caseData).then(function () {
            Modal.close();
            Toast.success('Incident reported successfully.');
            DataService.logAction('discipline_report', 'Reported ' + caseData.severity + ' ' + caseData.type + ' incident for ' + getStudentName(caseData.studentId));
            loadCases().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error saving incident:', err);
            Toast.error('Failed to report incident.');
          });
        });
      }
    }, 50);
  }

  /* ================================================================== */
  /*  View Incident Detail Modal                                         */
  /* ================================================================== */

  function openViewIncidentModal(caseId) {
    var c = _cases.find(function (x) { return x.id === caseId; });
    if (!c) return;

    var html = '<div>';

    // Info grid
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Student</div>'
      + '<div style="font-weight:600;color:var(--gray-800)">' + Utils.escapeHtml(getStudentName(c.studentId)) + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Incident Type</div>'
      + '<div style="font-weight:600;color:var(--gray-800)">' + Utils.escapeHtml(c.type || '\u2014') + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Severity</div>'
      + '<div>' + severityBadge(c.severity) + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Status</div>'
      + '<div>' + statusBadge(c.status) + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Date</div>'
      + '<div style="font-weight:600;color:var(--gray-800)">' + (c.date ? Utils.formatDate(c.date) : '\u2014') + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Location</div>'
      + '<div style="font-weight:600;color:var(--gray-800)">' + Utils.escapeHtml(c.location || '\u2014') + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Reported By</div>'
      + '<div style="font-weight:600;color:var(--gray-800)">' + Utils.escapeHtml(getStaffName(c.reportedBy)) + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:2px">Parent Notified</div>'
      + '<div>' + (c.parentNotified ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-default">No</span>') + '</div>'
      + '</div>';

    html += '</div>';

    // Description
    if (c.description) {
      html += '<div style="margin-bottom:16px">'
        + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:4px">Description</div>'
        + '<div style="padding:12px;background:var(--gray-50);border-radius:8px;font-size:13px;color:var(--gray-700);line-height:1.6">' + Utils.escapeHtml(c.description) + '</div>'
        + '</div>';
    }

    // Evidence & Witnesses
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:4px">Evidence</div>'
      + '<div style="font-size:13px;color:var(--gray-700)">' + Utils.escapeHtml(c.evidence || 'None') + '</div>'
      + '</div>';

    html += '<div>'
      + '<div style="font-size:12px;color:var(--gray-400);margin-bottom:4px">Witnesses</div>'
      + '<div style="font-size:13px;color:var(--gray-700)">' + Utils.escapeHtml(c.witnesses || 'None') + '</div>'
      + '</div>';

    html += '</div>';

    // Resolution details
    if (c.actionTaken || c.penalty) {
      html += '<div style="margin-bottom:16px;padding:14px;background:var(--success-50);border-radius:8px;border:1px solid var(--success-200)">'
        + '<div style="font-size:13px;font-weight:600;color:var(--success-800);margin-bottom:8px">Resolution Details</div>';

      if (c.actionTaken) {
        html += '<div style="font-size:12px;color:var(--gray-500);margin-bottom:2px">Action Taken</div>'
          + '<div style="font-size:13px;color:var(--gray-700);margin-bottom:8px">' + Utils.escapeHtml(c.actionTaken) + '</div>';
      }

      if (c.penalty) {
        html += '<div style="font-size:12px;color:var(--gray-500);margin-bottom:2px">Penalty / Consequence</div>'
          + '<div style="font-size:13px;color:var(--gray-700)">' + Utils.escapeHtml(c.penalty) + '</div>';
      }

      html += '</div>';
    }

    // Timeline
    html += '<div style="font-size:14px;font-weight:600;color:var(--gray-700);margin-bottom:12px">Timeline</div>';

    var timeline = c.timeline || [];
    if (!timeline.length) {
      html += '<p style="color:var(--gray-400);font-size:13px">No timeline entries.</p>';
    } else {
      html += '<div style="max-height:300px;overflow-y:auto">';
      timeline.slice().reverse().forEach(function (entry) {
        html += '<div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid var(--gray-100);align-items:flex-start">'
          + '<div style="width:10px;height:10px;border-radius:50%;margin-top:6px;flex-shrink:0;background:var(--primary-500)"></div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">'
          + '<span style="font-size:13px;font-weight:600;color:var(--gray-800)">' + Utils.escapeHtml(entry.action || '') + '</span>'
          + '<span style="font-size:11px;color:var(--gray-400)">' + (entry.date ? Utils.timeAgo(entry.date) : '') + '</span>'
          + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500);margin-top:2px">By: ' + Utils.escapeHtml(getStaffName(entry.by)) + '</div>'
          + (entry.note ? '<p style="margin:4px 0 0;font-size:12px;color:var(--gray-600);line-height:1.4">' + Utils.escapeHtml(entry.note) + '</p>' : '')
          + '</div></div>';
      });
      html += '</div>';
    }

    html += '</div>';

    Modal.open({
      title: 'Incident Details',
      content: html,
      size: 'lg',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Close</button>'
    });
  }

  /* ================================================================== */
  /*  Workflow Actions                                                   */
  /* ================================================================== */

  function openStartInvestigationModal(caseId) {
    var formHtml = '<form id="discipline-investigate-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Assign To (Class Manager)</label>'
      + '<select class="form-control" name="assignedTo">'
      + '<option value="">Select Staff</option>';
    _staff.forEach(function (s) {
      var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
      formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + '</option>';
    });
    formHtml += '</select></div>'
      + '<div class="form-group">'
      + '<label class="form-label">Investigation Notes</label>'
      + '<textarea class="form-control" name="note" rows="3" placeholder="Initial investigation notes..."></textarea>'
      + '</div>'
      + '</form>';

    Modal.open({
      title: 'Start Investigation',
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="discipline-investigate-btn">Start Investigation</button>'
    });

    setTimeout(function () {
      var btn = document.getElementById('discipline-investigate-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var form = document.getElementById('discipline-investigate-form');
          var fd = new FormData(form);
          var assignedTo = fd.get('assignedTo') || getUid();
          var note = fd.get('note') || '';

          var updates = {
            status: 'Under Investigation',
            assignedTo: assignedTo,
            timeline: (function () {
              var c = _cases.find(function (x) { return x.id === caseId; });
              var existing = (c && c.timeline) ? c.timeline.slice() : [];
              existing.push({
                action: 'Investigation Started',
                by: getUid(),
                date: new Date().toISOString(),
                note: note || 'Assigned to ' + getStaffName(assignedTo)
              });
              return existing;
            })()
          };

          DataService.update('disciplineCases', getSchoolId(), caseId, updates).then(function () {
            Modal.close();
            Toast.success('Investigation started.');
            DataService.logAction('discipline_investigate', 'Started investigation for discipline case ' + caseId);
            loadCases().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function () {
            Toast.error('Failed to start investigation.');
          });
        });
      }
    }, 50);
  }

  function openResolveCaseModal(caseId) {
    var formHtml = '<form id="discipline-resolve-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Action Taken <span style="color:var(--danger-500)">*</span></label>'
      + '<textarea class="form-control" name="actionTaken" rows="3" placeholder="Describe the resolution actions..." required></textarea>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Penalty / Consequence</label>'
      + '<input type="text" class="form-control" name="penalty" placeholder="e.g., Suspension for 3 days, Warning letter...">'
      + '</div>'
      + '</form>';

    Modal.open({
      title: 'Resolve Case',
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-success" id="discipline-resolve-btn">Resolve Case</button>'
    });

    setTimeout(function () {
      var btn = document.getElementById('discipline-resolve-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var form = document.getElementById('discipline-resolve-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var updates = {
            status: 'Resolved',
            actionTaken: fd.get('actionTaken'),
            penalty: fd.get('penalty'),
            timeline: (function () {
              var c = _cases.find(function (x) { return x.id === caseId; });
              var existing = (c && c.timeline) ? c.timeline.slice() : [];
              existing.push({
                action: 'Case Resolved',
                by: getUid(),
                date: new Date().toISOString(),
                note: fd.get('actionTaken') + (fd.get('penalty') ? ' | Penalty: ' + fd.get('penalty') : '')
              });
              return existing;
            })()
          };

          DataService.update('disciplineCases', getSchoolId(), caseId, updates).then(function () {
            Modal.close();
            Toast.success('Case resolved.');
            DataService.logAction('discipline_resolve', 'Resolved discipline case ' + caseId);
            loadCases().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function () {
            Toast.error('Failed to resolve case.');
          });
        });
      }
    }, 50);
  }

  function openCloseCaseModal(caseId) {
    var formHtml = '<form id="discipline-close-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Final Action / Notes</label>'
      + '<textarea class="form-control" name="note" rows="3" placeholder="Any final notes before closing..."></textarea>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">'
      + '<input type="checkbox" name="parentNotified" id="discipline-parent-notified" style="accent-color:var(--primary-500);width:18px;height:18px"> '
      + '<span>Parent Notified</span></label>'
      + '</div>'
      + '<div class="form-group" id="discipline-notification-method-group" style="display:none">'
      + '<label class="form-label">Notification Method</label>'
      + '<select class="form-control" name="notificationMethod">'
      + '<option value="">Select Method</option>';
    NOTIFICATION_METHODS.forEach(function (m) {
      formHtml += optionTag(m, m);
    });
    formHtml += '</select></div>'
      + '</form>';

    Modal.open({
      title: 'Close Case',
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="discipline-close-btn">Close Case</button>'
    });

    setTimeout(function () {
      var parentCheckbox = document.getElementById('discipline-parent-notified');
      var methodGroup = document.getElementById('discipline-notification-method-group');
      if (parentCheckbox && methodGroup) {
        parentCheckbox.addEventListener('change', function () {
          methodGroup.style.display = this.checked ? '' : 'none';
        });
      }

      var btn = document.getElementById('discipline-close-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var form = document.getElementById('discipline-close-form');
          var fd = new FormData(form);
          var parentNotified = !!fd.get('parentNotified');
          var note = fd.get('note') || 'Case closed by ' + getDisplayName();
          var notifMethod = fd.get('notificationMethod') || '';

          var updates = {
            status: 'Closed',
            parentNotified: parentNotified,
            resolution: (function () {
              var c = _cases.find(function (x) { return x.id === caseId; });
              return (c && c.resolution ? c.resolution + '\n' : '') + note;
            })(),
            timeline: (function () {
              var c = _cases.find(function (x) { return x.id === caseId; });
              var existing = (c && c.timeline) ? c.timeline.slice() : [];
              var timelineNote = note;
              if (parentNotified) {
                timelineNote += ' | Parent notified via ' + (notifMethod || 'unspecified method');
              }
              existing.push({
                action: 'Case Closed',
                by: getUid(),
                date: new Date().toISOString(),
                note: timelineNote
              });
              return existing;
            })()
          };

          DataService.update('disciplineCases', getSchoolId(), caseId, updates).then(function () {
            Modal.close();
            Toast.success('Case closed.');
            DataService.logAction('discipline_close', 'Closed discipline case ' + caseId + (parentNotified ? ' (parent notified)' : ''));
            loadCases().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function () {
            Toast.error('Failed to close case.');
          });
        });
      }
    }, 50);
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
          _activeTab = tab || 'incidents';
          var container = document.getElementById('main-content');
          if (container) container.innerHTML = renderMainView();
          bindEvents();
          break;

        case 'report-incident':
          e.preventDefault();
          e.stopPropagation();
          openReportIncidentModal();
          break;

        case 'view-incident':
          e.preventDefault();
          e.stopPropagation();
          openViewIncidentModal(id);
          break;

        case 'start-investigation':
          e.preventDefault();
          e.stopPropagation();
          openStartInvestigationModal(id);
          break;

        case 'resolve-case':
          e.preventDefault();
          e.stopPropagation();
          openResolveCaseModal(id);
          break;

        case 'close-case':
          e.preventDefault();
          e.stopPropagation();
          openCloseCaseModal(id);
          break;

        case 'clear-filters':
          e.preventDefault();
          e.stopPropagation();
          _filter = { status: '', severity: '', classId: '', dateFrom: '', dateTo: '' };
          var c2 = document.getElementById('main-content');
          if (c2) c2.innerHTML = renderMainView();
          bindEvents();
          break;
      }
    };

    document.addEventListener('click', _clickHandler);

    _changeHandler = function (e) {
      var el = e.target;
      if (!el || !el.dataset.filter) return;
      var filterKey = el.dataset.filter;
      _filter[filterKey] = el.value;
      var container = document.getElementById('main-content');
      if (container) {
        container.innerHTML = renderMainView();
        bindEvents();
      }
    };

    _inputHandler = Utils.debounce(function (e) {
      var el = e.target;
      if (!el || !el.dataset.filter) return;
      var filterKey = el.dataset.filter;
      _filter[filterKey] = el.value;
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

  window.Modules.discipline = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('discipline');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Discipline' }
      ]);
      _activeTab = 'incidents';
      _filter = { status: '', severity: '', classId: '', dateFrom: '', dateTo: '' };
      render();
    },

    destroy: function () {
      cleanup();
      _cases = [];
      _classes = [];
      _students = [];
      _staff = [];
      _activeTab = 'incidents';
      _filter = { status: '', severity: '', classId: '', dateFrom: '', dateTo: '' };
    }
  };
})();