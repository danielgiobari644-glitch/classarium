/**
 * Classarium Academic Structure Module
 * Manage Sessions, Terms, Departments, Classes, Houses, Subjects.
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

  var TABS = [
    { key: 'sessions', label: 'Sessions', icon: '📅' },
    { key: 'terms', label: 'Terms', icon: '📆' },
    { key: 'departments', label: 'Departments', icon: '🏛️' },
    { key: 'classes', label: 'Classes', icon: '🏫' },
    { key: 'houses', label: 'Houses', icon: '🏠' },
    { key: 'subjects', label: 'Subjects', icon: '📚' }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _activeTab = 'sessions';
  var _sessions = [];
  var _terms = [];
  var _departments = [];
  var _classes = [];
  var _houses = [];
  var _subjects = [];
  var _students = [];
  var _listeners = [];
  var _clickHandler = null;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getSessionName(sessionId) {
    var s = _sessions.find(function (x) { return x.id === sessionId; });
    return s ? (s.name || '—') : (sessionId || '—');
  }

  function getDeptName(deptId) {
    var d = _departments.find(function (x) { return x.id === deptId; });
    return d ? (d.name || '—') : (deptId || '—');
  }

  function getSessionOptions(selectedId) {
    return '<option value="">Select Session</option>'
      + _sessions.map(function (s) {
        return '<option value="' + (s.id || '') + '"' + (selectedId === s.id ? ' selected' : '') + '>'
          + Utils.escapeHtml(s.name || 'Unnamed') + '</option>';
      }).join('');
  }

  function getDeptOptions(selectedId) {
    return '<option value="">Select Department</option>'
      + _departments.map(function (d) {
        return '<option value="' + (d.id || '') + '"' + (selectedId === d.id ? ' selected' : '') + '>'
          + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
      }).join('');
  }

  function statusBadge(status) {
    var map = {
      active: { text: 'Active', cls: 'success' },
      upcoming: { text: 'Upcoming', cls: 'info' },
      ended: { text: 'Ended', cls: 'default' },
      archived: { text: 'Archived', cls: 'default' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function colorSwatch(color) {
    if (!color) return '—';
    return '<span style="display:inline-flex;align-items:center;gap:6px">'
      + '<span style="width:18px;height:18px;border-radius:4px;background:' + Utils.escapeHtml(color) + ';border:1px solid var(--gray-300);display:inline-block"></span>'
      + Utils.escapeHtml(color)
      + '</span>';
  }

  function getStudentsCountForClass(classId) {
    return _students.filter(function (st) { return st.classId === classId; }).length;
  }

  function getStudentsCountForHouse(houseId) {
    return _students.filter(function (st) { return st.houseId === houseId; }).length;
  }

  function getTeacherCountForDept(deptId) {
    return _students.length; // placeholder; real count would query staff by dept
  }

  function getTeachersForSubject(subjectId) {
    // Show teacher names from staff who have this subject in assignedSubjects
    // We don't have staff loaded here, so show placeholder
    var subj = _subjects.find(function (x) { return x.id === subjectId; });
    if (subj && subj.teacherIds && subj.teacherIds.length) {
      return subj.teacherIds.length + ' teacher(s)';
    }
    return '—';
  }

  /* ------------------------------------------------------------------ */
  /*  Render — Main Page                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="academic-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Academic Structure</h1>'
      + '<p class="page-header-description">Manage sessions, terms, departments, classes, houses &amp; subjects</p>'
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
      + '<div class="card-body" id="academic-tab-content">'
      + renderTabContent()
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  function renderTabContent() {
    switch (_activeTab) {
      case 'sessions': return renderSessionsTab();
      case 'terms': return renderTermsTab();
      case 'departments': return renderDepartmentsTab();
      case 'classes': return renderClassesTab();
      case 'houses': return renderHousesTab();
      case 'subjects': return renderSubjectsTab();
      default: return renderSessionsTab();
    }
  }

  /* ================================================================== */
  /*  SESSIONS TAB                                                       */
  /* ================================================================== */

  function renderSessionsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Sessions <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _sessions.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-session">+ Add Session</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="sessions-table">'
      + '<thead><tr>'
      + '<th>Name</th>'
      + '<th>Start Date</th>'
      + '<th>End Date</th>'
      + '<th>Status</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="sessions-tbody">';

    if (!_sessions.length) {
      html += '<tr><td colspan="5" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">📅</div>'
        + '<h3 class="empty-state-title">No sessions yet</h3>'
        + '<p class="empty-state-description">Add your first academic session to get started.</p>'
        + '</div></td></tr>';
    } else {
      _sessions.forEach(function (s) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(s.name || '—') + '</td>'
          + '<td>' + (s.startDate ? Utils.formatDate(s.startDate) : '—') + '</td>'
          + '<td>' + (s.endDate ? Utils.formatDate(s.endDate) : '—') + '</td>'
          + '<td>' + statusBadge(s.status) + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-session" data-id="' + s.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-session" data-id="' + s.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  TERMS TAB                                                          */
  /* ================================================================== */

  function renderTermsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Terms <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _terms.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-term">+ Add Term</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="terms-table">'
      + '<thead><tr>'
      + '<th>Name</th>'
      + '<th>Session</th>'
      + '<th>Start Date</th>'
      + '<th>End Date</th>'
      + '<th>Status</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="terms-tbody">';

    if (!_terms.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">📆</div>'
        + '<h3 class="empty-state-title">No terms yet</h3>'
        + '<p class="empty-state-description">Add your first term. You need at least one session first.</p>'
        + '</div></td></tr>';
    } else {
      _terms.forEach(function (t) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(t.name || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(getSessionName(t.sessionId)) + '</td>'
          + '<td>' + (t.startDate ? Utils.formatDate(t.startDate) : '—') + '</td>'
          + '<td>' + (t.endDate ? Utils.formatDate(t.endDate) : '—') + '</td>'
          + '<td>' + statusBadge(t.status) + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-term" data-id="' + t.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-term" data-id="' + t.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  DEPARTMENTS TAB                                                    */
  /* ================================================================== */

  function renderDepartmentsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Departments <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _departments.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-department">+ Add Department</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="departments-table">'
      + '<thead><tr>'
      + '<th>Name</th>'
      + '<th>Head of Department</th>'
      + '<th>No. of Teachers</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="departments-tbody">';

    if (!_departments.length) {
      html += '<tr><td colspan="4" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🏛️</div>'
        + '<h3 class="empty-state-title">No departments yet</h3>'
        + '<p class="empty-state-description">Add your first department to organize staff and subjects.</p>'
        + '</div></td></tr>';
    } else {
      _departments.forEach(function (d) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(d.name || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(d.hod || d.headOfDepartment || '—') + '</td>'
          + '<td><span style="font-size:14px;color:var(--gray-600)">' + (d.teacherCount || 0) + '</span></td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-department" data-id="' + d.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-department" data-id="' + d.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  CLASSES TAB                                                        */
  /* ================================================================== */

  function renderClassesTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Classes <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _classes.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-class">+ Add Class</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="classes-table">'
      + '<thead><tr>'
      + '<th>Class Name</th>'
      + '<th>Department</th>'
      + '<th>Arms</th>'
      + '<th>No. Students</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="classes-tbody">';

    if (!_classes.length) {
      html += '<tr><td colspan="5" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🏫</div>'
        + '<h3 class="empty-state-title">No classes yet</h3>'
        + '<p class="empty-state-description">Add your first class. You need at least one department first.</p>'
        + '</div></td></tr>';
    } else {
      _classes.forEach(function (c) {
        var arms = c.arms || [];
        var armsHtml = arms.length
          ? arms.map(function (a) { return '<span class="badge badge-primary" style="margin:0 2px">' + Utils.escapeHtml(a) + '</span>'; }).join('')
          : '<span style="color:var(--gray-400);font-size:13px">None</span>';

        var studentCount = getStudentsCountForClass(c.id);

        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(c.name || c.className || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(getDeptName(c.departmentId)) + '</td>'
          + '<td>' + armsHtml + '</td>'
          + '<td><span style="font-size:14px;color:var(--gray-600)">' + studentCount + '</span></td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="manage-arms" data-id="' + c.id + '">Manage Arms</button> '
          + '<button class="btn btn-sm btn-ghost" data-action="edit-class" data-id="' + c.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-class" data-id="' + c.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  HOUSES TAB                                                         */
  /* ================================================================== */

  function renderHousesTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Houses <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _houses.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-house">+ Add House</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="houses-table">'
      + '<thead><tr>'
      + '<th>House Name</th>'
      + '<th>Color</th>'
      + '<th>House Master</th>'
      + '<th>No. Students</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="houses-tbody">';

    if (!_houses.length) {
      html += '<tr><td colspan="5" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🏠</div>'
        + '<h3 class="empty-state-title">No houses yet</h3>'
        + '<p class="empty-state-description">Add school houses for student grouping and competitions.</p>'
        + '</div></td></tr>';
    } else {
      _houses.forEach(function (h) {
        var studentCount = getStudentsCountForHouse(h.id);

        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(h.name || '—') + '</td>'
          + '<td>' + colorSwatch(h.color) + '</td>'
          + '<td>' + Utils.escapeHtml(h.houseMaster || '—') + '</td>'
          + '<td><span style="font-size:14px;color:var(--gray-600)">' + studentCount + '</span></td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-house" data-id="' + h.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-house" data-id="' + h.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  SUBJECTS TAB                                                       */
  /* ================================================================== */

  function renderSubjectsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Subjects <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _subjects.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-subject">+ Add Subject</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="subjects-table">'
      + '<thead><tr>'
      + '<th>Subject Name</th>'
      + '<th>Code</th>'
      + '<th>Department</th>'
      + '<th>Teachers Assigned</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="subjects-tbody">';

    if (!_subjects.length) {
      html += '<tr><td colspan="5" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">📚</div>'
        + '<h3 class="empty-state-title">No subjects yet</h3>'
        + '<p class="empty-state-description">Add subjects offered in your school.</p>'
        + '</div></td></tr>';
    } else {
      _subjects.forEach(function (s) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(s.name || '—') + '</td>'
          + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(s.code || '—') + '</span></td>'
          + '<td>' + Utils.escapeHtml(getDeptName(s.departmentId)) + '</td>'
          + '<td><span style="font-size:14px;color:var(--gray-600)">' + getTeachersForSubject(s.id) + '</span></td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-subject" data-id="' + s.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-subject" data-id="' + s.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  SESSION CRUD                                                       */
  /* ================================================================== */

  function openAddSessionModal() {
    var formHtml = '<div class="modal-form" id="session-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Session Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required placeholder="e.g. 2025/2026"></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Start Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="startDate" class="form-input" required></div>'
      + '<div><label class="form-label">End Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="endDate" class="form-input" required></div>'
      + '</div>'
      + '<div><label class="form-label">Status</label>'
      + '<select name="status" class="form-select">'
      + '<option value="upcoming">Upcoming</option>'
      + '<option value="active">Active</option>'
      + '<option value="ended">Ended</option>'
      + '</select></div>'
      + '</div></div>';

    Modal.open('Add Session', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Add Session',
        className: 'btn btn-primary',
        onClick: function () { submitSession(null); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function openEditSessionModal(id) {
    var s = _sessions.find(function (x) { return x.id === id; });
    if (!s) { Toast.error('Session not found.'); return; }

    var formHtml = '<div class="modal-form" id="session-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Session Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required value="' + Utils.escapeHtml(s.name || '') + '"></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Start Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="startDate" class="form-input" required value="' + (s.startDate || '') + '"></div>'
      + '<div><label class="form-label">End Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="endDate" class="form-input" required value="' + (s.endDate || '') + '"></div>'
      + '</div>'
      + '<div><label class="form-label">Status</label>'
      + '<select name="status" class="form-select">'
      + '<option value="upcoming"' + (s.status === 'upcoming' ? ' selected' : '') + '>Upcoming</option>'
      + '<option value="active"' + (s.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="ended"' + (s.status === 'ended' ? ' selected' : '') + '>Ended</option>'
      + '<option value="archived"' + (s.status === 'archived' ? ' selected' : '') + '>Archived</option>'
      + '</select></div>'
      + '</div></div>';

    Modal.open('Edit Session', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitSession(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitSession(editId) {
    var form = document.getElementById('session-form');
    if (!form) return;

    var name = form.querySelector('[name="name"]').value.trim();
    var startDate = form.querySelector('[name="startDate"]').value;
    var endDate = form.querySelector('[name="endDate"]').value;
    var status = form.querySelector('[name="status"]').value;

    if (!name) { Toast.error('Session name is required.'); return; }
    if (!startDate) { Toast.error('Start date is required.'); return; }
    if (!endDate) { Toast.error('End date is required.'); return; }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';
    var data = { name: name, startDate: startDate, endDate: endDate, status: status, schoolId: schoolId };

    if (editId) {
      data.updatedAt = new Date().toISOString();
      Toast.info('Updating session...');
      DataService.update('sessions', editId, data).then(function () {
        Toast.success('Session "' + name + '" updated successfully');
        Modal.close();
        DataService.logAction('session_updated', 'sessions', editId, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to update session: ' + (err.message || 'Unknown error'));
      });
    } else {
      data.createdAt = new Date().toISOString();
      Toast.info('Adding session...');
      var addFn = DataService.addSession || function (d) { return DataService.add('sessions', d); };
      addFn(data).then(function (docRef) {
        Toast.success('Session "' + name + '" added successfully');
        Modal.close();
        DataService.logAction('session_added', 'sessions', docRef && docRef.id, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to add session: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteSession(id) {
    var s = _sessions.find(function (x) { return x.id === id; });
    if (!s) return;
    Modal.confirm(
      'Delete Session',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(s.name || 'this session') + '</strong>? This action cannot be undone.',
      function () {
        Toast.info('Deleting session...');
        DataService.remove('sessions', id).then(function () {
          Toast.success('Session deleted successfully');
          DataService.logAction('session_deleted', 'sessions', id, { name: s.name });
        }).catch(function (err) {
          Toast.error('Failed to delete session: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ================================================================== */
  /*  TERM CRUD                                                          */
  /* ================================================================== */

  function openAddTermModal() {
    if (!_sessions.length) {
      Toast.warning('Please add at least one session first.');
      return;
    }

    var formHtml = '<div class="modal-form" id="term-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Term Name <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="name" class="form-select" required>'
      + '<option value="">Select Term</option>'
      + '<option value="First Term">First Term</option>'
      + '<option value="Second Term">Second Term</option>'
      + '<option value="Third Term">Third Term</option>'
      + '</select></div>'
      + '<div><label class="form-label">Session <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="sessionId" class="form-select" required>' + getSessionOptions('') + '</select></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Start Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="startDate" class="form-input" required></div>'
      + '<div><label class="form-label">End Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="endDate" class="form-input" required></div>'
      + '</div>'
      + '</div></div>';

    Modal.open('Add Term', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Add Term',
        className: 'btn btn-primary',
        onClick: function () { submitTerm(null); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function openEditTermModal(id) {
    var t = _terms.find(function (x) { return x.id === id; });
    if (!t) { Toast.error('Term not found.'); return; }

    var termOptions = ['First Term', 'Second Term', 'Third Term'].map(function (name) {
      return '<option value="' + name + '"' + (t.name === name ? ' selected' : '') + '>' + name + '</option>';
    }).join('');

    var formHtml = '<div class="modal-form" id="term-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Term Name <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="name" class="form-select" required>' + termOptions + '</select></div>'
      + '<div><label class="form-label">Session <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="sessionId" class="form-select" required>' + getSessionOptions(t.sessionId) + '</select></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Start Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="startDate" class="form-input" required value="' + (t.startDate || '') + '"></div>'
      + '<div><label class="form-label">End Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" name="endDate" class="form-input" required value="' + (t.endDate || '') + '"></div>'
      + '</div>'
      + '<div><label class="form-label">Status</label>'
      + '<select name="status" class="form-select">'
      + '<option value="upcoming"' + (t.status === 'upcoming' ? ' selected' : '') + '>Upcoming</option>'
      + '<option value="active"' + (t.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="ended"' + (t.status === 'ended' ? ' selected' : '') + '>Ended</option>'
      + '</select></div>'
      + '</div></div>';

    Modal.open('Edit Term', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitTerm(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitTerm(editId) {
    var form = document.getElementById('term-form');
    if (!form) return;

    var name = form.querySelector('[name="name"]').value;
    var sessionId = form.querySelector('[name="sessionId"]').value;
    var startDate = form.querySelector('[name="startDate"]').value;
    var endDate = form.querySelector('[name="endDate"]').value;
    var status = form.querySelector('[name="status"]') ? form.querySelector('[name="status"]').value : 'upcoming';

    if (!name) { Toast.error('Term name is required.'); return; }
    if (!sessionId) { Toast.error('Please select a session.'); return; }
    if (!startDate) { Toast.error('Start date is required.'); return; }
    if (!endDate) { Toast.error('End date is required.'); return; }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';
    var data = { name: name, sessionId: sessionId, startDate: startDate, endDate: endDate, status: status, schoolId: schoolId };

    if (editId) {
      data.updatedAt = new Date().toISOString();
      Toast.info('Updating term...');
      DataService.update('terms', editId, data).then(function () {
        Toast.success('Term "' + name + '" updated successfully');
        Modal.close();
        DataService.logAction('term_updated', 'terms', editId, { name: name, sessionId: sessionId });
      }).catch(function (err) {
        Toast.error('Failed to update term: ' + (err.message || 'Unknown error'));
      });
    } else {
      data.createdAt = new Date().toISOString();
      Toast.info('Adding term...');
      var addFn = DataService.addTerm || function (d) { return DataService.add('terms', d); };
      addFn(data).then(function (docRef) {
        Toast.success('Term "' + name + '" added successfully');
        Modal.close();
        DataService.logAction('term_added', 'terms', docRef && docRef.id, { name: name, sessionId: sessionId });
      }).catch(function (err) {
        Toast.error('Failed to add term: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteTerm(id) {
    var t = _terms.find(function (x) { return x.id === id; });
    if (!t) return;
    Modal.confirm(
      'Delete Term',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(t.name || 'this term') + '</strong>? This action cannot be undone.',
      function () {
        Toast.info('Deleting term...');
        DataService.remove('terms', id).then(function () {
          Toast.success('Term deleted successfully');
          DataService.logAction('term_deleted', 'terms', id, { name: t.name });
        }).catch(function (err) {
          Toast.error('Failed to delete term: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ================================================================== */
  /*  DEPARTMENT CRUD                                                    */
  /* ================================================================== */

  function openAddDepartmentModal() {
    var formHtml = '<div class="modal-form" id="department-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Department Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required placeholder="e.g. Science Department"></div>'
      + '<div><label class="form-label">Head of Department</label>'
      + '<input type="text" name="hod" class="form-input" placeholder="e.g. Mr. John Adeyemi"></div>'
      + '<div><label class="form-label">Description</label>'
      + '<textarea name="description" class="form-input" rows="3" placeholder="Brief description of this department..." style="resize:vertical"></textarea></div>'
      + '</div></div>';

    Modal.open('Add Department', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Add Department',
        className: 'btn btn-primary',
        onClick: function () { submitDepartment(null); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function openEditDepartmentModal(id) {
    var d = _departments.find(function (x) { return x.id === id; });
    if (!d) { Toast.error('Department not found.'); return; }

    var formHtml = '<div class="modal-form" id="department-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Department Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required value="' + Utils.escapeHtml(d.name || '') + '"></div>'
      + '<div><label class="form-label">Head of Department</label>'
      + '<input type="text" name="hod" class="form-input" value="' + Utils.escapeHtml(d.hod || d.headOfDepartment || '') + '"></div>'
      + '<div><label class="form-label">Description</label>'
      + '<textarea name="description" class="form-input" rows="3" style="resize:vertical">' + Utils.escapeHtml(d.description || '') + '</textarea></div>'
      + '</div></div>';

    Modal.open('Edit Department', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitDepartment(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitDepartment(editId) {
    var form = document.getElementById('department-form');
    if (!form) return;

    var name = form.querySelector('[name="name"]').value.trim();
    var hod = form.querySelector('[name="hod"]').value.trim();
    var description = form.querySelector('[name="description"]').value.trim();

    if (!name) { Toast.error('Department name is required.'); return; }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';
    var data = { name: name, hod: hod, headOfDepartment: hod, description: description, schoolId: schoolId };

    if (editId) {
      data.updatedAt = new Date().toISOString();
      Toast.info('Updating department...');
      DataService.update('departments', editId, data).then(function () {
        Toast.success('Department "' + name + '" updated successfully');
        Modal.close();
        DataService.logAction('department_updated', 'departments', editId, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to update department: ' + (err.message || 'Unknown error'));
      });
    } else {
      data.createdAt = new Date().toISOString();
      Toast.info('Adding department...');
      var addFn = DataService.addDepartment || function (d) { return DataService.add('departments', d); };
      addFn(data).then(function (docRef) {
        Toast.success('Department "' + name + '" added successfully');
        Modal.close();
        DataService.logAction('department_added', 'departments', docRef && docRef.id, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to add department: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteDepartment(id) {
    var d = _departments.find(function (x) { return x.id === id; });
    if (!d) return;
    Modal.confirm(
      'Delete Department',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(d.name || 'this department') + '</strong>? Classes and subjects linked to this department will not be deleted, but will lose their department association.',
      function () {
        Toast.info('Deleting department...');
        DataService.remove('departments', id).then(function () {
          Toast.success('Department deleted successfully');
          DataService.logAction('department_deleted', 'departments', id, { name: d.name });
        }).catch(function (err) {
          Toast.error('Failed to delete department: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ================================================================== */
  /*  CLASS CRUD                                                         */
  /* ================================================================== */

  function openAddClassModal() {
    if (!_departments.length) {
      Toast.warning('Please add at least one department first.');
      return;
    }

    var formHtml = '<div class="modal-form" id="class-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Class Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required placeholder="e.g. JSS1, SSS2, Primary 3"></div>'
      + '<div><label class="form-label">Department <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="departmentId" class="form-select" required>' + getDeptOptions('') + '</select></div>'
      + '</div></div>';

    Modal.open('Add Class', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Add Class',
        className: 'btn btn-primary',
        onClick: function () { submitClass(null); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function openEditClassModal(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    if (!c) { Toast.error('Class not found.'); return; }

    var formHtml = '<div class="modal-form" id="class-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Class Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required value="' + Utils.escapeHtml(c.name || c.className || '') + '"></div>'
      + '<div><label class="form-label">Department <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="departmentId" class="form-select" required>' + getDeptOptions(c.departmentId) + '</select></div>'
      + '</div></div>';

    Modal.open('Edit Class', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitClass(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitClass(editId) {
    var form = document.getElementById('class-form');
    if (!form) return;

    var name = form.querySelector('[name="name"]').value.trim();
    var departmentId = form.querySelector('[name="departmentId"]').value;

    if (!name) { Toast.error('Class name is required.'); return; }
    if (!departmentId) { Toast.error('Please select a department.'); return; }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';
    var data = { name: name, className: name, departmentId: departmentId, schoolId: schoolId };

    if (editId) {
      data.updatedAt = new Date().toISOString();
      Toast.info('Updating class...');
      DataService.update('classes', editId, data).then(function () {
        Toast.success('Class "' + name + '" updated successfully');
        Modal.close();
        DataService.logAction('class_updated', 'classes', editId, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to update class: ' + (err.message || 'Unknown error'));
      });
    } else {
      data.arms = [];
      data.createdAt = new Date().toISOString();
      Toast.info('Adding class...');
      var addFn = DataService.addClass || function (d) { return DataService.add('classes', d); };
      addFn(data).then(function (docRef) {
        Toast.success('Class "' + name + '" added successfully');
        Modal.close();
        DataService.logAction('class_added', 'classes', docRef && docRef.id, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to add class: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteClass(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    if (!c) return;
    var studentCount = getStudentsCountForClass(id);
    Modal.confirm(
      'Delete Class',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(c.name || c.className || 'this class') + '</strong>?'
      + (studentCount > 0 ? '<br><br>This class currently has <strong>' + studentCount + ' student(s)</strong> enrolled. Consider reassigning them first.' : ''),
      function () {
        Toast.info('Deleting class...');
        DataService.remove('classes', id).then(function () {
          Toast.success('Class deleted successfully');
          DataService.logAction('class_deleted', 'classes', id, { name: c.name || c.className });
        }).catch(function (err) {
          Toast.error('Failed to delete class: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ================================================================== */
  /*  MANAGE CLASS ARMS                                                  */
  /* ================================================================== */

  function openManageArmsModal(classId) {
    var cls = _classes.find(function (x) { return x.id === classId; });
    if (!cls) { Toast.error('Class not found.'); return; }

    var arms = cls.arms || [];
    var className = cls.name || cls.className || 'Unnamed';

    function buildArmsContent() {
      var html = '<div id="arms-form-content">'
        + '<p style="color:var(--gray-500);font-size:14px;margin:0 0 16px">Manage class arms (sections) for <strong>' + Utils.escapeHtml(className) + '</strong>.</p>';

      if (arms.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px" id="arms-list">';
        arms.forEach(function (arm, idx) {
          html += '<div style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--primary-50);border:1px solid var(--primary-200);border-radius:8px;font-size:14px;font-weight:500;color:var(--primary-700)">'
            + Utils.escapeHtml(arm)
            + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600);padding:2px 6px;font-size:16px;line-height:1" data-action="remove-arm" data-idx="' + idx + '" title="Remove">&times;</button>'
            + '</div>';
        });
        html += '</div>';
      } else {
        html += '<div style="text-align:center;padding:16px;color:var(--gray-400);font-size:13px;margin-bottom:16px;border:1px dashed var(--gray-300);border-radius:8px">No arms added yet</div>';
      }

      html += '<div style="display:flex;gap:8px;align-items:center">'
        + '<input type="text" id="new-arm-input" class="form-input" placeholder="Enter arm name (e.g. A, B, C)" style="flex:1" maxlength="10">'
        + '<button class="btn btn-primary" id="add-arm-btn">Add Arm</button>'
        + '</div>'
        + '</div>';
      return html;
    }

    function bindArmsEvents() {
      var addBtn = document.getElementById('add-arm-btn');
      var input = document.getElementById('new-arm-input');

      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var armName = input.value.trim().toUpperCase();
          if (!armName) { Toast.warning('Please enter an arm name.'); return; }
          if (arms.indexOf(armName) !== -1) { Toast.warning('Arm "' + armName + '" already exists.'); return; }
          arms.push(armName);
          saveArms();
        });
      }

      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (addBtn) addBtn.click();
          }
        });
      }

      // Use event delegation for remove buttons
      var content = document.getElementById('arms-form-content');
      if (content) {
        content.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-action="remove-arm"]');
          if (!btn) return;
          var idx = parseInt(btn.dataset.idx, 10);
          if (!isNaN(idx) && idx >= 0 && idx < arms.length) {
            arms.splice(idx, 1);
            saveArms();
          }
        });
      }
    }

    function saveArms() {
      Toast.info('Saving arms...');
      DataService.update('classes', classId, { arms: arms.slice(), updatedAt: new Date().toISOString() }).then(function () {
        Toast.success('Arms updated successfully');
        // Re-render the arms content inside the modal
        var container = document.getElementById('arms-form-content');
        if (container) {
          // Temporarily swap content
          var parent = container.parentNode;
          parent.innerHTML = buildArmsContent();
          bindArmsEvents();
          // Focus the input
          var newInput = document.getElementById('new-arm-input');
          if (newInput) newInput.focus();
        }
      }).catch(function (err) {
        Toast.error('Failed to save arms: ' + (err.message || 'Unknown error'));
      });
    }

    Modal.open('Manage Arms — ' + className, buildArmsContent(), {
      size: 'medium',
      actions: [{
        label: 'Done',
        className: 'btn btn-primary',
        onClick: function () {
          DataService.logAction('class_arms_managed', 'classes', classId, { arms: arms.slice(), className: className });
          Modal.close();
        }
      }]
    });

    // Bind events after modal renders
    setTimeout(bindArmsEvents, 50);
  }

  /* ================================================================== */
  /*  HOUSE CRUD                                                         */
  /* ================================================================== */

  function openAddHouseModal() {
    var formHtml = '<div class="modal-form" id="house-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">House Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required placeholder="e.g. Blue House, Eagles"></div>'
      + '<div><label class="form-label">Color</label>'
      + '<div style="display:flex;gap:10px;align-items:center">'
      + '<input type="color" name="color" value="#2563EB" style="width:48px;height:38px;border:1px solid var(--gray-300);border-radius:6px;cursor:pointer;padding:2px">'
      + '<input type="text" name="colorText" class="form-input" placeholder="Or enter color name/hex" style="flex:1">'
      + '</div></div>'
      + '<div><label class="form-label">House Master</label>'
      + '<input type="text" name="houseMaster" class="form-input" placeholder="e.g. Mrs. Funke Obi"></div>'
      + '</div></div>';

    Modal.open('Add House', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Add House',
        className: 'btn btn-primary',
        onClick: function () { submitHouse(null); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });

    // Sync color picker with text input
    setTimeout(function () {
      var picker = document.querySelector('[name="color"]');
      var text = document.querySelector('[name="colorText"]');
      if (picker && text) {
        picker.addEventListener('input', function () { text.value = picker.value; });
        text.addEventListener('input', function () {
          if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) { picker.value = text.value; }
        });
      }
    }, 50);
  }

  function openEditHouseModal(id) {
    var h = _houses.find(function (x) { return x.id === id; });
    if (!h) { Toast.error('House not found.'); return; }

    var colorVal = h.color || '#2563EB';
    var isHex = /^#[0-9A-Fa-f]{6}$/.test(colorVal);

    var formHtml = '<div class="modal-form" id="house-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">House Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required value="' + Utils.escapeHtml(h.name || '') + '"></div>'
      + '<div><label class="form-label">Color</label>'
      + '<div style="display:flex;gap:10px;align-items:center">'
      + '<input type="color" name="color" value="' + (isHex ? colorVal : '#2563EB') + '" style="width:48px;height:38px;border:1px solid var(--gray-300);border-radius:6px;cursor:pointer;padding:2px">'
      + '<input type="text" name="colorText" class="form-input" value="' + Utils.escapeHtml(colorVal) + '" placeholder="Or enter color name/hex" style="flex:1">'
      + '</div></div>'
      + '<div><label class="form-label">House Master</label>'
      + '<input type="text" name="houseMaster" class="form-input" value="' + Utils.escapeHtml(h.houseMaster || '') + '"></div>'
      + '</div></div>';

    Modal.open('Edit House', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitHouse(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });

    setTimeout(function () {
      var picker = document.querySelector('[name="color"]');
      var text = document.querySelector('[name="colorText"]');
      if (picker && text) {
        picker.addEventListener('input', function () { text.value = picker.value; });
        text.addEventListener('input', function () {
          if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) { picker.value = text.value; }
        });
      }
    }, 50);
  }

  function submitHouse(editId) {
    var form = document.getElementById('house-form');
    if (!form) return;

    var name = form.querySelector('[name="name"]').value.trim();
    var color = form.querySelector('[name="colorText"]').value.trim() || form.querySelector('[name="color"]').value;
    var houseMaster = form.querySelector('[name="houseMaster"]').value.trim();

    if (!name) { Toast.error('House name is required.'); return; }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';
    var data = { name: name, color: color, houseMaster: houseMaster, schoolId: schoolId };

    if (editId) {
      data.updatedAt = new Date().toISOString();
      Toast.info('Updating house...');
      DataService.update('houses', editId, data).then(function () {
        Toast.success('House "' + name + '" updated successfully');
        Modal.close();
        DataService.logAction('house_updated', 'houses', editId, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to update house: ' + (err.message || 'Unknown error'));
      });
    } else {
      data.createdAt = new Date().toISOString();
      Toast.info('Adding house...');
      DataService.add('houses', data).then(function (docRef) {
        Toast.success('House "' + name + '" added successfully');
        Modal.close();
        DataService.logAction('house_added', 'houses', docRef && docRef.id, { name: name });
      }).catch(function (err) {
        Toast.error('Failed to add house: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteHouse(id) {
    var h = _houses.find(function (x) { return x.id === id; });
    if (!h) return;
    Modal.confirm(
      'Delete House',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(h.name || 'this house') + '</strong>?',
      function () {
        Toast.info('Deleting house...');
        DataService.remove('houses', id).then(function () {
          Toast.success('House deleted successfully');
          DataService.logAction('house_deleted', 'houses', id, { name: h.name });
        }).catch(function (err) {
          Toast.error('Failed to delete house: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ================================================================== */
  /*  SUBJECT CRUD                                                       */
  /* ================================================================== */

  function openAddSubjectModal() {
    var formHtml = '<div class="modal-form" id="subject-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Subject Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required placeholder="e.g. Mathematics"></div>'
      + '<div><label class="form-label">Subject Code <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="code" class="form-input" required placeholder="e.g. MTH, ENG, PHY"></div>'
      + '<div><label class="form-label">Department</label>'
      + '<select name="departmentId" class="form-select">' + getDeptOptions('') + '</select></div>'
      + '<div><label class="form-label">Description</label>'
      + '<textarea name="description" class="form-input" rows="3" placeholder="Brief description..." style="resize:vertical"></textarea></div>'
      + '</div></div>';

    Modal.open('Add Subject', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Add Subject',
        className: 'btn btn-primary',
        onClick: function () { submitSubject(null); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function openEditSubjectModal(id) {
    var s = _subjects.find(function (x) { return x.id === id; });
    if (!s) { Toast.error('Subject not found.'); return; }

    var formHtml = '<div class="modal-form" id="subject-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Subject Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="name" class="form-input" required value="' + Utils.escapeHtml(s.name || '') + '"></div>'
      + '<div><label class="form-label">Subject Code <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="code" class="form-input" required value="' + Utils.escapeHtml(s.code || '') + '"></div>'
      + '<div><label class="form-label">Department</label>'
      + '<select name="departmentId" class="form-select">' + getDeptOptions(s.departmentId) + '</select></div>'
      + '<div><label class="form-label">Description</label>'
      + '<textarea name="description" class="form-input" rows="3" style="resize:vertical">' + Utils.escapeHtml(s.description || '') + '</textarea></div>'
      + '</div></div>';

    Modal.open('Edit Subject', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitSubject(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitSubject(editId) {
    var form = document.getElementById('subject-form');
    if (!form) return;

    var name = form.querySelector('[name="name"]').value.trim();
    var code = form.querySelector('[name="code"]').value.trim().toUpperCase();
    var departmentId = form.querySelector('[name="departmentId"]').value || null;
    var description = form.querySelector('[name="description"]').value.trim();

    if (!name) { Toast.error('Subject name is required.'); return; }
    if (!code) { Toast.error('Subject code is required.'); return; }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';
    var data = { name: name, code: code, departmentId: departmentId, description: description, schoolId: schoolId };

    if (editId) {
      data.updatedAt = new Date().toISOString();
      Toast.info('Updating subject...');
      DataService.update('subjects', editId, data).then(function () {
        Toast.success('Subject "' + name + '" updated successfully');
        Modal.close();
        DataService.logAction('subject_updated', 'subjects', editId, { name: name, code: code });
      }).catch(function (err) {
        Toast.error('Failed to update subject: ' + (err.message || 'Unknown error'));
      });
    } else {
      data.createdAt = new Date().toISOString();
      Toast.info('Adding subject...');
      var addFn = DataService.addSubject || function (d) { return DataService.add('subjects', d); };
      addFn(data).then(function (docRef) {
        Toast.success('Subject "' + name + '" added successfully');
        Modal.close();
        DataService.logAction('subject_added', 'subjects', docRef && docRef.id, { name: name, code: code });
      }).catch(function (err) {
        Toast.error('Failed to add subject: ' + (err.message || 'Unknown error'));
      });
    }
  }

  function deleteSubject(id) {
    var s = _subjects.find(function (x) { return x.id === id; });
    if (!s) return;
    Modal.confirm(
      'Delete Subject',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(s.name || 'this subject') + '</strong>?',
      function () {
        Toast.info('Deleting subject...');
        DataService.remove('subjects', id).then(function () {
          Toast.success('Subject deleted successfully');
          DataService.logAction('subject_deleted', 'subjects', id, { name: s.name });
        }).catch(function (err) {
          Toast.error('Failed to delete subject: ' + (err.message || 'Unknown error'));
        });
      }
    );
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
      var id = btn.dataset.id;
      var tab = btn.dataset.tab;

      switch (action) {
        case 'switch-tab':
          e.preventDefault();
          e.stopPropagation();
          if (tab) {
            _activeTab = tab;
            var content = document.getElementById('academic-tab-content');
            if (content) content.innerHTML = renderTabContent();
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
          }
          break;

        // Sessions
        case 'add-session': e.preventDefault(); e.stopPropagation(); openAddSessionModal(); break;
        case 'edit-session': e.preventDefault(); e.stopPropagation(); openEditSessionModal(id); break;
        case 'delete-session': e.preventDefault(); e.stopPropagation(); deleteSession(id); break;

        // Terms
        case 'add-term': e.preventDefault(); e.stopPropagation(); openAddTermModal(); break;
        case 'edit-term': e.preventDefault(); e.stopPropagation(); openEditTermModal(id); break;
        case 'delete-term': e.preventDefault(); e.stopPropagation(); deleteTerm(id); break;

        // Departments
        case 'add-department': e.preventDefault(); e.stopPropagation(); openAddDepartmentModal(); break;
        case 'edit-department': e.preventDefault(); e.stopPropagation(); openEditDepartmentModal(id); break;
        case 'delete-department': e.preventDefault(); e.stopPropagation(); deleteDepartment(id); break;

        // Classes
        case 'add-class': e.preventDefault(); e.stopPropagation(); openAddClassModal(); break;
        case 'edit-class': e.preventDefault(); e.stopPropagation(); openEditClassModal(id); break;
        case 'delete-class': e.preventDefault(); e.stopPropagation(); deleteClass(id); break;
        case 'manage-arms': e.preventDefault(); e.stopPropagation(); openManageArmsModal(id); break;

        // Houses
        case 'add-house': e.preventDefault(); e.stopPropagation(); openAddHouseModal(); break;
        case 'edit-house': e.preventDefault(); e.stopPropagation(); openEditHouseModal(id); break;
        case 'delete-house': e.preventDefault(); e.stopPropagation(); deleteHouse(id); break;

        // Subjects
        case 'add-subject': e.preventDefault(); e.stopPropagation(); openAddSubjectModal(); break;
        case 'edit-subject': e.preventDefault(); e.stopPropagation(); openEditSubjectModal(id); break;
        case 'delete-subject': e.preventDefault(); e.stopPropagation(); deleteSubject(id); break;
      }
    };

    document.addEventListener('click', _clickHandler);
  }

  /* ================================================================== */
  /*  Data Loading                                                      */
  /* ================================================================== */

  function loadAllData() {
    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    // Sessions
    if (typeof DataService.onSnapshot === 'function') {
      var unsubSess = DataService.onSnapshot('sessions', function (data) {
        _sessions = data || [];
        refreshCurrentTab();
      }, schoolId);
      if (typeof unsubSess === 'function') _listeners.push(unsubSess);
    }
    DataService.getBySchool('sessions', schoolId).then(function (data) {
      _sessions = data || [];
      refreshCurrentTab();
    }).catch(function () { /* ignore */ });

    // Terms
    if (typeof DataService.onSnapshot === 'function') {
      var unsubTerm = DataService.onSnapshot('terms', function (data) {
        _terms = data || [];
        refreshCurrentTab();
      }, schoolId);
      if (typeof unsubTerm === 'function') _listeners.push(unsubTerm);
    }
    DataService.getBySchool('terms', schoolId).then(function (data) {
      _terms = data || [];
      refreshCurrentTab();
    }).catch(function () { /* ignore */ });

    // Departments
    if (typeof DataService.onSnapshot === 'function') {
      var unsubDept = DataService.onSnapshot('departments', function (data) {
        _departments = data || [];
        refreshCurrentTab();
      }, schoolId);
      if (typeof unsubDept === 'function') _listeners.push(unsubDept);
    }
    DataService.getBySchool('departments', schoolId).then(function (data) {
      _departments = data || [];
      refreshCurrentTab();
    }).catch(function () { /* ignore */ });

    // Classes
    if (typeof DataService.onSnapshot === 'function') {
      var unsubClass = DataService.onSnapshot('classes', function (data) {
        _classes = data || [];
        refreshCurrentTab();
      }, schoolId);
      if (typeof unsubClass === 'function') _listeners.push(unsubClass);
    }
    DataService.getBySchool('classes', schoolId).then(function (data) {
      _classes = data || [];
      refreshCurrentTab();
    }).catch(function () { /* ignore */ });

    // Houses
    if (typeof DataService.onSnapshot === 'function') {
      var unsubHouse = DataService.onSnapshot('houses', function (data) {
        _houses = data || [];
        refreshCurrentTab();
      }, schoolId);
      if (typeof unsubHouse === 'function') _listeners.push(unsubHouse);
    }
    DataService.getBySchool('houses', schoolId).then(function (data) {
      _houses = data || [];
      refreshCurrentTab();
    }).catch(function () { /* ignore */ });

    // Subjects
    if (typeof DataService.onSnapshot === 'function') {
      var unsubSubj = DataService.onSnapshot('subjects', function (data) {
        _subjects = data || [];
        refreshCurrentTab();
      }, schoolId);
      if (typeof unsubSubj === 'function') _listeners.push(unsubSubj);
    }
    DataService.getBySchool('subjects', schoolId).then(function (data) {
      _subjects = data || [];
      refreshCurrentTab();
    }).catch(function () { /* ignore */ });

    // Students (needed for count calculations)
    if (DataService.getStudents) {
      DataService.getStudents(schoolId).then(function (data) {
        _students = data || [];
        refreshCurrentTab();
      }).catch(function () { /* ignore */ });
    } else {
      DataService.getBySchool('students', schoolId).then(function (data) {
        _students = data || [];
        refreshCurrentTab();
      }).catch(function () { /* ignore */ });
    }
  }

  function refreshCurrentTab() {
    var content = document.getElementById('academic-tab-content');
    if (content) {
      content.innerHTML = renderTabContent();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.academic = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('academic');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Academic Structure' }
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

      _listeners.forEach(function (unsub) {
        if (typeof unsub === 'function') unsub();
      });
      _listeners = [];

      _activeTab = 'sessions';
      _sessions = [];
      _terms = [];
      _departments = [];
      _classes = [];
      _houses = [];
      _subjects = [];
      _students = [];
    }
  };
})();