/**
 * Classarium Staff Module
 * Full staff management — list, search, filter, add, view, edit, delete, export.
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
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _allStaff = [];
  var _departments = [];
  var _classes = [];
  var _filter = { search: '', departmentId: 'all', role: 'all', status: 'all' };
  var _listeners = [];
  var _clickHandler = null;

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  var ROLES = [
    { value: 'teacher', label: 'Teacher' },
    { value: 'class_manager', label: 'Class Manager' },
    { value: 'head_teacher', label: 'Head Teacher' },
    { value: 'vice_principal', label: 'Vice Principal' },
    { value: 'principal', label: 'Principal' },
    { value: 'bursar', label: 'Bursar' },
    { value: 'librarian', label: 'Librarian' },
    { value: 'lab_technician', label: 'Lab Technician' },
    { value: 'admin_staff', label: 'Admin Staff' },
    { value: 'security', label: 'Security' },
    { value: 'cleaner', label: 'Cleaner' },
    { value: 'driver', label: 'Driver' },
    { value: 'nurse', label: 'Nurse' },
    { value: 'counselor', label: 'Counselor' },
    { value: 'other', label: 'Other' }
  ];

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function statusBadge(status) {
    var map = {
      active: { text: 'Active', cls: 'success' },
      inactive: { text: 'Inactive', cls: 'warning' },
      suspended: { text: 'Suspended', cls: 'danger' },
      resigned: { text: 'Resigned', cls: 'default' },
      terminated: { text: 'Terminated', cls: 'danger' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function roleBadge(role) {
    var map = {
      teacher: { text: 'Teacher', cls: 'primary' },
      class_manager: { text: 'Class Manager', cls: 'info' },
      head_teacher: { text: 'Head Teacher', cls: 'info' },
      vice_principal: { text: 'Vice Principal', cls: 'warning' },
      principal: { text: 'Principal', cls: 'danger' },
      bursar: { text: 'Bursar', cls: 'default' },
      librarian: { text: 'Librarian', cls: 'default' },
      lab_technician: { text: 'Lab Tech', cls: 'default' },
      admin_staff: { text: 'Admin Staff', cls: 'default' },
      security: { text: 'Security', cls: 'default' },
      cleaner: { text: 'Cleaner', cls: 'default' },
      driver: { text: 'Driver', cls: 'default' },
      nurse: { text: 'Nurse', cls: 'info' },
      counselor: { text: 'Counselor', cls: 'info' },
      other: { text: 'Other', cls: 'default' }
    };
    var r = map[role] || { text: Utils.capitalize(role || 'N/A'), cls: 'default' };
    return '<span class="badge badge-' + r.cls + '">' + r.text + '</span>';
  }

  function getRoleLabel(role) {
    var found = ROLES.find(function (r) { return r.value === role; });
    return found ? found.label : Utils.capitalize(role || 'N/A');
  }

  function getDepartmentName(deptId) {
    var d = _departments.find(function (dp) { return dp.id === deptId; });
    return d ? (d.name || '—') : (deptId || '—');
  }

  function getFiltered() {
    return _allStaff.filter(function (s) {
      var q = _filter.search.toLowerCase();
      var name = (s.fullName || s.displayName || '').toLowerCase();
      var email = (s.email || '').toLowerCase();
      var staffId = (s.staffId || '').toLowerCase();
      var matchSearch = !q || name.indexOf(q) !== -1 || email.indexOf(q) !== -1 || staffId.indexOf(q) !== -1;
      var matchDept = _filter.departmentId === 'all' || s.departmentId === _filter.departmentId;
      var matchRole = _filter.role === 'all' || s.role === _filter.role;
      var matchStatus = _filter.status === 'all' || s.status === _filter.status;
      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Render — List View                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    // If route is staff-profile, render profile placeholder
    if (Router && Router.getParams && Router.getParams().staffId) {
      return renderProfilePlaceholder();
    }

    var html = '<div class="staff-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Staff</h1>'
      + '<p class="page-header-description">Manage all school staff members</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-ghost" data-action="export-staff">Export</button>'
      + '<button class="btn btn-primary" data-action="add-staff">Add Staff</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div id="staff-stat-total" class="stat-card"><div class="stat-card-icon" style="background:var(--primary-50);color:var(--primary-600)">👥</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Staff</div></div>'
      + '<div id="staff-stat-teachers" class="stat-card"><div class="stat-card-icon" style="background:#EFF6FF;color:#2563EB">👨‍🏫</div><div class="stat-card-value">--</div><div class="stat-card-label">Teachers</div></div>'
      + '<div id="staff-stat-active" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Active</div></div>'
      + '<div id="staff-stat-inactive" class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">⏸️</div><div class="stat-card-value">--</div><div class="stat-card-label">Inactive</div></div>'
      + '</div>';

    // Filters
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-body">'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'
      + '<div style="flex:1;min-width:220px">'
      + '<input type="text" id="staff-search" class="form-input" placeholder="Search by name, email, or staff ID..." value="' + Utils.escapeHtml(_filter.search || '') + '" style="width:100%">'
      + '</div>'
      + '<div style="min-width:180px">'
      + '<select id="staff-filter-dept" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.departmentId === 'all' ? ' selected' : '') + '>All Departments</option>'
      + _departments.map(function (d) {
        return '<option value="' + (d.id || '') + '"' + (_filter.departmentId === d.id ? ' selected' : '') + '>' + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div style="min-width:180px">'
      + '<select id="staff-filter-role" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.role === 'all' ? ' selected' : '') + '>All Roles</option>'
      + ROLES.map(function (r) {
        return '<option value="' + r.value + '"' + (_filter.role === r.value ? ' selected' : '') + '>' + r.label + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div style="min-width:150px">'
      + '<select id="staff-filter-status" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.status === 'all' ? ' selected' : '') + '>All Statuses</option>'
      + '<option value="active"' + (_filter.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="inactive"' + (_filter.status === 'inactive' ? ' selected' : '') + '>Inactive</option>'
      + '<option value="suspended"' + (_filter.status === 'suspended' ? ' selected' : '') + '>Suspended</option>'
      + '<option value="resigned"' + (_filter.status === 'resigned' ? ' selected' : '') + '>Resigned</option>'
      + '</select>'
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-action="clear-filters">Clear</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Table
    html += '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">All Staff <span id="staff-count" style="font-weight:400;font-size:13px;color:var(--gray-500)"></span></h3>'
      + '</div>'
      + '<div class="card-body" style="padding:0">'
      + '<div class="data-table-wrapper">'
      + '<table class="data-table" id="staff-table">'
      + '<thead>'
      + '<tr>'
      + '<th style="width:22%">Name</th>'
      + '<th style="width:12%">Staff ID</th>'
      + '<th style="width:14%">Role</th>'
      + '<th style="width:14%">Department</th>'
      + '<th style="width:12%">Phone</th>'
      + '<th style="width:10%">Status</th>'
      + '<th style="width:16%;text-align:right">Actions</th>'
      + '</tr>'
      + '</thead>'
      + '<tbody id="staff-tbody">'
      + '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">Loading staff...</td></tr>'
      + '</tbody>'
      + '</table>'
      + '</div>'
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Profile Placeholder                                               */
  /* ------------------------------------------------------------------ */

  function renderProfilePlaceholder() {
    return '<div class="profile-layout">'
      + '<div class="profile-sidebar" id="staff-profile-sidebar"></div>'
      + '<div class="profile-details" id="staff-profile-details">'
      + '<div style="padding:60px;text-align:center;color:var(--gray-400)">Loading staff profile...</div>'
      + '</div>'
      + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Table Rendering                                                   */
  /* ------------------------------------------------------------------ */

  function renderTable() {
    var tbody = document.getElementById('staff-tbody');
    if (!tbody) return;

    var filtered = getFiltered();
    var countEl = document.getElementById('staff-count');
    if (countEl) countEl.textContent = '(' + filtered.length + ' of ' + _allStaff.length + ')';

    if (!filtered.length) {
      var hasFilter = _filter.search || _filter.departmentId !== 'all' || _filter.role !== 'all' || _filter.status !== 'all';
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">👥</div>'
        + '<h3 class="empty-state-title">No staff found</h3>'
        + '<p class="empty-state-description">' + (hasFilter
          ? 'Try adjusting your search or filters.'
          : 'No staff members have been added yet. Click "Add Staff" to get started.')
        + '</p>'
        + (hasFilter ? '' : '<button class="btn btn-primary" data-action="add-staff" style="margin-top:12px">Add Staff</button>')
        + '</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (s) {
      var id = s.id || '';
      var name = s.fullName || s.displayName || '—';
      var initials = Utils.getInitials(name);

      return '<tr data-staff-id="' + id + '" style="cursor:pointer">'
        + '<td>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<div class="avatar" style="width:36px;height:36px;flex-shrink:0;font-size:12px">' + initials + '</div>'
        + '<div>'
        + '<div style="font-weight:500;font-size:14px">' + Utils.escapeHtml(name) + '</div>'
        + (s.email ? '<div style="font-size:12px;color:var(--gray-500)">' + Utils.escapeHtml(s.email) + '</div>' : '')
        + '</div>'
        + '</div>'
        + '</td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(s.staffId || '—') + '</span></td>'
        + '<td>' + roleBadge(s.role) + '</td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(getDepartmentName(s.departmentId)) + '</span></td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(s.phone || '—') + '</span></td>'
        + '<td>' + statusBadge(s.status) + '</td>'
        + '<td style="text-align:right">'
        + '<div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">'
        + '<button class="btn btn-sm btn-ghost" data-action="view-staff" data-id="' + id + '" title="View Profile">View</button> '
        + '<button class="btn btn-sm btn-ghost" data-action="edit-staff" data-id="' + id + '" title="Edit">Edit</button> '
        + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-staff" data-id="' + id + '" title="Delete">Delete</button>'
        + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Update Stats                                                      */
  /* ------------------------------------------------------------------ */

  function updateStats() {
    var total = _allStaff.length;
    var teachers = _allStaff.filter(function (s) { return s.role === 'teacher'; }).length;
    var active = _allStaff.filter(function (s) { return s.status === 'active'; }).length;
    var inactive = _allStaff.filter(function (s) { return s.status !== 'active'; }).length;

    var el;
    el = document.getElementById('staff-stat-total');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(total);
    el = document.getElementById('staff-stat-teachers');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(teachers);
    el = document.getElementById('staff-stat-active');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(active);
    el = document.getElementById('staff-stat-inactive');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(inactive);
  }

  /* ------------------------------------------------------------------ */
  /*  Add Staff Form                                                    */
  /* ------------------------------------------------------------------ */

  function buildAddStaffForm() {
    var deptOptions = _departments.map(function (d) {
      return '<option value="' + (d.id || '') + '">' + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
    }).join('');

    var roleOptions = ROLES.map(function (r) {
      return '<option value="' + r.value + '">' + r.label + '</option>';
    }).join('');

    var classCheckboxes = _classes.map(function (c) {
      return '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px;font-size:13px;cursor:pointer;margin:0 6px 6px 0">'
        + '<input type="checkbox" name="assignedClasses" value="' + (c.id || '') + '" style="margin:0">'
        + Utils.escapeHtml(c.name || c.className || 'Unnamed')
        + '</label>';
    }).join('');

    return '<div class="modal-form" id="add-staff-form">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'

      // Personal Information
      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin-bottom:4px">'
      + '<h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Personal Information</h4>'
      + '</div>'

      + '<div><label class="form-label">Full Name <span style="color:var(--danger-500)">*</span></label><input type="text" name="fullName" class="form-input" required placeholder="e.g. Mrs. Adaeze Okafor"></div>'
      + '<div><label class="form-label">Email <span style="color:var(--danger-500)">*</span></label><input type="email" name="email" class="form-input" required placeholder="e.g. ada@school.com"></div>'
      + '<div><label class="form-label">Phone <span style="color:var(--danger-500)">*</span></label><input type="tel" name="phone" class="form-input" required placeholder="e.g. 08012345678"></div>'
      + '<div><label class="form-label">Gender</label><select name="gender" class="form-select"><option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option></select></div>'
      + '<div><label class="form-label">Date of Birth</label><input type="date" name="dateOfBirth" class="form-input"></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Address</label><input type="text" name="address" class="form-input" placeholder="Residential address" style="width:100%"></div>'
      + '<div><label class="form-label">Qualification</label><input type="text" name="qualification" class="form-input" placeholder="e.g. B.Ed, M.Sc, PGDE"></div>'
      + '<div><label class="form-label">Employment Date</label><input type="date" name="employmentDate" class="form-input"></div>'

      // Assignment
      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px">'
      + '<h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Assignment</h4>'
      + '</div>'

      + '<div><label class="form-label">Role <span style="color:var(--danger-500)">*</span></label><select name="role" class="form-select" required><option value="">Select Role</option>' + roleOptions + '</select></div>'
      + '<div><label class="form-label">Department <span style="color:var(--danger-500)">*</span></label><select name="departmentId" class="form-select" required><option value="">Select Department</option>' + deptOptions + '</select></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Assigned Classes</label>'
      + '<div style="margin-top:4px;max-height:150px;overflow-y:auto;padding:4px 0">'
      + (classCheckboxes || '<span style="color:var(--gray-400);font-size:13px">No classes available. Please add classes first.</span>')
      + '</div></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Assigned Subjects</label><input type="text" name="assignedSubjects" class="form-input" placeholder="e.g. Mathematics, Physics, Chemistry (comma-separated)" style="width:100%"></div>'

      + '</div>'
      + '</div>';
  }

  function submitAddStaff() {
    var form = document.getElementById('add-staff-form');
    if (!form) return;

    var fullName = form.querySelector('[name="fullName"]').value.trim();
    var email = form.querySelector('[name="email"]').value.trim();
    var phone = form.querySelector('[name="phone"]').value.trim();

    if (!fullName) {
      Toast.error('Full Name is required.');
      return;
    }
    if (!email) {
      Toast.error('Email is required.');
      return;
    }
    if (!form.querySelector('[name="role"]').value) {
      Toast.error('Please select a role.');
      return;
    }
    if (!form.querySelector('[name="departmentId"]').value) {
      Toast.error('Please select a department.');
      return;
    }

    // Gather assigned classes
    var assignedClasses = [];
    var classCheckboxes = form.querySelectorAll('input[name="assignedClasses"]:checked');
    classCheckboxes.forEach(function (cb) { assignedClasses.push(cb.value); });

    // Parse subjects
    var subjectsRaw = form.querySelector('[name="assignedSubjects"]').value.trim();
    var assignedSubjects = subjectsRaw ? subjectsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    var staffData = {
      fullName: fullName,
      displayName: fullName,
      email: email,
      phone: phone,
      gender: form.querySelector('[name="gender"]').value || null,
      dateOfBirth: form.querySelector('[name="dateOfBirth"]').value || null,
      address: form.querySelector('[name="address"]').value.trim(),
      qualification: form.querySelector('[name="qualification"]').value.trim(),
      employmentDate: form.querySelector('[name="employmentDate"]').value || null,
      role: form.querySelector('[name="role"]').value,
      departmentId: form.querySelector('[name="departmentId"]').value || null,
      assignedClasses: assignedClasses,
      assignedSubjects: assignedSubjects,
      schoolId: schoolId,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    Toast.info('Adding staff member...');
    var addFn = DataService.addStaff || function (data) { return DataService.add('staff', data); };

    addFn(staffData).then(function (docRef) {
      Toast.success('Staff member "' + staffData.fullName + '" added successfully');
      Modal.close();
      DataService.logAction('staff_added', 'staff', docRef && docRef.id, { name: staffData.fullName, role: staffData.role });
    }).catch(function (err) {
      Toast.error('Failed to add staff member: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Edit Staff Form                                                   */
  /* ------------------------------------------------------------------ */

  function openEditStaff(id) {
    var staff = _allStaff.find(function (s) { return s.id === id; });
    if (!staff) {
      Toast.error('Staff member not found.');
      return;
    }

    var deptOptions = _departments.map(function (d) {
      return '<option value="' + (d.id || '') + '"' + (staff.departmentId === d.id ? ' selected' : '') + '>' + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
    }).join('');

    var roleOptions = ROLES.map(function (r) {
      return '<option value="' + r.value + '"' + (staff.role === r.value ? ' selected' : '') + '>' + r.label + '</option>';
    }).join('');

    var genderOptions = ['', 'male', 'female'].map(function (g) {
      var label = g ? Utils.capitalize(g) : 'Select Gender';
      return '<option value="' + g + '"' + (staff.gender === g ? ' selected' : '') + '>' + label + '</option>';
    }).join('');

    var statusOptions = ['active', 'inactive', 'suspended', 'resigned'].map(function (st) {
      return '<option value="' + st + '"' + (staff.status === st ? ' selected' : '') + '>' + Utils.capitalize(st) + '</option>';
    }).join('');

    var classCheckboxes = _classes.map(function (c) {
      var checked = (staff.assignedClasses || []).indexOf(c.id) !== -1 ? ' checked' : '';
      return '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px;font-size:13px;cursor:pointer;margin:0 6px 6px 0">'
        + '<input type="checkbox" name="assignedClasses" value="' + (c.id || '') + '"' + checked + ' style="margin:0">'
        + Utils.escapeHtml(c.name || c.className || 'Unnamed')
        + '</label>';
    }).join('');

    var subjectsStr = (staff.assignedSubjects || []).join(', ');

    var formHtml = '<div class="modal-form" id="edit-staff-form">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'

      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin-bottom:4px"><h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Personal Information</h4></div>'

      + '<div><label class="form-label">Full Name <span style="color:var(--danger-500)">*</span></label><input type="text" name="fullName" class="form-input" required value="' + Utils.escapeHtml(staff.fullName || '') + '"></div>'
      + '<div><label class="form-label">Email <span style="color:var(--danger-500)">*</span></label><input type="email" name="email" class="form-input" required value="' + Utils.escapeHtml(staff.email || '') + '"></div>'
      + '<div><label class="form-label">Phone <span style="color:var(--danger-500)">*</span></label><input type="tel" name="phone" class="form-input" required value="' + Utils.escapeHtml(staff.phone || '') + '"></div>'
      + '<div><label class="form-label">Gender</label><select name="gender" class="form-select">' + genderOptions + '</select></div>'
      + '<div><label class="form-label">Date of Birth</label><input type="date" name="dateOfBirth" class="form-input" value="' + (staff.dateOfBirth || '') + '"></div>'
      + '<div><label class="form-label">Status</label><select name="status" class="form-select">' + statusOptions + '</select></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Address</label><input type="text" name="address" class="form-input" value="' + Utils.escapeHtml(staff.address || '') + '" style="width:100%"></div>'
      + '<div><label class="form-label">Qualification</label><input type="text" name="qualification" class="form-input" value="' + Utils.escapeHtml(staff.qualification || '') + '"></div>'
      + '<div><label class="form-label">Employment Date</label><input type="date" name="employmentDate" class="form-input" value="' + (staff.employmentDate || '') + '"></div>'

      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px"><h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Assignment</h4></div>'

      + '<div><label class="form-label">Role</label><select name="role" class="form-select"><option value="">Select Role</option>' + roleOptions + '</select></div>'
      + '<div><label class="form-label">Department</label><select name="departmentId" class="form-select"><option value="">Select Department</option>' + deptOptions + '</select></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Assigned Classes</label>'
      + '<div style="margin-top:4px;max-height:150px;overflow-y:auto;padding:4px 0">'
      + (classCheckboxes || '<span style="color:var(--gray-400);font-size:13px">No classes available.</span>')
      + '</div></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Assigned Subjects</label><input type="text" name="assignedSubjects" class="form-input" value="' + Utils.escapeHtml(subjectsStr) + '" placeholder="e.g. Mathematics, Physics" style="width:100%"></div>'

      + '</div></div>';

    Modal.open('Edit Staff — ' + (staff.fullName || staff.displayName || ''), formHtml, {
      size: 'large',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitEditStaff(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitEditStaff(id) {
    var form = document.getElementById('edit-staff-form');
    if (!form) return;

    var fullName = form.querySelector('[name="fullName"]').value.trim();
    var email = form.querySelector('[name="email"]').value.trim();
    var phone = form.querySelector('[name="phone"]').value.trim();

    if (!fullName) {
      Toast.error('Full Name is required.');
      return;
    }
    if (!email) {
      Toast.error('Email is required.');
      return;
    }

    var assignedClasses = [];
    var classCheckboxes = form.querySelectorAll('input[name="assignedClasses"]:checked');
    classCheckboxes.forEach(function (cb) { assignedClasses.push(cb.value); });

    var subjectsRaw = form.querySelector('[name="assignedSubjects"]').value.trim();
    var assignedSubjects = subjectsRaw ? subjectsRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

    var updateData = {
      fullName: fullName,
      displayName: fullName,
      email: email,
      phone: phone,
      gender: form.querySelector('[name="gender"]').value || null,
      dateOfBirth: form.querySelector('[name="dateOfBirth"]').value || null,
      address: form.querySelector('[name="address"]').value.trim(),
      qualification: form.querySelector('[name="qualification"]').value.trim(),
      employmentDate: form.querySelector('[name="employmentDate"]').value || null,
      status: form.querySelector('[name="status"]').value,
      role: form.querySelector('[name="role"]').value,
      departmentId: form.querySelector('[name="departmentId"]').value || null,
      assignedClasses: assignedClasses,
      assignedSubjects: assignedSubjects,
      updatedAt: new Date().toISOString()
    };

    Toast.info('Updating staff member...');
    DataService.update('staff', id, updateData).then(function () {
      Toast.success('Staff member "' + updateData.fullName + '" updated successfully');
      Modal.close();
      DataService.logAction('staff_updated', 'staff', id, { name: updateData.fullName, role: updateData.role });
    }).catch(function (err) {
      Toast.error('Failed to update staff member: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Delete Staff                                                      */
  /* ------------------------------------------------------------------ */

  function deleteStaff(id) {
    var staff = _allStaff.find(function (s) { return s.id === id; });
    if (!staff) return;
    Modal.confirm(
      'Delete Staff Member',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(staff.fullName || staff.displayName || 'this staff member') + '</strong>? This action cannot be undone.',
      function () {
        Toast.info('Deleting staff member...');
        DataService.remove('staff', id).then(function () {
          Toast.success('Staff member deleted successfully');
          DataService.logAction('staff_deleted', 'staff', id, { name: staff.fullName || staff.displayName });
        }).catch(function (err) {
          Toast.error('Failed to delete staff member: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Staff Profile View                                                */
  /* ------------------------------------------------------------------ */

  function viewStaffProfile(id) {
    Router.navigate('/staff-profile/' + id);
  }

  function loadStaffProfile(id) {
    var getFn = DataService.getStaff || function (sid) { return DataService.get('staff', sid); };

    getFn(id).then(function (staff) {
      if (!staff) {
        Toast.error('Staff member not found.');
        return;
      }
      renderStaffProfile(staff);
    }).catch(function (err) {
      Toast.error('Failed to load staff: ' + (err.message || 'Unknown error'));
      var details = document.getElementById('staff-profile-details');
      if (details) {
        details.innerHTML = '<div style="padding:60px;text-align:center;color:var(--danger-500)">Error loading staff profile. Please try again.</div>';
      }
    });
  }

  function renderStaffProfile(s) {
    var id = s.id;
    var name = s.fullName || s.displayName || '—';
    var initials = Utils.getInitials(name);

    if (HeaderComponent) {
      HeaderComponent.setBreadcrumb([
        { label: 'Staff', onClick: function () { Router.navigate('/staff'); } },
        { label: name }
      ]);
    }

    // Sidebar
    var sidebar = document.getElementById('staff-profile-sidebar');
    if (sidebar) {
      sidebar.innerHTML = '<div style="text-align:center;padding:24px 16px">'
        + '<div class="avatar" style="width:96px;height:96px;font-size:32px;margin:0 auto 16px;border-radius:50%;background:var(--primary-100);color:var(--primary-700)">' + initials + '</div>'
        + '<h3 style="font-size:18px;font-weight:600;margin:0 0 4px">' + Utils.escapeHtml(name) + '</h3>'
        + '<p style="color:var(--gray-500);font-size:14px;margin:0 0 6px">' + roleBadge(s.role) + '</p>'
        + '<p style="color:var(--gray-500);font-size:13px;margin:0 0 12px">' + Utils.escapeHtml(getDepartmentName(s.departmentId)) + '</p>'
        + '<p style="color:var(--gray-500);font-size:13px;margin:0 0 4px">ID: ' + Utils.escapeHtml(s.staffId || 'N/A') + '</p>'
        + '<div style="margin-top:8px">' + statusBadge(s.status || 'active') + '</div>'
        + '<div style="margin-top:24px;display:flex;flex-direction:column;gap:8px">'
        + '<button class="btn btn-primary btn-block" data-action="edit-staff" data-id="' + id + '">Edit Staff</button>'
        + '<button class="btn btn-ghost btn-block" data-action="back-to-staff">Back to Staff</button>'
        + '</div>'
        + '</div>';
    }

    // Main content area with tabs
    var details = document.getElementById('staff-profile-details');
    if (details) {
      details.innerHTML = '<div class="profile-tabs">'
        + '<div class="profile-tabs-nav">'
        + '<button class="profile-tab active" data-tab="overview">Overview</button>'
        + '<button class="profile-tab" data-tab="classes">Assigned Classes</button>'
        + '<button class="profile-tab" data-tab="subjects">Assigned Subjects</button>'
        + '<button class="profile-tab" data-tab="attendance">Attendance</button>'
        + '<button class="profile-tab" data-tab="documents">Documents</button>'
        + '</div>'
        + '<div class="profile-tab-content" id="staff-tab-content">'
        + renderStaffOverviewTab(s)
        + '</div>'
        + '</div>';

      // Bind tab clicks
      var tabsNav = details.querySelector('.profile-tabs-nav');
      if (tabsNav) {
        tabsNav.addEventListener('click', function (e) {
          var tabBtn = e.target.closest('.profile-tab');
          if (!tabBtn) return;
          var tabName = tabBtn.dataset.tab;
          tabsNav.querySelectorAll('.profile-tab').forEach(function (btn) { btn.classList.remove('active'); });
          tabBtn.classList.add('active');
          var content = document.getElementById('staff-tab-content');
          if (content) {
            switch (tabName) {
              case 'overview': content.innerHTML = renderStaffOverviewTab(s); break;
              case 'classes': content.innerHTML = renderStaffClassesTab(s); break;
              case 'subjects': content.innerHTML = renderStaffSubjectsTab(s); break;
              case 'attendance': content.innerHTML = renderStaffAttendanceTab(s); break;
              case 'documents': content.innerHTML = renderStaffDocumentsTab(s); break;
            }
          }
        });
      }
    }
  }

  function staffInfoCard(title, items) {
    return '<div class="card" style="margin-bottom:16px">'
      + '<div class="card-header"><h3 class="card-title">' + title + '</h3></div>'
      + '<div class="card-body">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + items.map(function (item) {
        return '<div>'
          + '<div style="font-size:12px;color:var(--gray-500);margin-bottom:2px">' + item.label + '</div>'
          + '<div style="font-size:14px;font-weight:500;color:var(--gray-800)">' + (item.value || '—') + '</div>'
          + '</div>';
      }).join('')
      + '</div></div></div>';
  }

  function renderStaffOverviewTab(s) {
    var html = '<div style="padding:20px 0">';

    html += staffInfoCard('Personal Information', [
      { label: 'Full Name', value: Utils.escapeHtml(s.fullName || s.displayName || '—') },
      { label: 'Email', value: Utils.escapeHtml(s.email || '—') },
      { label: 'Phone', value: Utils.escapeHtml(s.phone || '—') },
      { label: 'Gender', value: Utils.capitalize(s.gender || '—') },
      { label: 'Date of Birth', value: s.dateOfBirth ? Utils.formatDate(s.dateOfBirth) : '—' },
      { label: 'Address', value: Utils.escapeHtml(s.address || '—') },
      { label: 'Qualification', value: Utils.escapeHtml(s.qualification || '—') },
      { label: 'Employment Date', value: s.employmentDate ? Utils.formatDate(s.employmentDate) : '—' }
    ]);

    html += staffInfoCard('Assignment', [
      { label: 'Role', value: getRoleLabel(s.role) },
      { label: 'Department', value: Utils.escapeHtml(getDepartmentName(s.departmentId)) },
      { label: 'Staff ID', value: Utils.escapeHtml(s.staffId || '—') },
      { label: 'Status', value: Utils.capitalize(s.status || 'active') },
      { label: 'Date Added', value: s.createdAt ? Utils.formatDate(s.createdAt) : '—' },
      { label: 'Last Updated', value: s.updatedAt ? Utils.formatDate(s.updatedAt) : '—' }
    ]);

    html += '</div>';
    return html;
  }

  function renderStaffClassesTab(s) {
    var assignedClassIds = s.assignedClasses || [];
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Assigned Classes (' + assignedClassIds.length + ')</h3></div>'
      + '<div class="card-body">';

    if (!assignedClassIds.length) {
      html += '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
        + '<div class="empty-state"><div class="empty-state-icon">🏫</div>'
        + '<h3 class="empty-state-title">No classes assigned</h3>'
        + '<p class="empty-state-description">This staff member has not been assigned to any classes yet.</p>'
        + '</div></div>';
    } else {
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      assignedClassIds.forEach(function (classId) {
        var c = _classes.find(function (cl) { return cl.id === classId; });
        var name = c ? (c.name || c.className || 'Unnamed') : classId;
        html += '<div style="padding:10px 16px;background:var(--primary-50);border:1px solid var(--primary-200);border-radius:8px;font-size:14px;font-weight:500;color:var(--primary-700)">🏫 ' + Utils.escapeHtml(name) + '</div>';
      });
      html += '</div>';
    }

    html += '</div></div></div>';
    return html;
  }

  function renderStaffSubjectsTab(s) {
    var subjects = s.assignedSubjects || [];
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Assigned Subjects (' + subjects.length + ')</h3></div>'
      + '<div class="card-body">';

    if (!subjects.length) {
      html += '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
        + '<div class="empty-state"><div class="empty-state-icon">📚</div>'
        + '<h3 class="empty-state-title">No subjects assigned</h3>'
        + '<p class="empty-state-description">This staff member has not been assigned to any subjects yet.</p>'
        + '</div></div>';
    } else {
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      subjects.forEach(function (subject) {
        html += '<div style="padding:10px 16px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;font-size:14px;font-weight:500;color:#1E40AF">📖 ' + Utils.escapeHtml(subject) + '</div>';
      });
      html += '</div>';
    }

    html += '</div></div></div>';
    return html;
  }

  function renderStaffAttendanceTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Attendance Records</h3></div>'
      + '<div class="card-body">'
      + '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
      + '<div class="empty-state"><div class="empty-state-icon">📋</div>'
      + '<h3 class="empty-state-title">No attendance records</h3>'
      + '<p class="empty-state-description">Attendance records for this staff member will appear here.</p>'
      + '</div>'
      + '</div></div></div>'
      + '</div>';
    return html;
  }

  function renderStaffDocumentsTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Documents</h3></div>'
      + '<div class="card-body">'
      + '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
      + '<div class="empty-state"><div class="empty-state-icon">📁</div>'
      + '<h3 class="empty-state-title">No documents uploaded</h3>'
      + '<p class="empty-state-description">Documents such as CVs, certificates, and employment letters will appear here.</p>'
      + '</div>'
      + '</div></div></div>'
      + '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                            */
  /* ------------------------------------------------------------------ */

  function exportStaff() {
    var filtered = getFiltered();
    if (!filtered.length) {
      Toast.warning('No staff to export.');
      return;
    }
    var data = filtered.map(function (s) {
      return {
        'Staff ID': s.staffId || '',
        'Full Name': s.fullName || s.displayName || '',
        'Email': s.email || '',
        'Phone': s.phone || '',
        'Gender': s.gender || '',
        'Role': getRoleLabel(s.role),
        'Department': getDepartmentName(s.departmentId),
        'Qualification': s.qualification || '',
        'Status': s.status || '',
        'Employment Date': s.employmentDate || '',
        'Assigned Classes': (s.assignedClasses || []).map(function (cid) { return getClassNameFromId(cid); }).join('; '),
        'Assigned Subjects': (s.assignedSubjects || []).join('; '),
        'Date Added': s.createdAt ? Utils.formatDate(s.createdAt) : ''
      };
    });
    Utils.exportCSV(data, 'staff-export');
    Toast.success('Staff exported successfully');
    DataService.logAction('staff_exported', 'staff', null, { count: data.length });
  }

  function getClassNameFromId(classId) {
    var c = _classes.find(function (cl) { return cl.id === classId; });
    return c ? (c.name || c.className || classId) : classId;
  }

  /* ------------------------------------------------------------------ */
  /*  Bind Events                                                       */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    var searchInput = document.getElementById('staff-search');
    var deptSelect = document.getElementById('staff-filter-dept');
    var roleSelect = document.getElementById('staff-filter-role');
    var statusSelect = document.getElementById('staff-filter-status');

    // Debounced search
    if (searchInput) {
      var debouncedSearch = Utils.debounce(function (val) {
        _filter.search = val;
        renderTable();
      }, 300);
      searchInput.addEventListener('input', function () {
        debouncedSearch(this.value);
      });
    }

    // Department filter
    if (deptSelect) {
      deptSelect.addEventListener('change', function () {
        _filter.departmentId = this.value;
        renderTable();
      });
    }

    // Role filter
    if (roleSelect) {
      roleSelect.addEventListener('change', function () {
        _filter.role = this.value;
        renderTable();
      });
    }

    // Status filter
    if (statusSelect) {
      statusSelect.addEventListener('change', function () {
        _filter.status = this.value;
        renderTable();
      });
    }

    // Click delegation
    _clickHandler = function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      var id = btn.dataset.id;

      switch (action) {
        case 'add-staff':
          e.preventDefault();
          e.stopPropagation();
          openAddStaffModal();
          break;
        case 'view-staff':
          e.preventDefault();
          e.stopPropagation();
          viewStaffProfile(id);
          break;
        case 'edit-staff':
          e.preventDefault();
          e.stopPropagation();
          openEditStaff(id);
          break;
        case 'delete-staff':
          e.preventDefault();
          e.stopPropagation();
          deleteStaff(id);
          break;
        case 'export-staff':
          e.preventDefault();
          e.stopPropagation();
          exportStaff();
          break;
        case 'clear-filters':
          e.preventDefault();
          e.stopPropagation();
          _filter = { search: '', departmentId: 'all', role: 'all', status: 'all' };
          if (searchInput) searchInput.value = '';
          if (deptSelect) deptSelect.value = 'all';
          if (roleSelect) roleSelect.value = 'all';
          if (statusSelect) statusSelect.value = 'all';
          renderTable();
          break;
        case 'back-to-staff':
          e.preventDefault();
          e.stopPropagation();
          Router.navigate('/staff');
          break;
      }
    };

    // Row click to view profile
    var table = document.getElementById('staff-table');
    if (table) {
      table.addEventListener('click', function (e) {
        if (e.target.closest('[data-action]')) return;
        var row = e.target.closest('tr[data-staff-id]');
        if (row) {
          viewStaffProfile(row.dataset.staffId);
        }
      });
    }

    document.addEventListener('click', _clickHandler);

    // Check if we need to load a profile
    if (Router && Router.getParams && Router.getParams().staffId) {
      loadStaffProfile(Router.getParams().staffId);
    }
  }

  function openAddStaffModal() {
    var formHtml = buildAddStaffForm();
    Modal.open('Add New Staff Member', formHtml, {
      size: 'large',
      actions: [{
        label: 'Add Staff',
        className: 'btn btn-primary',
        onClick: function () { submitAddStaff(); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                      */
  /* ------------------------------------------------------------------ */

  function loadReferenceData() {
    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    // Load departments
    if (DataService.getBySchool) {
      DataService.getBySchool('departments', schoolId).then(function (depts) {
        _departments = depts || [];
      }).catch(function () { /* ignore */ });
    }

    // Load classes for multi-select checkboxes
    if (DataService.getBySchool) {
      DataService.getBySchool('classes', schoolId).then(function (classes) {
        _classes = classes || [];
      }).catch(function () { /* ignore */ });
    }
  }

  function loadStaff() {
    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    // Try real-time via onSnapshot
    if (typeof DataService.onSnapshot === 'function') {
      var unsub = DataService.onSnapshot('staff', function (staff) {
        _allStaff = staff || [];
        updateStats();
        renderTable();
      }, schoolId);
      if (typeof unsub === 'function') {
        _listeners.push(unsub);
      }
    }

    // Fallback / initial load
    var loadFn = DataService.getStaff || function () { return DataService.getBySchool('staff', schoolId); };

    loadFn().then(function (staff) {
      _allStaff = staff || [];
      updateStats();
      renderTable();
    }).catch(function (err) {
      Toast.error('Failed to load staff: ' + (err.message || 'Unknown error'));
      var tbody = document.getElementById('staff-tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px">'
          + '<div class="empty-state"><div class="empty-state-icon">⚠️</div>'
          + '<h3 class="empty-state-title">Error loading staff</h3>'
          + '<p class="empty-state-description">Please try again or contact support.</p>'
          + '</div></td></tr>';
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.staff = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('staff');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Staff' }
      ]);
      return render();
    },

    bind: function () {
      setTimeout(function () {
        bindEvents();
        loadReferenceData();
        loadStaff();
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

      _allStaff = [];
      _departments = [];
      _classes = [];
      _filter = { search: '', departmentId: 'all', role: 'all', status: 'all' };
    }
  };
})();