/**
 * Classarium Timetable Module
 * Manage Class, Teacher, and Exam timetables.
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

  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  var PERIODS = 8;
  var TIME_SLOTS = [
    '8:00 - 8:40',
    '8:40 - 9:20',
    '9:20 - 10:00',
    '10:00 - 10:40',
    '10:40 - 11:20',
    '11:20 - 12:00',
    '12:00 - 12:40',
    '2:00 - 2:40'
  ];

  var TABS = [
    { key: 'class', label: 'Class Timetable', icon: '\uD83D\uDCDA' },
    { key: 'teacher', label: 'Teacher Timetable', icon: '\uD83D\uDC68\u200D\uD83C\uDFEB' },
    { key: 'exam', label: 'Exam Timetable', icon: '\uD83D\uDCDD' }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _activeTab = 'class';
  var _classes = [];
  var _subjects = [];
  var _staff = [];
  var _sessions = [];
  var _terms = [];
  var _timetableEntries = [];
  var _examEntries = [];
  var _listeners = [];
  var _clickHandler = null;
  var _filters = {
    classId: '',
    arm: '',
    teacherId: ''
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

  function getClassName(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    return c ? (c.name || '\u2014') : '\u2014';
  }

  function getSubjectName(id) {
    var s = _subjects.find(function (x) { return x.id === id; });
    return s ? (s.name || '\u2014') : '\u2014';
  }

  function getStaffName(id) {
    var s = _staff.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || (s.firstName + ' ' + s.lastName) || '\u2014') : '\u2014';
  }

  function getTeacherStaff() {
    return _staff.filter(function (s) {
      return s.role === 'teacher' || s.role === 'school_admin' || s.role === 'vice_principal';
    });
  }

  function getArmsForClass(classId) {
    var cls = _classes.find(function (c) { return c.id === classId; });
    if (!cls || !cls.arms) return [];
    return cls.arms;
  }

  function getClassArmKey() {
    return _filters.classId && _filters.arm
      ? _filters.classId + '_' + _filters.arm
      : '';
  }

  function getActiveSession() {
    return _sessions.find(function (s) { return s.status === 'active'; }) || _sessions[0] || null;
  }

  function getActiveTerm() {
    return _terms.find(function (t) { return t.status === 'active'; }) || _terms[0] || null;
  }

  function statusBadge(status) {
    var map = {
      active: { text: 'Active', cls: 'success' },
      draft: { text: 'Draft', cls: 'warning' },
      upcoming: { text: 'Upcoming', cls: 'info' },
      completed: { text: 'Completed', cls: 'default' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
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

  function getSubjectColor(subjectName) {
    if (!subjectName) return 'transparent';
    var colors = [
      '#EEF2FF', '#FEF3C7', '#ECFDF5', '#FFF1F2', '#F5F3FF',
      '#F0FDFA', '#FFFBEB', '#FDF2F8', '#EFF6FF', '#F0FDF4'
    ];
    var hash = 0;
    for (var i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    return Promise.all([
      DataService.getBySchool('classes', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('subjects', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('staff', schoolId),
      DataService.getBySchool('sessions', schoolId),
      DataService.getBySchool('terms', schoolId)
    ]).then(function (results) {
      _classes = results[0] || [];
      _subjects = results[1] || [];
      _staff = results[2] || [];
      _sessions = results[3] || [];
      _terms = results[4] || [];

      // Auto-select first class and arm
      if (!_filters.classId && _classes.length) {
        _filters.classId = _classes[0].id;
        var arms = getArmsForClass(_classes[0].id);
        if (arms.length) _filters.arm = arms[0];
      }
      if (!_filters.teacherId && _staff.length) {
        _filters.teacherId = _staff[0].id || _staff[0].uid || '';
      }
    });
  }

  function loadTimetableData() {
    var schoolId = getSchoolId();
    var classArm = getClassArmKey();
    if (!classArm) return Promise.resolve();

    return DataService.getBySchool('timetable', schoolId)
      .then(function (all) {
        _timetableEntries = (all || []).filter(function (e) {
          return e.type === 'class' && e.classArm === classArm;
        });
      });
  }

  function loadExamData() {
    var schoolId = getSchoolId();
    return DataService.getBySchool('timetable', schoolId)
      .then(function (all) {
        _examEntries = (all || []).filter(function (e) {
          return e.type === 'exam';
        });
      });
  }

  /* ================================================================== */
  /*  Render — Main Page                                                 */
  /* ================================================================== */

  function render() {
    var html = '<div class="timetable-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Timetable</h1>'
      + '<p class="page-header-description">Manage class, teacher and exam timetables</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Tabs
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200);overflow-x:auto">'
      + TABS.map(function (tab) {
        var isActive = _activeTab === tab.key;
        return '<button class="profile-tab' + (isActive ? ' active' : '') + '" data-action="switch-tab" data-tab="' + tab.key + '" style="white-space:nowrap;padding:14px 20px;font-size:14px;font-weight:500;border:none;background:none;cursor:pointer;color:' + (isActive ? 'var(--primary-600)' : 'var(--gray-500)') + ';border-bottom:2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent') + ';transition:all 0.15s">'
          + tab.icon + ' ' + tab.label
          + '</button>';
      }).join('')
      + '</div>'
      + '<div class="card-body" id="timetable-tab-content">'
      + renderTabContent()
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  function renderTabContent() {
    switch (_activeTab) {
      case 'class': return renderClassTimetable();
      case 'teacher': return renderTeacherTimetable();
      case 'exam': return renderExamTimetable();
      default: return renderClassTimetable();
    }
  }

  function refreshTabContent() {
    var content = document.getElementById('timetable-tab-content');
    if (content) {
      content.innerHTML = renderTabContent();
    }
  }

  /* ================================================================== */
  /*  CLASS TIMETABLE                                                    */
  /* ================================================================== */

  function renderClassTimetable() {
    var html = '';

    // Filter bar
    html += '<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap">';

    html += '<div style="flex:1;min-width:160px">'
      + '<label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">Class</label>'
      + '<select id="tt-class-filter" class="form-select" data-action="filter-class" style="width:100%">'
      + '<option value="">Select Class</option>'
      + _classes.map(function (c) {
        return optionTag(c.id, c.name, _filters.classId === c.id);
      }).join('')
      + '</select></div>';

    var arms = getArmsForClass(_filters.classId);
    html += '<div style="flex:1;min-width:120px">'
      + '<label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">Arm</label>'
      + '<select id="tt-arm-filter" class="form-select" data-action="filter-arm" style="width:100%">'
      + '<option value="">Select Arm</option>'
      + arms.map(function (a) {
        return optionTag(a, a, _filters.arm === a);
      }).join('')
      + '</select></div>';

    html += '<div style="display:flex;gap:8px;flex-shrink:0">'
      + '<button class="btn btn-ghost" data-action="auto-generate" style="font-size:13px;white-space:nowrap">\u26A1 Auto Generate</button>'
      + '<button class="btn btn-primary" data-action="save-timetable" style="font-size:13px;white-space:nowrap">\uD83D\uDCBE Save Timetable</button>'
      + '</div>';

    html += '</div>';

    // Grid
    if (!_filters.classId || !_filters.arm) {
      html += emptyState('\uD83D\uDCDA', 'Select a Class', 'Choose a class and arm above to view the timetable.');
      return html;
    }

    html += '<div style="overflow-x:auto;border:1px solid var(--gray-200);border-radius:8px">';

    html += '<table class="data-table" style="min-width:900px;margin:0" id="class-timetable-grid">';
    html += '<thead><tr><th style="width:110px;background:var(--gray-50);position:sticky;left:0;z-index:1">Day / Period</th>';
    for (var p = 0; p < PERIODS; p++) {
      html += '<th style="text-align:center;min-width:140px"><div style="font-weight:600">P' + (p + 1) + '</div><div style="font-size:11px;color:var(--gray-500);font-weight:400">' + TIME_SLOTS[p] + '</div></th>';
    }
    html += '</tr></thead><tbody>';

    DAYS.forEach(function (day, di) {
      html += '<tr>';
      html += '<td style="font-weight:600;background:var(--gray-50);position:sticky;left:0;z-index:1;white-space:nowrap">' + day + '</td>';
      for (var pi = 0; pi < PERIODS; pi++) {
        var entry = findEntry(day, pi + 1);
        var cellStyle = 'cursor:pointer;min-height:60px;vertical-align:top;padding:6px 8px;transition:background 0.15s';
        if (entry) {
          var bgColor = getSubjectColor(entry.subjectName);
          html += '<td style="' + cellStyle + ';background:' + bgColor + '" data-action="edit-cell" data-day="' + day + '" data-period="' + (pi + 1) + '" class="timetable-cell">'
            + '<div style="font-weight:600;font-size:13px;color:var(--gray-800)">' + Utils.escapeHtml(entry.subjectName || '') + '</div>'
            + '<div style="font-size:11px;color:var(--gray-600);margin-top:2px">' + Utils.escapeHtml(entry.teacherName || '') + '</div>'
            + '</td>';
        } else {
          html += '<td style="' + cellStyle + '" data-action="edit-cell" data-day="' + day + '" data-period="' + (pi + 1) + '" class="timetable-cell">'
            + '<div style="color:var(--gray-300);font-size:20px;text-align:center;opacity:0.5">+</div>'
            + '</td>';
        }
      }
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function findEntry(day, period) {
    return _timetableEntries.find(function (e) {
      return e.day === day && e.period === period;
    });
  }

  /* ================================================================== */
  /*  TEACHER TIMETABLE                                                  */
  /* ================================================================== */

  function renderTeacherTimetable() {
    var html = '';

    // Filter bar
    html += '<div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap">';
    html += '<div style="flex:1;min-width:220px">'
      + '<label class="form-label" style="font-size:12px;font-weight:600;margin-bottom:4px;display:block">Teacher</label>'
      + '<select id="tt-teacher-filter" class="form-select" data-action="filter-teacher" style="width:100%">'
      + '<option value="">Select Teacher</option>'
      + getTeacherStaff().map(function (s) {
        var name = s.displayName || (s.firstName + ' ' + s.lastName);
        var val = s.id || s.uid || '';
        return optionTag(val, name, _filters.teacherId === val);
      }).join('')
      + '</select></div>';
    html += '</div>';

    if (!_filters.teacherId) {
      html += emptyState('\uD83D\uDC68\u200D\uD83C\uDFEB', 'Select a Teacher', 'Choose a teacher above to view their timetable.');
      return html;
    }

    var teacherName = getStaffName(_filters.teacherId);

    html += '<div style="margin-bottom:16px"><h3 style="margin:0;font-size:16px;font-weight:600">'
      + Utils.escapeHtml(teacherName) + '</h3>'
      + '<p style="margin:4px 0 0;font-size:13px;color:var(--gray-500)">Weekly Schedule</p></div>';

    html += '<div style="overflow-x:auto;border:1px solid var(--gray-200);border-radius:8px">';
    html += '<table class="data-table" style="min-width:900px;margin:0">';
    html += '<thead><tr><th style="width:110px;background:var(--gray-50);position:sticky;left:0;z-index:1">Day / Period</th>';
    for (var p = 0; p < PERIODS; p++) {
      html += '<th style="text-align:center;min-width:140px"><div style="font-weight:600">P' + (p + 1) + '</div><div style="font-size:11px;color:var(--gray-500);font-weight:400">' + TIME_SLOTS[p] + '</div></th>';
    }
    html += '</tr></thead><tbody>';

    var hasAny = false;
    DAYS.forEach(function (day) {
      html += '<tr>';
      html += '<td style="font-weight:600;background:var(--gray-50);position:sticky;left:0;z-index:1;white-space:nowrap">' + day + '</td>';
      for (var pi = 0; pi < PERIODS; pi++) {
        var entry = _timetableEntries.find(function (e) {
          return e.day === day && e.period === (pi + 1) && e.teacherId === _filters.teacherId;
        });
        if (entry) {
          hasAny = true;
          var bgColor = getSubjectColor(entry.subjectName);
          html += '<td style="background:' + bgColor + ';vertical-align:top;padding:6px 8px">'
            + '<div style="font-weight:600;font-size:13px;color:var(--gray-800)">' + Utils.escapeHtml(entry.subjectName || '') + '</div>'
            + '<div style="font-size:11px;color:var(--gray-600);margin-top:2px">' + Utils.escapeHtml(entry.classArm || '') + '</div>'
            + '</td>';
        } else {
          html += '<td style="vertical-align:top;padding:6px 8px">'
            + '<div style="color:var(--gray-300);font-size:20px;text-align:center;opacity:0.4">\u2014</div>'
            + '</td>';
        }
      }
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  EXAM TIMETABLE                                                    */
  /* ================================================================== */

  function renderExamTimetable() {
    var html = '';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Exam Schedule</h3>'
      + '<button class="btn btn-primary" data-action="add-exam">\uFF0B Add Exam</button>'
      + '</div>';

    if (!_examEntries.length) {
      html += emptyState('\uD83D\uDCDD', 'No Exam Schedule', 'Add exam entries to build the exam timetable.');
      return html;
    }

    // Sort by date
    var sorted = _examEntries.slice().sort(function (a, b) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
    });

    html += '<div class="data-table-wrapper"><table class="data-table">'
      + '<thead><tr>'
      + '<th>Date</th>'
      + '<th>Time</th>'
      + '<th>Subject</th>'
      + '<th>Class</th>'
      + '<th>Room</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody>';

    sorted.forEach(function (e) {
      html += '<tr>'
        + '<td>' + (e.date ? Utils.formatDate(e.date) : '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(e.time || '\u2014') + '</td>'
        + '<td style="font-weight:500">' + Utils.escapeHtml(e.subjectName || '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(e.classArm || '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(e.room || '\u2014') + '</td>'
        + '<td style="text-align:right">'
        + '<div style="display:flex;gap:4px;justify-content:flex-end">'
        + '<button class="btn btn-sm btn-ghost" data-action="edit-exam" data-id="' + (e.id || '') + '">Edit</button> '
        + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-exam" data-id="' + (e.id || '') + '">Delete</button>'
        + '</div></td></tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  Modals                                                             */
  /* ================================================================== */

  function openEditCellModal(day, period) {
    var existing = findEntry(day, period);

    var classOpts = _subjects.map(function (s) {
      return optionTag(s.id, s.name, existing && existing.subjectId === s.id);
    }).join('');

    var teacherOpts = getTeacherStaff().map(function (s) {
      var name = s.displayName || (s.firstName + ' ' + s.lastName);
      var val = s.id || s.uid || '';
      return optionTag(val, name, existing && existing.teacherId === val);
    }).join('');

    var formHtml = '<div class="modal-form" id="cell-edit-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div style="padding:10px 14px;background:var(--gray-50);border-radius:6px;font-size:13px;color:var(--gray-600)">'
      + '<strong>' + day + '</strong> \u2014 Period ' + period + ' (' + TIME_SLOTS[period - 1] + ')'
      + '</div>'
      + '<div><label class="form-label">Subject <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="subjectId" class="form-select" id="cell-subject-select">'
      + '<option value="">Select Subject</option>' + classOpts + '</select></div>'
      + '<div><label class="form-label">Teacher <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="teacherId" class="form-select" id="cell-teacher-select">'
      + '<option value="">Select Teacher</option>' + teacherOpts + '</select></div>';

    if (existing) {
      formHtml += '<div style="text-align:right">'
        + '<button class="btn btn-ghost" style="color:var(--danger-600);font-size:13px" data-action="clear-cell" data-day="' + day + '" data-period="' + period + '">\u2716 Clear This Slot</button>'
        + '</div>';
    }

    formHtml += '</div></div>';

    Modal.open('Set Period \u2014 ' + day + ' P' + period, formHtml, {
      size: 'medium',
      actions: [{
        label: existing ? 'Update' : 'Set',
        className: 'btn btn-primary',
        onClick: function () { saveCellEntry(day, period, existing); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function saveCellEntry(day, period, existing) {
    var form = document.getElementById('cell-edit-form');
    if (!form) return;

    var subjectId = form.querySelector('[name="subjectId"]').value;
    var teacherId = form.querySelector('[name="teacherId"]').value;

    if (!subjectId) {
      Toast.error('Please select a subject.');
      return;
    }
    if (!teacherId) {
      Toast.error('Please select a teacher.');
      return;
    }

    var session = getActiveSession();
    var term = getActiveTerm();
    var classArm = getClassArmKey();

    var data = {
      schoolId: getSchoolId(),
      type: 'class',
      classArm: classArm,
      day: day,
      period: period,
      subjectId: subjectId,
      subjectName: getSubjectName(subjectId),
      teacherId: teacherId,
      teacherName: getStaffName(teacherId),
      sessionId: session ? session.id : '',
      termId: term ? term.id : ''
    };

    if (existing && existing.id) {
      DataService.update('timetable', existing.id, data).then(function () {
        Toast.success('Timetable slot updated.');
        Modal.close();
        loadTimetableData().then(function () { refreshTabContent(); });
        DataService.logAction('timetable_updated', 'timetable', existing.id, { day: day, period: period });
      }).catch(function (err) {
        Toast.error('Failed to update: ' + (err.message || 'Unknown error'));
      });
    } else {
      DataService.add('timetable', data).then(function () {
        Toast.success('Timetable slot set.');
        Modal.close();
        loadTimetableData().then(function () { refreshTabContent(); });
        DataService.logAction('timetable_entry_created', 'timetable', null, { day: day, period: period });
      }).catch(function (err) {
        Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function clearCellEntry(day, period) {
    var existing = findEntry(day, period);
    if (!existing || !existing.id) {
      Toast.info('This slot is already empty.');
      Modal.close();
      return;
    }

    Modal.confirm(
      'Clear Slot',
      'Are you sure you want to clear <strong>' + day + ' Period ' + period + '</strong>?',
      function () {
        DataService.remove('timetable', existing.id).then(function () {
          Toast.success('Slot cleared.');
          Modal.close();
          loadTimetableData().then(function () { refreshTabContent(); });
          DataService.logAction('timetable_slot_cleared', 'timetable', existing.id, { day: day, period: period });
        }).catch(function (err) {
          Toast.error('Failed to clear: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Auto Generate                                                      */
  /* ------------------------------------------------------------------ */

  function autoGenerate() {
    var classArm = getClassArmKey();
    if (!classArm) {
      Toast.error('Select a class and arm first.');
      return;
    }

    var teacherList = getTeacherStaff();
    if (!_subjects.length || !teacherList.length) {
      Toast.error('Need at least one subject and one teacher to auto-generate.');
      return;
    }

    Modal.confirm(
      'Auto Generate Timetable',
      'This will fill all empty slots with subjects and teachers. <strong>Existing entries will not be overwritten.</strong> Conflicts (same teacher in two slots at the same time) will be avoided. Continue?',
      function () {
        performAutoGenerate(classArm, teacherList);
      }
    );
  }

  function performAutoGenerate(classArm, teacherList) {
    Toast.info('Generating timetable\u2026');

    var session = getActiveSession();
    var term = getActiveTerm();

    // Build a map of existing occupied slots per teacher
    var teacherSlots = {}; // teacherId -> Set of "day-period"
    _timetableEntries.forEach(function (e) {
      var key = e.teacherId + '|' + e.day + '|' + e.period;
      teacherSlots[key] = true;
    });

    // Build existing entry keys for this class
    var existingKeys = {};
    _timetableEntries.forEach(function (e) {
      existingKeys[e.day + '-' + e.period] = true;
    });

    // Shuffle subjects for variety
    var subjectPool = _subjects.slice();
    for (var si = subjectPool.length - 1; si > 0; si--) {
      var sj = Math.floor(Math.random() * (si + 1));
      var tmp = subjectPool[si];
      subjectPool[si] = subjectPool[sj];
      subjectPool[sj] = tmp;
    }

    var subjectIndex = 0;
    var batchSize = 0;
    var maxBatch = 40;
    var promises = [];

    DAYS.forEach(function (day) {
      for (var p = 1; p <= PERIODS; p++) {
        if (existingKeys[day + '-' + p]) continue; // skip occupied

        var subject = subjectPool[subjectIndex % subjectPool.length];
        subjectIndex++;

        // Find an available teacher (no conflict)
        var assignedTeacher = null;
        for (var ti = 0; ti < teacherList.length; ti++) {
          var tKey = (teacherList[ti].id || teacherList[ti].uid) + '|' + day + '|' + p;
          if (!teacherSlots[tKey]) {
            assignedTeacher = teacherList[ti];
            teacherSlots[tKey] = true; // mark as occupied
            break;
          }
        }

        if (!assignedTeacher) continue; // all teachers busy

        var tId = assignedTeacher.id || assignedTeacher.uid;
        var data = {
          schoolId: getSchoolId(),
          type: 'class',
          classArm: classArm,
          day: day,
          period: p,
          subjectId: subject.id,
          subjectName: subject.name,
          teacherId: tId,
          teacherName: assignedTeacher.displayName || (assignedTeacher.firstName + ' ' + assignedTeacher.lastName),
          sessionId: session ? session.id : '',
          termId: term ? term.id : ''
        };

        promises.push(DataService.add('timetable', data));
        batchSize++;

        if (batchSize >= maxBatch) {
          // Process in batches
          var currentBatch = promises.splice(0, maxBatch);
          // Keep going, collect all promises
          batchSize = 0;
        }
      }
    });

    Promise.all(promises).then(function () {
      Toast.success('Timetable generated successfully!');
      DataService.logAction('timetable_auto_generated', 'timetable', null, { classArm: classArm });
      return loadTimetableData();
    }).then(function () {
      refreshTabContent();
    }).catch(function (err) {
      Toast.error('Error generating timetable: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Save Timetable (full replace)                                      */
  /* ------------------------------------------------------------------ */

  function saveFullTimetable() {
    var classArm = getClassArmKey();
    if (!classArm) {
      Toast.error('Select a class and arm first.');
      return;
    }

    Toast.info('Timetable is saved in real-time as you edit each slot.');
  }

  /* ================================================================== */
  /*  EXAM CRUD                                                          */
  /* ================================================================== */

  function openAddExamModal(existing) {
    var classOpts = _classes.map(function (c) {
      var arms = getArmsForClass(c.id);
      if (arms.length === 0) {
        return optionTag(c.id + '_', c.name, existing && existing.classId === c.id);
      }
      return arms.map(function (a) {
        var val = c.id + '_' + a;
        var label = c.name + ' (' + a + ')';
        return optionTag(val, label, existing && existing.classArm === val);
      }).join('');
    }).join('');

    var subjectOpts = _subjects.map(function (s) {
      return optionTag(s.id, s.name, existing && existing.subjectId === s.id);
    }).join('');

    var formHtml = '<div class="modal-form" id="exam-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="date" class="form-input" value="' + Utils.escapeHtml(existing ? (existing.date || '') : '') + '"></div>'
      + '<div><label class="form-label">Time <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="time" name="time" class="form-input" value="' + Utils.escapeHtml(existing ? (existing.time || '') : '') + '"></div>'
      + '</div>'
      + '<div><label class="form-label">Subject <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="subjectId" class="form-select">'
      + '<option value="">Select Subject</option>' + subjectOpts + '</select></div>'
      + '<div><label class="form-label">Class / Arm <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="classArm" class="form-select">'
      + '<option value="">Select Class</option>' + classOpts + '</select></div>'
      + '<div><label class="form-label">Room</label>'
      + '<input type="text" name="room" class="form-input" placeholder="e.g. Hall A, Room 12" value="' + Utils.escapeHtml(existing ? (existing.room || '') : '') + '"></div>'
      + '</div></div>';

    Modal.open(existing ? 'Edit Exam Entry' : 'Add Exam Entry', formHtml, {
      size: 'medium',
      actions: [{
        label: existing ? 'Update' : 'Add Exam',
        className: 'btn btn-primary',
        onClick: function () { saveExamEntry(existing); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function saveExamEntry(existing) {
    var form = document.getElementById('exam-form');
    if (!form) return;

    var date = form.querySelector('[name="date"]').value;
    var time = form.querySelector('[name="time"]').value;
    var subjectId = form.querySelector('[name="subjectId"]').value;
    var classArm = form.querySelector('[name="classArm"]').value;
    var room = form.querySelector('[name="room"]').value.trim();

    if (!date || !time || !subjectId || !classArm) {
      Toast.error('Please fill in all required fields.');
      return;
    }

    var session = getActiveSession();
    var term = getActiveTerm();

    var data = {
      schoolId: getSchoolId(),
      type: 'exam',
      date: date,
      time: time,
      subjectId: subjectId,
      subjectName: getSubjectName(subjectId),
      classArm: classArm,
      room: room,
      sessionId: session ? session.id : '',
      termId: term ? term.id : ''
    };

    if (existing && existing.id) {
      DataService.update('timetable', existing.id, data).then(function () {
        Toast.success('Exam entry updated.');
        Modal.close();
        loadExamData().then(function () { refreshTabContent(); });
        DataService.logAction('exam_updated', 'timetable', existing.id, { subject: data.subjectName, date: date });
      }).catch(function (err) {
        Toast.error('Failed to update: ' + (err.message || 'Unknown error'));
      });
    } else {
      DataService.add('timetable', data).then(function () {
        Toast.success('Exam entry added.');
        Modal.close();
        loadExamData().then(function () { refreshTabContent(); });
        DataService.logAction('exam_added', 'timetable', null, { subject: data.subjectName, date: date });
      }).catch(function (err) {
        Toast.error('Failed to add: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteExamEntry(id) {
    var entry = _examEntries.find(function (e) { return e.id === id; });
    if (!entry) { Toast.error('Entry not found.'); return; }

    Modal.confirm(
      'Delete Exam Entry',
      'Are you sure you want to delete <strong>' + Utils.escapeHtml(entry.subjectName || 'this exam entry') + '</strong> on ' + (entry.date ? Utils.formatDate(entry.date) : 'the scheduled date') + '?',
      function () {
        DataService.remove('timetable', id).then(function () {
          Toast.success('Exam entry deleted.');
          DataService.logAction('exam_deleted', 'timetable', id, { subject: entry.subjectName });
          return loadExamData();
        }).then(function () {
          refreshTabContent();
        }).catch(function (err) {
          Toast.error('Failed to delete: ' + (err.message || 'Unknown error'));
        });
      }
    );
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
          if (tab) {
            _activeTab = tab;
            refreshTabContent();
            // Update tab button styles
            var tabContainer = btn.closest('.card');
            if (tabContainer) {
              tabContainer.querySelectorAll('.profile-tab').forEach(function (t) {
                var isActive = t.dataset.tab === tab;
                t.classList.toggle('active', isActive);
                t.style.color = isActive ? 'var(--primary-600)' : 'var(--gray-500)';
                t.style.borderBottom = isActive ? '2px solid var(--primary-600)' : '2px solid transparent';
              });
            }
            // Load data for the new tab
            if (tab === 'class') {
              loadTimetableData();
            } else if (tab === 'teacher') {
              loadAllTimetableForTeacherView();
            } else if (tab === 'exam') {
              loadExamData();
            }
          }
          break;

        case 'filter-class':
          // Handled via change event below
          break;
        case 'filter-arm':
          // Handled via change event below
          break;
        case 'filter-teacher':
          // Handled via change event below
          break;

        case 'edit-cell':
          e.preventDefault();
          e.stopPropagation();
          openEditCellModal(btn.dataset.day, parseInt(btn.dataset.period, 10));
          break;

        case 'clear-cell':
          e.preventDefault();
          e.stopPropagation();
          clearCellEntry(btn.dataset.day, parseInt(btn.dataset.period, 10));
          break;

        case 'auto-generate':
          e.preventDefault();
          e.stopPropagation();
          autoGenerate();
          break;

        case 'save-timetable':
          e.preventDefault();
          e.stopPropagation();
          saveFullTimetable();
          break;

        case 'add-exam':
          e.preventDefault();
          e.stopPropagation();
          openAddExamModal(null);
          break;

        case 'edit-exam':
          e.preventDefault();
          e.stopPropagation();
          var examEntry = _examEntries.find(function (x) { return x.id === id; });
          if (examEntry) openAddExamModal(examEntry);
          else Toast.error('Exam entry not found.');
          break;

        case 'delete-exam':
          e.preventDefault();
          e.stopPropagation();
          deleteExamEntry(id);
          break;
      }
    };

    document.addEventListener('click', _clickHandler);

    // Change events for filters
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.id === 'tt-class-filter' || el.matches('[data-action="filter-class"]')) {
        _filters.classId = el.value;
        _filters.arm = '';
        loadTimetableData().then(function () { refreshTabContent(); });
      }
      if (el.id === 'tt-arm-filter' || el.matches('[data-action="filter-arm"]')) {
        _filters.arm = el.value;
        loadTimetableData().then(function () { refreshTabContent(); });
      }
      if (el.id === 'tt-teacher-filter' || el.matches('[data-action="filter-teacher"]')) {
        _filters.teacherId = el.value;
        refreshTabContent();
      }
    });

    // Hover effect on timetable cells
    document.addEventListener('mouseover', function (e) {
      var cell = e.target.closest('.timetable-cell');
      if (cell) cell.style.background = cell.style.background ? undefined : '';
      if (cell) cell.style.outline = '2px solid var(--primary-300)';
    });
    document.addEventListener('mouseout', function (e) {
      var cell = e.target.closest('.timetable-cell');
      if (cell) cell.style.outline = '';
    });
  }

  function loadAllTimetableForTeacherView() {
    var schoolId = getSchoolId();
    DataService.getBySchool('timetable', schoolId)
      .then(function (all) {
        _timetableEntries = (all || []).filter(function (e) {
          return e.type === 'class';
        });
        refreshTabContent();
      });
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  function cleanup() {
    if (_clickHandler) {
      document.removeEventListener('click', _clickHandler);
      _clickHandler = null;
    }
    _listeners.forEach(function (unsub) { if (typeof unsub === 'function') unsub(); });
    _listeners = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  window.Modules.timetable = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('timetable');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Timetable' }
      ]);

      var container = document.getElementById('main-content');
      if (!container) return render();

      cleanup();
      container.innerHTML = loadingSpinner();

      loadBaseData().then(function () {
        if (_activeTab === 'class') {
          return loadTimetableData();
        } else if (_activeTab === 'teacher') {
          return loadAllTimetableForTeacherView();
        } else if (_activeTab === 'exam') {
          return loadExamData();
        }
      }).then(function () {
        container.innerHTML = render();
        bindEvents();
      }).catch(function (err) {
        console.error('Error loading timetable module:', err);
        container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load timetable. Please refresh.');
        Toast.error('Failed to load timetable.');
      });
    },

    destroy: function () {
      cleanup();
      _activeTab = 'class';
      _classes = [];
      _subjects = [];
      _staff = [];
      _sessions = [];
      _terms = [];
      _timetableEntries = [];
      _examEntries = [];
      _filters = { classId: '', arm: '', teacherId: '' };
    }
  };
})();