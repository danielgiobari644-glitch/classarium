/**
 * Classarium Medical Records Module
 * Manage clinic visits, student health profiles, and immunizations.
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
    { key: 'visits', label: 'Clinic Visits', icon: '🏥' },
    { key: 'health', label: 'Student Health', icon: '❤️' },
    { key: 'immunizations', label: 'Immunizations', icon: '💉' }
  ];

  var BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  var GENOTYPES = ['AA', 'AS', 'AC', 'SS', 'SC', 'CC'];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _activeTab = 'visits';
  var _visits = [];
  var _healthRecords = [];
  var _immunizations = [];
  var _students = [];
  var _staff = [];
  var _listeners = [];
  var _clickHandler = null;
  var _filterStudent = '';
  var _filterDateFrom = '';
  var _filterDateTo = '';
  var _selectedHealthStudent = '';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getSchoolId() {
    var profile = window.App && window.App.state && window.App.state.profile;
    return profile ? profile.schoolId : '';
  }

  function getStudentName(studentId) {
    var s = _students.find(function (st) { return st.id === studentId; });
    return s ? (s.fullName || s.displayName || '—') : '—';
  }

  function getStaffName(staffId) {
    var s = _staff.find(function (st) { return st.id === staffId; });
    return s ? (s.fullName || s.displayName || '—') : '—';
  }

  function visitStatusBadge(status) {
    var map = {
      open: { text: 'Open', cls: 'warning' },
      follow_up: { text: 'Follow-up', cls: 'info' },
      closed: { text: 'Closed', cls: 'success' },
      referred: { text: 'Referred', cls: 'danger' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function immunizationStatusBadge(status) {
    var map = {
      complete: { text: 'Complete', cls: 'success' },
      due: { text: 'Due', cls: 'warning' },
      overdue: { text: 'Overdue', cls: 'danger' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function computeImmunizationStatus(nextDue) {
    if (!nextDue) return 'complete';
    var now = new Date();
    var due = new Date(nextDue);
    if (due < now) return 'overdue';
    return 'due';
  }

  function studentOptions(selectedId, includeAll) {
    var opts = '';
    if (includeAll) opts += '<option value="all"' + (selectedId === 'all' ? ' selected' : '') + '>All Students</option>';
    opts += '<option value="">Select Student</option>';
    _students.forEach(function (s) {
      var name = s.fullName || s.displayName || 'Unnamed';
      opts += '<option value="' + (s.id || '') + '"' + (selectedId === s.id ? ' selected' : '') + '>'
        + Utils.escapeHtml(name) + '</option>';
    });
    return opts;
  }

  function staffOptions(selectedId) {
    var opts = '<option value="">Select Staff</option>';
    _staff.forEach(function (s) {
      var name = s.fullName || s.displayName || 'Unnamed';
      opts += '<option value="' + (s.id || '') + '"' + (selectedId === s.id ? ' selected' : '') + '>'
        + Utils.escapeHtml(name) + '</option>';
    });
    return opts;
  }

  function getFilteredVisits() {
    return _visits.filter(function (v) {
      var matchStudent = !_filterStudent || v.studentId === _filterStudent;
      var matchFrom = !_filterDateFrom || (v.date && v.date >= _filterDateFrom);
      var matchTo = !_filterDateTo || (v.date && v.date <= _filterDateTo);
      return matchStudent && matchFrom && matchTo;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Render — Main Page                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="medical-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Medical Records</h1>'
      + '<p class="page-header-description">Manage clinic visits, student health profiles & immunizations</p>'
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
      + '<div class="card-body" id="medical-tab-content">'
      + renderTabContent()
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  function renderTabContent() {
    switch (_activeTab) {
      case 'visits': return renderVisitsTab();
      case 'health': return renderHealthTab();
      case 'immunizations': return renderImmunizationsTab();
      default: return renderVisitsTab();
    }
  }

  /* ================================================================== */
  /*  CLINIC VISITS TAB                                                  */
  /* ================================================================== */

  function renderVisitsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Clinic Visits <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _visits.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="record-visit">+ Record Visit</button>'
      + '</div>';

    // Filters
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">'
      + '<div style="min-width:220px">'
      + '<select id="medical-filter-student" class="form-select" style="width:100%">'
      + studentOptions(_filterStudent, true)
      + '</select>'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<input type="date" id="medical-filter-from" class="form-input" value="' + Utils.escapeHtml(_filterDateFrom) + '" placeholder="From date">'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<input type="date" id="medical-filter-to" class="form-input" value="' + Utils.escapeHtml(_filterDateTo) + '" placeholder="To date">'
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-action="clear-medical-filters">Clear</button>'
      + '</div>';

    var filtered = getFilteredVisits();

    html += '<div class="data-table-wrapper"><table class="data-table" id="visits-table">'
      + '<thead><tr>'
      + '<th>Student</th>'
      + '<th>Date</th>'
      + '<th>Complaint</th>'
      + '<th>Diagnosis</th>'
      + '<th>Treatment</th>'
      + '<th>Attended By</th>'
      + '<th>Status</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="visits-tbody">';

    if (!filtered.length) {
      html += '<tr><td colspan="8" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🏥</div>'
        + '<h3 class="empty-state-title">No clinic visits recorded</h3>'
        + '<p class="empty-state-description">Record your first clinic visit.</p>'
        + '</div></td></tr>';
    } else {
      filtered.forEach(function (v) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(getStudentName(v.studentId)) + '</td>'
          + '<td>' + (v.date ? Utils.formatDate(v.date) : '—') + '</td>'
          + '<td style="max-width:150px;white-space:pre-wrap;font-size:13px">' + Utils.escapeHtml(v.complaint || '—') + '</td>'
          + '<td style="max-width:150px;white-space:pre-wrap;font-size:13px">' + Utils.escapeHtml(v.diagnosis || '—') + '</td>'
          + '<td style="max-width:150px;white-space:pre-wrap;font-size:13px">' + Utils.escapeHtml(v.treatment || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(getStaffName(v.attendedBy)) + '</td>'
          + '<td>' + visitStatusBadge(v.status) + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-visit" data-id="' + v.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-visit" data-id="' + v.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  STUDENT HEALTH TAB                                                 */
  /* ================================================================== */

  function renderHealthTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Student Health Profiles</h3>'
      + '</div>';

    // Student selector
    html += '<div style="margin-bottom:20px">'
      + '<select id="medical-health-student" class="form-select" style="width:300px">'
      + '<option value="">Select a student to view health profile</option>'
      + _students.map(function (s) {
        var name = s.fullName || s.displayName || 'Unnamed';
        return '<option value="' + (s.id || '') + '"' + (_selectedHealthStudent === s.id ? ' selected' : '') + '>'
          + Utils.escapeHtml(name) + '</option>';
      }).join('')
      + '</select>'
      + '</div>';

    // Health profile
    if (_selectedHealthStudent) {
      var record = _healthRecords.find(function (h) { return h.studentId === _selectedHealthStudent; });
      var studentName = getStudentName(_selectedHealthStudent);

      html += '<div class="card">'
        + '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center">'
        + '<h3 class="card-title">' + Utils.escapeHtml(studentName) + ' — Health Profile</h3>'
        + '<button class="btn btn-sm btn-primary" data-action="edit-health-profile" data-id="' + _selectedHealthStudent + '">Edit Health Info</button>'
        + '</div>'
        + '<div class="card-body">';

      if (record) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">'
          + '<div>'
          + '<div style="font-size:12px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Blood Group</div>'
          + '<div style="font-weight:600;font-size:15px">' + Utils.escapeHtml(record.bloodGroup || 'Not set') + '</div>'
          + '</div>'
          + '<div>'
          + '<div style="font-size:12px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Genotype</div>'
          + '<div style="font-weight:600;font-size:15px">' + Utils.escapeHtml(record.genotype || 'Not set') + '</div>'
          + '</div>'
          + '<div>'
          + '<div style="font-size:12px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Allergies</div>'
          + '<div style="font-weight:600;font-size:15px">' + (record.allergies ? Utils.escapeHtml(record.allergies) : '<span style="color:var(--gray-400)">None recorded</span>') + '</div>'
          + '</div>'
          + '<div>'
          + '<div style="font-size:12px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Disabilities</div>'
          + '<div style="font-weight:600;font-size:15px">' + (record.disabilities ? Utils.escapeHtml(record.disabilities) : '<span style="color:var(--gray-400)">None recorded</span>') + '</div>'
          + '</div>'
          + '<div style="grid-column:1/-1">'
          + '<div style="font-size:12px;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Medical Notes</div>'
          + '<div style="font-size:14px;color:var(--gray-700);white-space:pre-wrap">' + (record.medicalNotes ? Utils.escapeHtml(record.medicalNotes) : '<span style="color:var(--gray-400)">No notes</span>') + '</div>'
          + '</div>'
          + '</div>';
      } else {
        html += '<div style="text-align:center;padding:30px;color:var(--gray-500)">'
          + '<p>No health profile found for this student.</p>'
          + '<button class="btn btn-primary btn-sm" style="margin-top:12px" data-action="create-health-profile" data-id="' + _selectedHealthStudent + '">Create Health Profile</button>'
          + '</div>';
      }

      html += '</div></div>';

      // Past visits for this student
      var studentVisits = _visits.filter(function (v) { return v.studentId === _selectedHealthStudent; })
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

      html += '<div class="card" style="margin-top:16px">'
        + '<div class="card-header"><h3 class="card-title">Past Clinic Visits (' + studentVisits.length + ')</h3></div>'
        + '<div class="card-body" style="padding:0">';

      if (!studentVisits.length) {
        html += '<div style="text-align:center;padding:30px;color:var(--gray-500)">No visits recorded for this student.</div>';
      } else {
        html += '<div class="data-table-wrapper"><table class="data-table">'
          + '<thead><tr><th>Date</th><th>Complaint</th><th>Diagnosis</th><th>Treatment</th><th>Doctor/Nurse</th><th>Status</th></tr></thead><tbody>';
        studentVisits.forEach(function (v) {
          html += '<tr>'
            + '<td>' + (v.date ? Utils.formatDate(v.date) : '—') + '</td>'
            + '<td>' + Utils.escapeHtml(v.complaint || '—') + '</td>'
            + '<td>' + Utils.escapeHtml(v.diagnosis || '—') + '</td>'
            + '<td>' + Utils.escapeHtml(v.treatment || '—') + '</td>'
            + '<td>' + Utils.escapeHtml(getStaffName(v.attendedBy)) + '</td>'
            + '<td>' + visitStatusBadge(v.status) + '</td>'
            + '</tr>';
        });
        html += '</tbody></table></div>';
      }

      html += '</div></div>';
    } else {
      html += '<div style="text-align:center;padding:60px;color:var(--gray-400)">'
        + '<div style="font-size:48px;margin-bottom:12px">❤️</div>'
        + '<p>Select a student above to view their health profile and clinic visit history.</p>'
        + '</div>';
    }

    return html;
  }

  /* ================================================================== */
  /*  IMMUNIZATIONS TAB                                                  */
  /* ================================================================== */

  function renderImmunizationsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Immunizations <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _immunizations.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="record-immunization">+ Record Immunization</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="immunizations-table">'
      + '<thead><tr>'
      + '<th>Student</th>'
      + '<th>Vaccine</th>'
      + '<th>Date Given</th>'
      + '<th>Next Due</th>'
      + '<th>Status</th>'
      + '<th>Given By</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="immunizations-tbody">';

    if (!_immunizations.length) {
      html += '<tr><td colspan="7" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">💉</div>'
        + '<h3 class="empty-state-title">No immunizations recorded</h3>'
        + '<p class="empty-state-description">Record your first immunization.</p>'
        + '</div></td></tr>';
    } else {
      _immunizations.forEach(function (im) {
        var status = im.status || computeImmunizationStatus(im.nextDue);
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(getStudentName(im.studentId)) + '</td>'
          + '<td>' + Utils.escapeHtml(im.vaccineName || '—') + '</td>'
          + '<td>' + (im.dateGiven ? Utils.formatDate(im.dateGiven) : '—') + '</td>'
          + '<td>' + (im.nextDue ? Utils.formatDate(im.nextDue) : '—') + '</td>'
          + '<td>' + immunizationStatusBadge(status) + '</td>'
          + '<td>' + Utils.escapeHtml(im.givenBy || '—') + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-immunization" data-id="' + im.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-immunization" data-id="' + im.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Modal Forms                                                        */
  /* ------------------------------------------------------------------ */

  function openVisitModal(editId) {
    var v = editId ? _visits.find(function (x) { return x.id === editId; }) : null;
    var title = v ? 'Edit Clinic Visit' : 'Record Clinic Visit';

    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Student <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-visit-student" class="form-select">'
      + studentOptions(v ? v.studentId : '', false)
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" id="modal-visit-date" class="form-input" value="' + Utils.escapeHtml(v ? (v.date || '') : new Date().toISOString().split('T')[0]) + '">'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Reason / Complaint <span style="color:var(--danger-500)">*</span></label>'
      + '<textarea id="modal-visit-complaint" class="form-input" rows="2" placeholder="Describe the complaint...">' + Utils.escapeHtml(v ? (v.complaint || '') : '') + '</textarea>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Diagnosis</label>'
      + '<textarea id="modal-visit-diagnosis" class="form-input" rows="2" placeholder="Diagnosis...">' + Utils.escapeHtml(v ? (v.diagnosis || '') : '') + '</textarea>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Treatment</label>'
      + '<textarea id="modal-visit-treatment" class="form-input" rows="2" placeholder="Treatment administered...">' + Utils.escapeHtml(v ? (v.treatment || '') : '') + '</textarea>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Medication Prescribed</label>'
      + '<textarea id="modal-visit-medication" class="form-input" rows="2" placeholder="List medications...">' + Utils.escapeHtml(v ? (v.medication || '') : '') + '</textarea>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Follow-up Date</label>'
      + '<input type="date" id="modal-visit-followup" class="form-input" value="' + Utils.escapeHtml(v ? (v.followUpDate || '') : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Attended By <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-visit-attended" class="form-select">'
      + staffOptions(v ? v.attendedBy : '')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Status</label>'
      + '<select id="modal-visit-status" class="form-select">'
      + '<option value="open"' + (v && v.status === 'open' ? ' selected' : '') + '>Open</option>'
      + '<option value="follow_up"' + (v && v.status === 'follow_up' ? ' selected' : '') + '>Follow-up</option>'
      + '<option value="closed"' + (v && v.status === 'closed' ? ' selected' : '') + '>Closed</option>'
      + '<option value="referred"' + (v && v.status === 'referred' ? ' selected' : '') + '>Referred</option>'
      + '</select>'
      + '</div>'
      + '</div>';

    Modal.open(title, formHtml, {
      size: 'large',
      actions: [{
        label: v ? 'Save Changes' : 'Record Visit',
        className: 'btn btn-primary',
        onClick: function () { submitVisit(editId); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitVisit(editId) {
    var studentId = (document.getElementById('modal-visit-student') || {}).value || '';
    var date = (document.getElementById('modal-visit-date') || {}).value || '';
    var complaint = (document.getElementById('modal-visit-complaint') || {}).value || '';
    var diagnosis = (document.getElementById('modal-visit-diagnosis') || {}).value || '';
    var treatment = (document.getElementById('modal-visit-treatment') || {}).value || '';
    var medication = (document.getElementById('modal-visit-medication') || {}).value || '';
    var followUpDate = (document.getElementById('modal-visit-followup') || {}).value || '';
    var attendedBy = (document.getElementById('modal-visit-attended') || {}).value || '';
    var status = (document.getElementById('modal-visit-status') || {}).value || 'open';

    if (!studentId) { Toast.error('Please select a student'); return; }
    if (!date) { Toast.error('Date is required'); return; }
    if (!complaint.trim()) { Toast.error('Complaint is required'); return; }
    if (!attendedBy) { Toast.error('Please select who attended to the student'); return; }

    var schoolId = getSchoolId();
    var data = {
      studentId: studentId,
      date: date,
      complaint: complaint.trim(),
      diagnosis: diagnosis.trim(),
      treatment: treatment.trim(),
      medication: medication.trim(),
      followUpDate: followUpDate,
      attendedBy: attendedBy,
      status: status,
      schoolId: schoolId,
      updatedAt: new Date().toISOString()
    };

    var promise;
    if (editId) {
      promise = DataService.update('medicalVisits', editId, data);
    } else {
      data.createdAt = new Date().toISOString();
      promise = DataService.add('medicalVisits', data);
    }

    promise.then(function () {
      Toast.success(editId ? 'Visit updated' : 'Clinic visit recorded');
      Modal.close();
      DataService.logAction && DataService.logAction(editId ? 'update_medical_visit' : 'add_medical_visit', 'medicalVisits', editId || '', data);
    }).catch(function (err) {
      Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  function openHealthProfileModal(studentId, editMode) {
    var record = _healthRecords.find(function (h) { return h.studentId === studentId; });
    var studentName = getStudentName(studentId);

    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Blood Group</label>'
      + '<select id="modal-health-blood" class="form-select">'
      + '<option value="">Select</option>'
      + BLOOD_GROUPS.map(function (bg) {
        return '<option value="' + bg + '"' + (record && record.bloodGroup === bg ? ' selected' : '') + '>' + bg + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Genotype</label>'
      + '<select id="modal-health-genotype" class="form-select">'
      + '<option value="">Select</option>'
      + GENOTYPES.map(function (g) {
        return '<option value="' + g + '"' + (record && record.genotype === g ? ' selected' : '') + '>' + g + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Allergies</label>'
      + '<textarea id="modal-health-allergies" class="form-input" rows="2" placeholder="List known allergies...">' + Utils.escapeHtml(record ? (record.allergies || '') : '') + '</textarea>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Disabilities</label>'
      + '<textarea id="modal-health-disabilities" class="form-input" rows="2" placeholder="List any disabilities...">' + Utils.escapeHtml(record ? (record.disabilities || '') : '') + '</textarea>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Medical Notes</label>'
      + '<textarea id="modal-health-notes" class="form-input" rows="3" placeholder="Additional medical notes...">' + Utils.escapeHtml(record ? (record.medicalNotes || '') : '') + '</textarea>'
      + '</div>'
      + '</div>';

    Modal.open('Health Profile — ' + studentName, formHtml, {
      size: 'medium',
      actions: [{
        label: 'Save',
        className: 'btn btn-primary',
        onClick: function () { submitHealthProfile(studentId, record); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitHealthProfile(studentId, existingRecord) {
    var bloodGroup = (document.getElementById('modal-health-blood') || {}).value || '';
    var genotype = (document.getElementById('modal-health-genotype') || {}).value || '';
    var allergies = (document.getElementById('modal-health-allergies') || {}).value || '';
    var disabilities = (document.getElementById('modal-health-disabilities') || {}).value || '';
    var medicalNotes = (document.getElementById('modal-health-notes') || {}).value || '';

    var schoolId = getSchoolId();
    var data = {
      studentId: studentId,
      bloodGroup: bloodGroup,
      genotype: genotype,
      allergies: allergies.trim(),
      disabilities: disabilities.trim(),
      medicalNotes: medicalNotes.trim(),
      schoolId: schoolId,
      updatedAt: new Date().toISOString()
    };

    var promise;
    if (existingRecord && existingRecord.id) {
      promise = DataService.update('studentHealth', existingRecord.id, data);
    } else {
      data.createdAt = new Date().toISOString();
      promise = DataService.add('studentHealth', data);
    }

    promise.then(function () {
      Toast.success('Health profile saved');
      Modal.close();
      DataService.logAction && DataService.logAction('update_health_profile', 'studentHealth', existingRecord ? existingRecord.id : '', data);
    }).catch(function (err) {
      Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  function openImmunizationModal(editId) {
    var im = editId ? _immunizations.find(function (x) { return x.id === editId; }) : null;
    var title = im ? 'Edit Immunization' : 'Record Immunization';

    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Student <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-imm-student" class="form-select">'
      + studentOptions(im ? im.studentId : '', false)
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Vaccine Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-imm-vaccine" class="form-input" placeholder="e.g. BCG, OPV, Hepatitis B" value="' + Utils.escapeHtml(im ? (im.vaccineName || '') : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Date Given <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" id="modal-imm-date" class="form-input" value="' + Utils.escapeHtml(im ? (im.dateGiven || '') : new Date().toISOString().split('T')[0]) + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Next Due Date</label>'
      + '<input type="date" id="modal-imm-next" class="form-input" value="' + Utils.escapeHtml(im ? (im.nextDue || '') : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Given By <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-imm-givenby" class="form-input" placeholder="Name of doctor/nurse" value="' + Utils.escapeHtml(im ? (im.givenBy || '') : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Status</label>'
      + '<select id="modal-imm-status" class="form-select">'
      + '<option value="complete"' + (im && im.status === 'complete' ? ' selected' : '') + '>Complete</option>'
      + '<option value="due"' + (im && im.status === 'due' ? ' selected' : '') + '>Due</option>'
      + '<option value="overdue"' + (im && im.status === 'overdue' ? ' selected' : '') + '>Overdue</option>'
      + '</select>'
      + '</div>'
      + '</div>';

    Modal.open(title, formHtml, {
      size: 'medium',
      actions: [{
        label: im ? 'Save Changes' : 'Record Immunization',
        className: 'btn btn-primary',
        onClick: function () { submitImmunization(editId); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitImmunization(editId) {
    var studentId = (document.getElementById('modal-imm-student') || {}).value || '';
    var vaccineName = (document.getElementById('modal-imm-vaccine') || {}).value || '';
    var dateGiven = (document.getElementById('modal-imm-date') || {}).value || '';
    var nextDue = (document.getElementById('modal-imm-next') || {}).value || '';
    var givenBy = (document.getElementById('modal-imm-givenby') || {}).value || '';
    var status = (document.getElementById('modal-imm-status') || {}).value || 'complete';

    if (!studentId) { Toast.error('Please select a student'); return; }
    if (!vaccineName.trim()) { Toast.error('Vaccine name is required'); return; }
    if (!dateGiven) { Toast.error('Date given is required'); return; }
    if (!givenBy.trim()) { Toast.error('Given by is required'); return; }

    if (!status && nextDue) {
      status = computeImmunizationStatus(nextDue);
    }

    var schoolId = getSchoolId();
    var data = {
      studentId: studentId,
      vaccineName: vaccineName.trim(),
      dateGiven: dateGiven,
      nextDue: nextDue || null,
      givenBy: givenBy.trim(),
      status: status,
      schoolId: schoolId,
      updatedAt: new Date().toISOString()
    };

    var promise;
    if (editId) {
      promise = DataService.update('immunizations', editId, data);
    } else {
      data.createdAt = new Date().toISOString();
      promise = DataService.add('immunizations', data);
    }

    promise.then(function () {
      Toast.success(editId ? 'Immunization updated' : 'Immunization recorded');
      Modal.close();
      DataService.logAction && DataService.logAction(editId ? 'update_immunization' : 'add_immunization', 'immunizations', editId || '', data);
    }).catch(function (err) {
      Toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Delete helpers                                                     */
  /* ------------------------------------------------------------------ */

  function deleteItem(collection, id, label) {
    Modal.confirm('Delete ' + label + '?', 'Are you sure you want to delete this ' + label + '? This action cannot be undone.', function () {
      DataService.remove(collection, id).then(function () {
        Toast.success(label + ' deleted');
        DataService.logAction && DataService.logAction('delete_' + label.toLowerCase().replace(/ /g, '_'), collection, id, {});
      }).catch(function (err) {
        Toast.error('Failed to delete: ' + (err.message || 'Unknown error'));
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                      */
  /* ------------------------------------------------------------------ */

  function loadData() {
    var schoolId = getSchoolId();

    // Load visits
    if (typeof DataService.onSnapshot === 'function') {
      var unsub1 = DataService.onSnapshot('medicalVisits', function (data) {
        _visits = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub1 === 'function') _listeners.push(unsub1);
    } else {
      DataService.getBySchool('medicalVisits', schoolId).then(function (data) {
        _visits = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load health records
    if (typeof DataService.onSnapshot === 'function') {
      var unsub2 = DataService.onSnapshot('studentHealth', function (data) {
        _healthRecords = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub2 === 'function') _listeners.push(unsub2);
    } else {
      DataService.getBySchool('studentHealth', schoolId).then(function (data) {
        _healthRecords = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load immunizations
    if (typeof DataService.onSnapshot === 'function') {
      var unsub3 = DataService.onSnapshot('immunizations', function (data) {
        _immunizations = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub3 === 'function') _listeners.push(unsub3);
    } else {
      DataService.getBySchool('immunizations', schoolId).then(function (data) {
        _immunizations = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load students
    var loadStudents = DataService.getStudents || function () { return DataService.getBySchool('students', schoolId); };
    loadStudents().then(function (data) { _students = data || []; refreshTab(); }).catch(function () { /* ignore */ });

    // Load staff
    var loadStaff = DataService.getStaff || function () { return DataService.getBySchool('staff', schoolId); };
    loadStaff().then(function (data) { _staff = data || []; }).catch(function () { /* ignore */ });
  }

  function refreshTab() {
    var container = document.getElementById('medical-tab-content');
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
          var container = document.getElementById('medical-tab-content');
          if (container) container.innerHTML = renderTabContent();
          document.querySelectorAll('.profile-tab[data-action="switch-tab"]').forEach(function (btn) {
            var isActive = btn.dataset.tab === _activeTab;
            btn.classList.toggle('active', isActive);
            btn.style.color = isActive ? 'var(--primary-600)' : 'var(--gray-500)';
            btn.style.borderBottom = '2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent');
          });
          break;

        case 'record-visit':
          e.preventDefault();
          openVisitModal(null);
          break;
        case 'edit-visit':
          e.preventDefault();
          e.stopPropagation();
          openVisitModal(id);
          break;
        case 'delete-visit':
          e.preventDefault();
          e.stopPropagation();
          deleteItem('medicalVisits', id, 'Clinic Visit');
          break;

        case 'edit-health-profile':
        case 'create-health-profile':
          e.preventDefault();
          openHealthProfileModal(id, true);
          break;

        case 'record-immunization':
          e.preventDefault();
          openImmunizationModal(null);
          break;
        case 'edit-immunization':
          e.preventDefault();
          e.stopPropagation();
          openImmunizationModal(id);
          break;
        case 'delete-immunization':
          e.preventDefault();
          e.stopPropagation();
          deleteItem('immunizations', id, 'Immunization');
          break;

        case 'clear-medical-filters':
          e.preventDefault();
          _filterStudent = '';
          _filterDateFrom = '';
          _filterDateTo = '';
          refreshTab();
          bindFilterInputs();
          break;
      }
    };

    bindFilterInputs();

    // Health student selector
    var healthSelect = document.getElementById('medical-health-student');
    if (healthSelect) {
      healthSelect.addEventListener('change', function () {
        _selectedHealthStudent = this.value;
        refreshTab();
        // Re-bind the new selector
        var newSelect = document.getElementById('medical-health-student');
        if (newSelect) {
          newSelect.addEventListener('change', arguments.callee);
        }
      });
    }

    document.addEventListener('click', _clickHandler);
  }

  function bindFilterInputs() {
    var studentFilter = document.getElementById('medical-filter-student');
    if (studentFilter) {
      studentFilter.addEventListener('change', function () {
        _filterStudent = this.value;
        refreshTab();
        bindFilterInputs();
      });
    }
    var dateFrom = document.getElementById('medical-filter-from');
    if (dateFrom) {
      dateFrom.addEventListener('change', function () {
        _filterDateFrom = this.value;
      });
    }
    var dateTo = document.getElementById('medical-filter-to');
    if (dateTo) {
      dateTo.addEventListener('change', function () {
        _filterDateTo = this.value;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.medical = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('medical');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Medical Records' }
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
      _visits = [];
      _healthRecords = [];
      _immunizations = [];
      _students = [];
      _staff = [];
      _activeTab = 'visits';
      _filterStudent = '';
      _filterDateFrom = '';
      _filterDateTo = '';
      _selectedHealthStudent = '';
    }
  };
})();