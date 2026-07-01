/**
 * Classarium Hostel Management Module
 * Manage hostel blocks, rooms, student allocations, daily attendance, and visitor logs.
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

  var _blocks = [];
  var _rooms = [];
  var _allocations = [];
  var _attendance = [];
  var _visitors = [];
  var _students = [];
  var _listeners = [];
  var _clickHandler = null;
  var _inputHandler = null;
  var _changeHandler = null;

  var _activeTab = 'blocks';
  var _selectedBlockId = '';
  var _attBlockId = '';
  var _attDate = '';
  var _allocFilterBlock = '';
  var _allocFilterRoom = '';

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

  function getBlockName(id) {
    var b = _blocks.find(function (x) { return x.id === id; });
    return b ? (b.name || '\u2014') : '\u2014';
  }

  function getRoomLabel(roomId) {
    var r = _rooms.find(function (x) { return x.id === roomId; });
    return r ? (r.roomNumber || '\u2014') : '\u2014';
  }

  function getRoomOccupants(roomId) {
    return _allocations.filter(function (a) { return a.roomId === roomId && a.status === 'Active'; });
  }

  function getAvailableBeds(room) {
    var occupants = getRoomOccupants(room.id).length;
    return Math.max(0, (room.bedCapacity || 0) - occupants);
  }

  function getBlockRooms(blockId) {
    return _rooms.filter(function (r) { return r.blockId === blockId; });
  }

  function getAvailableBedsInRoom(roomId) {
    var room = _rooms.find(function (r) { return r.id === roomId; });
    if (!room) return 0;
    return getAvailableBeds(room);
  }

  function getOccupiedBedsInBlock(blockId) {
    var rooms = getBlockRooms(blockId);
    var total = 0;
    rooms.forEach(function (r) {
      total += getRoomOccupants(r.id).length;
    });
    return total;
  }

  function getNextAvailableBed(roomId) {
    var room = _rooms.find(function (r) { return r.id === roomId; });
    if (!room) return 1;
    var occupants = getRoomOccupants(roomId);
    var usedBeds = occupants.map(function (a) { return a.bedNumber || 0; });
    for (var i = 1; i <= (room.bedCapacity || 4); i++) {
      if (usedBeds.indexOf(i) === -1) return i;
    }
    return 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    return DataService.getStudents(schoolId).then(function (data) {
      _students = data || [];
    });
  }

  function loadHostelData() {
    var schoolId = getSchoolId();
    return Promise.all([
      DataService.getBySchool('hostelBlocks', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('hostelRooms', schoolId),
      DataService.getBySchool('hostelAllocations', schoolId),
      DataService.getBySchool('hostelAttendance', schoolId, { orderBy: 'timestamp', orderDir: 'desc' }),
      DataService.getBySchool('hostelVisitors', schoolId, { orderBy: 'timestamp', orderDir: 'desc' })
    ]).then(function (results) {
      _blocks = results[0] || [];
      _rooms = results[1] || [];
      _allocations = results[2] || [];
      _attendance = results[3] || [];
      _visitors = results[4] || [];
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
      return loadHostelData();
    }).then(function () {
      container.innerHTML = renderMainView();
      bindEvents();
    }).catch(function (err) {
      console.error('Error loading hostel module:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load hostel data. Please refresh.');
      Toast.error('Failed to load hostel data.');
    });
  }

  /* ================================================================== */
  /*  Main View                                                          */
  /* ================================================================== */

  function renderMainView() {
    var html = '<div class="hostel-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Hostel</h1>'
      + '<p class="page-header-description">Manage hostel blocks, rooms, allocations, and visitors</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + (_activeTab === 'blocks'
        ? '<button class="btn btn-primary" data-action="add-block">Add Block</button>'
        : (_activeTab === 'allocation'
          ? '<button class="btn btn-primary" data-action="allocate-student">Allocate Student</button>'
          : (_activeTab === 'visitors'
            ? '<button class="btn btn-primary" data-action="record-visitor">Record Visitor</button>'
            : '')))
      + '</div>'
      + '</div>'
      + '</div>';

    // Tabs
    html += '<div style="display:flex;border-bottom:2px solid var(--gray-200);margin-bottom:20px">'
      + tabButton('blocks', 'Blocks & Rooms')
      + tabButton('allocation', 'Allocation')
      + tabButton('attendance', 'Attendance')
      + tabButton('visitors', 'Visitors')
      + '</div>';

    // Tab content
    if (_activeTab === 'blocks') {
      html += renderBlocksTab();
    } else if (_activeTab === 'allocation') {
      html += renderAllocationTab();
    } else if (_activeTab === 'attendance') {
      html += renderAttendanceTab();
    } else {
      html += renderVisitorsTab();
    }

    html += '</div>';
    return html;
  }

  function tabButton(tab, label) {
    var isActive = _activeTab === tab;
    return '<button class="hostel-tab" data-action="switch-tab" data-tab="' + tab + '"'
      + ' style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;'
      + 'color:' + (isActive ? 'var(--primary-600)' : 'var(--gray-500)')
      + ';border-bottom:2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent')
      + ';margin-bottom:-2px;transition:all 0.15s">' + label + '</button>';
  }

  /* ================================================================== */
  /*  Blocks & Rooms Tab                                                 */
  /* ================================================================== */

  function renderBlocksTab() {
    var totalBlocks = _blocks.length;
    var totalRooms = _rooms.length;
    var totalBeds = _rooms.reduce(function (s, r) { return s + (r.bedCapacity || 0); }, 0);
    var totalOccupied = _allocations.filter(function (a) { return a.status === 'Active'; }).length;

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83C\uDFE0', 'Total Blocks', totalBlocks, 'var(--primary-600)');
    html += statCard('\uD83C\uDFE2', 'Total Rooms', totalRooms, 'var(--info-600)');
    html += statCard('\uD83D\uDECB', 'Total Beds', totalBeds, 'var(--success-600)');
    html += statCard('\uD83D\uDC64', 'Occupied', totalOccupied, 'var(--warning-600)');
    html += '</div>';

    if (!_blocks.length) {
      html += emptyState('\uD83C\uDFE0', 'No Hostel Blocks', 'Add a hostel block to get started.');
      return html;
    }

    // Block cards
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px">';

    _blocks.forEach(function (block) {
      var rooms = getBlockRooms(block.id);
      var occupied = getOccupiedBedsInBlock(block.id);
      var beds = rooms.reduce(function (s, r) { return s + (r.bedCapacity || 0); }, 0);
      var pct = beds > 0 ? Math.round((occupied / beds) * 100) : 0;

      var typeColor = block.type === 'Male' ? 'var(--info-600)' : (block.type === 'Female' ? 'var(--danger-600)' : 'var(--warning-600)');
      var isSelected = _selectedBlockId === block.id;

      html += '<div class="card" style="padding:20px;cursor:pointer;border:2px solid ' + (isSelected ? 'var(--primary-500)' : 'transparent') + ';transition:border-color 0.15s" data-action="select-block" data-id="' + block.id + '">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
        + '<div>'
        + '<h3 style="margin:0;font-size:16px;font-weight:700;color:var(--gray-800)">' + Utils.escapeHtml(block.name) + '</h3>'
        + '<span class="badge" style="background:' + typeColor + '15;color:' + typeColor + ';font-size:11px;margin-top:4px;display:inline-block">' + Utils.escapeHtml(block.type || 'Mixed') + '</span>'
        + '</div>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="btn btn-sm btn-outline-primary" data-action="add-room" data-id="' + block.id + '" title="Add Room" onclick="event.stopPropagation()">+</button>'
        + '</div>'
        + '</div>'
        + (block.description ? '<p style="margin:0 0 12px;font-size:13px;color:var(--gray-500);line-height:1.4">' + Utils.escapeHtml(block.description) + '</p>' : '')
        + '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:8px">'
        + '<span>' + rooms.length + ' room' + (rooms.length !== 1 ? 's' : '') + '</span>'
        + '<span>' + occupied + ' / ' + beds + ' beds</span>'
        + '</div>'
        + '<div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden">'
        + '<div style="height:100%;width:' + pct + '%;background:' + typeColor + ';border-radius:3px;transition:width 0.3s"></div>'
        + '</div>'
        + '</div>';
    });

    html += '</div>';

    // Show rooms for selected block
    if (_selectedBlockId) {
      var block = _blocks.find(function (b) { return b.id === _selectedBlockId; });
      var rooms = getBlockRooms(_selectedBlockId);

      html += '<div class="card" style="overflow:hidden">'
        + '<div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);display:flex;justify-content:space-between;align-items:center">'
        + '<h3 style="margin:0;font-size:15px;font-weight:600;color:var(--gray-800)">Rooms in ' + Utils.escapeHtml(block ? block.name : '') + '</h3>'
        + '<button class="btn btn-sm btn-primary" data-action="add-room" data-id="' + _selectedBlockId + '">+ Add Room</button>'
        + '</div>';

      if (!rooms.length) {
        html += '<div style="padding:30px;text-align:center;color:var(--gray-400);font-size:13px">No rooms in this block yet.</div>';
      } else {
        html += '<div style="overflow-x:auto"><table class="table" style="margin:0">'
          + '<thead><tr><th>Room Number</th><th>Capacity</th><th>Occupants</th><th>Available Beds</th><th>Actions</th></tr></thead><tbody>';

        rooms.forEach(function (r) {
          var occupants = getRoomOccupants(r.id);
          var avail = getAvailableBeds(r);

          html += '<tr>'
            + '<td><strong>' + Utils.escapeHtml(r.roomNumber || '\u2014') + '</strong></td>'
            + '<td>' + (r.bedCapacity || 0) + '</td>'
            + '<td>'
            + (occupants.length > 0
              ? occupants.map(function (a) { return '<span style="display:inline-block;font-size:12px;background:var(--gray-100);padding:2px 8px;border-radius:4px;margin:2px">' + Utils.escapeHtml(getStudentName(a.studentId)) + ' (Bed ' + (a.bedNumber || '') + ')</span>'; }).join('')
              : '<span style="color:var(--gray-400);font-size:13px">Empty</span>')
            + '</td>'
            + '<td style="font-weight:600;color:' + (avail > 0 ? 'var(--success-600)' : 'var(--danger-600)') + '">' + avail + '</td>'
            + '<td>'
            + '<button class="btn btn-sm btn-outline-danger" data-action="delete-room" data-id="' + r.id + '" title="Delete Room">\uD83D\uDDD1</button>'
            + '</td>'
            + '</tr>';
        });

        html += '</tbody></table></div>';
      }

      html += '</div>';
    }

    return html;
  }

  /* ================================================================== */
  /*  Allocation Tab                                                     */
  /* ================================================================== */

  function renderAllocationTab() {
    // Filter bar
    var html = '<div class="card" style="padding:14px 20px;margin-bottom:20px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">';

    html += '<div style="min-width:180px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Block</label>'
      + '<select class="form-control form-control-sm" data-alloc-filter="blockId" style="font-size:13px">'
      + '<option value="">All Blocks</option>';
    _blocks.forEach(function (b) {
      html += optionTag(b.id, b.name, _allocFilterBlock === b.id);
    });
    html += '</select></div>';

    html += '<div style="min-width:180px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Room</label>'
      + '<select class="form-control form-control-sm" data-alloc-filter="roomId" style="font-size:13px">'
      + '<option value="">All Rooms</option>';
    var filteredRooms = _allocFilterBlock ? getBlockRooms(_allocFilterBlock) : _rooms;
    filteredRooms.forEach(function (r) {
      html += optionTag(r.id, r.roomNumber || r.id, _allocFilterRoom === r.id);
    });
    html += '</select></div>';

    html += '<button class="btn btn-outline-secondary btn-sm" data-action="clear-alloc-filters" style="margin-bottom:0;white-space:nowrap">Clear</button>';
    html += '</div></div>';

    // Filtered allocations
    var activeAllocations = _allocations.filter(function (a) { return a.status === 'Active'; });

    if (_allocFilterBlock) {
      activeAllocations = activeAllocations.filter(function (a) {
        var room = _rooms.find(function (r) { return r.id === a.roomId; });
        return room && room.blockId === _allocFilterBlock;
      });
    }

    if (_allocFilterRoom) {
      activeAllocations = activeAllocations.filter(function (a) { return a.roomId === _allocFilterRoom; });
    }

    if (!activeAllocations.length) {
      html += emptyState('\uD83D\uDC64', 'No Allocations', _allocations.length === 0
        ? 'No students allocated yet. Click "Allocate Student" to start.'
        : 'Try adjusting your filters.');
      return html;
    }

    html += '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:700px">'
      + '<thead><tr>'
      + '<th>Student Name</th>'
      + '<th>Block</th>'
      + '<th>Room</th>'
      + '<th>Bed</th>'
      + '<th>Date Allocated</th>'
      + '<th>Status</th>'
      + '<th>Actions</th>'
      + '</tr></thead><tbody>';

    activeAllocations.forEach(function (a) {
      var room = _rooms.find(function (r) { return r.id === a.roomId; });
      var blockId = room ? room.blockId : '';
      var blockName = getBlockName(blockId);
      var roomNumber = room ? room.roomNumber : '\u2014';

      html += '<tr>'
        + '<td><strong>' + Utils.escapeHtml(getStudentName(a.studentId)) + '</strong></td>'
        + '<td>' + Utils.escapeHtml(blockName) + '</td>'
        + '<td>' + Utils.escapeHtml(roomNumber) + '</td>'
        + '<td>' + (a.bedNumber || '\u2014') + '</td>'
        + '<td>' + (a.dateAllocated ? Utils.formatDate(a.dateAllocated) : '\u2014') + '</td>'
        + '<td><span class="badge badge-success">Active</span></td>'
        + '<td>'
        + '<button class="btn btn-sm btn-outline-danger" data-action="deallocate-student" data-id="' + a.id + '" data-student="' + Utils.escapeHtml(getStudentName(a.studentId)) + '">Deallocate</button>'
        + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">Showing ' + activeAllocations.length + ' allocation' + (activeAllocations.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Attendance Tab                                                     */
  /* ================================================================== */

  function renderAttendanceTab() {
    var todayStr = new Date().toISOString().split('T')[0];
    if (!_attDate) _attDate = todayStr;
    if (!_attBlockId && _blocks.length) _attBlockId = _blocks[0].id;

    var html = '<div class="card" style="padding:14px 20px;margin-bottom:20px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">';

    html += '<div style="min-width:180px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Block</label>'
      + '<select class="form-control form-control-sm" id="hostel-att-block" style="font-size:13px">'
      + '<option value="">Select Block</option>';
    _blocks.forEach(function (b) {
      html += optionTag(b.id, b.name, _attBlockId === b.id);
    });
    html += '</select></div>';

    html += '<div style="min-width:160px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Date</label>'
      + '<input type="date" class="form-control form-control-sm" id="hostel-att-date" value="' + _attDate + '" style="font-size:13px">'
      + '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:0">'
      + '<button class="btn btn-sm btn-outline-primary" data-action="mark-all-present">Mark All Present</button>'
      + '<button class="btn btn-sm btn-primary" data-action="save-attendance">Save Attendance</button>'
      + '</div>';

    html += '</div></div>';

    // Get students allocated to selected block
    var blockAllocations = _allocations.filter(function (a) {
      if (a.status !== 'Active') return false;
      if (!_attBlockId) return false;
      var room = _rooms.find(function (r) { return r.id === a.roomId; });
      return room && room.blockId === _attBlockId;
    });

    if (!_attBlockId) {
      html += emptyState('\uD83C\uDFE0', 'Select a Block', 'Choose a hostel block to record attendance.');
      return html;
    }

    if (!blockAllocations.length) {
      html += emptyState('\uD83D\uDC64', 'No Students', 'No students allocated to this block.');
      return html;
    }

    // Check for existing attendance records
    var existingRecords = {};
    _attendance.forEach(function (rec) {
      if (rec.date === _attDate && rec.blockId === _attBlockId) {
        existingRecords[rec.studentId] = rec;
      }
    });

    html += '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:600px">'
      + '<thead><tr>'
      + '<th>Student Name</th>'
      + '<th>Room</th>'
      + '<th>Status</th>'
      + '<th>Note</th>'
      + '</tr></thead><tbody>';

    blockAllocations.forEach(function (a) {
      var existing = existingRecords[a.studentId];
      var room = _rooms.find(function (r) { return r.id === a.roomId; });
      var roomNumber = room ? room.roomNumber : '\u2014';
      var currentStatus = existing ? (existing.status || 'Present') : 'Present';
      var currentNote = existing ? (existing.note || '') : '';

      html += '<tr>'
        + '<td><strong>' + Utils.escapeHtml(getStudentName(a.studentId)) + '</strong></td>'
        + '<td>' + Utils.escapeHtml(roomNumber) + '</td>'
        + '<td>'
        + '<select class="form-control form-control-sm att-status" data-student-id="' + (a.studentId) + '" style="min-width:120px;font-size:13px">'
        + '<option value="Present"' + (currentStatus === 'Present' ? ' selected' : '') + '>Present</option>'
        + '<option value="Absent"' + (currentStatus === 'Absent' ? ' selected' : '') + '>Absent</option>'
        + '</select></td>'
        + '<td>'
        + '<input type="text" class="form-control form-control-sm att-note" data-student-id="' + (a.studentId) + '" value="' + Utils.escapeHtml(currentNote) + '" placeholder="Optional note..." style="font-size:13px">'
        + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">' + blockAllocations.length + ' student' + (blockAllocations.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Visitors Tab                                                       */
  /* ================================================================== */

  function renderVisitorsTab() {
    var html = '';

    if (!_visitors.length) {
      html = emptyState('\uD83D\uDC65', 'No Visitors', 'No visitor records yet. Click "Record Visitor" to start.');
      return html;
    }

    html += '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:800px">'
      + '<thead><tr>'
      + '<th>Visitor</th>'
      + '<th>Student</th>'
      + '<th>Relation</th>'
      + '<th>Purpose</th>'
      + '<th>Check-in</th>'
      + '<th>Check-out</th>'
      + '<th>Status</th>'
      + '<th>Actions</th>'
      + '</tr></thead><tbody>';

    _visitors.forEach(function (v) {
      var statusHtml = v.checkOut
        ? '<span class="badge badge-default">Out</span>'
        : '<span class="badge badge-success">In</span>';

      html += '<tr>'
        + '<td><strong>' + Utils.escapeHtml(v.visitorName || '\u2014') + '</strong></td>'
        + '<td>' + Utils.escapeHtml(v.studentName || '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(v.relation || '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(v.purpose || '\u2014') + '</td>'
        + '<td>' + (v.checkIn ? Utils.formatDate(v.checkIn) : '\u2014') + '</td>'
        + '<td>' + (v.checkOut ? Utils.formatDate(v.checkOut) : '\u2014') + '</td>'
        + '<td>' + statusHtml + '</td>'
        + '<td>'
        + (!v.checkOut
          ? '<button class="btn btn-sm btn-warning" data-action="check-out-visitor" data-id="' + v.id + '">Check Out</button>'
          : '<span style="color:var(--gray-400);font-size:12px">\u2014</span>')
        + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">Showing ' + _visitors.length + ' visitor' + (_visitors.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Add Block Modal                                                    */
  /* ================================================================== */

  function openAddBlockModal() {
    var formHtml = '<form id="hostel-block-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Block Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="name" required placeholder="e.g., Block A, Boys Hostel">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Type <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="type" required>'
      + '<option value="Male">Male</option>'
      + '<option value="Female">Female</option>'
      + '<option value="Mixed">Mixed</option>'
      + '</select></div>'
      + '<div class="form-group">'
      + '<label class="form-label">Description</label>'
      + '<textarea class="form-control" name="description" rows="2" placeholder="Optional description..."></textarea>'
      + '</div>'
      + '</form>';

    Modal.open({
      title: 'Add Hostel Block',
      content: formHtml,
      size: 'sm',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="hostel-save-block-btn">Add Block</button>'
    });

    setTimeout(function () {
      var btn = document.getElementById('hostel-save-block-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var form = document.getElementById('hostel-block-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var blockData = {
            schoolId: getSchoolId(),
            name: fd.get('name'),
            type: fd.get('type'),
            description: fd.get('description'),
            timestamp: Date.now()
          };

          DataService.add('hostelBlocks', blockData).then(function () {
            Modal.close();
            Toast.success('Block added.');
            DataService.logAction('hostel_add_block', 'Added hostel block: ' + blockData.name);
            loadHostelData().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error adding block:', err);
            Toast.error('Failed to add block.');
          });
        });
      }
    }, 50);
  }

  /* ================================================================== */
  /*  Add Room Modal                                                     */
  /* ================================================================== */

  function openAddRoomModal(blockId) {
    var block = _blocks.find(function (b) { return b.id === blockId; });
    var blockName = block ? block.name : '';

    var formHtml = '<form id="hostel-room-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Room Number <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="roomNumber" required placeholder="e.g., 101, A1">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Bed Capacity <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="number" class="form-control" name="bedCapacity" value="4" required min="1" max="20">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Room Type</label>'
      + '<input type="text" class="form-control" name="roomType" placeholder="e.g., Single, Double, Dormitory">'
      + '</div>'
      + '</form>';

    Modal.open({
      title: 'Add Room to ' + Utils.escapeHtml(blockName),
      content: formHtml,
      size: 'sm',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="hostel-save-room-btn">Add Room</button>'
    });

    setTimeout(function () {
      var btn = document.getElementById('hostel-save-room-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var form = document.getElementById('hostel-room-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);

          // Check for duplicate room number in this block
          var roomNumber = fd.get('roomNumber');
          var duplicate = _rooms.find(function (r) {
            return r.blockId === blockId && r.roomNumber === roomNumber;
          });
          if (duplicate) {
            Toast.error('Room number "' + roomNumber + '" already exists in this block.');
            return;
          }

          var roomData = {
            schoolId: getSchoolId(),
            blockId: blockId,
            roomNumber: roomNumber,
            bedCapacity: parseInt(fd.get('bedCapacity')) || 4,
            roomType: fd.get('roomType'),
            timestamp: Date.now()
          };

          DataService.add('hostelRooms', roomData).then(function () {
            Modal.close();
            Toast.success('Room added.');
            DataService.logAction('hostel_add_room', 'Added room ' + roomData.roomNumber + ' to ' + blockName);
            loadHostelData().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error adding room:', err);
            Toast.error('Failed to add room.');
          });
        });
      }
    }, 50);
  }

  /* ================================================================== */
  /*  Allocate Student Modal                                             */
  /* ================================================================== */

  function openAllocateStudentModal() {
    // Get unallocated students
    var allocatedIds = _allocations.filter(function (a) { return a.status === 'Active'; }).map(function (a) { return a.studentId; });

    var formHtml = '<form id="hostel-allocate-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Student <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="studentId" id="hostel-alloc-student" required>'
      + '<option value="">Select Student</option>';
    _students.forEach(function (s) {
      if (allocatedIds.indexOf(s.uid || s.id) !== -1) return;
      var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
      formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + '</option>';
    });
    formHtml += '</select></div>';

    // Block
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Block <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="blockId" id="hostel-alloc-block" required>'
      + '<option value="">Select Block</option>';
    _blocks.forEach(function (b) {
      formHtml += '<option value="' + b.id + '">' + Utils.escapeHtml(b.name) + '</option>';
    });
    formHtml += '</select></div>';

    // Room (dynamically populated)
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Room <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="roomId" id="hostel-alloc-room" required>'
      + '<option value="">Select Block first</option>'
      + '</select></div>';

    // Bed
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Bed Number</label>'
      + '<select class="form-control" name="bedNumber" id="hostel-alloc-bed">'
      + '<option value="">Auto-assign</option>'
      + '</select></div>';

    formHtml += '</form>';

    Modal.open({
      title: 'Allocate Student',
      content: formHtml,
      size: 'sm',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="hostel-save-alloc-btn">Allocate</button>'
    });

    setTimeout(function () {
      var blockSelect = document.getElementById('hostel-alloc-block');
      var roomSelect = document.getElementById('hostel-alloc-room');
      var bedSelect = document.getElementById('hostel-alloc-bed');

      function updateRooms() {
        var blockId = blockSelect.value;
        roomSelect.innerHTML = '<option value="">Select Room</option>';
        bedSelect.innerHTML = '<option value="">Auto-assign</option>';
        if (!blockId) return;
        var rooms = getBlockRooms(blockId);
        rooms.forEach(function (r) {
          var avail = getAvailableBeds(r);
          if (avail > 0) {
            roomSelect.innerHTML += '<option value="' + r.id + '">' + Utils.escapeHtml(r.roomNumber || r.id) + ' (' + avail + ' beds free)</option>';
          }
        });
      }

      function updateBeds() {
        var roomId = roomSelect.value;
        bedSelect.innerHTML = '<option value="">Auto-assign</option>';
        if (!roomId) return;
        var nextBed = getNextAvailableBed(roomId);
        if (nextBed) {
          bedSelect.innerHTML += '<option value="' + nextBed + '" selected>Bed ' + nextBed + '</option>';
        }
      }

      if (blockSelect) blockSelect.addEventListener('change', updateRooms);
      if (roomSelect) roomSelect.addEventListener('change', updateBeds);

      // Save
      var saveBtn = document.getElementById('hostel-save-alloc-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('hostel-allocate-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var roomId = fd.get('roomId');
          var bedNumber = parseInt(fd.get('bedNumber')) || getNextAvailableBed(roomId);

          if (!bedNumber) {
            Toast.error('No available beds in this room.');
            return;
          }

          var allocData = {
            schoolId: getSchoolId(),
            studentId: fd.get('studentId'),
            roomId: roomId,
            bedNumber: bedNumber,
            dateAllocated: new Date().toISOString().split('T')[0],
            allocatedBy: getUid(),
            status: 'Active',
            timestamp: Date.now()
          };

          DataService.add('hostelAllocations', allocData).then(function () {
            Modal.close();
            Toast.success('Student allocated.');
            DataService.logAction('hostel_allocate', 'Allocated ' + getStudentName(allocData.studentId) + ' to room in block ' + getBlockName(blockSelect.value));
            loadHostelData().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error allocating student:', err);
            Toast.error('Failed to allocate student.');
          });
        });
      }
    }, 50);
  }

  /* ================================================================== */
  /*  Record Visitor Modal                                               */
  /* ================================================================== */

  function openRecordVisitorModal() {
    var now = new Date();
    var timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    var todayStr = now.toISOString().split('T')[0];

    var formHtml = '<form id="hostel-visitor-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Visitor Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="visitorName" required placeholder="Full name of visitor">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Relation to Student <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="relation" required placeholder="e.g., Parent, Guardian, Sibling">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Student Name <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="studentName" id="hostel-visitor-student" required>'
      + '<option value="">Select Student</option>';
    // Only show allocated students
    var allocatedIds = _allocations.filter(function (a) { return a.status === 'Active'; }).map(function (a) { return a.studentId; });
    _students.forEach(function (s) {
      if (allocatedIds.indexOf(s.uid || s.id) === -1) return;
      var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
      formHtml += '<option value="' + Utils.escapeHtml(name) + '">' + Utils.escapeHtml(name) + '</option>';
    });
    formHtml += '</select></div>'
      + '<div class="form-group">'
      + '<label class="form-label">Purpose <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="purpose" required placeholder="e.g., Visit, Deliver items">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Check-in Time</label>'
      + '<input type="time" class="form-control" name="checkInTime" value="' + timeStr + '">'
      + '</div>'
      + '</form>';

    Modal.open({
      title: 'Record Visitor',
      content: formHtml,
      size: 'sm',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="hostel-save-visitor-btn">Record Visit</button>'
    });

    setTimeout(function () {
      var btn = document.getElementById('hostel-save-visitor-btn');
      if (btn) {
        btn.addEventListener('click', function () {
          var form = document.getElementById('hostel-visitor-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var visitorData = {
            schoolId: getSchoolId(),
            visitorName: fd.get('visitorName'),
            relation: fd.get('relation'),
            studentName: fd.get('studentName'),
            purpose: fd.get('purpose'),
            checkIn: todayStr + 'T' + (fd.get('checkInTime') || timeStr),
            checkOut: '',
            status: 'In',
            timestamp: Date.now()
          };

          DataService.add('hostelVisitors', visitorData).then(function () {
            Modal.close();
            Toast.success('Visitor recorded.');
            DataService.logAction('hostel_visitor', 'Visitor ' + visitorData.visitorName + ' checked in for ' + visitorData.studentName);
            loadHostelData().then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error recording visitor:', err);
            Toast.error('Failed to record visitor.');
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
          _activeTab = tab || 'blocks';
          var container = document.getElementById('main-content');
          if (container) container.innerHTML = renderMainView();
          bindEvents();
          break;

        case 'add-block':
          e.preventDefault();
          e.stopPropagation();
          openAddBlockModal();
          break;

        case 'select-block':
          e.preventDefault();
          e.stopPropagation();
          _selectedBlockId = (_selectedBlockId === id) ? '' : id;
          var c1 = document.getElementById('main-content');
          if (c1) c1.innerHTML = renderMainView();
          bindEvents();
          break;

        case 'add-room':
          e.preventDefault();
          e.stopPropagation();
          openAddRoomModal(id);
          break;

        case 'delete-room':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Delete this room? Allocated students will be deallocated.').then(function (confirmed) {
            if (confirmed) {
              // Deallocate students in this room
              var roomAllocs = _allocations.filter(function (a) { return a.roomId === id && a.status === 'Active'; });
              var promises = roomAllocs.map(function (a) {
                return DataService.update('hostelAllocations', getSchoolId(), a.id, { status: 'Deallocated' });
              });
              Promise.all(promises).then(function () {
                return DataService.remove('hostelRooms', getSchoolId(), id);
              }).then(function () {
                Toast.success('Room deleted.');
                DataService.logAction('hostel_delete_room', 'Deleted room ' + id);
                loadHostelData().then(function () {
                  var c = document.getElementById('main-content');
                  if (c) c.innerHTML = renderMainView();
                  bindEvents();
                });
              });
            }
          });
          break;

        case 'allocate-student':
          e.preventDefault();
          e.stopPropagation();
          openAllocateStudentModal();
          break;

        case 'deallocate-student':
          e.preventDefault();
          e.stopPropagation();
          var studentName = btn.dataset.student || 'Student';
          Modal.confirm('Deallocate ' + studentName + ' from their hostel room?').then(function (confirmed) {
            if (confirmed) {
              DataService.update('hostelAllocations', getSchoolId(), id, { status: 'Deallocated' }).then(function () {
                Toast.success('Student deallocated.');
                DataService.logAction('hostel_deallocate', 'Deallocated student from allocation ' + id);
                loadHostelData().then(function () {
                  var c = document.getElementById('main-content');
                  if (c) c.innerHTML = renderMainView();
                  bindEvents();
                });
              });
            }
          });
          break;

        case 'clear-alloc-filters':
          e.preventDefault();
          e.stopPropagation();
          _allocFilterBlock = '';
          _allocFilterRoom = '';
          var c2 = document.getElementById('main-content');
          if (c2) c2.innerHTML = renderMainView();
          bindEvents();
          break;

        case 'mark-all-present':
          e.preventDefault();
          e.stopPropagation();
          document.querySelectorAll('.att-status').forEach(function (sel) {
            sel.value = 'Present';
          });
          Toast.info('All students marked as present. Click "Save Attendance" to confirm.');
          break;

        case 'save-attendance':
          e.preventDefault();
          e.stopPropagation();
          var blockId = document.getElementById('hostel-att-block');
          var dateInput = document.getElementById('hostel-att-date');
          if (!blockId || !blockId.value) {
            Toast.error('Please select a block.');
            return;
          }
          var attBlockId = blockId.value;
          var attDate = dateInput ? dateInput.value : '';

          var statusSelects = document.querySelectorAll('.att-status');
          var noteInputs = document.querySelectorAll('.att-note');
          var records = [];
          statusSelects.forEach(function (sel, idx) {
            var studentId = sel.dataset.studentId;
            var status = sel.value;
            var note = noteInputs[idx] ? noteInputs[idx].value : '';
            records.push({
              schoolId: getSchoolId(),
              blockId: attBlockId,
              studentId: studentId,
              date: attDate,
              status: status,
              note: note,
              recordedBy: getUid(),
              timestamp: Date.now()
            });
          });

          // Remove existing records for this block/date
          var existing = _attendance.filter(function (a) { return a.date === attDate && a.blockId === attBlockId; });
          var removePromises = existing.map(function (a) {
            return DataService.remove('hostelAttendance', getSchoolId(), a.id);
          });

          Promise.all(removePromises).then(function () {
            var addPromises = records.map(function (r) {
              return DataService.add('hostelAttendance', r);
            });
            return Promise.all(addPromises);
          }).then(function () {
            Toast.success('Attendance saved for ' + records.length + ' students.');
            DataService.logAction('hostel_attendance', 'Saved hostel attendance for ' + attDate + ' in block ' + getBlockName(attBlockId));
            loadHostelData().then(function () {
              var c = document.getElementById('main-content');
              if (c) c.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error saving attendance:', err);
            Toast.error('Failed to save attendance.');
          });
          break;

        case 'record-visitor':
          e.preventDefault();
          e.stopPropagation();
          openRecordVisitorModal();
          break;

        case 'check-out-visitor':
          e.preventDefault();
          e.stopPropagation();
          var now = new Date();
          var checkOutStr = now.toISOString().split('T')[0] + 'T' + now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
          DataService.update('hostelVisitors', getSchoolId(), id, {
            checkOut: checkOutStr,
            status: 'Out'
          }).then(function () {
            Toast.success('Visitor checked out.');
            DataService.logAction('hostel_visitor_checkout', 'Checked out visitor ' + id);
            loadHostelData().then(function () {
              var c = document.getElementById('main-content');
              if (c) c.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function () {
            Toast.error('Failed to check out visitor.');
          });
          break;
      }
    };

    document.addEventListener('click', _clickHandler);

    // Allocation filter handlers
    _changeHandler = function (e) {
      var el = e.target;
      if (!el) return;

      if (el.dataset.allocFilter === 'blockId') {
        _allocFilterBlock = el.value;
        _allocFilterRoom = '';
        var container = document.getElementById('main-content');
        if (container) container.innerHTML = renderMainView();
        bindEvents();
      } else if (el.dataset.allocFilter === 'roomId') {
        _allocFilterRoom = el.value;
        var container = document.getElementById('main-content');
        if (container) container.innerHTML = renderMainView();
        bindEvents();
      }

      // Attendance block/date changes
      if (el.id === 'hostel-att-block') {
        _attBlockId = el.value;
        var container = document.getElementById('main-content');
        if (container) container.innerHTML = renderMainView();
        bindEvents();
      }
      if (el.id === 'hostel-att-date') {
        _attDate = el.value;
      }
    };

    _inputHandler = Utils.debounce(function (e) {
      // Reserved for future search filtering
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

  window.Modules.hostel = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('hostel');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Hostel' }
      ]);
      _activeTab = 'blocks';
      _selectedBlockId = '';
      _attBlockId = '';
      _attDate = '';
      _allocFilterBlock = '';
      _allocFilterRoom = '';
      render();
    },

    destroy: function () {
      cleanup();
      _blocks = [];
      _rooms = [];
      _allocations = [];
      _attendance = [];
      _visitors = [];
      _students = [];
      _activeTab = 'blocks';
      _selectedBlockId = '';
      _attBlockId = '';
      _attDate = '';
      _allocFilterBlock = '';
      _allocFilterRoom = '';
    }
  };
})();