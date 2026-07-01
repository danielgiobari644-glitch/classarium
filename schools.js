/**
 * Classarium Schools Module
 * Super admin school management — list, search, filter, approve, suspend, reactivate, delete.
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

  var _allSchools = [];
  var _filter = { search: '', status: 'all', type: 'all' };
  var _listener = null;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function statusBadge(status) {
    var map = {
      pending_approval: { text: 'Pending Approval', cls: 'warning' },
      active: { text: 'Active', cls: 'success' },
      suspended: { text: 'Suspended', cls: 'danger' }
    };
    var s = map[status] || { text: status || 'Unknown', cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function typeBadge(type) {
    var map = {
      primary: 'Primary',
      secondary: 'Secondary',
      tertiary: 'Tertiary',
      mixed: 'Mixed',
      nursery: 'Nursery'
    };
    return '<span class="badge badge-default">' + (map[type] || Utils.capitalize(type || 'N/A')) + '</span>';
  }

  function getFiltered() {
    return _allSchools.filter(function (s) {
      var q = _filter.search.toLowerCase();
      var matchSearch = !q
        || (s.name || '').toLowerCase().indexOf(q) !== -1
        || (s.location || '').toLowerCase().indexOf(q) !== -1
        || (s.email || '').toLowerCase().indexOf(q) !== -1
        || (s.state || '').toLowerCase().indexOf(q) !== -1;
      var matchStatus = _filter.status === 'all' || s.status === _filter.status;
      var matchType = _filter.type === 'all' || s.type === _filter.type;
      return matchSearch && matchStatus && matchType;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="schools-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Schools Management</h1>'
      + '<p class="page-header-description">Manage all registered schools on the platform</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-primary" data-action="add-school">Add School</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Summary stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div id="schools-stat-total" class="stat-card"><div class="stat-card-icon" style="background:var(--primary-50);color:var(--primary-600)">🏫</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Schools</div></div>'
      + '<div id="schools-stat-active" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Active</div></div>'
      + '<div id="schools-stat-pending" class="stat-card"><div class="stat-card-icon" style="background:#FFFBEB;color:#D97706">⏳</div><div class="stat-card-value">--</div><div class="stat-card-label">Pending Approval</div></div>'
      + '<div id="schools-stat-suspended" class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">🚫</div><div class="stat-card-value">--</div><div class="stat-card-label">Suspended</div></div>'
      + '</div>';

    // Filters
    html += '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-body">'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'
      + '<div style="flex:1;min-width:200px">'
      + '<input type="text" id="schools-search" class="form-input" placeholder="Search schools by name, location, email..." value="' + (_filter.search || '') + '" style="width:100%">'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<select id="schools-filter-status" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.status === 'all' ? ' selected' : '') + '>All Statuses</option>'
      + '<option value="pending_approval"' + (_filter.status === 'pending_approval' ? ' selected' : '') + '>Pending Approval</option>'
      + '<option value="active"' + (_filter.status === 'active' ? ' selected' : '') + '>Active</option>'
      + '<option value="suspended"' + (_filter.status === 'suspended' ? ' selected' : '') + '>Suspended</option>'
      + '</select>'
      + '</div>'
      + '<div style="min-width:160px">'
      + '<select id="schools-filter-type" class="form-select" style="width:100%">'
      + '<option value="all"' + (_filter.type === 'all' ? ' selected' : '') + '>All Types</option>'
      + '<option value="primary"' + (_filter.type === 'primary' ? ' selected' : '') + '>Primary</option>'
      + '<option value="secondary"' + (_filter.type === 'secondary' ? ' selected' : '') + '>Secondary</option>'
      + '<option value="tertiary"' + (_filter.type === 'tertiary' ? ' selected' : '') + '>Tertiary</option>'
      + '<option value="mixed"' + (_filter.type === 'mixed' ? ' selected' : '') + '>Mixed</option>'
      + '<option value="nursery"' + (_filter.type === 'nursery' ? ' selected' : '') + '>Nursery</option>'
      + '</select>'
      + '</div>'
      + '<button class="btn btn-ghost btn-sm" data-action="clear-filters">Clear Filters</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Table
    html += '<div class="card">'
      + '<div class="card-header"><h3 class="card-title">All Schools</h3>'
      + '<div class="card-header-actions">'
      + '<button class="btn btn-ghost btn-sm" data-action="export-schools">Export CSV</button>'
      + '</div>'
      + '</div>'
      + '<div class="card-body" style="padding:0">'
      + '<div class="data-table-wrapper">'
      + '<table class="data-table" id="schools-table">'
      + '<thead>'
      + '<tr>'
      + '<th style="width:25%">Name</th>'
      + '<th style="width:12%">Type</th>'
      + '<th style="width:18%">Location</th>'
      + '<th style="width:12%">Status</th>'
      + '<th style="width:13%">Created</th>'
      + '<th style="width:20%;text-align:right">Actions</th>'
      + '</tr>'
      + '</thead>'
      + '<tbody id="schools-tbody">'
      + '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400)">Loading schools...</td></tr>'
      + '</tbody>'
      + '</table>'
      + '</div>'
      + '</div>'
      + '</div>';

    html += '</div>'; // schools-page
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Table Rendering                                                   */
  /* ------------------------------------------------------------------ */

  function renderTable() {
    var tbody = document.getElementById('schools-tbody');
    if (!tbody) return;

    var filtered = getFiltered();

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">'
        + '<div class="empty-state"><div class="empty-state-icon">🏫</div>'
        + '<h3 class="empty-state-title">No schools found</h3>'
        + '<p class="empty-state-description">' + (_filter.search || _filter.status !== 'all' || _filter.type !== 'all' ? 'Try adjusting your search or filters.' : 'No schools have been registered yet.') + '</p>'
        + '</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (school) {
      var id = school.id || '';
      var status = school.status || 'pending_approval';
      var actions = '';

      // Approve
      if (status === 'pending_approval') {
        actions += '<button class="btn btn-sm btn-primary" data-action="approve" data-id="' + id + '" title="Approve">Approve</button> ';
      }

      // Suspend
      if (status === 'active') {
        actions += '<button class="btn btn-sm btn-ghost" style="color:var(--warning-600)" data-action="suspend" data-id="' + id + '" title="Suspend">Suspend</button> ';
      }

      // Reactivate
      if (status === 'suspended') {
        actions += '<button class="btn btn-sm btn-ghost" style="color:var(--success-600)" data-action="reactivate" data-id="' + id + '" title="Reactivate">Reactivate</button> ';
      }

      // View
      actions += '<button class="btn btn-sm btn-ghost" data-action="view" data-id="' + id + '" title="View">View</button> ';

      // Delete
      actions += '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="delete" data-id="' + id + '" title="Delete">Delete</button>';

      var location = [school.city, school.state, school.country].filter(Boolean).join(', ') || (school.location || '—');

      return '<tr data-school-id="' + id + '">'
        + '<td>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '<div class="avatar" style="width:36px;height:36px;flex-shrink:0;font-size:12px">' + Utils.getInitials(school.name || 'S') + '</div>'
        + '<div>'
        + '<div style="font-weight:500;font-size:14px">' + (school.name || '—') + '</div>'
        + (school.email ? '<div style="font-size:12px;color:var(--gray-500)">' + school.email + '</div>' : '')
        + '</div>'
        + '</div>'
        + '</td>'
        + '<td>' + typeBadge(school.type) + '</td>'
        + '<td><span style="font-size:14px;color:var(--gray-600)">' + location + '</span></td>'
        + '<td>' + statusBadge(status) + '</td>'
        + '<td><span style="font-size:13px;color:var(--gray-500)">' + (school.createdAt ? Utils.formatDate(school.createdAt) : '—') + '</span></td>'
        + '<td style="text-align:right">'
        + '<div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">' + actions + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Update Stats                                                      */
  /* ------------------------------------------------------------------ */

  function updateStats() {
    var total = _allSchools.length;
    var active = _allSchools.filter(function (s) { return s.status === 'active'; }).length;
    var pending = _allSchools.filter(function (s) { return s.status === 'pending_approval'; }).length;
    var suspended = _allSchools.filter(function (s) { return s.status === 'suspended'; }).length;

    var el;
    el = document.getElementById('schools-stat-total');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(total);
    el = document.getElementById('schools-stat-active');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(active);
    el = document.getElementById('schools-stat-pending');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(pending);
    el = document.getElementById('schools-stat-suspended');
    if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(suspended);
  }

  /* ------------------------------------------------------------------ */
  /*  Actions                                                           */
  /* ------------------------------------------------------------------ */

  function approveSchool(id) {
    var school = _allSchools.find(function (s) { return s.id === id; });
    if (!school) return;
    Modal.confirm(
      'Approve School',
      'Are you sure you want to approve <strong>' + (school.name || 'this school') + '</strong>? The school admin will be notified.',
      function () {
        Toast.info('Approving school...');
        DataService.update('schools', id, { status: 'active' }).then(function () {
          Toast.success('School approved successfully');
          DataService.logAction('school_approved', 'schools', id, { schoolName: school.name });
        }).catch(function (err) {
          Toast.error('Failed to approve school: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  function suspendSchool(id) {
    var school = _allSchools.find(function (s) { return s.id === id; });
    if (!school) return;
    Modal.confirm(
      'Suspend School',
      'Are you sure you want to suspend <strong>' + (school.name || 'this school') + '</strong>? The school will lose access to the platform.',
      function () {
        Toast.info('Suspending school...');
        DataService.update('schools', id, { status: 'suspended' }).then(function () {
          Toast.success('School suspended successfully');
          DataService.logAction('school_suspended', 'schools', id, { schoolName: school.name });
        }).catch(function (err) {
          Toast.error('Failed to suspend school: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  function reactivateSchool(id) {
    var school = _allSchools.find(function (s) { return s.id === id; });
    if (!school) return;
    Modal.confirm(
      'Reactivate School',
      'Are you sure you want to reactivate <strong>' + (school.name || 'this school') + '</strong>?',
      function () {
        Toast.info('Reactivating school...');
        DataService.update('schools', id, { status: 'active' }).then(function () {
          Toast.success('School reactivated successfully');
          DataService.logAction('school_reactivated', 'schools', id, { schoolName: school.name });
        }).catch(function (err) {
          Toast.error('Failed to reactivate school: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  function deleteSchool(id) {
    var school = _allSchools.find(function (s) { return s.id === id; });
    if (!school) return;
    Modal.confirm(
      'Delete School',
      '<span style="color:var(--danger-600);font-weight:600">Warning:</span> Are you sure you want to permanently delete <strong>' + (school.name || 'this school') + '</strong>? This action cannot be undone. All associated data will be removed.',
      function () {
        Toast.info('Deleting school...');
        DataService.remove('schools', id).then(function () {
          Toast.success('School deleted successfully');
          DataService.logAction('school_deleted', 'schools', id, { schoolName: school.name });
        }).catch(function (err) {
          Toast.error('Failed to delete school: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  function exportSchools() {
    var filtered = getFiltered();
    if (!filtered.length) {
      Toast.warning('No schools to export.');
      return;
    }
    var data = filtered.map(function (s) {
      return {
        Name: s.name || '',
        Type: s.type || '',
        Location: [s.city, s.state, s.country].filter(Boolean).join(', ') || (s.location || ''),
        Email: s.email || '',
        Phone: s.phone || '',
        Status: s.status || '',
        'Created At': s.createdAt ? Utils.formatDate(s.createdAt) : ''
      };
    });
    Utils.exportCSV(data, 'schools-export');
    Toast.success('Schools exported successfully');
    DataService.logAction('schools_exported', 'schools', null, { count: data.length });
  }

  /* ------------------------------------------------------------------ */
  /*  Bind Events                                                       */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    var searchInput = document.getElementById('schools-search');
    var statusSelect = document.getElementById('schools-filter-status');
    var typeSelect = document.getElementById('schools-filter-type');

    // Search with debounce
    if (searchInput) {
      var debouncedSearch = Utils.debounce(function (val) {
        _filter.search = val;
        renderTable();
      }, 300);
      searchInput.addEventListener('input', function () {
        debouncedSearch(this.value);
      });
    }

    // Status filter
    if (statusSelect) {
      statusSelect.addEventListener('change', function () {
        _filter.status = this.value;
        renderTable();
      });
    }

    // Type filter
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        _filter.type = this.value;
        renderTable();
      });
    }

    // Click delegation for table actions and header actions
    document.addEventListener('click', _clickHandler);
  }

  function _clickHandler(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;

    var action = btn.dataset.action;
    var id = btn.dataset.id;

    switch (action) {
      case 'approve':
        e.preventDefault();
        approveSchool(id);
        break;
      case 'suspend':
        e.preventDefault();
        suspendSchool(id);
        break;
      case 'reactivate':
        e.preventDefault();
        reactivateSchool(id);
        break;
      case 'delete':
        e.preventDefault();
        deleteSchool(id);
        break;
      case 'view':
        e.preventDefault();
        Router.navigate('/schools/' + id);
        break;
      case 'add-school':
        e.preventDefault();
        Router.navigate('/schools/new');
        break;
      case 'export-schools':
        e.preventDefault();
        exportSchools();
        break;
      case 'clear-filters':
        e.preventDefault();
        _filter = { search: '', status: 'all', type: 'all' };
        var searchEl = document.getElementById('schools-search');
        var statusEl = document.getElementById('schools-filter-status');
        var typeEl = document.getElementById('schools-filter-type');
        if (searchEl) searchEl.value = '';
        if (statusEl) statusEl.value = 'all';
        if (typeEl) typeEl.value = 'all';
        renderTable();
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading (real-time with onSnapshot)                           */
  /* ------------------------------------------------------------------ */

  function loadData() {
    // Use onSnapshot for real-time updates, fall back to getAllSchools
    if (typeof DataService.onSnapshot === 'function') {
      _listener = DataService.onSnapshot('schools', function (schools) {
        _allSchools = schools || [];
        updateStats();
        renderTable();
      });
    }

    // If onSnapshot doesn't trigger or as a fallback, load once
    if (DataService.getAllSchools) {
      DataService.getAllSchools().then(function (schools) {
        _allSchools = schools || [];
        updateStats();
        renderTable();
      }).catch(function (err) {
        Toast.error('Failed to load schools: ' + (err.message || 'Unknown error'));
        var tbody = document.getElementById('schools-tbody');
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">'
            + '<div class="empty-state"><div class="empty-state-icon">⚠️</div>'
            + '<h3 class="empty-state-title">Error loading schools</h3>'
            + '<p class="empty-state-description">Please try again or contact support.</p>'
            + '</div></td></tr>';
        }
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules.schools = {
    render: function () {
      // Update sidebar and breadcrumb
      if (window.SidebarComponent) window.SidebarComponent.setActive('schools');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'Admin' },
        { label: 'Schools' }
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
      // Remove click listener
      document.removeEventListener('click', _clickHandler);

      // Unsubscribe from real-time listener
      if (_listener && typeof _listener === 'function') {
        _listener();
        _listener = null;
      }

      _allSchools = [];
      _filter = { search: '', status: 'all', type: 'all' };
    }
  };
})();