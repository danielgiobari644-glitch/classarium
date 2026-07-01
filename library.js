/**
 * Classarium Library Management Module
 * Manage library book catalog, borrowing/return/reserve transactions,
 * and a dashboard with key metrics.
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

  var _books = [];
  var _transactions = [];
  var _students = [];
  var _staff = [];
  var _listeners = [];
  var _clickHandler = null;
  var _inputHandler = null;
  var _changeHandler = null;

  var _activeTab = 'catalog';
  var _filter = {
    search: '',
    category: '',
    availability: ''
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

  function getPersonName(id) {
    var s = _students.find(function (x) { return x.id === id || x.uid === id; });
    if (s) return s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ') || '\u2014';
    var st = _staff.find(function (x) { return x.id === id || x.uid === id; });
    if (st) return st.displayName || [st.firstName, st.middleName, st.surname].filter(Boolean).join(' ') || '\u2014';
    return id || '\u2014';
  }

  function getBookTitle(id) {
    var b = _books.find(function (x) { return x.id === id; });
    return b ? (b.title || '\u2014') : '\u2014';
  }

  function getAvailableCopies(book) {
    var borrowed = _transactions.filter(function (t) {
      return t.bookId === book.id && (t.status === 'Active' || t.status === 'Overdue');
    }).length;
    var reserved = _transactions.filter(function (t) {
      return t.bookId === book.id && t.type === 'Reserve' && t.status === 'Active';
    }).length;
    return Math.max(0, (book.totalCopies || 0) - borrowed - reserved);
  }

  function isOverdue(tx) {
    if (tx.status !== 'Active' || tx.type !== 'Borrow') return false;
    if (!tx.dueDate) return false;
    return new Date(tx.dueDate) < new Date();
  }

  function getFilteredBooks() {
    return _books.filter(function (b) {
      if (_filter.search) {
        var q = _filter.search.toLowerCase();
        var match = (b.title || '').toLowerCase().indexOf(q) !== -1
          || (b.author || '').toLowerCase().indexOf(q) !== -1
          || (b.isbn || '').toLowerCase().indexOf(q) !== -1;
        if (!match) return false;
      }
      if (_filter.category && b.category !== _filter.category) return false;
      if (_filter.availability === 'available' && getAvailableCopies(b) <= 0) return false;
      if (_filter.availability === 'unavailable' && getAvailableCopies(b) > 0) return false;
      return true;
    });
  }

  function getFilteredTransactions() {
    return _transactions.filter(function (t) {
      if (_filter.search) {
        var q = _filter.search.toLowerCase();
        var bookTitle = getBookTitle(t.bookId).toLowerCase();
        var personName = getPersonName(t.memberId).toLowerCase();
        if (bookTitle.indexOf(q) === -1 && personName.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function getCategories() {
    var cats = {};
    _books.forEach(function (b) {
      if (b.category) cats[b.category] = true;
    });
    return Object.keys(cats).sort();
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    return Promise.all([
      DataService.getStudents(schoolId),
      DataService.getBySchool('staff', schoolId)
    ]).then(function (results) {
      _students = results[0] || [];
      _staff = results[1] || [];
    });
  }

  function loadBooks() {
    return DataService.getBySchool('libraryBooks', getSchoolId(), { orderBy: 'title' })
      .then(function (data) { _books = data || []; });
  }

  function loadTransactions() {
    return DataService.getBySchool('libraryTransactions', getSchoolId(), { orderBy: 'timestamp', orderDir: 'desc' })
      .then(function (data) { _transactions = data || []; });
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
      return Promise.all([loadBooks(), loadTransactions()]);
    }).then(function () {
      container.innerHTML = renderMainView();
      bindEvents();
    }).catch(function (err) {
      console.error('Error loading library module:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load library data. Please refresh.');
      Toast.error('Failed to load library data.');
    });
  }

  /* ================================================================== */
  /*  Main View                                                          */
  /* ================================================================== */

  function renderMainView() {
    var html = '<div class="library-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Library</h1>'
      + '<p class="page-header-description">Manage book catalog, transactions, and library resources</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + (_activeTab === 'catalog'
        ? '<button class="btn btn-primary" data-action="add-book">Add Book</button>'
        : (_activeTab === 'transactions'
          ? '<button class="btn btn-primary" data-action="new-transaction">New Transaction</button>'
          : ''))
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats
    var totalBooks = _books.reduce(function (sum, b) { return sum + (b.totalCopies || 0); }, 0);
    var availableBooks = _books.reduce(function (sum, b) { return sum + getAvailableCopies(b); }, 0);
    var borrowedCount = _transactions.filter(function (t) { return t.type === 'Borrow' && (t.status === 'Active' || t.status === 'Overdue'); }).length;
    var overdueCount = _transactions.filter(function (t) { return isOverdue(t); }).length;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83D\uDCDA', 'Total Books', totalBooks, 'var(--primary-600)');
    html += statCard('\u2705', 'Available', availableBooks, 'var(--success-600)');
    html += statCard('\uD83D\uDCE6', 'Borrowed', borrowedCount, 'var(--info-600)');
    html += statCard('\u26A0', 'Overdue', overdueCount, 'var(--danger-600)');
    html += '</div>';

    // Tabs
    html += '<div style="display:flex;border-bottom:2px solid var(--gray-200);margin-bottom:20px">'
      + tabButton('catalog', 'Catalog')
      + tabButton('transactions', 'Transactions')
      + tabButton('dashboard', 'Dashboard')
      + '</div>';

    // Filter bar (catalog and transactions)
    if (_activeTab === 'catalog') {
      html += renderCatalogFilterBar();
    } else if (_activeTab === 'transactions') {
      html += renderTransactionsFilterBar();
    }

    // Tab content
    if (_activeTab === 'catalog') {
      html += renderCatalogTab();
    } else if (_activeTab === 'transactions') {
      html += renderTransactionsTab();
    } else {
      html += renderDashboardTab();
    }

    html += '</div>';
    return html;
  }

  function tabButton(tab, label) {
    var isActive = _activeTab === tab;
    return '<button class="library-tab" data-action="switch-tab" data-tab="' + tab + '"'
      + ' style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;'
      + 'color:' + (isActive ? 'var(--primary-600)' : 'var(--gray-500)')
      + ';border-bottom:2px solid ' + (isActive ? 'var(--primary-600)' : 'transparent')
      + ';margin-bottom:-2px;transition:all 0.15s">' + label + '</button>';
  }

  /* ================================================================== */
  /*  Catalog Filter Bar                                                 */
  /* ================================================================== */

  function renderCatalogFilterBar() {
    var categories = getCategories();
    var html = '<div class="card" style="padding:14px 20px;margin-bottom:20px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">';

    html += '<div style="min-width:220px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Search</label>'
      + '<input type="text" class="form-control form-control-sm" data-filter="search" placeholder="Search by title, author, ISBN..." value="' + Utils.escapeHtml(_filter.search) + '" style="font-size:13px">'
      + '</div>';

    html += '<div style="min-width:160px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Category</label>'
      + '<select class="form-control form-control-sm" data-filter="category" style="font-size:13px">'
      + '<option value="">All Categories</option>';
    categories.forEach(function (c) {
      html += optionTag(c, c, _filter.category === c);
    });
    html += '</select></div>';

    html += '<div style="min-width:150px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Availability</label>'
      + '<select class="form-control form-control-sm" data-filter="availability" style="font-size:13px">'
      + '<option value="">All</option>'
      + '<option value="available"' + (_filter.availability === 'available' ? ' selected' : '') + '>Available</option>'
      + '<option value="unavailable"' + (_filter.availability === 'unavailable' ? ' selected' : '') + '>Unavailable</option>'
      + '</select></div>';

    html += '<button class="btn btn-outline-secondary btn-sm" data-action="clear-filters" style="margin-bottom:0;white-space:nowrap">Clear</button>';
    html += '</div></div>';
    return html;
  }

  /* ================================================================== */
  /*  Transactions Filter Bar                                            */
  /* ================================================================== */

  function renderTransactionsFilterBar() {
    var html = '<div class="card" style="padding:14px 20px;margin-bottom:20px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">';

    html += '<div style="min-width:220px;flex:1">'
      + '<label class="form-label" style="font-size:12px;margin-bottom:4px">Search</label>'
      + '<input type="text" class="form-control form-control-sm" data-filter="search" placeholder="Search by book or member name..." value="' + Utils.escapeHtml(_filter.search) + '" style="font-size:13px">'
      + '</div>';

    html += '<button class="btn btn-outline-secondary btn-sm" data-action="clear-filters" style="margin-bottom:0;white-space:nowrap">Clear</button>';
    html += '</div></div>';
    return html;
  }

  /* ================================================================== */
  /*  Catalog Tab                                                        */
  /* ================================================================== */

  function renderCatalogTab() {
    var filtered = getFilteredBooks();

    if (!filtered.length) {
      return emptyState('\uD83D\uDCDA', 'No Books Found', _books.length === 0
        ? 'No books in the catalog yet. Click "Add Book" to start.'
        : 'Try adjusting your filters.');
    }

    var html = '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:800px">'
      + '<thead><tr>'
      + '<th>Title</th>'
      + '<th>Author</th>'
      + '<th>ISBN</th>'
      + '<th>Category</th>'
      + '<th>Available</th>'
      + '<th>Total</th>'
      + '<th>Status</th>'
      + '<th>Actions</th>'
      + '</tr></thead><tbody>';

    filtered.forEach(function (b) {
      var avail = getAvailableCopies(b);
      var statusBadge = avail > 0
        ? '<span class="badge badge-success">Available</span>'
        : '<span class="badge badge-danger">Unavailable</span>';

      html += '<tr>'
        + '<td><strong>' + Utils.escapeHtml(b.title || '\u2014') + '</strong></td>'
        + '<td>' + Utils.escapeHtml(b.author || '\u2014') + '</td>'
        + '<td style="font-family:monospace;font-size:12px;color:var(--gray-500)">' + Utils.escapeHtml(b.isbn || '\u2014') + '</td>'
        + '<td>' + Utils.escapeHtml(b.category || '\u2014') + '</td>'
        + '<td style="font-weight:600;color:' + (avail > 0 ? 'var(--success-600)' : 'var(--danger-600)') + '">' + avail + '</td>'
        + '<td>' + (b.totalCopies || 0) + '</td>'
        + '<td>' + statusBadge + '</td>'
        + '<td>'
        + '<div style="display:flex;gap:6px">'
        + '<button class="btn btn-sm btn-outline-primary" data-action="edit-book" data-id="' + b.id + '" title="Edit">\u270F</button>'
        + '<button class="btn btn-sm btn-outline-danger" data-action="delete-book" data-id="' + b.id + '" title="Delete">\uD83D\uDDD1</button>'
        + '</div></td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">Showing ' + filtered.length + ' book' + (filtered.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Transactions Tab                                                   */
  /* ================================================================== */

  function renderTransactionsTab() {
    var filtered = getFilteredTransactions();

    if (!filtered.length) {
      return emptyState('\uD83D\uDCE6', 'No Transactions Found', _transactions.length === 0
        ? 'No library transactions yet. Click "New Transaction" to start.'
        : 'Try adjusting your filters.');
    }

    var html = '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
      + '<table class="table" style="min-width:900px">'
      + '<thead><tr>'
      + '<th>Book Title</th>'
      + '<th>Borrower Name</th>'
      + '<th>Type</th>'
      + '<th>Date</th>'
      + '<th>Due Date</th>'
      + '<th>Status</th>'
      + '<th>Actions</th>'
      + '</tr></thead><tbody>';

    filtered.forEach(function (t) {
      var typeBadge = '';
      if (t.type === 'Borrow') typeBadge = '<span class="badge badge-info">Borrow</span>';
      else if (t.type === 'Return') typeBadge = '<span class="badge badge-success">Return</span>';
      else if (t.type === 'Reserve') typeBadge = '<span class="badge badge-warning">Reserve</span>';
      else typeBadge = '<span class="badge badge-default">' + Utils.escapeHtml(t.type || '') + '</span>';

      var statusHtml = '';
      if (t.status === 'Active') statusHtml = '<span class="badge badge-info">Active</span>';
      else if (t.status === 'Returned') statusHtml = '<span class="badge badge-success">Returned</span>';
      else if (t.status === 'Overdue') statusHtml = '<span class="badge badge-danger">Overdue</span>';
      else statusHtml = '<span class="badge badge-default">' + Utils.escapeHtml(t.status || '') + '</span>';

      var actions = '';
      if (t.type === 'Borrow' && t.status === 'Active' && !isOverdue(t)) {
        actions += '<button class="btn btn-sm btn-success" data-action="return-book" data-id="' + t.id + '">Return</button> ';
      }
      if (t.type === 'Borrow' && t.status === 'Active') {
        // Allow return even if overdue
        if (isOverdue(t)) {
          actions += '<button class="btn btn-sm btn-danger" data-action="return-book" data-id="' + t.id + '">Return (Overdue)</button> ';
        }
      }
      if (t.type === 'Reserve' && t.status === 'Active') {
        actions += '<button class="btn btn-sm btn-outline-primary" data-action="cancel-reserve" data-id="' + t.id + '">Cancel</button>';
      }

      html += '<tr' + (isOverdue(t) ? ' style="background:var(--danger-50)"' : '') + '>'
        + '<td><strong>' + Utils.escapeHtml(getBookTitle(t.bookId)) + '</strong></td>'
        + '<td>' + Utils.escapeHtml(getPersonName(t.memberId)) + '</td>'
        + '<td>' + typeBadge + '</td>'
        + '<td>' + (t.date ? Utils.formatDate(t.date) : '\u2014') + '</td>'
        + '<td>' + (t.dueDate ? Utils.formatDate(t.dueDate) : '\u2014') + '</td>'
        + '<td>' + statusHtml + '</td>'
        + '<td>' + actions + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:0 4px">'
      + '<span style="font-size:13px;color:var(--gray-500)">Showing ' + filtered.length + ' transaction' + (filtered.length !== 1 ? 's' : '') + '</span>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Dashboard Tab                                                      */
  /* ================================================================== */

  function renderDashboardTab() {
    var totalBooks = _books.reduce(function (sum, b) { return sum + (b.totalCopies || 0); }, 0);
    var availableBooks = _books.reduce(function (sum, b) { return sum + getAvailableCopies(b); }, 0);
    var borrowedCount = _transactions.filter(function (t) { return t.type === 'Borrow' && (t.status === 'Active' || t.status === 'Overdue'); }).length;
    var overdueCount = _transactions.filter(function (t) { return isOverdue(t); }).length;

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83D\uDCDA', 'Total Books', totalBooks, 'var(--primary-600)');
    html += statCard('\u2705', 'Available', availableBooks, 'var(--success-600)');
    html += statCard('\uD83D\uDCE6', 'Borrowed', borrowedCount, 'var(--info-600)');
    html += statCard('\u26A0', 'Overdue', overdueCount, 'var(--danger-600)');
    html += '</div>';

    // Category distribution
    var catCounts = {};
    _books.forEach(function (b) {
      var cat = b.category || 'Uncategorized';
      catCounts[cat] = (catCounts[cat] || 0) + (b.totalCopies || 1);
    });
    var catEntries = Object.entries(catCounts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    var catMax = catEntries.length > 0 ? catEntries[0][1] : 1;

    html += '<div class="card" style="padding:20px;margin-bottom:20px">'
      + '<h3 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--gray-800)">\uD83D\uDCCA Books by Category</h3>';

    if (!catEntries.length) {
      html += '<p style="color:var(--gray-400);font-size:13px">No books in catalog yet.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      catEntries.forEach(function (entry) {
        var cat = entry[0];
        var count = entry[1];
        var pct = (count / catMax) * 100;
        html += '<div style="display:flex;align-items:center;gap:12px">'
          + '<div style="width:140px;font-size:13px;font-weight:500;color:var(--gray-700);text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          + Utils.escapeHtml(cat) + '</div>'
          + '<div style="flex:1;height:28px;background:var(--gray-100);border-radius:4px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:var(--primary-500);border-radius:4px;display:flex;align-items:center;padding-left:8px;min-width:fit-content">'
          + '<span style="font-size:12px;font-weight:600;color:white;white-space:nowrap">' + count + '</span>'
          + '</div></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Recent transactions
    html += '<div class="card" style="overflow:hidden">'
      + '<div style="padding:16px 20px;border-bottom:1px solid var(--gray-100)">'
      + '<h3 style="margin:0;font-size:15px;font-weight:600;color:var(--gray-800)">\uD83D\uDD50 Recent Transactions</h3>'
      + '</div>';

    var recent = _transactions.slice().sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); }).slice(0, 10);

    if (!recent.length) {
      html += '<div style="padding:30px;text-align:center;color:var(--gray-400);font-size:13px">No transactions yet.</div>';
    } else {
      html += '<div style="overflow-x:auto"><table class="table" style="min-width:600px;margin:0">'
        + '<thead><tr><th>Book</th><th>Member</th><th>Type</th><th>Date</th><th>Status</th></tr></thead><tbody>';

      recent.forEach(function (t) {
        var typeBadge = '';
        if (t.type === 'Borrow') typeBadge = '<span class="badge badge-info">Borrow</span>';
        else if (t.type === 'Return') typeBadge = '<span class="badge badge-success">Return</span>';
        else if (t.type === 'Reserve') typeBadge = '<span class="badge badge-warning">Reserve</span>';
        else typeBadge = '<span class="badge badge-default">' + Utils.escapeHtml(t.type || '') + '</span>';

        var statusHtml = '';
        if (t.status === 'Active') statusHtml = '<span class="badge badge-info">Active</span>';
        else if (t.status === 'Returned') statusHtml = '<span class="badge badge-success">Returned</span>';
        else if (t.status === 'Overdue') statusHtml = '<span class="badge badge-danger">Overdue</span>';
        else statusHtml = '<span class="badge badge-default">' + Utils.escapeHtml(t.status || '') + '</span>';

        html += '<tr>'
          + '<td>' + Utils.escapeHtml(getBookTitle(t.bookId)) + '</td>'
          + '<td>' + Utils.escapeHtml(getPersonName(t.memberId)) + '</td>'
          + '<td>' + typeBadge + '</td>'
          + '<td>' + (t.date ? Utils.formatDate(t.date) : '\u2014') + '</td>'
          + '<td>' + statusHtml + '</td>'
          + '</tr>';
      });

      html += '</tbody></table></div>';
    }
    html += '</div>';

    return html;
  }

  /* ================================================================== */
  /*  Add / Edit Book Modal                                              */
  /* ================================================================== */

  function openBookModal(book) {
    var isEdit = !!book;
    var title = isEdit ? 'Edit Book' : 'Add Book';
    var btnLabel = isEdit ? 'Update' : 'Add Book';
    var btnId = isEdit ? 'library-update-book-btn' : 'library-save-book-btn';

    var formHtml = '<form id="library-book-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Title <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="title" value="' + Utils.escapeHtml(book ? book.title : '') + '" required placeholder="Enter book title">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Author <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="author" value="' + Utils.escapeHtml(book ? book.author : '') + '" required placeholder="Enter author name">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">ISBN</label>'
      + '<input type="text" class="form-control" name="isbn" value="' + Utils.escapeHtml(book ? book.isbn : '') + '" placeholder="ISBN number">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Category</label>'
      + '<input type="text" class="form-control" name="category" value="' + Utils.escapeHtml(book ? book.category : '') + '" placeholder="e.g., Fiction, Science, History">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Publisher</label>'
      + '<input type="text" class="form-control" name="publisher" value="' + Utils.escapeHtml(book ? book.publisher : '') + '" placeholder="Publisher name">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Year</label>'
      + '<input type="number" class="form-control" name="year" value="' + (book ? book.year : '') + '" placeholder="Publication year" min="1000" max="2099">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Total Copies <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="number" class="form-control" name="totalCopies" value="' + (book ? book.totalCopies : 1) + '" required min="1" placeholder="Number of copies">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Description</label>'
      + '<textarea class="form-control" name="description" rows="3" placeholder="Brief description...">' + Utils.escapeHtml(book ? book.description : '') + '</textarea>'
      + '</div>'
      + '</form>';

    Modal.open({
      title: title,
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="' + btnId + '">' + btnLabel + '</button>'
    });

    setTimeout(function () {
      var saveBtn = document.getElementById(btnId);
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('library-book-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var bookData = {
            schoolId: getSchoolId(),
            title: fd.get('title'),
            author: fd.get('author'),
            isbn: fd.get('isbn'),
            category: fd.get('category'),
            publisher: fd.get('publisher'),
            year: fd.get('year') ? parseInt(fd.get('year')) : null,
            totalCopies: parseInt(fd.get('totalCopies')) || 1,
            description: fd.get('description'),
            timestamp: Date.now()
          };

          var promise;
          if (isEdit) {
            promise = DataService.update('libraryBooks', getSchoolId(), book.id, bookData);
          } else {
            promise = DataService.add('libraryBooks', bookData);
          }

          promise.then(function () {
            Modal.close();
            Toast.success(isEdit ? 'Book updated.' : 'Book added.');
            DataService.logAction('library_' + (isEdit ? 'edit' : 'add'), (isEdit ? 'Updated' : 'Added') + ' book: ' + bookData.title);
            Promise.all([loadBooks(), loadTransactions()]).then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error saving book:', err);
            Toast.error('Failed to save book.');
          });
        });
      }
    }, 50);
  }

  /* ================================================================== */
  /*  New Transaction Modal                                              */
  /* ================================================================== */

  function openTransactionModal() {
    var availableBooks = _books.filter(function (b) { return getAvailableCopies(b) > 0; });
    var todayStr = new Date().toISOString().split('T')[0];
    var dueDateDefault = new Date();
    dueDateDefault.setDate(dueDateDefault.getDate() + 14);
    var dueDateStr = dueDateDefault.toISOString().split('T')[0];

    var formHtml = '<form id="library-tx-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Book <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" id="library-book-search" placeholder="Search book..." autocomplete="off">'
      + '<select class="form-control" name="bookId" id="library-book-select" required style="margin-top:6px">'
      + '<option value="">Select Book</option>';
    availableBooks.forEach(function (b) {
      var avail = getAvailableCopies(b);
      formHtml += '<option value="' + b.id + '">' + Utils.escapeHtml(b.title + ' by ' + (b.author || '')) + ' (' + avail + ' available)</option>';
    });
    formHtml += '</select></div>';

    // Member selection
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Member <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" id="library-member-search" placeholder="Search student or staff..." autocomplete="off">'
      + '<select class="form-control" name="memberId" id="library-member-select" required style="margin-top:6px">'
      + '<option value="">Select Member</option>';

    if (_students.length) {
      formHtml += '<optgroup label="Students">';
      _students.forEach(function (s) {
        var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
        formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + ' (Student)</option>';
      });
      formHtml += '</optgroup>';
    }
    if (_staff.length) {
      formHtml += '<optgroup label="Staff">';
      _staff.forEach(function (s) {
        var name = s.displayName || [s.firstName, s.middleName, s.surname].filter(Boolean).join(' ');
        formHtml += '<option value="' + (s.uid || s.id) + '">' + Utils.escapeHtml(name) + ' (Staff)</option>';
      });
      formHtml += '</optgroup>';
    }

    formHtml += '</select></div>';

    // Type
    formHtml += '<div class="form-group">'
      + '<label class="form-label">Type <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="type" id="library-tx-type" required>'
      + '<option value="Borrow">Borrow</option>'
      + '<option value="Reserve">Reserve</option>'
      + '</select></div>';

    // Due date
    formHtml += '<div class="form-group" id="library-due-date-group">'
      + '<label class="form-label">Due Date</label>'
      + '<input type="date" class="form-control" name="dueDate" value="' + dueDateStr + '">'
      + '</div>';

    formHtml += '</form>';

    Modal.open({
      title: 'New Transaction',
      content: formHtml,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="library-save-tx-btn">Save Transaction</button>'
    });

    setTimeout(function () {
      // Book search
      var bookSearch = document.getElementById('library-book-search');
      var bookSelect = document.getElementById('library-book-select');
      if (bookSearch && bookSelect) {
        bookSearch.addEventListener('input', function () {
          var q = this.value.toLowerCase();
          bookSelect.querySelectorAll('option').forEach(function (opt) {
            if (!opt.value) return;
            opt.style.display = opt.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
        });
      }

      // Member search
      var memberSearch = document.getElementById('library-member-search');
      var memberSelect = document.getElementById('library-member-select');
      if (memberSearch && memberSelect) {
        memberSearch.addEventListener('input', function () {
          var q = this.value.toLowerCase();
          memberSelect.querySelectorAll('option').forEach(function (opt) {
            if (!opt.value) return;
            opt.style.display = opt.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
        });
      }

      // Toggle due date visibility
      var typeSelect = document.getElementById('library-tx-type');
      var dueGroup = document.getElementById('library-due-date-group');
      if (typeSelect && dueGroup) {
        typeSelect.addEventListener('change', function () {
          dueGroup.style.display = this.value === 'Borrow' ? '' : 'none';
        });
      }

      // Save
      var saveBtn = document.getElementById('library-save-tx-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('library-tx-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var txType = fd.get('type');

          // Check for existing active borrow/reserve for same book and member
          var existing = _transactions.find(function (t) {
            return t.bookId === fd.get('bookId')
              && t.memberId === fd.get('memberId')
              && (t.status === 'Active' || t.status === 'Overdue');
          });
          if (existing) {
            Toast.error('This member already has an active transaction for this book.');
            return;
          }

          var txData = {
            schoolId: getSchoolId(),
            bookId: fd.get('bookId'),
            memberId: fd.get('memberId'),
            type: txType,
            date: todayStr,
            dueDate: txType === 'Borrow' ? (fd.get('dueDate') || dueDateStr) : '',
            status: 'Active',
            processedBy: getUid(),
            timestamp: Date.now()
          };

          DataService.add('libraryTransactions', txData).then(function () {
            Modal.close();
            Toast.success('Transaction recorded.');
            DataService.logAction('library_' + txType.toLowerCase(), txType + ': ' + getBookTitle(txData.bookId) + ' by ' + getPersonName(txData.memberId));
            Promise.all([loadBooks(), loadTransactions()]).then(function () {
              var container = document.getElementById('main-content');
              if (container) container.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function (err) {
            console.error('Error saving transaction:', err);
            Toast.error('Failed to record transaction.');
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
          _activeTab = tab || 'catalog';
          _filter = { search: '', category: '', availability: '' };
          var container = document.getElementById('main-content');
          if (container) container.innerHTML = renderMainView();
          bindEvents();
          break;

        case 'add-book':
          e.preventDefault();
          e.stopPropagation();
          openBookModal(null);
          break;

        case 'edit-book':
          e.preventDefault();
          e.stopPropagation();
          var book = _books.find(function (b) { return b.id === id; });
          if (book) openBookModal(book);
          break;

        case 'delete-book':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Delete this book from the catalog? This cannot be undone.').then(function (confirmed) {
            if (confirmed) {
              DataService.remove('libraryBooks', getSchoolId(), id).then(function () {
                Toast.success('Book deleted.');
                DataService.logAction('library_delete', 'Deleted book ' + id);
                Promise.all([loadBooks(), loadTransactions()]).then(function () {
                  var c = document.getElementById('main-content');
                  if (c) c.innerHTML = renderMainView();
                  bindEvents();
                });
              });
            }
          });
          break;

        case 'new-transaction':
          e.preventDefault();
          e.stopPropagation();
          openTransactionModal();
          break;

        case 'return-book':
          e.preventDefault();
          e.stopPropagation();
          DataService.update('libraryTransactions', getSchoolId(), id, {
            status: 'Returned',
            returnDate: new Date().toISOString().split('T')[0],
            timestamp: Date.now()
          }).then(function () {
            Toast.success('Book returned.');
            DataService.logAction('library_return', 'Returned book for transaction ' + id);
            Promise.all([loadBooks(), loadTransactions()]).then(function () {
              var c = document.getElementById('main-content');
              if (c) c.innerHTML = renderMainView();
              bindEvents();
            });
          }).catch(function () {
            Toast.error('Failed to process return.');
          });
          break;

        case 'cancel-reserve':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Cancel this reservation?').then(function (confirmed) {
            if (confirmed) {
              DataService.update('libraryTransactions', getSchoolId(), id, {
                status: 'Returned',
                timestamp: Date.now()
              }).then(function () {
                Toast.success('Reservation cancelled.');
                Promise.all([loadBooks(), loadTransactions()]).then(function () {
                  var c = document.getElementById('main-content');
                  if (c) c.innerHTML = renderMainView();
                  bindEvents();
                });
              });
            }
          });
          break;

        case 'clear-filters':
          e.preventDefault();
          e.stopPropagation();
          _filter = { search: '', category: '', availability: '' };
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

  window.Modules.library = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('library');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Library' }
      ]);
      _activeTab = 'catalog';
      _filter = { search: '', category: '', availability: '' };
      render();
    },

    destroy: function () {
      cleanup();
      _books = [];
      _transactions = [];
      _students = [];
      _staff = [];
      _activeTab = 'catalog';
      _filter = { search: '', category: '', availability: '' };
    }
  };
})();