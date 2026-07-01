/**
 * Classarium Students Module
 * Full student management — list, search, filter, add, view, edit, delete, export.
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

  var _allStudents = [];
  var _classes = [];
  var _departments = [];
  var _filter = { search: '', classId: 'all', departmentId: 'all', status: 'all' };
  var _listeners = [];
  var _clickHandler = null;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function statusBadge(status) {
    var map = {
      active: { text: 'Active', cls: 'success' },
      inactive: { text: 'Inactive', cls: 'warning' },
      graduated: { text: 'Graduated', cls: 'info' },
      suspended: { text: 'Suspended', cls: 'danger' },
      withdrawn: { text: 'Withdrawn', cls: 'default' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function genderBadge(gender) {
    if (gender === 'male') return '<span class="badge badge-primary">Male</span>';
    if (gender === 'female') return '<span class="badge badge-info">Female</span>';
    return '<span class="badge badge-default">' + (gender || 'N/A') + '</span>';
  }

  function getFullName(s) {
    return [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ') || (s.displayName || '—');
  }

  function getClassName(classId) {
    var c = _classes.find(function (cl) { return cl.id === classId; });
    return c ? (c.name || c.className || '—') : (classId || '—');
  }

  function getDepartmentName(deptId) {
    var d = _departments.find(function (dp) { return dp.id === deptId; });
    return d ? (d.name || '—') : (deptId || '—');
  }

  function getFiltered() {
    return _allStudents.filter(function (s) {
      var q = _filter.search.toLowerCase();
      var name = getFullName(s).toLowerCase();
      var admNo = (s.admissionNumber || '').toLowerCase();
      var matchSearch = !q || name.indexOf(q) !== -1 || admNo.indexOf(q) !== -1;
      var matchClass = _filter.classId === 'all' || s.classId === _filter.classId;
      var matchDept = _filter.departmentId === 'all' || s.departmentId === _filter.departmentId;
      var matchStatus = _filter.status === 'all' || s.status === _filter.status;
      return matchSearch && matchClass && matchDept && matchStatus;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Render — List View                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    // If route is student-profile, render profile view
    if (Router && Router.getParams && Router.getParams().studentId) {
      return renderProfilePlaceholder();
    }

    var html = '<div class="students-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Students</h1>'
      + '<p class="page-header-description">Manage all enrolled students</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-ghost" data-action="export-students">Export</button>'
      + '<button class="btn btn-primary" data-action="add-student">Add Student</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div id="students-stat-total" class="stat-card"><div class="stat-card-icon" style="background:var(--primary-50);color:var(--primary-600)">🎓</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Students</div></div>'
      + '<div id="students-stat-active" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Active</div></div>'
      + '<div id="students-stat-inactive" class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">⏸️</div><div class="stat-card-value">--</div><div class="stat-card-label">Inactive</div></div>'
      + '<div id="students-stat-graduated" class="stat-card"><div class="stat-card-icon" style="background:#EFF6FF;color:#2563EB">🎓</div><div class="stat-card-value">--</div><div class="stat-card-label">Graduated</div></div>'
      + '</div>';

    // Filters
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-body">'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'
      + '<div style="flex:1;min-width:220px">'
      + '<input type="text" id="students-search" class="form-input" placeholder="Search by name or admission number..." value="' + Utils.escapeHtml(_filter.search || '') + '" style="width:100%">'
      + '</div>'
      + '<div style="min-width:170px">'
      + '<select id="students-filter-class" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.classId === 'all' ? ' selected' : '') + '>All Classes</option>'
      + _classes.map(function (c) {
        return '<option value="' + (c.id || '') + '"' + (_filter.classId === c.id ? ' selected' : '') + '>' + Utils.escapeHtml(c.name || c.className || 'Unnamed') + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div style="min-width:170px">'
      + '<select id="students-filter-dept" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.departmentId === 'all' ? ' selected' : '') + '>All Departments</option>'
      + _departments.map(function (d) {
        return '<option value="' + (d.id || '') + '"' + (_filter.departmentId === d.id ? ' selected' : '') + '>' + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div style="min-width:150px">'
      + '<select id="students-filter-status" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.status === 'all' ? ' selected' : '') + '>All Statuses</option>'
      + '<option value="active"' + (_filter.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="inactive"' + (_filter.status === 'inactive' ? ' selected' : '') + '>Inactive</option>'
      + '<option value="graduated"' + (_filter.status === 'graduated' ? ' selected' : '') + '>Graduated</option>'
      + '</select>'
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-action="clear-filters">Clear</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Table
    html += '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">All Students <span id="students-count" style="font-weight:400;font-size:13px;color:var(--gray-500)"></span></h3>'
      + '</div>'
      + '<div class="card-body" style="padding:0">'
      + '<div class="data-table-wrapper">'
      + '<table class="data-table" id="students-table">'
      + '<thead>'
      + '<tr>'
      + '<th style="width:20%">Name</th>'
      + '<th style="width:10%">Admission No</th>'
      + '<th style="width:10%">Class</th>'
      + '<th style="width:8%">Arm</th>'
      + '<th style="width:8%">Gender</th>'
      + '<th style="width:12%">Parent Phone</th>'
      + '<th style="width:8%">Status</th>'
      + '<th style="width:24%;text-align:right">Actions</th>'
      + '</tr>'
      + '</thead>'
      + '<tbody id="students-tbody">'
      + '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400)">Loading students...</td></tr>'
      + '</tbody>'
      + '</table>'
      + '</div>'
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Profile Placeholder (used while loading)                           */
  /* ------------------------------------------------------------------ */

  function renderProfilePlaceholder() {
    return '<div class="profile-layout">'
      + '<div class="profile-sidebar" id="student-profile-sidebar"></div>'
      + '<div class="profile-details" id="student-profile-details">'
      + '<div style="padding:60px;text-align:center;color:var(--gray-400)">Loading student profile...</div>'
      + '</div>'
      + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Table Rendering                                                   */
  /* ------------------------------------------------------------------ */

  function renderTable() {
    var tbody = document.getElementById('students-tbody');
    if (!tbody) return;

    var filtered = getFiltered();
    var countEl = document.getElementById('students-count');
    if (countEl) countEl.textContent = '(' + filtered.length + ' of ' + _allStudents.length + ')';

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🎓</div>'
        + '<h3 class="empty-state-title">No students found</h3>'
        + '<p class="empty-state-description">' + (_filter.search || _filter.classId !== 'all' || _filter.departmentId !== 'all' || _filter.status !== 'all'
          ? 'Try adjusting your search or filters.'
          : 'No students have been enrolled yet. Click "Add Student" to get started.')
        + '</p>'
        + (_filter.search || _filter.classId !== 'all' || _filter.departmentId !== 'all' || _filter.status !== 'all'
          ? '' : '<button class="btn btn-primary" data-action="add-student" style="margin-top:12px">Add Student</button>')
        + '</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (s) {
      var id = s.id || '';
      var name = getFullName(s);
      var initials = Utils.getInitials(name);
      var phone = s.fatherPhone || s.motherPhone || s.guardianPhone || '—';

      return '<tr data-student-id="' + id + '" style="cursor:pointer">'
        + '<td>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<div class="avatar" style="width:36px;height:36px;flex-shrink:0;font-size:12px">' + initials + '</div>'
        + '<div>'
        + '<div style="font-weight:500;font-size:14px">' + Utils.escapeHtml(name) + '</div>'
        + '</div>'
        + '</div>'
        + '</td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(s.admissionNumber || '—') + '</span></td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(getClassName(s.classId)) + '</span></td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(s.arm || '—') + '</span></td>'
        + '<td>' + genderBadge(s.gender) + '</td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + Utils.escapeHtml(phone) + '</span></td>'
        + '<td>' + statusBadge(s.status) + '</td>'
        + '<td style="text-align:right">'
        + '<div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">'
        + '<button class="btn btn-sm btn-ghost" data-action="view-student" data-id="' + id + '" title="View Profile">View</button> '
        + '<button class="btn btn-sm btn-ghost" data-action="edit-student" data-id="' + id + '" title="Edit">Edit</button> '
        + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-student" data-id="' + id + '" title="Delete">Delete</button>'
        + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Update Stats                                                      */
  /* ------------------------------------------------------------------ */

  function updateStats() {
    var total = _allStudents.length;
    var active = _allStudents.filter(function (s) { return s.status === 'active'; }).length;
    var inactive = _allStudents.filter(function (s) { return s.status === 'inactive'; }).length;
    var graduated = _allStudents.filter(function (s) { return s.status === 'graduated'; }).length;

    var el;
    el = document.getElementById('students-stat-total');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(total);
    el = document.getElementById('students-stat-active');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(active);
    el = document.getElementById('students-stat-inactive');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(inactive);
    el = document.getElementById('students-stat-graduated');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(graduated);
  }

  /* ------------------------------------------------------------------ */
  /*  Add Student Form                                                  */
  /* ------------------------------------------------------------------ */

  function buildAddStudentForm() {
    var classOptions = _classes.map(function (c) {
      return '<option value="' + (c.id || '') + '">' + Utils.escapeHtml(c.name || c.className || 'Unnamed') + '</option>';
    }).join('');

    var deptOptions = _departments.map(function (d) {
      return '<option value="' + (d.id || '') + '">' + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
    }).join('');

    return '<div class="modal-form" id="add-student-form">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      // Personal Information
      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin-bottom:4px">'
      + '<h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Personal Information</h4>'
      + '</div>'

      + '<div><label class="form-label">Surname <span style="color:var(--danger-500)">*</span></label><input type="text" name="surname" class="form-input" required placeholder="e.g. Smith"></div>'
      + '<div><label class="form-label">First Name <span style="color:var(--danger-500)">*</span></label><input type="text" name="firstName" class="form-input" required placeholder="e.g. John"></div>'
      + '<div><label class="form-label">Middle Name</label><input type="text" name="middleName" class="form-input" placeholder="e.g. Paul"></div>'
      + '<div><label class="form-label">Gender <span style="color:var(--danger-500)">*</span></label><select name="gender" class="form-select" required><option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option></select></div>'
      + '<div><label class="form-label">Date of Birth</label><input type="date" name="dateOfBirth" class="form-input"></div>'
      + '<div><label class="form-label">Nationality</label><input type="text" name="nationality" class="form-input" value="Nigerian" placeholder="e.g. Nigerian"></div>'
      + '<div><label class="form-label">State of Origin</label><input type="text" name="stateOfOrigin" class="form-input" placeholder="e.g. Lagos"></div>'
      + '<div><label class="form-label">LGA</label><input type="text" name="lga" class="form-input" placeholder="Local Government Area"></div>'
      + '<div><label class="form-label">Religion</label><input type="text" name="religion" class="form-input" placeholder="e.g. Christianity"></div>'

      // Academic Information
      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px">'
      + '<h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Academic Information</h4>'
      + '</div>'

      + '<div><label class="form-label">Department <span style="color:var(--danger-500)">*</span></label><select name="departmentId" class="form-select" required><option value="">Select Department</option>' + deptOptions + '</select></div>'
      + '<div><label class="form-label">Class <span style="color:var(--danger-500)">*</span></label><select name="classId" class="form-select" required><option value="">Select Class</option>' + classOptions + '</select></div>'
      + '<div><label class="form-label">Arm</label><input type="text" name="arm" class="form-input" placeholder="e.g. A, B, Science"></div>'
      + '<div><label class="form-label">House</label><input type="text" name="house" class="form-input" placeholder="e.g. Blue House"></div>'

      // Parent / Guardian Information
      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px">'
      + '<h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Parent / Guardian Information</h4>'
      + '</div>'

      + '<div><label class="form-label">Father\'s Name</label><input type="text" name="fatherName" class="form-input" placeholder="Father\'s full name"></div>'
      + '<div><label class="form-label">Father\'s Phone</label><input type="tel" name="fatherPhone" class="form-input" placeholder="e.g. 08012345678"></div>'
      + '<div><label class="form-label">Father\'s Occupation</label><input type="text" name="fatherOccupation" class="form-input" placeholder="e.g. Engineer"></div>'
      + '<div><label class="form-label">Mother\'s Name</label><input type="text" name="motherName" class="form-input" placeholder="Mother\'s full name"></div>'
      + '<div><label class="form-label">Mother\'s Phone</label><input type="tel" name="motherPhone" class="form-input" placeholder="e.g. 08012345678"></div>'
      + '<div><label class="form-label">Mother\'s Occupation</label><input type="text" name="motherOccupation" class="form-input" placeholder="e.g. Teacher"></div>'
      + '<div><label class="form-label">Guardian\'s Name</label><input type="text" name="guardianName" class="form-input" placeholder="If different from parents"></div>'
      + '<div><label class="form-label">Guardian\'s Phone</label><input type="tel" name="guardianPhone" class="form-input" placeholder="e.g. 08012345678"></div>'

      // Medical Information
      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px">'
      + '<h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Medical Information</h4>'
      + '</div>'

      + '<div><label class="form-label">Blood Group</label><select name="bloodGroup" class="form-select"><option value="">Select</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div>'
      + '<div><label class="form-label">Genotype</label><select name="genotype" class="form-select"><option value="">Select</option><option value="AA">AA</option><option value="AS">AS</option><option value="AC">AC</option><option value="SS">SS</option><option value="SC">SC</option><option value="CC">CC</option></select></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Allergies</label><textarea name="allergies" class="form-input" rows="2" placeholder="List any known allergies..."></textarea></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Disabilities / Special Needs</label><textarea name="disabilities" class="form-input" rows="2" placeholder="List any disabilities or special needs..."></textarea></div>'

      + '</div>'
      + '</div>';
  }

  function submitAddStudent() {
    var form = document.getElementById('add-student-form');
    if (!form) return;

    var surname = form.querySelector('[name="surname"]').value.trim();
    var firstName = form.querySelector('[name="firstName"]').value.trim();

    if (!surname || !firstName) {
      Toast.error('Surname and First Name are required.');
      return;
    }
    if (!form.querySelector('[name="gender"]').value) {
      Toast.error('Please select a gender.');
      return;
    }
    if (!form.querySelector('[name="classId"]').value) {
      Toast.error('Please select a class.');
      return;
    }

    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    var studentData = {
      surname: surname,
      firstName: firstName,
      middleName: form.querySelector('[name="middleName"]').value.trim(),
      displayName: surname + ' ' + firstName,
      gender: form.querySelector('[name="gender"]').value,
      dateOfBirth: form.querySelector('[name="dateOfBirth"]').value || null,
      nationality: form.querySelector('[name="nationality"]').value.trim() || 'Nigerian',
      stateOfOrigin: form.querySelector('[name="stateOfOrigin"]').value.trim(),
      lga: form.querySelector('[name="lga"]').value.trim(),
      religion: form.querySelector('[name="religion"]').value.trim(),
      departmentId: form.querySelector('[name="departmentId"]').value || null,
      classId: form.querySelector('[name="classId"]').value || null,
      arm: form.querySelector('[name="arm"]').value.trim(),
      house: form.querySelector('[name="house"]').value.trim(),
      fatherName: form.querySelector('[name="fatherName"]').value.trim(),
      fatherPhone: form.querySelector('[name="fatherPhone"]').value.trim(),
      fatherOccupation: form.querySelector('[name="fatherOccupation"]').value.trim(),
      motherName: form.querySelector('[name="motherName"]').value.trim(),
      motherPhone: form.querySelector('[name="motherPhone"]').value.trim(),
      motherOccupation: form.querySelector('[name="motherOccupation"]').value.trim(),
      guardianName: form.querySelector('[name="guardianName"]').value.trim(),
      guardianPhone: form.querySelector('[name="guardianPhone"]').value.trim(),
      bloodGroup: form.querySelector('[name="bloodGroup"]').value || null,
      genotype: form.querySelector('[name="genotype"]').value || null,
      allergies: form.querySelector('[name="allergies"]').value.trim(),
      disabilities: form.querySelector('[name="disabilities"]').value.trim(),
      schoolId: schoolId,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    Toast.info('Adding student...');
    var addFn = DataService.addStudent || function (data) { return DataService.add('students', data); };

    addFn(studentData).then(function (docRef) {
      Toast.success('Student "' + studentData.displayName + '" added successfully');
      Modal.close();
      DataService.logAction('student_added', 'students', docRef && docRef.id, { name: studentData.displayName });
    }).catch(function (err) {
      Toast.error('Failed to add student: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Edit Student Form                                                 */
  /* ------------------------------------------------------------------ */

  function openEditStudent(id) {
    var student = _allStudents.find(function (s) { return s.id === id; });
    if (!student) {
      Toast.error('Student not found.');
      return;
    }

    var classOptions = _classes.map(function (c) {
      return '<option value="' + (c.id || '') + '"' + (student.classId === c.id ? ' selected' : '') + '>' + Utils.escapeHtml(c.name || c.className || 'Unnamed') + '</option>';
    }).join('');

    var deptOptions = _departments.map(function (d) {
      return '<option value="' + (d.id || '') + '"' + (student.departmentId === d.id ? ' selected' : '') + '>' + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
    }).join('');

    var genderOptions = ['', 'male', 'female'].map(function (g) {
      var label = g ? Utils.capitalize(g) : 'Select Gender';
      return '<option value="' + g + '"' + (student.gender === g ? ' selected' : '') + '>' + label + '</option>';
    }).join('');

    var bloodOptions = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(function (bg) {
      return '<option value="' + bg + '"' + (student.bloodGroup === bg ? ' selected' : '') + '>' + (bg || 'Select') + '</option>';
    }).join('');

    var genotypeOptions = ['', 'AA', 'AS', 'AC', 'SS', 'SC', 'CC'].map(function (gt) {
      return '<option value="' + gt + '"' + (student.genotype === gt ? ' selected' : '') + '>' + (gt || 'Select') + '</option>';
    }).join('');

    var statusOptions = ['active', 'inactive', 'graduated', 'suspended'].map(function (st) {
      return '<option value="' + st + '"' + (student.status === st ? ' selected' : '') + '>' + Utils.capitalize(st) + '</option>';
    }).join('');

    var formHtml = '<div class="modal-form" id="edit-student-form">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'

      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin-bottom:4px"><h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Personal Information</h4></div>'

      + '<div><label class="form-label">Surname <span style="color:var(--danger-500)">*</span></label><input type="text" name="surname" class="form-input" required value="' + Utils.escapeHtml(student.surname || '') + '"></div>'
      + '<div><label class="form-label">First Name <span style="color:var(--danger-500)">*</span></label><input type="text" name="firstName" class="form-input" required value="' + Utils.escapeHtml(student.firstName || '') + '"></div>'
      + '<div><label class="form-label">Middle Name</label><input type="text" name="middleName" class="form-input" value="' + Utils.escapeHtml(student.middleName || '') + '"></div>'
      + '<div><label class="form-label">Gender</label><select name="gender" class="form-select">' + genderOptions + '</select></div>'
      + '<div><label class="form-label">Date of Birth</label><input type="date" name="dateOfBirth" class="form-input" value="' + (student.dateOfBirth || '') + '"></div>'
      + '<div><label class="form-label">Nationality</label><input type="text" name="nationality" class="form-input" value="' + Utils.escapeHtml(student.nationality || 'Nigerian') + '"></div>'
      + '<div><label class="form-label">State of Origin</label><input type="text" name="stateOfOrigin" class="form-input" value="' + Utils.escapeHtml(student.stateOfOrigin || '') + '"></div>'
      + '<div><label class="form-label">LGA</label><input type="text" name="lga" class="form-input" value="' + Utils.escapeHtml(student.lga || '') + '"></div>'
      + '<div><label class="form-label">Religion</label><input type="text" name="religion" class="form-input" value="' + Utils.escapeHtml(student.religion || '') + '"></div>'
      + '<div><label class="form-label">Status</label><select name="status" class="form-select">' + statusOptions + '</select></div>'

      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px"><h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Academic Information</h4></div>'

      + '<div><label class="form-label">Department</label><select name="departmentId" class="form-select"><option value="">Select Department</option>' + deptOptions + '</select></div>'
      + '<div><label class="form-label">Class</label><select name="classId" class="form-select"><option value="">Select Class</option>' + classOptions + '</select></div>'
      + '<div><label class="form-label">Arm</label><input type="text" name="arm" class="form-input" value="' + Utils.escapeHtml(student.arm || '') + '"></div>'
      + '<div><label class="form-label">House</label><input type="text" name="house" class="form-input" value="' + Utils.escapeHtml(student.house || '') + '"></div>'

      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px"><h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Parent / Guardian Information</h4></div>'

      + '<div><label class="form-label">Father\'s Name</label><input type="text" name="fatherName" class="form-input" value="' + Utils.escapeHtml(student.fatherName || '') + '"></div>'
      + '<div><label class="form-label">Father\'s Phone</label><input type="tel" name="fatherPhone" class="form-input" value="' + Utils.escapeHtml(student.fatherPhone || '') + '"></div>'
      + '<div><label class="form-label">Father\'s Occupation</label><input type="text" name="fatherOccupation" class="form-input" value="' + Utils.escapeHtml(student.fatherOccupation || '') + '"></div>'
      + '<div><label class="form-label">Mother\'s Name</label><input type="text" name="motherName" class="form-input" value="' + Utils.escapeHtml(student.motherName || '') + '"></div>'
      + '<div><label class="form-label">Mother\'s Phone</label><input type="tel" name="motherPhone" class="form-input" value="' + Utils.escapeHtml(student.motherPhone || '') + '"></div>'
      + '<div><label class="form-label">Mother\'s Occupation</label><input type="text" name="motherOccupation" class="form-input" value="' + Utils.escapeHtml(student.motherOccupation || '') + '"></div>'
      + '<div><label class="form-label">Guardian\'s Name</label><input type="text" name="guardianName" class="form-input" value="' + Utils.escapeHtml(student.guardianName || '') + '"></div>'
      + '<div><label class="form-label">Guardian\'s Phone</label><input type="tel" name="guardianPhone" class="form-input" value="' + Utils.escapeHtml(student.guardianPhone || '') + '"></div>'

      + '<div style="grid-column:1/-1;padding:12px 0 8px;border-bottom:1px solid var(--gray-200);margin:4px 0 4px"><h4 style="font-size:15px;font-weight:600;color:var(--gray-700);margin:0">Medical Information</h4></div>'

      + '<div><label class="form-label">Blood Group</label><select name="bloodGroup" class="form-select">' + bloodOptions + '</select></div>'
      + '<div><label class="form-label">Genotype</label><select name="genotype" class="form-select">' + genotypeOptions + '</select></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Allergies</label><textarea name="allergies" class="form-input" rows="2">' + Utils.escapeHtml(student.allergies || '') + '</textarea></div>'
      + '<div style="grid-column:1/-1"><label class="form-label">Disabilities / Special Needs</label><textarea name="disabilities" class="form-input" rows="2">' + Utils.escapeHtml(student.disabilities || '') + '</textarea></div>'

      + '</div></div>';

    Modal.open('Edit Student — ' + getFullName(student), formHtml, {
      size: 'large',
      actions: [{
        label: 'Save Changes',
        className: 'btn btn-primary',
        onClick: function () { submitEditStudent(id); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitEditStudent(id) {
    var form = document.getElementById('edit-student-form');
    if (!form) return;

    var surname = form.querySelector('[name="surname"]').value.trim();
    var firstName = form.querySelector('[name="firstName"]').value.trim();
    if (!surname || !firstName) {
      Toast.error('Surname and First Name are required.');
      return;
    }

    var updateData = {
      surname: surname,
      firstName: firstName,
      middleName: form.querySelector('[name="middleName"]').value.trim(),
      displayName: surname + ' ' + firstName,
      gender: form.querySelector('[name="gender"]').value,
      dateOfBirth: form.querySelector('[name="dateOfBirth"]').value || null,
      nationality: form.querySelector('[name="nationality"]').value.trim(),
      stateOfOrigin: form.querySelector('[name="stateOfOrigin"]').value.trim(),
      lga: form.querySelector('[name="lga"]').value.trim(),
      religion: form.querySelector('[name="religion"]').value.trim(),
      status: form.querySelector('[name="status"]').value,
      departmentId: form.querySelector('[name="departmentId"]').value || null,
      classId: form.querySelector('[name="classId"]').value || null,
      arm: form.querySelector('[name="arm"]').value.trim(),
      house: form.querySelector('[name="house"]').value.trim(),
      fatherName: form.querySelector('[name="fatherName"]').value.trim(),
      fatherPhone: form.querySelector('[name="fatherPhone"]').value.trim(),
      fatherOccupation: form.querySelector('[name="fatherOccupation"]').value.trim(),
      motherName: form.querySelector('[name="motherName"]').value.trim(),
      motherPhone: form.querySelector('[name="motherPhone"]').value.trim(),
      motherOccupation: form.querySelector('[name="motherOccupation"]').value.trim(),
      guardianName: form.querySelector('[name="guardianName"]').value.trim(),
      guardianPhone: form.querySelector('[name="guardianPhone"]').value.trim(),
      bloodGroup: form.querySelector('[name="bloodGroup"]').value || null,
      genotype: form.querySelector('[name="genotype"]').value || null,
      allergies: form.querySelector('[name="allergies"]').value.trim(),
      disabilities: form.querySelector('[name="disabilities"]').value.trim(),
      updatedAt: new Date().toISOString()
    };

    Toast.info('Updating student...');
    DataService.update('students', id, updateData).then(function () {
      Toast.success('Student "' + updateData.displayName + '" updated successfully');
      Modal.close();
      DataService.logAction('student_updated', 'students', id, { name: updateData.displayName });
    }).catch(function (err) {
      Toast.error('Failed to update student: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Delete Student                                                    */
  /* ------------------------------------------------------------------ */

  function deleteStudent(id) {
    var student = _allStudents.find(function (s) { return s.id === id; });
    if (!student) return;
    Modal.confirm(
      'Delete Student',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(getFullName(student)) + '</strong>? This action cannot be undone. All associated records will be removed.',
      function () {
        Toast.info('Deleting student...');
        DataService.remove('students', id).then(function () {
          Toast.success('Student deleted successfully');
          DataService.logAction('student_deleted', 'students', id, { name: getFullName(student) });
        }).catch(function (err) {
          Toast.error('Failed to delete student: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Student Profile View                                              */
  /* ------------------------------------------------------------------ */

  function viewStudentProfile(id) {
    Router.navigate('/student-profile/' + id);
  }

  function loadStudentProfile(id) {
    var getFn = DataService.getStudent || function (sid) { return DataService.get('students', sid); };

    getFn(id).then(function (student) {
      if (!student) {
        Toast.error('Student not found.');
        return;
      }
      renderStudentProfile(student);
    }).catch(function (err) {
      Toast.error('Failed to load student: ' + (err.message || 'Unknown error'));
      var details = document.getElementById('student-profile-details');
      if (details) {
        details.innerHTML = '<div style="padding:60px;text-align:center;color:var(--danger-500)">Error loading student profile. Please try again.</div>';
      }
    });
  }

  function renderStudentProfile(s) {
    var id = s.id;
    var name = getFullName(s);
    var initials = Utils.getInitials(name);

    if (HeaderComponent) {
      HeaderComponent.setBreadcrumb([
        { label: 'Students', onClick: function () { Router.navigate('/students'); } },
        { label: name }
      ]);
    }

    // Sidebar
    var sidebar = document.getElementById('student-profile-sidebar');
    if (sidebar) {
      sidebar.innerHTML = '<div style="text-align:center;padding:24px 16px">'
        + '<div class="avatar" style="width:96px;height:96px;font-size:32px;margin:0 auto 16px;border-radius:50%;background:var(--primary-100);color:var(--primary-700)">' + initials + '</div>'
        + '<h3 style="font-size:18px;font-weight:600;margin:0 0 4px">' + Utils.escapeHtml(name) + '</h3>'
        + '<p style="color:var(--gray-500);font-size:14px;margin:0 0 12px">' + Utils.escapeHtml(getClassName(s.classId)) + (s.arm ? ' — ' + Utils.escapeHtml(s.arm) : '') + '</p>'
        + '<p style="color:var(--gray-500);font-size:13px;margin:0 0 16px">Adm: ' + Utils.escapeHtml(s.admissionNumber || 'N/A') + '</p>'
        + statusBadge(s.status || 'active')
        + '<div style="margin-top:24px;display:flex;flex-direction:column;gap:8px">'
        + '<button class="btn btn-primary btn-block" data-action="edit-student" data-id="' + id + '">Edit Student</button>'
        + '<button class="btn btn-ghost btn-block" data-action="back-to-students">Back to Students</button>'
        + '</div>'
        + '</div>';
    }

    // Main content area with tabs
    var details = document.getElementById('student-profile-details');
    if (details) {
      details.innerHTML = '<div class="profile-tabs">'
        + '<div class="profile-tabs-nav">'
        + '<button class="profile-tab active" data-tab="overview">Overview</button>'
        + '<button class="profile-tab" data-tab="academics">Academics</button>'
        + '<button class="profile-tab" data-tab="attendance">Attendance</button>'
        + '<button class="profile-tab" data-tab="behavior">Behavior</button>'
        + '<button class="profile-tab" data-tab="medical">Medical</button>'
        + '<button class="profile-tab" data-tab="documents">Documents</button>'
        + '<button class="profile-tab" data-tab="timeline">Timeline</button>'
        + '</div>'
        + '<div class="profile-tab-content" id="student-tab-content">'
        + renderOverviewTab(s)
        + '</div>'
        + '</div>';

      // Bind tab clicks
      var tabsNav = details.querySelector('.profile-tabs-nav');
      if (tabsNav) {
        tabsNav.addEventListener('click', function (e) {
          var tabBtn = e.target.closest('.profile-tab');
          if (!tabBtn) return;
          var tabName = tabBtn.dataset.tab;
          // Set active
          tabsNav.querySelectorAll('.profile-tab').forEach(function (btn) { btn.classList.remove('active'); });
          tabBtn.classList.add('active');
          // Render tab content
          var content = document.getElementById('student-tab-content');
          if (content) {
            switch (tabName) {
              case 'overview': content.innerHTML = renderOverviewTab(s); break;
              case 'academics': content.innerHTML = renderAcademicsTab(s); break;
              case 'attendance': content.innerHTML = renderAttendanceTab(s); break;
              case 'behavior': content.innerHTML = renderBehaviorTab(s); break;
              case 'medical': content.innerHTML = renderMedicalTab(s); break;
              case 'documents': content.innerHTML = renderDocumentsTab(s); break;
              case 'timeline': content.innerHTML = renderTimelineTab(s); break;
            }
          }
        });
      }
    }
  }

  function infoCard(title, items) {
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

  function renderOverviewTab(s) {
    var html = '<div style="padding:20px 0">';

    // Personal Info Card
    html += infoCard('Personal Information', [
      { label: 'Full Name', value: Utils.escapeHtml(getFullName(s)) },
      { label: 'Gender', value: Utils.capitalize(s.gender || '—') },
      { label: 'Date of Birth', value: s.dateOfBirth ? Utils.formatDate(s.dateOfBirth) : '—' },
      { label: 'Nationality', value: Utils.escapeHtml(s.nationality || '—') },
      { label: 'State of Origin', value: Utils.escapeHtml(s.stateOfOrigin || '—') },
      { label: 'LGA', value: Utils.escapeHtml(s.lga || '—') },
      { label: 'Religion', value: Utils.escapeHtml(s.religion || '—') }
    ]);

    // Academic Info Card
    html += infoCard('Academic Information', [
      { label: 'Department', value: Utils.escapeHtml(getDepartmentName(s.departmentId)) },
      { label: 'Class', value: Utils.escapeHtml(getClassName(s.classId)) },
      { label: 'Arm', value: Utils.escapeHtml(s.arm || '—') },
      { label: 'House', value: Utils.escapeHtml(s.house || '—') },
      { label: 'Admission Number', value: Utils.escapeHtml(s.admissionNumber || '—') },
      { label: 'Date Enrolled', value: s.createdAt ? Utils.formatDate(s.createdAt) : '—' }
    ]);

    // Parent Info Card
    html += infoCard('Parent / Guardian Information', [
      { label: 'Father\'s Name', value: Utils.escapeHtml(s.fatherName || '—') },
      { label: 'Father\'s Phone', value: Utils.escapeHtml(s.fatherPhone || '—') },
      { label: 'Father\'s Occupation', value: Utils.escapeHtml(s.fatherOccupation || '—') },
      { label: 'Mother\'s Name', value: Utils.escapeHtml(s.motherName || '—') },
      { label: 'Mother\'s Phone', value: Utils.escapeHtml(s.motherPhone || '—') },
      { label: 'Mother\'s Occupation', value: Utils.escapeHtml(s.motherOccupation || '—') },
      { label: 'Guardian\'s Name', value: Utils.escapeHtml(s.guardianName || '—') },
      { label: 'Guardian\'s Phone', value: Utils.escapeHtml(s.guardianPhone || '—') }
    ]);

    html += '</div>';
    return html;
  }

  function renderAcademicsTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Academic Results</h3></div>'
      + '<div class="card-body">'
      + '<div id="student-results-table">'
      + '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
      + '<div class="empty-state"><div class="empty-state-icon">📊</div>'
      + '<h3 class="empty-state-title">No results yet</h3>'
      + '<p class="empty-state-description">Academic results for this student will appear here once published.</p>'
      + '</div></div>'
      + '</div>'
      + '</div></div>'
      + '</div>';
    return html;
  }

  function renderAttendanceTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Attendance Records</h3></div>'
      + '<div class="card-body">'
      + '<div id="student-attendance-table">'
      + '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
      + '<div class="empty-state"><div class="empty-state-icon">📋</div>'
      + '<h3 class="empty-state-title">No attendance records</h3>'
      + '<p class="empty-state-description">Attendance records for this student will appear here.</p>'
      + '</div></div>'
      + '</div>'
      + '</div></div>'
      + '</div>';
    return html;
  }

  function renderBehaviorTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Behavior Records</h3></div>'
      + '<div class="card-body">'
      + '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
      + '<div class="empty-state"><div class="empty-state-icon">⭐</div>'
      + '<h3 class="empty-state-title">No behavior records</h3>'
      + '<p class="empty-state-description">Behavior incidents and commendations for this student will appear here.</p>'
      + '</div>'
      + '</div>'
      + '</div></div>'
      + '</div>';
    return html;
  }

  function renderMedicalTab(s) {
    var html = '<div style="padding:20px 0">';
    html += infoCard('Medical Information', [
      { label: 'Blood Group', value: Utils.escapeHtml(s.bloodGroup || '—') },
      { label: 'Genotype', value: Utils.escapeHtml(s.genotype || '—') },
      { label: 'Allergies', value: Utils.escapeHtml(s.allergies || 'None recorded') },
      { label: 'Disabilities / Special Needs', value: Utils.escapeHtml(s.disabilities || 'None recorded') }
    ]);
    html += '</div>';
    return html;
  }

  function renderDocumentsTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Documents</h3></div>'
      + '<div class="card-body">'
      + '<div style="text-align:center;padding:40px;color:var(--gray-400)">'
      + '<div class="empty-state"><div class="empty-state-icon">📁</div>'
      + '<h3 class="empty-state-title">No documents uploaded</h3>'
      + '<p class="empty-state-description">Documents such as birth certificates, passports, and report cards will appear here.</p>'
      + '</div>'
      + '</div>'
      + '</div></div>'
      + '</div>';
    return html;
  }

  function renderTimelineTab(s) {
    var html = '<div style="padding:20px 0">'
      + '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">Activity Timeline</h3></div>'
      + '<div class="card-body">'
      + '<div class="timeline" id="student-timeline">';

    if (s.createdAt) {
      html += '<div class="timeline-item">'
        + '<div class="timeline-marker" style="background:var(--success-500)"></div>'
        + '<div class="timeline-content">'
        + '<div class="timeline-title">Student Enrolled</div>'
        + '<div class="timeline-date">' + Utils.formatDate(s.createdAt) + '</div>'
        + '</div></div>';
    }

    if (s.updatedAt) {
      html += '<div class="timeline-item">'
        + '<div class="timeline-marker" style="background:var(--primary-500)"></div>'
        + '<div class="timeline-content">'
        + '<div class="timeline-title">Record Last Updated</div>'
        + '<div class="timeline-date">' + Utils.formatDate(s.updatedAt) + '</div>'
        + '</div></div>';
    }

    html += '</div>'
      + '</div></div>'
      + '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                            */
  /* ------------------------------------------------------------------ */

  function exportStudents() {
    var filtered = getFiltered();
    if (!filtered.length) {
      Toast.warning('No students to export.');
      return;
    }
    var data = filtered.map(function (s) {
      return {
        'Admission No': s.admissionNumber || '',
        'Surname': s.surname || '',
        'First Name': s.firstName || '',
        'Middle Name': s.middleName || '',
        'Gender': s.gender || '',
        'Date of Birth': s.dateOfBirth || '',
        'Class': getClassName(s.classId),
        'Arm': s.arm || '',
        'Department': getDepartmentName(s.departmentId),
        'Status': s.status || '',
        'Father Name': s.fatherName || '',
        'Father Phone': s.fatherPhone || '',
        'Mother Name': s.motherName || '',
        'Mother Phone': s.motherPhone || '',
        'Guardian Name': s.guardianName || '',
        'Guardian Phone': s.guardianPhone || '',
        'Blood Group': s.bloodGroup || '',
        'Genotype': s.genotype || '',
        'Date Enrolled': s.createdAt ? Utils.formatDate(s.createdAt) : ''
      };
    });
    Utils.exportCSV(data, 'students-export');
    Toast.success('Students exported successfully');
    DataService.logAction('students_exported', 'students', null, { count: data.length });
  }

  /* ------------------------------------------------------------------ */
  /*  Bind Events                                                       */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    var searchInput = document.getElementById('students-search');
    var classSelect = document.getElementById('students-filter-class');
    var deptSelect = document.getElementById('students-filter-dept');
    var statusSelect = document.getElementById('students-filter-status');

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

    // Class filter
    if (classSelect) {
      classSelect.addEventListener('change', function () {
        _filter.classId = this.value;
        renderTable();
      });
    }

    // Department filter
    if (deptSelect) {
      deptSelect.addEventListener('change', function () {
        _filter.departmentId = this.value;
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
        case 'add-student':
          e.preventDefault();
          e.stopPropagation();
          openAddStudentModal();
          break;
        case 'view-student':
          e.preventDefault();
          e.stopPropagation();
          viewStudentProfile(id);
          break;
        case 'edit-student':
          e.preventDefault();
          e.stopPropagation();
          openEditStudent(id);
          break;
        case 'delete-student':
          e.preventDefault();
          e.stopPropagation();
          deleteStudent(id);
          break;
        case 'export-students':
          e.preventDefault();
          e.stopPropagation();
          exportStudents();
          break;
        case 'clear-filters':
          e.preventDefault();
          e.stopPropagation();
          _filter = { search: '', classId: 'all', departmentId: 'all', status: 'all' };
          if (searchInput) searchInput.value = '';
          if (classSelect) classSelect.value = 'all';
          if (deptSelect) deptSelect.value = 'all';
          if (statusSelect) statusSelect.value = 'all';
          renderTable();
          break;
        case 'back-to-students':
          e.preventDefault();
          e.stopPropagation();
          Router.navigate('/students');
          break;
      }
    };

    // Row click to view profile
    var table = document.getElementById('students-table');
    if (table) {
      table.addEventListener('click', function (e) {
        // If the click was on an action button, don't navigate
        if (e.target.closest('[data-action]')) return;
        var row = e.target.closest('tr[data-student-id]');
        if (row) {
          viewStudentProfile(row.dataset.studentId);
        }
      });
    }

    document.addEventListener('click', _clickHandler);

    // Check if we need to load a profile
    if (Router && Router.getParams && Router.getParams().studentId) {
      loadStudentProfile(Router.getParams().studentId);
    }
  }

  function openAddStudentModal() {
    var formHtml = buildAddStudentForm();
    Modal.open('Add New Student', formHtml, {
      size: 'large',
      actions: [{
        label: 'Add Student',
        className: 'btn btn-primary',
        onClick: function () { submitAddStudent(); }
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

    // Load classes
    if (DataService.getBySchool) {
      DataService.getBySchool('classes', schoolId).then(function (classes) {
        _classes = classes || [];
      }).catch(function () { /* ignore */ });
    }

    // Load departments
    if (DataService.getBySchool) {
      DataService.getBySchool('departments', schoolId).then(function (depts) {
        _departments = depts || [];
      }).catch(function () { /* ignore */ });
    }
  }

  function loadStudents() {
    var profile = window.App && window.App.state && window.App.state.profile;
    var schoolId = profile ? profile.schoolId : '';

    // Try real-time via onSnapshot
    if (typeof DataService.onSnapshot === 'function') {
      var unsub = DataService.onSnapshot('students', function (students) {
        _allStudents = students || [];
        updateStats();
        renderTable();
      }, schoolId);
      if (typeof unsub === 'function') {
        _listeners.push(unsub);
      }
    }

    // Fallback / initial load via getStudents or getBySchool
    var loadFn = DataService.getStudents || function () { return DataService.getBySchool('students', schoolId); };

    loadFn().then(function (students) {
      _allStudents = students || [];
      updateStats();
      renderTable();
    }).catch(function (err) {
      Toast.error('Failed to load students: ' + (err.message || 'Unknown error'));
      var tbody = document.getElementById('students-tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px">'
          + '<div class="empty-state"><div class="empty-state-icon">⚠️</div>'
          + '<h3 class="empty-state-title">Error loading students</h3>'
          + '<p class="empty-state-description">Please try again or contact support.</p>'
          + '</div></td></tr>';
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.students = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('students');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Students' }
      ]);
      return render();
    },

    bind: function () {
      setTimeout(function () {
        bindEvents();
        loadReferenceData();
        loadStudents();
      }, 0);
    },

    destroy: function () {
      // Remove click listener
      if (_clickHandler) {
        document.removeEventListener('click', _clickHandler);
        _clickHandler = null;
      }

      // Unsubscribe from real-time listeners
      _listeners.forEach(function (unsub) {
        if (typeof unsub === 'function') unsub();
      });
      _listeners = [];

      _allStudents = [];
      _classes = [];
      _departments = [];
      _filter = { search: '', classId: 'all', departmentId: 'all', status: 'all' };
    }
  };
})();