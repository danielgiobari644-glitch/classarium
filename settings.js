/**
 * Classarium School Settings Module
 * Manage school info, result configuration, grading system, and user management.
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
    { key: 'school-info', label: 'School Info', icon: '🏫' },
    { key: 'result-config', label: 'Result Configuration', icon: '📊' },
    { key: 'grading', label: 'Grading System', icon: '📝' },
    { key: 'users', label: 'User Management', icon: '👥' }
  ];

  var SCHOOL_TYPES = [
    { value: 'primary', label: 'Primary School' },
    { value: 'secondary', label: 'Secondary School' },
    { value: 'tertiary', label: 'Tertiary Institution' },
    { value: 'mixed', label: 'Mixed (Primary & Secondary)' }
  ];

  var ROLES = [
    { value: 'school_admin', label: 'School Admin' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'class_manager', label: 'Class Manager' },
    { value: 'head_teacher', label: 'Head Teacher' },
    { value: 'vice_principal', label: 'Vice Principal' },
    { value: 'principal', label: 'Principal' },
    { value: 'bursar', label: 'Bursar' },
    { value: 'librarian', label: 'Librarian' },
    { value: 'admin_staff', label: 'Admin Staff' }
  ];

  var DEFAULT_GRADES = [
    { grade: 'A', minScore: 70, maxScore: 100, remark: 'Excellent' },
    { grade: 'B', minScore: 60, maxScore: 69, remark: 'Very Good' },
    { grade: 'C', minScore: 50, maxScore: 59, remark: 'Good' },
    { grade: 'D', minScore: 45, maxScore: 49, remark: 'Fair' },
    { grade: 'F', minScore: 0, maxScore: 44, remark: 'Fail' }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _activeTab = 'school-info';
  var _school = {};
  var _config = {};
  var _users = [];
  var _listeners = [];
  var _clickHandler = null;
  var _userSearch = '';
  var _userRoleFilter = 'all';
  var _editingGrades = [];

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getSchoolId() {
    var profile = window.App && window.App.state && window.App.state.profile;
    return profile ? profile.schoolId : '';
  }

  function isAdmin() {
    var profile = window.App && window.App.state && window.App.state.profile;
    return profile && (profile.role === 'school_admin' || profile.role === 'admin');
  }

  function getConfigVal(key, fallback) {
    return _config[key] !== undefined ? _config[key] : fallback;
  }

  /* ------------------------------------------------------------------ */
  /*  Render — Main Page                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="settings-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Settings</h1>'
      + '<p class="page-header-description">Configure school information, results, grading & users</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Tabs
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div style="display:flex;gap:0;border-bottom:1px solid var(--gray-200);overflow-x:auto">'
      + TABS.map(function (tab) {
        // Hide User Management for non-admins
        if (tab.key === 'users' && !isAdmin()) return '';
        var isActive = _activeTab === tab.key;
        return '<button class="profile-tab' + (isActive ? ' active' : '') + '" data-action="switch-tab" data-tab="' + tab.key + '" style="white-space:nowrap;padding:14px 20px;font-size:14px;font-weight:500;border:none;background:none;cursor:pointer;color:' + (isActive ? 'var(--primary-600)' : 'var(--gray-500)') + ';border-bottom:2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent') + ';transition:all 0.15s">'
          + tab.icon + ' ' + tab.label
          + '</button>';
      }).join('')
      + '</div>'
      + '<div class="card-body" id="settings-tab-content">'
      + renderTabContent()
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  function renderTabContent() {
    switch (_activeTab) {
      case 'school-info': return renderSchoolInfoTab();
      case 'result-config': return renderResultConfigTab();
      case 'grading': return renderGradingTab();
      case 'users': return isAdmin() ? renderUsersTab() : '<p style="color:var(--gray-500);text-align:center;padding:40px">Access denied.</p>';
      default: return renderSchoolInfoTab();
    }
  }

  /* ================================================================== */
  /*  SCHOOL INFO TAB                                                    */
  /* ================================================================== */

  function renderSchoolInfoTab() {
    var s = _school;

    var html = '<form id="school-info-form">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">School Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="si-name" class="form-input" value="' + Utils.escapeHtml(s.name || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Motto</label>'
      + '<input type="text" id="si-motto" class="form-input" value="' + Utils.escapeHtml(s.motto || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Email</label>'
      + '<input type="email" id="si-email" class="form-input" value="' + Utils.escapeHtml(s.email || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Phone</label>'
      + '<input type="text" id="si-phone" class="form-input" value="' + Utils.escapeHtml(s.phone || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Website</label>'
      + '<input type="url" id="si-website" class="form-input" value="' + Utils.escapeHtml(s.website || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Established Year</label>'
      + '<input type="number" id="si-year" class="form-input" placeholder="e.g. 1990" value="' + (s.establishedYear || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">School Type</label>'
      + '<select id="si-type" class="form-select">'
      + '<option value="">Select Type</option>'
      + SCHOOL_TYPES.map(function (t) {
        return '<option value="' + t.value + '"' + (s.schoolType === t.value ? ' selected' : '') + '>' + t.label + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Country</label>'
      + '<input type="text" id="si-country" class="form-input" value="' + Utils.escapeHtml(s.country || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">State</label>'
      + '<input type="text" id="si-state" class="form-input" value="' + Utils.escapeHtml(s.state || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">City</label>'
      + '<input type="text" id="si-city" class="form-input" value="' + Utils.escapeHtml(s.city || '') + '">'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Address</label>'
      + '<textarea id="si-address" class="form-input" rows="2">' + Utils.escapeHtml(s.address || '') + '</textarea>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Principal Name</label>'
      + '<input type="text" id="si-principal" class="form-input" value="' + Utils.escapeHtml(s.principalName || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Principal Signature (text or URL)</label>'
      + '<textarea id="si-signature" class="form-input" rows="2" placeholder="Text or image URL">' + Utils.escapeHtml(s.principalSignature || '') + '</textarea>'
      + '</div>'
      + '</div>'
      + '<div style="margin-top:20px;display:flex;gap:12px">'
      + '<button type="button" class="btn btn-primary" data-action="save-school-info">Save Changes</button>'
      + '</div>'
      + '</form>';

    return html;
  }

  /* ================================================================== */
  /*  RESULT CONFIGURATION TAB                                           */
  /* ================================================================== */

  function renderResultConfigTab() {
    var caMax = getConfigVal('caTestMaxScore', 20);
    var assignMax = getConfigVal('assignmentMaxScore', 10);
    var examMax = getConfigVal('examMaxScore', 70);
    var caWeight = getConfigVal('caWeight', 40);
    var examWeight = getConfigVal('examWeight', 60);
    var showLogo = getConfigVal('reportShowLogo', true);
    var showAttendance = getConfigVal('reportShowAttendance', true);
    var showPosition = getConfigVal('reportShowPosition', true);

    var html = '<form id="result-config-form">'
      + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600">Score Settings</h3>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">'
      + '<div>'
      + '<label class="form-label">CA Test Max Score</label>'
      + '<input type="number" id="rc-ca-max" class="form-input" value="' + caMax + '" min="0">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Assignment Max Score</label>'
      + '<input type="number" id="rc-assign-max" class="form-input" value="' + assignMax + '" min="0">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Exam Max Score</label>'
      + '<input type="number" id="rc-exam-max" class="form-input" value="' + examMax + '" min="0">'
      + '</div>'
      + '</div>'
      + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600">Weight Settings</h3>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">'
      + '<div>'
      + '<label class="form-label">CA Weight (%)</label>'
      + '<input type="number" id="rc-ca-weight" class="form-input" value="' + caWeight + '" min="0" max="100">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Exam Weight (%)</label>'
      + '<input type="number" id="rc-exam-weight" class="form-input" value="' + examWeight + '" min="0" max="100">'
      + '</div>'
      + '</div>'
      + '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600">Report Card Header</h3>'
      + '<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">'
      + '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">'
      + '<input type="checkbox" id="rc-show-logo"' + (showLogo ? ' checked' : '') + '> Show School Logo'
      + '</label>'
      + '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">'
      + '<input type="checkbox" id="rc-show-attendance"' + (showAttendance ? ' checked' : '') + '> Show Attendance Summary'
      + '</label>'
      + '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">'
      + '<input type="checkbox" id="rc-show-position"' + (showPosition ? ' checked' : '') + '> Show Student Position'
      + '</label>'
      + '</div>'
      + '<button type="button" class="btn btn-primary" data-action="save-result-config">Save Configuration</button>'
      + '</form>';

    return html;
  }

  /* ================================================================== */
  /*  GRADING SYSTEM TAB                                                 */
  /* ================================================================== */

  function renderGradingTab() {
    if (!_editingGrades.length) {
      _editingGrades = (_config.gradingSystem && _config.gradingSystem.length)
        ? JSON.parse(JSON.stringify(_config.gradingSystem))
        : JSON.parse(JSON.stringify(DEFAULT_GRADES));
    }

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Grading System</h3>'
      + '<button class="btn btn-primary btn-sm" data-action="add-grade-row">+ Add Grade</button>'
      + '</div>'
      + '<p style="margin:0 0 16px;font-size:13px;color:var(--gray-500)">Define the grade boundaries used for student results.</p>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="grading-table">'
      + '<thead><tr>'
      + '<th style="width:15%">Grade</th>'
      + '<th style="width:20%">Min Score</th>'
      + '<th style="width:20%">Max Score</th>'
      + '<th style="width:35%">Remark</th>'
      + '<th style="width:10%;text-align:right">Actions</th>'
      + '</tr></thead><tbody id="grading-tbody">';

    _editingGrades.forEach(function (g, i) {
      html += '<tr>'
        + '<td><input type="text" class="form-input grade-input" data-field="grade" data-index="' + i + '" value="' + Utils.escapeHtml(g.grade || '') + '" style="width:80px;text-align:center;font-weight:600"></td>'
        + '<td><input type="number" class="form-input grade-input" data-field="minScore" data-index="' + i + '" value="' + g.minScore + '" min="0" max="100" style="width:80px"></td>'
        + '<td><input type="number" class="form-input grade-input" data-field="maxScore" data-index="' + i + '" value="' + g.maxScore + '" min="0" max="100" style="width:80px"></td>'
        + '<td><input type="text" class="form-input grade-input" data-field="remark" data-index="' + i + '" value="' + Utils.escapeHtml(g.remark || '') + '" style="width:100%"></td>'
        + '<td style="text-align:right">'
        + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="remove-grade-row" data-index="' + i + '">Remove</button>'
        + '</td></tr>';
    });

    html += '</tbody></table></div>';

    html += '<div style="margin-top:20px">'
      + '<button class="btn btn-primary" data-action="save-grading">Save Grading System</button>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  USER MANAGEMENT TAB (Admin Only)                                   */
  /* ================================================================== */

  function renderUsersTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Users <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _users.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="invite-staff">+ Invite Staff</button>'
      + '</div>';

    // Filters
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">'
      + '<div style="flex:1;min-width:220px">'
      + '<input type="text" id="settings-user-search" class="form-input" placeholder="Search by name or email..." value="' + Utils.escapeHtml(_userSearch) + '">'
      + '</div>'
      + '<div style="min-width:180px">'
      + '<select id="settings-user-role-filter" class="form-select">'
      + '<option value="all"' + (_userRoleFilter === 'all' ? ' selected' : '') + '>All Roles</option>'
      + ROLES.map(function (r) {
        return '<option value="' + r.value + '"' + (_userRoleFilter === r.value ? ' selected' : '') + '>' + r.label + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '</div>';

    // Filtered users
    var filtered = _users.filter(function (u) {
      var q = _userSearch.toLowerCase();
      var name = (u.fullName || u.displayName || '').toLowerCase();
      var email = (u.email || '').toLowerCase();
      var matchSearch = !q || name.indexOf(q) !== -1 || email.indexOf(q) !== -1;
      var matchRole = _userRoleFilter === 'all' || u.role === _userRoleFilter;
      return matchSearch && matchRole;
    });

    html += '<div class="data-table-wrapper"><table class="data-table" id="users-table">'
      + '<thead><tr>'
      + '<th>Name</th>'
      + '<th>Email</th>'
      + '<th>Role</th>'
      + '<th>Status</th>'
      + '<th>Last Login</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="users-tbody">';

    if (!filtered.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">👥</div>'
        + '<h3 class="empty-state-title">No users found</h3>'
        + '<p class="empty-state-description">Invite staff members to join your school.</p>'
        + '</div></td></tr>';
    } else {
      filtered.forEach(function (u) {
        var statusBadge = u.status === 'active'
          ? '<span class="badge badge-success">Active</span>'
          : '<span class="badge badge-warning">Inactive</span>';

        var roleName = ROLES.find(function (r) { return r.value === u.role; });
        var roleLabel = roleName ? roleName.label : Utils.capitalize(u.role || 'N/A');

        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(u.fullName || u.displayName || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(u.email || '—') + '</td>'
          + '<td><span class="badge badge-primary">' + Utils.escapeHtml(roleLabel) + '</span></td>'
          + '<td>' + statusBadge + '</td>'
          + '<td>' + (u.lastLogin ? Utils.timeAgo(u.lastLogin) : 'Never') + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="change-role" data-id="' + u.id + '">Change Role</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="toggle-user-status" data-id="' + u.id + '" data-status="' + (u.status || 'active') + '">'
          + (u.status === 'active' ? 'Deactivate' : 'Activate')
          + '</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Save Handlers                                                      */
  /* ------------------------------------------------------------------ */

  function saveSchoolInfo() {
    var name = (document.getElementById('si-name') || {}).value || '';
    if (!name.trim()) { Toast.error('School name is required'); return; }

    var data = {
      name: name.trim(),
      motto: ((document.getElementById('si-motto') || {}).value || '').trim(),
      email: ((document.getElementById('si-email') || {}).value || '').trim(),
      phone: ((document.getElementById('si-phone') || {}).value || '').trim(),
      website: ((document.getElementById('si-website') || {}).value || '').trim(),
      establishedYear: parseInt(((document.getElementById('si-year') || {}).value || ''), 10) || null,
      schoolType: (document.getElementById('si-type') || {}).value || '',
      country: ((document.getElementById('si-country') || {}).value || '').trim(),
      state: ((document.getElementById('si-state') || {}).value || '').trim(),
      city: ((document.getElementById('si-city') || {}).value || '').trim(),
      address: ((document.getElementById('si-address') || {}).value || '').trim(),
      principalName: ((document.getElementById('si-principal') || {}).value || '').trim(),
      principalSignature: ((document.getElementById('si-signature') || {}).value || '').trim(),
      updatedAt: new Date().toISOString()
    };

    var schoolId = getSchoolId();
    DataService.update('schools', schoolId, data).then(function () {
      _school = Object.assign({}, _school, data);
      Toast.success('School information saved');
      DataService.logAction && DataService.logAction('update_school_info', 'schools', schoolId, data);
    }).catch(function (err) {
      Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  function saveResultConfig() {
    var caMax = parseFloat((document.getElementById('rc-ca-max') || {}).value) || 20;
    var assignMax = parseFloat((document.getElementById('rc-assign-max') || {}).value) || 10;
    var examMax = parseFloat((document.getElementById('rc-exam-max') || {}).value) || 70;
    var caWeight = parseFloat((document.getElementById('rc-ca-weight') || {}).value) || 40;
    var examWeight = parseFloat((document.getElementById('rc-exam-weight') || {}).value) || 60;
    var showLogo = (document.getElementById('rc-show-logo') || {}).checked;
    var showAttendance = (document.getElementById('rc-show-attendance') || {}).checked;
    var showPosition = (document.getElementById('rc-show-position') || {}).checked;

    if (caWeight + examWeight !== 100) {
      Toast.error('CA Weight + Exam Weight must equal 100%');
      return;
    }

    var data = {
      caTestMaxScore: caMax,
      assignmentMaxScore: assignMax,
      examMaxScore: examMax,
      caWeight: caWeight,
      examWeight: examWeight,
      reportShowLogo: showLogo,
      reportShowAttendance: showAttendance,
      reportShowPosition: showPosition
    };

    DataService.updateSchoolConfig(data).then(function () {
      _config = Object.assign({}, _config, data);
      Toast.success('Result configuration saved');
      DataService.logAction && DataService.logAction('update_result_config', 'schoolConfig', '', data);
    }).catch(function (err) {
      Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  function saveGrading() {
    // Read values from inputs
    var inputs = document.querySelectorAll('.grade-input');
    inputs.forEach(function (input) {
      var idx = parseInt(input.dataset.index, 10);
      var field = input.dataset.field;
      if (field === 'minScore' || field === 'maxScore') {
        _editingGrades[idx][field] = parseFloat(input.value) || 0;
      } else {
        _editingGrades[idx][field] = input.value.trim();
      }
    });

    // Validation
    for (var i = 0; i < _editingGrades.length; i++) {
      var g = _editingGrades[i];
      if (!g.grade.trim()) { Toast.error('Grade letter is required for row ' + (i + 1)); return; }
      if (g.minScore > g.maxScore) { Toast.error('Min score cannot exceed max score for grade ' + g.grade); return; }
    }

    var data = { gradingSystem: _editingGrades };

    DataService.updateSchoolConfig(data).then(function () {
      _config = Object.assign({}, _config, data);
      Toast.success('Grading system saved');
      DataService.logAction && DataService.logAction('update_grading_system', 'schoolConfig', '', data);
    }).catch(function (err) {
      Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  User Management Modals                                             */
  /* ------------------------------------------------------------------ */

  function openInviteStaffModal() {
    var formHtml = '<div style="display:grid;gap:16px">'
      + '<div>'
      + '<label class="form-label">Email Address <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="email" id="modal-invite-email" class="form-input" placeholder="staff@example.com">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Full Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-invite-name" class="form-input" placeholder="John Doe">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Role <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-invite-role" class="form-select">'
      + ROLES.map(function (r) {
        return '<option value="' + r.value + '">' + r.label + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '</div>';

    Modal.open('Invite Staff Member', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Send Invitation',
        className: 'btn btn-primary',
        onClick: function () { submitInviteStaff(); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitInviteStaff() {
    var email = ((document.getElementById('modal-invite-email') || {}).value || '').trim();
    var name = ((document.getElementById('modal-invite-name') || {}).value || '').trim();
    var role = (document.getElementById('modal-invite-role') || {}).value || '';

    if (!email) { Toast.error('Email is required'); return; }
    if (!name) { Toast.error('Name is required'); return; }
    if (!role) { Toast.error('Role is required'); return; }

    var schoolId = getSchoolId();
    var data = {
      email: email,
      fullName: name,
      displayName: name,
      role: role,
      schoolId: schoolId,
      status: 'active',
      invitedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    DataService.add('staff', data).then(function () {
      Toast.success('Invitation sent to ' + email);
      Modal.close();
      DataService.logAction && DataService.logAction('invite_staff', 'staff', '', data);
    }).catch(function (err) {
      Toast.error('Failed to invite: ' + (err.message || 'Unknown error'));
    });
  }

  function openChangeRoleModal(userId) {
    var user = _users.find(function (u) { return u.id === userId; });
    if (!user) return;

    var formHtml = '<div>'
      + '<p style="margin:0 0 16px;font-size:14px;color:var(--gray-600)">Change role for <strong>' + Utils.escapeHtml(user.fullName || user.displayName || user.email) + '</strong></p>'
      + '<label class="form-label">New Role</label>'
      + '<select id="modal-role-select" class="form-select">'
      + ROLES.map(function (r) {
        return '<option value="' + r.value + '"' + (user.role === r.value ? ' selected' : '') + '>' + r.label + '</option>';
      }).join('')
      + '</select>'
      + '</div>';

    Modal.open('Change Role', formHtml, {
      size: 'small',
      actions: [{
        label: 'Save',
        className: 'btn btn-primary',
        onClick: function () { submitChangeRole(userId); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitChangeRole(userId) {
    var role = (document.getElementById('modal-role-select') || {}).value || '';
    if (!role) { Toast.error('Please select a role'); return; }

    DataService.update('staff', userId, { role: role, updatedAt: new Date().toISOString() }).then(function () {
      Toast.success('Role updated');
      Modal.close();
      DataService.logAction && DataService.logAction('change_role', 'staff', userId, { role: role });
    }).catch(function (err) {
      Toast.error('Failed to update role: ' + (err.message || 'Unknown error'));
    });
  }

  function toggleUserStatus(userId, currentStatus) {
    var newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    var label = newStatus === 'active' ? 'Activate' : 'Deactivate';

    Modal.confirm(label + ' User?', 'Are you sure you want to ' + label.toLowerCase() + ' this user?', function () {
      DataService.update('staff', userId, { status: newStatus, updatedAt: new Date().toISOString() }).then(function () {
        Toast.success('User ' + label.toLowerCase() + 'd');
        DataService.logAction && DataService.logAction('toggle_user_status', 'staff', userId, { status: newStatus });
      }).catch(function (err) {
        Toast.error('Failed: ' + (err.message || 'Unknown error'));
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                      */
  /* ------------------------------------------------------------------ */

  function loadData() {
    var schoolId = getSchoolId();

    // Load school document
    if (DataService.get) {
      DataService.get('schools', schoolId).then(function (data) {
        _school = data || {};
      }).catch(function () { /* ignore */ });
    }

    // Load school config
    if (DataService.getSchoolConfig) {
      DataService.getSchoolConfig().then(function (data) {
        _config = data || {};
        _editingGrades = [];
        // Re-render grading tab if active
        if (_activeTab === 'grading') refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load users/staff for user management tab
    var loadStaff = DataService.getStaff || function () { return DataService.getBySchool('staff', schoolId); };
    loadStaff().then(function (data) {
      _users = data || [];
      if (_activeTab === 'users') refreshTab();
    }).catch(function () { /* ignore */ });

    // Realtime for staff/users
    if (typeof DataService.onSnapshot === 'function') {
      var unsub = DataService.onSnapshot('staff', function (data) {
        _users = data || [];
        if (_activeTab === 'users') refreshTab();
      }, schoolId);
      if (typeof unsub === 'function') _listeners.push(unsub);
    }
  }

  function refreshTab() {
    var container = document.getElementById('settings-tab-content');
    if (container) container.innerHTML = renderTabContent();
  }

  /* ------------------------------------------------------------------ */
  /*  Event Binding                                                      */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    _clickHandler = function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.dataset.action;
      var id = target.dataset.id || '';

      switch (action) {
        case 'switch-tab':
          e.preventDefault();
          _activeTab = target.dataset.tab;
          _editingGrades = [];
          var container = document.getElementById('settings-tab-content');
          if (container) container.innerHTML = renderTabContent();
          document.querySelectorAll('.profile-tab[data-action="switch-tab"]').forEach(function (btn) {
            var isActive = btn.dataset.tab === _activeTab;
            btn.classList.toggle('active', isActive);
            btn.style.color = isActive ? 'var(--primary-600)' : 'var(--gray-500)';
            btn.style.borderBottom = '2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent');
          });
          bindTabEvents();
          break;

        case 'save-school-info':
          e.preventDefault();
          saveSchoolInfo();
          break;

        case 'save-result-config':
          e.preventDefault();
          saveResultConfig();
          break;

        case 'add-grade-row':
          e.preventDefault();
          _editingGrades.push({ grade: '', minScore: 0, maxScore: 0, remark: '' });
          refreshTab();
          bindTabEvents();
          break;

        case 'remove-grade-row':
          e.preventDefault();
          var idx = parseInt(target.dataset.index, 10);
          _editingGrades.splice(idx, 1);
          refreshTab();
          bindTabEvents();
          break;

        case 'save-grading':
          e.preventDefault();
          saveGrading();
          break;

        case 'invite-staff':
          e.preventDefault();
          openInviteStaffModal();
          break;

        case 'change-role':
          e.preventDefault();
          e.stopPropagation();
          openChangeRoleModal(id);
          break;

        case 'toggle-user-status':
          e.preventDefault();
          e.stopPropagation();
          toggleUserStatus(id, target.dataset.status);
          break;
      }
    };

    bindTabEvents();

    document.addEventListener('click', _clickHandler);
  }

  function bindTabEvents() {
    // User search
    var userSearch = document.getElementById('settings-user-search');
    if (userSearch) {
      var debouncedSearch = Utils.debounce(function (val) {
        _userSearch = val;
        refreshTab();
        bindTabEvents();
      }, 300);
      userSearch.addEventListener('input', function () { debouncedSearch(this.value); });
    }

    // User role filter
    var roleFilter = document.getElementById('settings-user-role-filter');
    if (roleFilter) {
      roleFilter.addEventListener('change', function () {
        _userRoleFilter = this.value;
        refreshTab();
        bindTabEvents();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.settings = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('settings');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Settings' }
      ]);
      return render();
    },

    bind: function () {
      setTimeout(function () {
        bindEvents();
        loadData();
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
      _school = {};
      _config = {};
      _users = [];
      _activeTab = 'school-info';
      _userSearch = '';
      _userRoleFilter = 'all';
      _editingGrades = [];
    }
  };
})();