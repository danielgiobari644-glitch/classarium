/**
 * Classarium Dashboard Module
 * Role-based dashboard rendering for all user roles.
 */
(function () {
  'use strict';

  window.Modules = window.Modules || {};

  var Utils = window.Utils;
  var Toast = window.Toast;
  var DataService = window.DataService;
  var Router = window.Router;
  var SidebarComponent = window.SidebarComponent;
  var HeaderComponent = window.SidebarComponent;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function statCard(icon, iconBg, value, label, change, changeType) {
    var changeHtml = '';
    if (change) {
      var cls = changeType === 'up' ? 'text-success' : changeType === 'down' ? 'text-danger' : 'text-muted';
      changeHtml = '<div class="stat-card-change ' + cls + '">' + change + '</div>';
    }
    return '<div class="stat-card">'
      + '<div class="stat-card-icon" style="background:' + iconBg + '">' + icon + '</div>'
      + '<div class="stat-card-value">' + value + '</div>'
      + '<div class="stat-card-label">' + label + '</div>'
      + changeHtml
      + '</div>';
  }

  function card(id, title, actions, bodyHtml) {
    var actionsHtml = actions ? '<div class="card-header-actions">' + actions + '</div>' : '';
    return '<div class="card" ' + (id ? 'id="' + id + '"' : '') + '>'
      + '<div class="card-header"><h3 class="card-title">' + title + '</h3>' + actionsHtml + '</div>'
      + '<div class="card-body">' + (bodyHtml || '') + '</div>'
      + '</div>';
  }

  function emptyState(icon, title, description) {
    return '<div class="empty-state">'
      + '<div class="empty-state-icon">' + icon + '</div>'
      + '<h3 class="empty-state-title">' + title + '</h3>'
      + '<p class="empty-state-description">' + (description || '') + '</p>'
      + '</div>';
  }

  function badge(text, type) {
    return '<span class="badge badge-' + (type || 'default') + '">' + text + '</span>';
  }

  function avatar(name, size) {
    var initials = Utils.getInitials(name || 'U');
    var s = size || 32;
    return '<div class="avatar" style="width:' + s + 'px;height:' + s + 'px">' + initials + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /*  Super Admin Dashboard                                              */
  /* ------------------------------------------------------------------ */

  function renderSuperAdmin() {
    var school = window.App.state.school;
    var html = '<div class="dashboard-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Platform Dashboard</h1>'
      + '<p class="page-header-description">Overview of all schools and platform activity</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-primary" data-action="add-school">Add School</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats
    html += '<div class="dashboard-grid grid-4">'
      + '<div id="sa-stat-schools" class="stat-card"><div class="stat-card-icon" style="background:var(--primary-50);color:var(--primary-600)">🏫</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Schools</div></div>'
      + '<div id="sa-stat-students" class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">👨‍🎓</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Students</div></div>'
      + '<div id="sa-stat-users" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">👥</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Users</div></div>'
      + '<div id="sa-stat-active" class="stat-card"><div class="stat-card-icon" style="background:#FFF7ED;color:#EA580C">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Active Schools</div></div>'
      + '</div>';

    // Revenue placeholder + Recent Activity
    html += '<div class="dashboard-grid grid-2">';

    // Revenue Analytics placeholder
    html += card('sa-revenue', 'Revenue Analytics', '<button class="btn btn-ghost btn-sm">View Report</button>',
      '<div style="height:280px;display:flex;align-items:center;justify-content:center;background:var(--gray-50);border-radius:8px;color:var(--gray-400);font-size:14px">Revenue Chart Area</div>'
    );

    // Recent Platform Activity
    html += card('sa-activity', 'Recent Platform Activity', '<button class="btn btn-ghost btn-sm">View All</button>',
      '<div class="data-table-wrapper"><table class="data-table" id="sa-activity-table">'
      + '<thead><tr><th>School</th><th>Action</th><th>Date</th><th>Status</th></tr></thead>'
      + '<tbody id="sa-activity-body"><tr><td colspan="4" class="empty-state"><p>Loading activity...</p></td></tr></tbody>'
      + '</table></div>'
    );

    html += '</div>'; // grid-2
    html += '</div>'; // dashboard-page
    return html;
  }

  function bindSuperAdmin() {
    DataService.getPlatformStats().then(function (stats) {
      if (!stats) return;
      var el;
      el = document.getElementById('sa-stat-schools');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(stats.totalSchools || 0);
      el = document.getElementById('sa-stat-students');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(stats.totalStudents || 0);
      el = document.getElementById('sa-stat-users');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(stats.totalUsers || 0);
      el = document.getElementById('sa-stat-active');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(stats.activeSchools || 0);
    }).catch(function () { });

    DataService.getAllSchools().then(function (schools) {
      var tbody = document.getElementById('sa-activity-body');
      if (!tbody || !schools || !schools.length) return;
      var rows = schools.slice(0, 8).map(function (s) {
        var statusBadge = s.status === 'active' ? badge('Active', 'success') : s.status === 'suspended' ? badge('Suspended', 'danger') : badge('Pending', 'warning');
        return '<tr><td>' + (s.name || '—') + '</td><td>School Registered</td><td>' + Utils.timeAgo(s.createdAt) + '</td><td>' + statusBadge + '</td></tr>';
      }).join('');
      tbody.innerHTML = rows;
    }).catch(function () { });

    document.addEventListener('click', function saHandler(e) {
      var btn = e.target.closest('[data-action="add-school"]');
      if (btn) {
        e.preventDefault();
        Router.navigate('/schools/new');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  School Admin Dashboard                                             */
  /* ------------------------------------------------------------------ */

  function renderSchoolAdmin() {
    var school = window.App.state.school || {};
    var html = '<div class="dashboard-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">School Dashboard</h1>'
      + '<p class="page-header-description">Welcome back, ' + Utils.capitalize((window.App.state.profile || {}).displayName || 'Admin') + '. Here is your school overview.</p>'
      + '</div>'
      + '<div class="page-header-actions">'
      + '<button class="btn btn-ghost btn-sm" data-action="view-reports">View Reports</button>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats row
    html += '<div class="dashboard-grid grid-4">'
      + '<div id="admin-stat-students" class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">👨‍🎓</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Students</div></div>'
      + '<div id="admin-stat-staff" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">👨‍🏫</div><div class="stat-card-value">--</div><div class="stat-card-label">Total Staff</div></div>'
      + '<div id="admin-stat-present" class="stat-card"><div class="stat-card-icon" style="background:#FFF7ED;color:#EA580C">✅</div><div class="stat-card-value">--</div><div class="stat-card-label">Present Today</div></div>'
      + '<div id="admin-stat-pending" class="stat-card"><div class="stat-card-icon" style="background:#FEF2F2;color:#DC2626">📋</div><div class="stat-card-value">--</div><div class="stat-card-label">Pending Results</div></div>'
      + '</div>';

    // Quick Actions
    html += card('admin-quick-actions', 'Quick Actions', '',
      '<div style="display:flex;gap:12px;flex-wrap:wrap">'
      + '<button class="btn btn-primary" data-action="add-student">Add Student</button>'
      + '<button class="btn btn-primary" data-action="record-attendance">Record Attendance</button>'
      + '<button class="btn btn-primary" data-action="enter-results">Enter Results</button>'
      + '<button class="btn btn-primary" data-action="send-message">Send Message</button>'
      + '</div>'
    );

    html += '<div class="dashboard-grid grid-2">';

    // Recent Activities
    html += card('admin-activities', 'Recent Activities', '<button class="btn btn-ghost btn-sm">View All</button>',
      '<div id="admin-activities-list"><p style="color:var(--gray-400)">Loading activities...</p></div>'
    );

    // Announcements
    html += card('admin-announcements', 'Announcements', '<button class="btn btn-ghost btn-sm" data-action="new-announcement">New</button>',
      '<div id="admin-announcements-list"><p style="color:var(--gray-400)">Loading announcements...</p></div>'
    );

    html += '</div>'; // grid-2

    html += '</div>'; // dashboard-page
    return html;
  }

  function bindSchoolAdmin() {
    // Load stats
    DataService.count('students').then(function (c) {
      var el = document.getElementById('admin-stat-students');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(c || 0);
    }).catch(function () { });

    DataService.count('staff').then(function (c) {
      var el = document.getElementById('admin-stat-staff');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(c || 0);
    }).catch(function () { });

    DataService.count('attendance', { date: new Date().toISOString().slice(0, 10), status: 'present' }).then(function (c) {
      var el = document.getElementById('admin-stat-present');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(c || 0);
    }).catch(function () { });

    DataService.count('results', { status: 'pending' }).then(function (c) {
      var el = document.getElementById('admin-stat-pending');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(c || 0);
    }).catch(function () { });

    // Load recent activities
    DataService.getBySchool('activity_logs', 10).then(function (logs) {
      var container = document.getElementById('admin-activities-list');
      if (!container) return;
      if (!logs || !logs.length) {
        container.innerHTML = emptyState('📝', 'No recent activities', 'Activities will appear here as they happen.');
        return;
      }
      container.innerHTML = logs.map(function (log) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + avatar(log.userName)
          + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + (log.description || log.action || 'Activity') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + Utils.timeAgo(log.createdAt) + '</div></div>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Load announcements
    DataService.getBySchool('announcements', 5).then(function (anns) {
      var container = document.getElementById('admin-announcements-list');
      if (!container) return;
      if (!anns || !anns.length) {
        container.innerHTML = emptyState('📢', 'No announcements', 'Create an announcement to keep everyone informed.');
        return;
      }
      container.innerHTML = anns.map(function (a) {
        return '<div style="padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div style="font-weight:500;font-size:14px">' + (a.title || 'Announcement') + '</div>'
          + '<div style="font-size:13px;color:var(--gray-600);margin-top:2px">' + (a.content || '').substring(0, 100) + '</div>'
          + '<div style="font-size:12px;color:var(--gray-400);margin-top:4px">' + Utils.timeAgo(a.createdAt) + '</div>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Quick action buttons
    document.addEventListener('click', function adminClick(e) {
      var action = e.target.closest('[data-action]');
      if (!action) return;
      var act = action.dataset.action;
      var routes = {
        'add-student': '/students/new',
        'record-attendance': '/attendance',
        'enter-results': '/results',
        'send-message': '/messages/new',
        'view-reports': '/reports',
        'new-announcement': '/announcements/new'
      };
      if (routes[act]) {
        e.preventDefault();
        Router.navigate(routes[act]);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Teacher Dashboard                                                  */
  /* ------------------------------------------------------------------ */

  function renderTeacher() {
    var profile = window.App.state.profile || {};
    var html = '<div class="dashboard-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Teacher Dashboard</h1>'
      + '<p class="page-header-description">Welcome, ' + Utils.capitalize(profile.displayName || 'Teacher') + '.</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    html += '<div class="dashboard-grid grid-2">';

    // Assigned Classes
    html += card('teacher-classes', 'My Classes', '',
      '<div id="teacher-classes-list"><p style="color:var(--gray-400)">Loading classes...</p></div>'
    );

    // Today's Schedule
    html += card('teacher-schedule', "Today's Schedule", '',
      '<div id="teacher-schedule-list"><p style="color:var(--gray-400)">Loading schedule...</p></div>'
    );

    html += '</div>';

    // Pending Tasks
    html += '<div class="dashboard-grid grid-2">';
    html += card('teacher-tasks-results', 'Pending Result Entry', '',
      '<div id="teacher-pending-results"><p style="color:var(--gray-400)">Checking...</p></div>'
    );
    html += card('teacher-tasks-attendance', 'Pending Attendance', '',
      '<div id="teacher-pending-attendance"><p style="color:var(--gray-400)">Checking...</p></div>'
    );
    html += '</div>';

    // Recent Messages
    html += card('teacher-messages', 'Recent Messages', '<button class="btn btn-ghost btn-sm">View All</button>',
      '<div id="teacher-messages-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    html += '</div>';
    return html;
  }

  function bindTeacher() {
    var profile = window.App.state.profile || {};

    // Load assigned classes
    DataService.getBySchool('classes', 20).then(function (classes) {
      var container = document.getElementById('teacher-classes-list');
      if (!container) return;
      if (!classes || !classes.length) {
        container.innerHTML = emptyState('📚', 'No classes assigned', 'Contact your admin to get class assignments.');
        return;
      }
      container.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap">' + classes.map(function (c) {
        return '<div style="padding:12px 20px;background:var(--gray-50);border-radius:8px;cursor:pointer;font-weight:500;font-size:14px" data-action="view-class" data-id="' + (c.id || '') + '">' + (c.name || 'Class') + '</div>';
      }).join('') + '</div>';
    }).catch(function () { });

    // Load today's schedule
    DataService.getBySchool('timetable', 20).then(function (items) {
      var container = document.getElementById('teacher-schedule-list');
      if (!container) return;
      if (!items || !items.length) {
        container.innerHTML = emptyState('🕐', 'No schedule today', 'Your timetable for today will appear here.');
        return;
      }
      var today = new Date().getDay();
      var dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 0: 'sunday' };
      var dayKey = dayMap[today];
      var todayItems = items.filter(function (i) { return (i.day || '').toLowerCase() === dayKey; });
      if (!todayItems.length) {
        container.innerHTML = emptyState('🎉', 'Free day!', 'No classes scheduled for today.');
        return;
      }
      container.innerHTML = todayItems.map(function (item) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div style="font-weight:600;font-size:14px;min-width:110px;color:var(--gray-700)">' + (item.startTime || '--') + ' - ' + (item.endTime || '--') + '</div>'
          + '<div style="flex:1"><div style="font-weight:500">' + (item.subject || 'Subject') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + (item.className || '') + '</div></div>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Pending results
    DataService.getBySchool('results', 10).then(function (results) {
      var container = document.getElementById('teacher-pending-results');
      if (!container) return;
      var pending = (results || []).filter(function (r) { return r.status === 'pending' || r.status === 'draft'; });
      if (!pending.length) {
        container.innerHTML = '<p style="color:var(--success-600);font-weight:500">✅ All results are up to date</p>';
        return;
      }
      container.innerHTML = pending.map(function (r) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + '<span style="font-size:14px">' + (r.subject || 'Subject') + ' — ' + (r.className || 'Class') + '</span>'
          + '<button class="btn btn-sm btn-primary" data-action="enter-result" data-id="' + (r.id || '') + '">Enter</button>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Pending attendance
    DataService.getBySchool('attendance', 10).then(function (records) {
      var container = document.getElementById('teacher-pending-attendance');
      if (!container) return;
      container.innerHTML = '<p style="color:var(--success-600);font-weight:500">✅ Attendance recorded for today</p>';
    }).catch(function () { });

    // Messages
    DataService.getBySchool('messages', 5).then(function (msgs) {
      var container = document.getElementById('teacher-messages-list');
      if (!container) return;
      if (!msgs || !msgs.length) {
        container.innerHTML = emptyState('💬', 'No messages', 'Messages from admin and parents will appear here.');
        return;
      }
      container.innerHTML = msgs.map(function (m) {
        return '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + avatar(m.senderName)
          + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + (m.senderName || 'Sender') + '</div>'
          + '<div style="font-size:13px;color:var(--gray-600)">' + (m.content || '').substring(0, 80) + '</div>'
          + '<div style="font-size:12px;color:var(--gray-400)">' + Utils.timeAgo(m.createdAt) + '</div></div>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    document.addEventListener('click', function teacherClick(e) {
      var action = e.target.closest('[data-action]');
      if (!action) return;
      var act = action.dataset.action;
      if (act === 'enter-result') {
        e.preventDefault();
        Router.navigate('/results/' + (action.dataset.id || '') + '/edit');
      } else if (act === 'view-class') {
        e.preventDefault();
        Router.navigate('/classes/' + (action.dataset.id || ''));
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Student Dashboard                                                  */
  /* ------------------------------------------------------------------ */

  function renderStudent() {
    var profile = window.App.state.profile || {};
    var html = '<div class="dashboard-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Student Dashboard</h1>'
      + '<p class="page-header-description">Welcome, ' + Utils.capitalize(profile.displayName || 'Student') + '.</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats
    html += '<div class="dashboard-grid grid-3">'
      + '<div id="student-stat-attendance" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">📊</div><div class="stat-card-value">--</div><div class="stat-card-label">Attendance Rate</div></div>'
      + '<div id="student-stat-average" class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">📈</div><div class="stat-card-value">--</div><div class="stat-card-label">Average Score</div></div>'
      + '<div id="student-stat-assignments" class="stat-card"><div class="stat-card-icon" style="background:#FFF7ED;color:#EA580C">📝</div><div class="stat-card-value">--</div><div class="stat-card-label">Pending Assignments</div></div>'
      + '</div>';

    html += '<div class="dashboard-grid grid-2">';

    // Upcoming Assignments
    html += card('student-assignments', 'Upcoming Assignments', '',
      '<div id="student-assignments-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    // Recent Results
    html += card('student-results', 'Recent Results', '<button class="btn btn-ghost btn-sm">View All</button>',
      '<div id="student-results-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    html += '</div>';

    // Timetable today
    html += card('student-timetable', 'Today\'s Timetable', '',
      '<div id="student-timetable-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    html += '</div>';
    return html;
  }

  function bindStudent() {
    // Attendance
    DataService.getBySchool('attendance', 50).then(function (records) {
      var el = document.getElementById('student-stat-attendance');
      if (!el) return;
      var total = (records || []).length;
      var present = (records || []).filter(function (r) { return r.status === 'present'; }).length;
      var pct = total ? Math.round((present / total) * 100) : 0;
      el.querySelector('.stat-card-value').textContent = pct + '%';
    }).catch(function () { });

    // Average score
    DataService.getBySchool('results', 50).then(function (results) {
      var el = document.getElementById('student-stat-average');
      if (!el) return;
      var scores = (results || []).filter(function (r) { return r.score != null; }).map(function (r) { return Number(r.score); });
      var avg = scores.length ? (scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(1) : '--';
      el.querySelector('.stat-card-value').textContent = avg;

      // Render recent results
      var container = document.getElementById('student-results-list');
      if (!container) return;
      if (!results || !results.length) {
        container.innerHTML = emptyState('📋', 'No results yet', 'Your results will appear here once published.');
        return;
      }
      container.innerHTML = results.slice(0, 6).map(function (r) {
        var grade = r.score >= 70 ? 'A' : r.score >= 60 ? 'B' : r.score >= 50 ? 'C' : r.score >= 40 ? 'D' : 'F';
        var gradeBadge = r.score >= 50 ? badge(grade, 'success') : badge(grade, 'danger');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div><div style="font-weight:500;font-size:14px">' + (r.subject || 'Subject') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + (r.term || '') + ' ' + (r.session || '') + '</div></div>'
          + '<div style="text-align:right"><div style="font-weight:600">' + (r.score != null ? r.score + '%' : '--') + '</div>' + gradeBadge + '</div>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Assignments
    DataService.getBySchool('assignments', 10).then(function (assignments) {
      var container = document.getElementById('student-assignments-list');
      var el = document.getElementById('student-stat-assignments');
      if (!container) return;
      var pending = (assignments || []).filter(function (a) { return a.status === 'pending' || a.status === 'active'; });
      if (el) el.querySelector('.stat-card-value').textContent = pending.length;
      if (!pending.length) {
        container.innerHTML = '<p style="color:var(--success-600);font-weight:500">✅ All caught up! No pending assignments.</p>';
        return;
      }
      container.innerHTML = pending.map(function (a) {
        var due = a.dueDate ? Utils.timeAgo(a.dueDate) : '';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div><div style="font-weight:500;font-size:14px">' + (a.title || 'Assignment') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + (a.subject || '') + '</div></div>'
          + '<span style="font-size:12px;color:' + (due && due.includes('ago') ? 'var(--danger-500)' : 'var(--gray-500)') + '">' + due + '</span>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Timetable
    DataService.getBySchool('timetable', 20).then(function (items) {
      var container = document.getElementById('student-timetable-list');
      if (!container) return;
      var today = new Date().getDay();
      var dayMap = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 0: 'sunday' };
      var dayKey = dayMap[today];
      var todayItems = (items || []).filter(function (i) { return (i.day || '').toLowerCase() === dayKey; });
      if (!todayItems.length) {
        container.innerHTML = emptyState('🎉', 'No classes today', 'Enjoy your free time!');
        return;
      }
      container.innerHTML = todayItems.map(function (item) {
        return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div style="font-weight:600;font-size:14px;min-width:110px;color:var(--gray-700)">' + (item.startTime || '--') + ' - ' + (item.endTime || '--') + '</div>'
          + '<div style="font-weight:500">' + (item.subject || 'Subject') + '</div>'
          + '</div>';
      }).join('');
    }).catch(function () { });
  }

  /* ------------------------------------------------------------------ */
  /*  Class Manager Dashboard                                            */
  /* ------------------------------------------------------------------ */

  function renderClassManager() {
    var profile = window.App.state.profile || {};
    var html = '<div class="dashboard-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Class Manager Dashboard</h1>'
      + '<p class="page-header-description">Welcome, ' + Utils.capitalize(profile.displayName || 'Class Manager') + '.</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats
    html += '<div class="dashboard-grid grid-3">'
      + '<div id="cm-stat-students" class="stat-card"><div class="stat-card-icon" style="background:#EEF2FF;color:#4F46E5">👨‍🎓</div><div class="stat-card-value">--</div><div class="stat-card-label">Class Students</div></div>'
      + '<div id="cm-stat-attendance" class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5;color:#059669">📊</div><div class="stat-card-value">--</div><div class="stat-card-label">Attendance Rate</div></div>'
      + '<div id="cm-stat-submitted" class="stat-card"><div class="stat-card-icon" style="background:#FFF7ED;color:#EA580C">📝</div><div class="stat-card-value">--</div><div class="stat-card-label">Results Submitted</div></div>'
      + '</div>';

    // Result Submission Progress
    html += card('cm-result-progress', 'Result Submission Progress', '',
      '<div id="cm-progress-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    // Behavior Alerts
    html += card('cm-behavior', 'Behavior Alerts', '',
      '<div id="cm-behavior-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    // Attendance Overview
    html += card('cm-attendance', 'Attendance Overview', '',
      '<div id="cm-attendance-overview"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    html += '</div>';
    return html;
  }

  function bindClassManager() {
    // Stats
    DataService.count('students').then(function (c) {
      var el = document.getElementById('cm-stat-students');
      if (el) el.querySelector('.stat-card-value').textContent = Utils.formatNumber(c || 0);
    }).catch(function () { });

    DataService.getBySchool('attendance', 100).then(function (records) {
      var el = document.getElementById('cm-stat-attendance');
      var container = document.getElementById('cm-attendance-overview');
      if (!records || !records.length) return;
      var total = records.length;
      var present = records.filter(function (r) { return r.status === 'present'; }).length;
      var pct = Math.round((present / total) * 100);
      if (el) el.querySelector('.stat-card-value').textContent = pct + '%';
      if (container) {
        container.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap">'
          + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--success-600)">' + present + '</div><div style="font-size:12px;color:var(--gray-500)">Present</div></div>'
          + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--danger-600)">' + (records.filter(function (r) { return r.status === 'absent'; }).length) + '</div><div style="font-size:12px;color:var(--gray-500)">Absent</div></div>'
          + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--warning-600)">' + (records.filter(function (r) { return r.status === 'late'; }).length) + '</div><div style="font-size:12px;color:var(--gray-500)">Late</div></div>'
          + '</div>';
      }
    }).catch(function () { });

    // Result submission progress
    DataService.getBySchool('subjects', 20).then(function (subjects) {
      var container = document.getElementById('cm-progress-list');
      var el = document.getElementById('cm-stat-submitted');
      if (!container) return;
      if (!subjects || !subjects.length) {
        container.innerHTML = emptyState('📝', 'No subjects', 'Subjects will appear here.');
        return;
      }
      var submitted = subjects.filter(function (s) { return s.resultsSubmitted; }).length;
      var pct = Math.round((submitted / subjects.length) * 100);
      if (el) el.querySelector('.stat-card-value').textContent = pct + '%';

      container.innerHTML = '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;font-weight:500">Completion</span><span style="font-size:13px;color:var(--gray-500)">' + submitted + '/' + subjects.length + ' subjects</span></div>'
        + '<div style="height:8px;background:var(--gray-200);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--primary-600);border-radius:4px"></div></div></div>'
        + subjects.map(function (s) {
          var statusBadge = s.resultsSubmitted ? badge('Submitted', 'success') : badge('Pending', 'warning');
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
            + '<span style="font-size:14px">' + (s.name || 'Subject') + '</span>' + statusBadge + '</div>';
        }).join('');
    }).catch(function () { });

    // Behavior alerts
    DataService.getBySchool('behavior_logs', 10).then(function (logs) {
      var container = document.getElementById('cm-behavior-list');
      if (!container) return;
      if (!logs || !logs.length) {
        container.innerHTML = '<p style="color:var(--success-600);font-weight:500">✅ No behavior alerts</p>';
        return;
      }
      container.innerHTML = logs.map(function (log) {
        var typeBadge = log.type === 'positive' ? badge('Positive', 'success') : badge('Warning', 'danger');
        return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + avatar(log.studentName)
          + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + (log.studentName || 'Student') + '</div>'
          + '<div style="font-size:13px;color:var(--gray-600)">' + (log.description || '') + '</div></div>'
          + typeBadge + '</div>';
      }).join('');
    }).catch(function () { });
  }

  /* ------------------------------------------------------------------ */
  /*  Parent Dashboard                                                   */
  /* ------------------------------------------------------------------ */

  function renderParent() {
    var profile = window.App.state.profile || {};
    var html = '<div class="dashboard-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Parent Dashboard</h1>'
      + '<p class="page-header-description">Welcome, ' + Utils.capitalize(profile.displayName || 'Parent') + '.</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Children attendance summary
    html += card('parent-attendance', 'Children\'s Attendance', '',
      '<div id="parent-attendance-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    // Recent results
    html += card('parent-results', 'Recent Results', '',
      '<div id="parent-results-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    html += '<div class="dashboard-grid grid-2">';

    // Messages from teachers
    html += card('parent-messages', 'Messages from Teachers', '<button class="btn btn-ghost btn-sm">View All</button>',
      '<div id="parent-messages-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    // Upcoming events
    html += card('parent-events', 'Upcoming Events', '',
      '<div id="parent-events-list"><p style="color:var(--gray-400)">Loading...</p></div>'
    );

    html += '</div>';
    html += '</div>';
    return html;
  }

  function bindParent() {
    // Attendance summary
    DataService.getBySchool('attendance', 50).then(function (records) {
      var container = document.getElementById('parent-attendance-list');
      if (!container) return;
      if (!records || !records.length) {
        container.innerHTML = emptyState('📊', 'No attendance data', 'Attendance records will appear here.');
        return;
      }
      // Group by student
      var grouped = {};
      records.forEach(function (r) {
        var key = r.studentId || r.studentName || 'Unknown';
        if (!grouped[key]) grouped[key] = { name: r.studentName || 'Student', total: 0, present: 0 };
        grouped[key].total++;
        if (r.status === 'present') grouped[key].present++;
      });
      container.innerHTML = Object.values(grouped).map(function (g) {
        var pct = g.total ? Math.round((g.present / g.total) * 100) : 0;
        var color = pct >= 75 ? 'var(--success-600)' : pct >= 50 ? 'var(--warning-600)' : 'var(--danger-600)';
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + avatar(g.name) + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + g.name + '</div>'
          + '<div style="height:6px;background:var(--gray-200);border-radius:3px;margin-top:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px"></div></div></div>'
          + '<div style="font-weight:600;color:' + color + '">' + pct + '%</div></div>';
      }).join('');
    }).catch(function () { });

    // Results
    DataService.getBySchool('results', 10).then(function (results) {
      var container = document.getElementById('parent-results-list');
      if (!container) return;
      if (!results || !results.length) {
        container.innerHTML = emptyState('📋', 'No results yet', 'Results will appear here once published.');
        return;
      }
      container.innerHTML = results.slice(0, 5).map(function (r) {
        var gradeBadge = r.score >= 50 ? badge((r.score || 0) + '%', 'success') : badge((r.score || 0) + '%', 'danger');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div><div style="font-weight:500;font-size:14px">' + (r.subject || 'Subject') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + (r.studentName || '') + ' • ' + (r.term || '') + '</div></div>'
          + gradeBadge + '</div>';
      }).join('');
    }).catch(function () { });

    // Messages
    DataService.getBySchool('messages', 5).then(function (msgs) {
      var container = document.getElementById('parent-messages-list');
      if (!container) return;
      if (!msgs || !msgs.length) {
        container.innerHTML = emptyState('💬', 'No messages', 'Messages from teachers will appear here.');
        return;
      }
      container.innerHTML = msgs.map(function (m) {
        return '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + avatar(m.senderName)
          + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + (m.senderName || 'Teacher') + '</div>'
          + '<div style="font-size:13px;color:var(--gray-600)">' + (m.content || '').substring(0, 80) + '</div>'
          + '<div style="font-size:12px;color:var(--gray-400)">' + Utils.timeAgo(m.createdAt) + '</div></div>'
          + '</div>';
      }).join('');
    }).catch(function () { });

    // Events
    DataService.getBySchool('events', 5).then(function (events) {
      var container = document.getElementById('parent-events-list');
      if (!container) return;
      if (!events || !events.length) {
        container.innerHTML = emptyState('📅', 'No upcoming events', 'School events will appear here.');
        return;
      }
      container.innerHTML = events.map(function (ev) {
        return '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + '<div style="font-size:24px">📅</div>'
          + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + (ev.title || 'Event') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + (ev.date ? Utils.formatDate(ev.date) : '') + ' • ' + (ev.location || '') + '</div></div>'
          + '</div>';
      }).join('');
    }).catch(function () { });
  }

  /* ------------------------------------------------------------------ */
  /*  Support Staff Dashboard (librarian, hostel_manager, transport)     */
  /* ------------------------------------------------------------------ */

  function renderSupportStaff(role) {
    var profile = window.App.state.profile || {};
    var config = {
      librarian: { title: 'Library Dashboard', icon: '📚', stats: [
        { id: 'lib-books', icon: '📖', bg: '#EEF2FF', color: '#4F46E5', label: 'Total Books' },
        { id: 'lib-issued', icon: '📤', bg: '#ECFDF5', color: '#059669', label: 'Books Issued' },
        { id: 'lib-overdue', icon: '⚠️', bg: '#FEF2F2', color: '#DC2626', label: 'Overdue' },
        { id: 'lib-returns', icon: '📥', bg: '#FFF7ED', color: '#EA580C', label: 'Returns Today' }
      ], actions: [
        { label: 'Issue Book', route: '/library/issue' },
        { label: 'Return Book', route: '/library/returns' },
        { label: 'Add Book', route: '/library/books/new' },
        { label: 'View Catalog', route: '/library/books' }
      ]},
      hostel_manager: { title: 'Hostel Dashboard', icon: '🏠', stats: [
        { id: 'hostel-rooms', icon: '🚪', bg: '#EEF2FF', color: '#4F46E5', label: 'Total Rooms' },
        { id: 'hostel-occupied', icon: '🛏️', bg: '#ECFDF5', color: '#059669', label: 'Occupied' },
        { id: 'hostel-available', icon: '✅', bg: '#FFF7ED', color: '#EA580C', label: 'Available' },
        { id: 'hostel-maintenance', icon: '🔧', bg: '#FEF2F2', color: '#DC2626', label: 'Maintenance' }
      ], actions: [
        { label: 'Room Allocation', route: '/hostel/allocate' },
        { label: 'Maintenance Request', route: '/hostel/maintenance/new' },
        { label: 'Visitor Log', route: '/hostel/visitors' },
        { label: 'View Rooms', route: '/hostel/rooms' }
      ]},
      transport_officer: { title: 'Transport Dashboard', icon: '🚌', stats: [
        { id: 'trans-vehicles', icon: '🚍', bg: '#EEF2FF', color: '#4F46E5', label: 'Total Vehicles' },
        { id: 'trans-routes', icon: '🗺️', bg: '#ECFDF5', color: '#059669', label: 'Active Routes' },
        { id: 'trans-assigned', icon: '👨‍🎓', bg: '#FFF7ED', color: '#EA580C', label: 'Students Assigned' },
        { id: 'trans-trips', icon: '🛣️', bg: '#FEF2F2', color: '#DC2626', label: 'Trips Today' }
      ], actions: [
        { label: 'Assign Student', route: '/transport/assign' },
        { label: 'Manage Routes', route: '/transport/routes' },
        { label: 'Trip Log', route: '/transport/trips' },
        { label: 'View Vehicles', route: '/transport/vehicles' }
      ]}
    };

    var cfg = config[role] || config.librarian;
    var html = '<div class="dashboard-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">' + cfg.title + '</h1>'
      + '<p class="page-header-description">Welcome, ' + Utils.capitalize(profile.displayName || 'Staff') + '.</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    // Stats
    html += '<div class="dashboard-grid grid-4">';
    cfg.stats.forEach(function (s) {
      html += '<div id="' + s.id + '" class="stat-card"><div class="stat-card-icon" style="background:' + s.bg + ';color:' + s.color + '">' + s.icon + '</div><div class="stat-card-value">--</div><div class="stat-card-label">' + s.label + '</div></div>';
    });
    html += '</div>';

    // Quick Actions
    html += card('support-quick-actions', 'Quick Actions', '',
      '<div style="display:flex;gap:12px;flex-wrap:wrap">'
      + cfg.actions.map(function (a) {
        return '<button class="btn btn-primary" data-action="support-nav" data-route="' + a.route + '">' + a.label + '</button>';
      }).join('')
      + '</div>'
    );

    // Recent activity placeholder
    html += card('support-activity', 'Recent Activity', '',
      '<div id="support-activity-list"><p style="color:var(--gray-400)">Loading recent activity...</p></div>'
    );

    html += '</div>';
    return html;
  }

  function bindSupportStaff(role) {
    // Load placeholder stats
    var statEls = document.querySelectorAll('.stat-card .stat-card-value');
    statEls.forEach(function (el) { el.textContent = '0'; });

    // Bind quick action navigation
    document.addEventListener('click', function supportClick(e) {
      var btn = e.target.closest('[data-action="support-nav"]');
      if (btn) {
        e.preventDefault();
        Router.navigate(btn.dataset.route);
      }
    });

    // Load recent activity
    DataService.getBySchool('activity_logs', 8).then(function (logs) {
      var container = document.getElementById('support-activity-list');
      if (!container) return;
      if (!logs || !logs.length) {
        container.innerHTML = emptyState('📝', 'No recent activity', 'Activity will appear here.');
        return;
      }
      container.innerHTML = logs.map(function (log) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100)">'
          + avatar(log.userName)
          + '<div style="flex:1"><div style="font-weight:500;font-size:14px">' + (log.description || log.action || 'Activity') + '</div>'
          + '<div style="font-size:12px;color:var(--gray-500)">' + Utils.timeAgo(log.createdAt) + '</div></div>'
          + '</div>';
      }).join('');
    }).catch(function () { });
  }

  /* ------------------------------------------------------------------ */
  /*  Main Module                                                       */
  /* ------------------------------------------------------------------ */

  var _cleanupFns = [];

  function cleanup() {
    _cleanupFns.forEach(function (fn) { if (typeof fn === 'function') fn(); });
    _cleanupFns = [];
  }

  var renderers = {
    super_admin: { render: renderSuperAdmin, bind: bindSuperAdmin },
    school_admin: { render: renderSchoolAdmin, bind: bindSchoolAdmin },
    teacher: { render: renderTeacher, bind: bindTeacher },
    student: { render: renderStudent, bind: bindStudent },
    class_manager: { render: renderClassManager, bind: bindClassManager },
    parent: { render: renderParent, bind: bindParent },
    librarian: { render: function () { return renderSupportStaff('librarian'); }, bind: function () { bindSupportStaff('librarian'); } },
    hostel_manager: { render: function () { return renderSupportStaff('hostel_manager'); }, bind: function () { bindSupportStaff('hostel_manager'); } },
    transport_officer: { render: function () { return renderSupportStaff('transport_officer'); }, bind: function () { bindSupportStaff('transport_officer'); } }
  };

  window.Modules.dashboard = {
    render: function () {
      cleanup();
      var profile = window.App.state.profile || {};
      var role = profile.role || 'student';

      // Update sidebar and breadcrumb
      if (window.SidebarComponent) window.SidebarComponent.setActive('dashboard');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([{ label: 'Dashboard' }]);

      var renderer = renderers[role];
      if (!renderer) {
        renderer = renderers.student; // fallback
      }

      return renderer.render();
    },

    bind: function () {
      var profile = window.App.state.profile || {};
      var role = profile.role || 'student';
      var renderer = renderers[role];
      if (renderer && renderer.bind) {
        setTimeout(function () {
          renderer.bind();
        }, 0);
      }
    },

    destroy: function () {
      cleanup();
    }
  };
})();