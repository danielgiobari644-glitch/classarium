/**
 * Classarium Transport Management Module
 * Manage vehicles, drivers, routes, and student assignments.
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
    { key: 'vehicles', label: 'Vehicles', icon: '🚌' },
    { key: 'drivers', label: 'Drivers', icon: '🧑‍✈️' },
    { key: 'routes', label: 'Routes', icon: '🗺️' },
    { key: 'assignments', label: 'Student Assignment', icon: '📋' }
  ];

  var VEHICLE_TYPES = [
    { value: 'Bus', label: 'Bus' },
    { value: 'Van', label: 'Van' },
    { value: 'Car', label: 'Car' }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _activeTab = 'vehicles';
  var _vehicles = [];
  var _drivers = [];
  var _routes = [];
  var _assignments = [];
  var _staff = [];
  var _students = [];
  var _listeners = [];
  var _clickHandler = null;
  var _filterRoute = 'all';

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getSchoolId() {
    var profile = window.App && window.App.state && window.App.state.profile;
    return profile ? profile.schoolId : '';
  }

  function statusBadge(status) {
    var map = {
      active: { text: 'Active', cls: 'success' },
      inactive: { text: 'Inactive', cls: 'warning' },
      maintenance: { text: 'Maintenance', cls: 'danger' },
      assigned: { text: 'Assigned', cls: 'info' },
      unassigned: { text: 'Unassigned', cls: 'default' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function getDriverName(driverId) {
    var d = _drivers.find(function (dr) { return dr.id === driverId; });
    if (d) return d.name || '—';
    var st = _staff.find(function (s) { return s.id === driverId; });
    return st ? (st.fullName || st.displayName || '—') : '—';
  }

  function getVehicleName(vehicleId) {
    var v = _vehicles.find(function (ve) { return ve.id === vehicleId; });
    return v ? (v.name + ' (' + v.numberPlate + ')') : '—';
  }

  function getRouteName(routeId) {
    var r = _routes.find(function (ro) { return ro.id === routeId; });
    return r ? (r.name || '—') : '—';
  }

  function getStudentName(studentId) {
    var s = _students.find(function (st) { return st.id === studentId; });
    return s ? (s.fullName || s.displayName || '—') : '—';
  }

  function getDriverOptions(selectedId) {
    var opts = '<option value="">Select Driver</option>';
    _drivers.forEach(function (d) {
      opts += '<option value="' + (d.id || '') + '"' + (selectedId === d.id ? ' selected' : '') + '>'
        + Utils.escapeHtml(d.name || 'Unnamed') + '</option>';
    });
    return opts;
  }

  function getVehicleOptions(selectedId) {
    var opts = '<option value="">Select Vehicle</option>';
    _vehicles.forEach(function (v) {
      opts += '<option value="' + (v.id || '') + '"' + (selectedId === v.id ? ' selected' : '') + '>'
        + Utils.escapeHtml(v.name || 'Unnamed') + ' (' + Utils.escapeHtml(v.numberPlate || '') + ')</option>';
    });
    return opts;
  }

  function getRouteOptions(selectedId) {
    var opts = '<option value="">Select Route</option>';
    _routes.forEach(function (r) {
      opts += '<option value="' + (r.id || '') + '"' + (selectedId === r.id ? ' selected' : '') + '>'
        + Utils.escapeHtml(r.name || 'Unnamed') + '</option>';
    });
    return opts;
  }

  function getStaffOptions(selectedId) {
    var opts = '<option value="">Select Staff Member</option>';
    _staff.forEach(function (s) {
      var name = s.fullName || s.displayName || 'Unnamed';
      opts += '<option value="' + (s.id || '') + '"' + (selectedId === s.id ? ' selected' : '') + '>'
        + Utils.escapeHtml(name) + '</option>';
    });
    return opts;
  }

  function getAssignedStudentsCount(routeId) {
    return _assignments.filter(function (a) { return a.routeId === routeId; }).length;
  }

  /* ------------------------------------------------------------------ */
  /*  Render — Main Page                                                 */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="transport-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Transport</h1>'
      + '<p class="page-header-description">Manage vehicles, drivers, routes & student assignments</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stat cards
    var activeRoutes = _routes.filter(function (r) { return r.status === 'active'; }).length;
    var assignedStudents = _assignments.length;

    html += '<div class="dashboard-grid grid-3">'
      + '<div id="transport-stat-vehicles" class="stat-card"><div class="stat-card-icon" style="background:var(--primary-50);color:var(--primary-600)">🚌</div><div class="stat-card-value">' + _vehicles.length + '</div><div class="stat-card-label">Total Vehicles</div></div>'
      + '<div id="transport-stat-routes" class="stat-card"><div class="stat-card-icon" style="background:#EFF6FF;color:#2563EB">🗺️</div><div class="stat-card-value">' + activeRoutes + '</div><div class="stat-card-label">Active Routes</div></div>'
      + '<div id="transport-stat-assigned" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">📋</div><div class="stat-card-value">' + assignedStudents + '</div><div class="stat-card-label">Assigned Students</div></div>'
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
      + '<div class="card-body" id="transport-tab-content">'
      + renderTabContent()
      + '</div>'
      + '</div>';

    html += '</div>';
    return html;
  }

  function renderTabContent() {
    switch (_activeTab) {
      case 'vehicles': return renderVehiclesTab();
      case 'drivers': return renderDriversTab();
      case 'routes': return renderRoutesTab();
      case 'assignments': return renderAssignmentsTab();
      default: return renderVehiclesTab();
    }
  }

  /* ================================================================== */
  /*  VEHICLES TAB                                                       */
  /* ================================================================== */

  function renderVehiclesTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Vehicles <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _vehicles.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-vehicle">+ Add Vehicle</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="vehicles-table">'
      + '<thead><tr>'
      + '<th>Vehicle Name / Number</th>'
      + '<th>Type</th>'
      + '<th>Capacity</th>'
      + '<th>Driver</th>'
      + '<th>Status</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="vehicles-tbody">';

    if (!_vehicles.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🚌</div>'
        + '<h3 class="empty-state-title">No vehicles yet</h3>'
        + '<p class="empty-state-description">Add your first vehicle to get started.</p>'
        + '</div></td></tr>';
    } else {
      _vehicles.forEach(function (v) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(v.name || '—') + '<br><span style="font-size:12px;color:var(--gray-500)">' + Utils.escapeHtml(v.numberPlate || '') + '</span></td>'
          + '<td>' + Utils.escapeHtml(v.type || '—') + '</td>'
          + '<td>' + (v.capacity || 0) + '</td>'
          + '<td>' + Utils.escapeHtml(getDriverName(v.driverId)) + '</td>'
          + '<td>' + statusBadge(v.status) + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-vehicle" data-id="' + v.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-vehicle" data-id="' + v.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  DRIVERS TAB                                                        */
  /* ================================================================== */

  function renderDriversTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Drivers <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _drivers.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-driver">+ Add Driver</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="drivers-table">'
      + '<thead><tr>'
      + '<th>Driver Name</th>'
      + '<th>Phone</th>'
      + '<th>License Number</th>'
      + '<th>Vehicle Assigned</th>'
      + '<th>Status</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="drivers-tbody">';

    if (!_drivers.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🧑‍✈️</div>'
        + '<h3 class="empty-state-title">No drivers yet</h3>'
        + '<p class="empty-state-description">Add your first driver.</p>'
        + '</div></td></tr>';
    } else {
      _drivers.forEach(function (d) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(d.name || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(d.phone || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(d.licenseNumber || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(getVehicleName(d.vehicleId)) + '</td>'
          + '<td>' + statusBadge(d.status) + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-driver" data-id="' + d.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-driver" data-id="' + d.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  ROUTES TAB                                                         */
  /* ================================================================== */

  function renderRoutesTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Routes <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _routes.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="add-route">+ Add Route</button>'
      + '</div>';

    html += '<div class="data-table-wrapper"><table class="data-table" id="routes-table">'
      + '<thead><tr>'
      + '<th>Route Name</th>'
      + '<th>Stops</th>'
      + '<th>Vehicle</th>'
      + '<th>Driver</th>'
      + '<th>Students</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="routes-tbody">';

    if (!_routes.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🗺️</div>'
        + '<h3 class="empty-state-title">No routes yet</h3>'
        + '<p class="empty-state-description">Add your first transport route.</p>'
        + '</div></td></tr>';
    } else {
      _routes.forEach(function (r) {
        var stops = (r.stops || []).join(', ');
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(r.name || '—') + '</td>'
          + '<td style="max-width:200px;white-space:pre-wrap;font-size:13px;color:var(--gray-600)">' + Utils.escapeHtml(stops || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(getVehicleName(r.vehicleId)) + '</td>'
          + '<td>' + Utils.escapeHtml(getDriverName(r.driverId)) + '</td>'
          + '<td>' + getAssignedStudentsCount(r.id) + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" data-action="edit-route" data-id="' + r.id + '">Edit</button> '
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete-route" data-id="' + r.id + '">Delete</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ================================================================== */
  /*  STUDENT ASSIGNMENTS TAB                                             */
  /* ================================================================== */

  function renderAssignmentsTab() {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
      + '<h3 style="margin:0;font-size:16px;font-weight:600">Student Assignments <span style="font-weight:400;font-size:13px;color:var(--gray-500)">(' + _assignments.length + ')</span></h3>'
      + '<button class="btn btn-primary" data-action="assign-student">+ Assign Student</button>'
      + '</div>';

    // Filter by route
    html += '<div style="margin-bottom:16px">'
      + '<select id="transport-filter-route" class="form-select" style="width:250px">'
      + '<option value="all"' + (_filterRoute === 'all' ? ' selected' : '') + '>All Routes</option>'
      + _routes.map(function (r) {
        return '<option value="' + (r.id || '') + '"' + (_filterRoute === r.id ? ' selected' : '') + '>' + Utils.escapeHtml(r.name || 'Unnamed') + '</option>';
      }).join('')
      + '</select>'
      + '</div>';

    var filtered = _filterRoute === 'all' ? _assignments : _assignments.filter(function (a) { return a.routeId === _filterRoute; });

    html += '<div class="data-table-wrapper"><table class="data-table" id="assignments-table">'
      + '<thead><tr>'
      + '<th>Student</th>'
      + '<th>Route</th>'
      + '<th>Pickup Point</th>'
      + '<th>Drop Point</th>'
      + '<th>Status</th>'
      + '<th style="text-align:right">Actions</th>'
      + '</tr></thead><tbody id="assignments-tbody">';

    if (!filtered.length) {
      html += '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">📋</div>'
        + '<h3 class="empty-state-title">No assignments yet</h3>'
        + '<p class="empty-state-description">Assign students to transport routes.</p>'
        + '</div></td></tr>';
    } else {
      filtered.forEach(function (a) {
        html += '<tr>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(getStudentName(a.studentId)) + '</td>'
          + '<td>' + Utils.escapeHtml(getRouteName(a.routeId)) + '</td>'
          + '<td>' + Utils.escapeHtml(a.pickupPoint || '—') + '</td>'
          + '<td>' + Utils.escapeHtml(a.dropPoint || '—') + '</td>'
          + '<td>' + statusBadge(a.status || 'active') + '</td>'
          + '<td style="text-align:right">'
          + '<div style="display:flex;gap:4px;justify-content:flex-end">'
          + '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="remove-assignment" data-id="' + a.id + '">Remove</button>'
          + '</div></td></tr>';
      });
    }

    html += '</tbody></table></div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Modal Forms                                                        */
  /* ------------------------------------------------------------------ */

  function openAddVehicleModal(editId) {
    var v = editId ? _vehicles.find(function (x) { return x.id === editId; }) : null;
    var title = v ? 'Edit Vehicle' : 'Add Vehicle';

    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Vehicle Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-vehicle-name" class="form-input" placeholder="e.g. Toyota Hiace" value="' + Utils.escapeHtml(v ? v.name : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Number Plate <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-vehicle-plate" class="form-input" placeholder="e.g. ABC-1234" value="' + Utils.escapeHtml(v ? v.numberPlate : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Type <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-vehicle-type" class="form-select">'
      + VEHICLE_TYPES.map(function (t) {
        return '<option value="' + t.value + '"' + (v && v.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Capacity <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="number" id="modal-vehicle-capacity" class="form-input" placeholder="e.g. 30" min="1" value="' + (v ? v.capacity : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Driver</label>'
      + '<select id="modal-vehicle-driver" class="form-select">'
      + getDriverOptions(v ? v.driverId : '')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Status</label>'
      + '<select id="modal-vehicle-status" class="form-select">'
      + '<option value="active"' + (v && v.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="inactive"' + (v && v.status === 'inactive' ? ' selected' : '') + '>Inactive</option>'
      + '<option value="maintenance"' + (v && v.status === 'maintenance' ? ' selected' : '') + '>Maintenance</option>'
      + '</select>'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Description</label>'
      + '<textarea id="modal-vehicle-desc" class="form-input" rows="2" placeholder="Optional description...">' + Utils.escapeHtml(v ? (v.description || '') : '') + '</textarea>'
      + '</div>'
      + '</div>';

    Modal.open(title, formHtml, {
      size: 'medium',
      actions: [{
        label: v ? 'Save Changes' : 'Add Vehicle',
        className: 'btn btn-primary',
        onClick: function () { submitVehicle(editId); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitVehicle(editId) {
    var name = (document.getElementById('modal-vehicle-name') || {}).value || '';
    var numberPlate = (document.getElementById('modal-vehicle-plate') || {}).value || '';
    var type = (document.getElementById('modal-vehicle-type') || {}).value || '';
    var capacity = parseInt((document.getElementById('modal-vehicle-capacity') || {}).value, 10) || 0;
    var driverId = (document.getElementById('modal-vehicle-driver') || {}).value || '';
    var status = (document.getElementById('modal-vehicle-status') || {}).value || 'active';
    var description = (document.getElementById('modal-vehicle-desc') || {}).value || '';

    if (!name.trim()) { Toast.error('Vehicle name is required'); return; }
    if (!numberPlate.trim()) { Toast.error('Number plate is required'); return; }
    if (!type) { Toast.error('Vehicle type is required'); return; }
    if (capacity <= 0) { Toast.error('Capacity must be greater than 0'); return; }

    var schoolId = getSchoolId();
    var data = {
      name: name.trim(),
      numberPlate: numberPlate.trim(),
      type: type,
      capacity: capacity,
      driverId: driverId || null,
      status: status,
      description: description.trim(),
      schoolId: schoolId,
      updatedAt: new Date().toISOString()
    };

    var promise;
    if (editId) {
      promise = DataService.update('transportVehicles', editId, data);
    } else {
      data.createdAt = new Date().toISOString();
      promise = DataService.add('transportVehicles', data);
    }

    promise.then(function () {
      Toast.success(editId ? 'Vehicle updated' : 'Vehicle added');
      Modal.close();
      DataService.logAction && DataService.logAction(editId ? 'update_vehicle' : 'add_vehicle', 'transportVehicles', editId || '', data);
    }).catch(function (err) {
      Toast.error('Failed to save vehicle: ' + (err.message || 'Unknown error'));
    });
  }

  function openAddDriverModal(editId) {
    var d = editId ? _drivers.find(function (x) { return x.id === editId; }) : null;
    var title = d ? 'Edit Driver' : 'Add Driver';

    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Staff Member <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-driver-staff" class="form-select">'
      + getStaffOptions(d ? d.staffId : '')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Phone <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-driver-phone" class="form-input" placeholder="e.g. 08012345678" value="' + Utils.escapeHtml(d ? d.phone : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">License Number <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-driver-license" class="form-input" placeholder="e.g. DRV-12345" value="' + Utils.escapeHtml(d ? d.licenseNumber : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Vehicle</label>'
      + '<select id="modal-driver-vehicle" class="form-select">'
      + getVehicleOptions(d ? d.vehicleId : '')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Status</label>'
      + '<select id="modal-driver-status" class="form-select">'
      + '<option value="active"' + (d && d.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="inactive"' + (d && d.status === 'inactive' ? ' selected' : '') + '>Inactive</option>'
      + '</select>'
      + '</div>'
      + '</div>';

    Modal.open(title, formHtml, {
      size: 'medium',
      actions: [{
        label: d ? 'Save Changes' : 'Add Driver',
        className: 'btn btn-primary',
        onClick: function () { submitDriver(editId); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitDriver(editId) {
    var staffId = (document.getElementById('modal-driver-staff') || {}).value || '';
    var phone = (document.getElementById('modal-driver-phone') || {}).value || '';
    var licenseNumber = (document.getElementById('modal-driver-license') || {}).value || '';
    var vehicleId = (document.getElementById('modal-driver-vehicle') || {}).value || '';
    var status = (document.getElementById('modal-driver-status') || {}).value || 'active';

    if (!staffId) { Toast.error('Please select a staff member'); return; }
    if (!phone.trim()) { Toast.error('Phone number is required'); return; }
    if (!licenseNumber.trim()) { Toast.error('License number is required'); return; }

    var staffMember = _staff.find(function (s) { return s.id === staffId; });
    var driverName = staffMember ? (staffMember.fullName || staffMember.displayName || '') : '';

    var schoolId = getSchoolId();
    var data = {
      staffId: staffId,
      name: driverName,
      phone: phone.trim(),
      licenseNumber: licenseNumber.trim(),
      vehicleId: vehicleId || null,
      status: status,
      schoolId: schoolId,
      updatedAt: new Date().toISOString()
    };

    var promise;
    if (editId) {
      promise = DataService.update('transportDrivers', editId, data);
    } else {
      data.createdAt = new Date().toISOString();
      promise = DataService.add('transportDrivers', data);
    }

    promise.then(function () {
      Toast.success(editId ? 'Driver updated' : 'Driver added');
      Modal.close();
      DataService.logAction && DataService.logAction(editId ? 'update_driver' : 'add_driver', 'transportDrivers', editId || '', data);
    }).catch(function (err) {
      Toast.error('Failed to save driver: ' + (err.message || 'Unknown error'));
    });
  }

  function openAddRouteModal(editId) {
    var r = editId ? _routes.find(function (x) { return x.id === editId; }) : null;
    var title = r ? 'Edit Route' : 'Add Route';

    var stopsText = r && r.stops ? r.stops.join('\n') : '';

    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Route Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-route-name" class="form-input" placeholder="e.g. Ikeja Route" value="' + Utils.escapeHtml(r ? r.name : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Vehicle <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-route-vehicle" class="form-select">'
      + getVehicleOptions(r ? r.vehicleId : '')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Driver</label>'
      + '<select id="modal-route-driver" class="form-select">'
      + getDriverOptions(r ? r.driverId : '')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Morning Pickup Time</label>'
      + '<input type="time" id="modal-route-pickup" class="form-input" value="' + Utils.escapeHtml(r ? (r.morningPickupTime || '') : '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Afternoon Drop Time</label>'
      + '<input type="time" id="modal-route-drop" class="form-input" value="' + Utils.escapeHtml(r ? (r.afternoonDropTime || '') : '') + '">'
      + '</div>'
      + '<div style="grid-column:1/-1">'
      + '<label class="form-label">Stops (one per line) <span style="color:var(--danger-500)">*</span></label>'
      + '<textarea id="modal-route-stops" class="form-input" rows="5" placeholder="Stop 1\nStop 2\nStop 3">' + Utils.escapeHtml(stopsText) + '</textarea>'
      + '</div>'
      + '</div>';

    Modal.open(title, formHtml, {
      size: 'medium',
      actions: [{
        label: r ? 'Save Changes' : 'Add Route',
        className: 'btn btn-primary',
        onClick: function () { submitRoute(editId); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitRoute(editId) {
    var name = (document.getElementById('modal-route-name') || {}).value || '';
    var vehicleId = (document.getElementById('modal-route-vehicle') || {}).value || '';
    var driverId = (document.getElementById('modal-route-driver') || {}).value || '';
    var morningPickupTime = (document.getElementById('modal-route-pickup') || {}).value || '';
    var afternoonDropTime = (document.getElementById('modal-route-drop') || {}).value || '';
    var stopsRaw = (document.getElementById('modal-route-stops') || {}).value || '';

    if (!name.trim()) { Toast.error('Route name is required'); return; }
    if (!vehicleId) { Toast.error('Please select a vehicle'); return; }

    var stops = stopsRaw.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    if (!stops.length) { Toast.error('Add at least one stop'); return; }

    var schoolId = getSchoolId();
    var data = {
      name: name.trim(),
      stops: stops,
      vehicleId: vehicleId,
      driverId: driverId || null,
      morningPickupTime: morningPickupTime,
      afternoonDropTime: afternoonDropTime,
      status: 'active',
      schoolId: schoolId,
      updatedAt: new Date().toISOString()
    };

    var promise;
    if (editId) {
      promise = DataService.update('transportRoutes', editId, data);
    } else {
      data.createdAt = new Date().toISOString();
      promise = DataService.add('transportRoutes', data);
    }

    promise.then(function () {
      Toast.success(editId ? 'Route updated' : 'Route added');
      Modal.close();
      DataService.logAction && DataService.logAction(editId ? 'update_route' : 'add_route', 'transportRoutes', editId || '', data);
    }).catch(function (err) {
      Toast.error('Failed to save route: ' + (err.message || 'Unknown error'));
    });
  }

  function openAssignStudentModal() {
    var formHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Search Student <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="modal-assign-student-search" class="form-input" placeholder="Type to search students..." oninput="window._transportFilterStudents && window._transportFilterStudents(this.value)">'
      + '<select id="modal-assign-student" class="form-select" style="margin-top:8px">'
      + '<option value="">Select a student</option>'
      + _students.map(function (s) {
        var name = s.fullName || s.displayName || 'Unnamed';
        return '<option value="' + (s.id || '') + '">' + Utils.escapeHtml(name) + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Route <span style="color:var(--danger-500)">*</span></label>'
      + '<select id="modal-assign-route" class="form-select">'
      + getRouteOptions('')
      + '</select>'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Pickup Point</label>'
      + '<input type="text" id="modal-assign-pickup" class="form-input" placeholder="e.g. Main Gate">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Drop Point</label>'
      + '<input type="text" id="modal-assign-drop" class="form-input" placeholder="e.g. Home">'
      + '</div>'
      + '</div>';

    // Expose filter function
    window._transportFilterStudents = function (query) {
      var select = document.getElementById('modal-assign-student');
      if (!select) return;
      var q = query.toLowerCase();
      var opts = '<option value="">Select a student</option>';
      _students.forEach(function (s) {
        var name = (s.fullName || s.displayName || '').toLowerCase();
        if (!q || name.indexOf(q) !== -1) {
          opts += '<option value="' + (s.id || '') + '">' + Utils.escapeHtml(s.fullName || s.displayName || 'Unnamed') + '</option>';
        }
      });
      select.innerHTML = opts;
    };

    Modal.open('Assign Student to Route', formHtml, {
      size: 'medium',
      actions: [{
        label: 'Assign',
        className: 'btn btn-primary',
        onClick: function () { submitAssignment(); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () {
          window._transportFilterStudents = null;
          Modal.close();
        }
      }]
    });
  }

  function submitAssignment() {
    var studentId = (document.getElementById('modal-assign-student') || {}).value || '';
    var routeId = (document.getElementById('modal-assign-route') || {}).value || '';
    var pickupPoint = (document.getElementById('modal-assign-pickup') || {}).value || '';
    var dropPoint = (document.getElementById('modal-assign-drop') || {}).value || '';

    if (!studentId) { Toast.error('Please select a student'); return; }
    if (!routeId) { Toast.error('Please select a route'); return; }

    // Check for duplicate assignment
    var exists = _assignments.find(function (a) { return a.studentId === studentId && a.routeId === routeId; });
    if (exists) { Toast.error('This student is already assigned to this route'); return; }

    var schoolId = getSchoolId();
    var data = {
      studentId: studentId,
      routeId: routeId,
      pickupPoint: pickupPoint.trim(),
      dropPoint: dropPoint.trim(),
      status: 'active',
      schoolId: schoolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DataService.add('transportAssignments', data).then(function () {
      Toast.success('Student assigned to route');
      window._transportFilterStudents = null;
      Modal.close();
      DataService.logAction && DataService.logAction('assign_student_route', 'transportAssignments', '', data);
    }).catch(function (err) {
      Toast.error('Failed to assign student: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Delete helpers                                                     */
  /* ------------------------------------------------------------------ */

  function deleteItem(collection, id, label) {
    Modal.confirm('Delete ' + label + '?', 'Are you sure you want to delete this ' + label + '? This action cannot be undone.', function () {
      DataService.remove(collection, id).then(function () {
        Toast.success(label + ' deleted');
        DataService.logAction && DataService.logAction('delete_' + label.toLowerCase().replace(' ', '_'), collection, id, {});
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

    // Load vehicles
    if (typeof DataService.onSnapshot === 'function') {
      var unsub1 = DataService.onSnapshot('transportVehicles', function (data) {
        _vehicles = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub1 === 'function') _listeners.push(unsub1);
    } else {
      DataService.getBySchool('transportVehicles', schoolId).then(function (data) {
        _vehicles = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load drivers
    if (typeof DataService.onSnapshot === 'function') {
      var unsub2 = DataService.onSnapshot('transportDrivers', function (data) {
        _drivers = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub2 === 'function') _listeners.push(unsub2);
    } else {
      DataService.getBySchool('transportDrivers', schoolId).then(function (data) {
        _drivers = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load routes
    if (typeof DataService.onSnapshot === 'function') {
      var unsub3 = DataService.onSnapshot('transportRoutes', function (data) {
        _routes = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub3 === 'function') _listeners.push(unsub3);
    } else {
      DataService.getBySchool('transportRoutes', schoolId).then(function (data) {
        _routes = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load assignments
    if (typeof DataService.onSnapshot === 'function') {
      var unsub4 = DataService.onSnapshot('transportAssignments', function (data) {
        _assignments = data || [];
        refreshTab();
      }, schoolId);
      if (typeof unsub4 === 'function') _listeners.push(unsub4);
    } else {
      DataService.getBySchool('transportAssignments', schoolId).then(function (data) {
        _assignments = data || [];
        refreshTab();
      }).catch(function () { /* ignore */ });
    }

    // Load staff for driver selection
    var loadStaff = DataService.getStaff || function () { return DataService.getBySchool('staff', schoolId); };
    loadStaff().then(function (data) { _staff = data || []; }).catch(function () { /* ignore */ });

    // Load students for assignment
    var loadStudents = DataService.getStudents || function () { return DataService.getBySchool('students', schoolId); };
    loadStudents().then(function (data) { _students = data || []; }).catch(function () { /* ignore */ });
  }

  function refreshTab() {
    var container = document.getElementById('transport-tab-content');
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
          _filterRoute = 'all';
          var container = document.getElementById('transport-tab-content');
          if (container) container.innerHTML = renderTabContent();
          // Re-highlight tabs
          document.querySelectorAll('.profile-tab[data-action="switch-tab"]').forEach(function (btn) {
            var isActive = btn.dataset.tab === _activeTab;
            btn.classList.toggle('active', isActive);
            btn.style.color = isActive ? 'var(--primary-600)' : 'var(--gray-500)';
            btn.style.borderBottom = '2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent');
          });
          break;

        case 'add-vehicle':
          e.preventDefault();
          openAddVehicleModal(null);
          break;
        case 'edit-vehicle':
          e.preventDefault();
          e.stopPropagation();
          openAddVehicleModal(id);
          break;
        case 'delete-vehicle':
          e.preventDefault();
          e.stopPropagation();
          deleteItem('transportVehicles', id, 'Vehicle');
          break;

        case 'add-driver':
          e.preventDefault();
          openAddDriverModal(null);
          break;
        case 'edit-driver':
          e.preventDefault();
          e.stopPropagation();
          openAddDriverModal(id);
          break;
        case 'delete-driver':
          e.preventDefault();
          e.stopPropagation();
          deleteItem('transportDrivers', id, 'Driver');
          break;

        case 'add-route':
          e.preventDefault();
          openAddRouteModal(null);
          break;
        case 'edit-route':
          e.preventDefault();
          e.stopPropagation();
          openAddRouteModal(id);
          break;
        case 'delete-route':
          e.preventDefault();
          e.stopPropagation();
          deleteItem('transportRoutes', id, 'Route');
          break;

        case 'assign-student':
          e.preventDefault();
          openAssignStudentModal();
          break;
        case 'remove-assignment':
          e.preventDefault();
          e.stopPropagation();
          deleteItem('transportAssignments', id, 'Assignment');
          break;
      }
    };

    // Route filter change
    var routeFilter = document.getElementById('transport-filter-route');
    if (routeFilter) {
      routeFilter.addEventListener('change', function () {
        _filterRoute = this.value;
        refreshTab();
      });
    }

    document.addEventListener('click', _clickHandler);
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.transport = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('transport');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Transport' }
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
      _vehicles = [];
      _drivers = [];
      _routes = [];
      _assignments = [];
      _staff = [];
      _students = [];
      _activeTab = 'vehicles';
      _filterRoute = 'all';
    }
  };
})();