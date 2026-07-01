/**
 * Classarium Assignments / LMS Module
 * Role-based assignment management: Teachers create & grade, Students submit, Parents view.
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

  var _assignments = [];
  var _submissions = [];
  var _classes = [];
  var _subjects = [];
  var _students = [];
  var _staff = [];
  var _sessions = [];
  var _terms = [];
  var _listeners = [];
  var _clickHandler = null;
  var _changeHandler = null;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function getProfile() {
    return window.App.state.profile || {};
  }

  function getSchoolId() {
    return getProfile().schoolId || '';
  }

  function getUid() {
    return getProfile().uid || '';
  }

  function isAdmin() {
    var r = getProfile().role;
    return r === 'school_admin' || r === 'vice_principal';
  }

  function isTeacher() {
    return getProfile().role === 'teacher';
  }

  function isStudent() {
    return getProfile().role === 'student';
  }

  function isParent() {
    return getProfile().role === 'parent';
  }

  function getClassName(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    return c ? (c.name || '\u2014') : '\u2014';
  }

  function getSubjectName(id) {
    var s = _subjects.find(function (x) { return x.id === id; });
    return s ? (s.name || '\u2014') : '\u2014';
  }

  function getStudentName(id) {
    var s = _students.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || (s.firstName + ' ' + s.lastName) || '\u2014') : '\u2014';
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

  function statusBadge(status) {
    var map = {
      active: { text: 'Active', cls: 'success' },
      closed: { text: 'Closed', cls: 'default' },
      draft: { text: 'Draft', cls: 'warning' },
      pending: { text: 'Pending', cls: 'warning' },
      submitted: { text: 'Submitted', cls: 'info' },
      graded: { text: 'Graded', cls: 'success' },
      late: { text: 'Late', cls: 'danger' },
      overdue: { text: 'Overdue', cls: 'danger' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function getArmsForClass(classId) {
    var cls = _classes.find(function (c) { return c.id === classId; });
    if (!cls || !cls.arms) return [];
    return cls.arms;
  }

  function getActiveSession() {
    return _sessions.find(function (s) { return s.status === 'active'; }) || _sessions[0] || null;
  }

  function getActiveTerm() {
    return _terms.find(function (t) { return t.status === 'active'; }) || _terms[0] || null;
  }

  function getStudentAssignmentStatus(assignment, studentUid) {
    var sub = _submissions.find(function (s) {
      return s.assignmentId === assignment.id && s.studentId === studentUid;
    });
    if (!sub) {
      // Check if overdue
      if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) {
        return 'overdue';
      }
      return 'pending';
    }
    if (sub.score !== undefined && sub.score !== null && sub.score !== '') {
      return 'graded';
    }
    if (sub.late) {
      return 'late';
    }
    return 'submitted';
  }

  function getSubmissionCount(assignment) {
    var count = _submissions.filter(function (s) {
      return s.assignmentId === assignment.id;
    }).length;
    return count;
  }

  function getStudentRecord() {
    return _students.find(function (s) { return s.uid === getUid() || s.id === getUid(); });
  }

  function getChildRecord() {
    // Parent sees their child's data
    var child = _students.find(function (s) { return s.parentId === getUid() || s.parentUid === getUid(); });
    if (!child && _students.length === 1) child = _students[0]; // fallback
    return child;
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    var promises = [
      DataService.getBySchool('classes', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('subjects', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('sessions', schoolId),
      DataService.getBySchool('terms', schoolId)
    ];

    if (isAdmin()) {
      promises.push(DataService.getBySchool('staff', schoolId));
      promises.push(DataService.getStudents(schoolId));
    } else if (isTeacher()) {
      promises.push(Promise.resolve([getProfile()])); // self as staff
      promises.push(DataService.getStudents(schoolId));
    } else if (isStudent()) {
      promises.push(Promise.resolve([]));
      promises.push(Promise.resolve([]));
    } else if (isParent()) {
      promises.push(Promise.resolve([]));
      promises.push(DataService.getStudents(schoolId));
    } else {
      promises.push(Promise.resolve([]));
      promises.push(Promise.resolve([]));
    }

    return Promise.all(promises).then(function (results) {
      _classes = results[0] || [];
      _subjects = results[1] || [];
      _sessions = results[2] || [];
      _terms = results[3] || [];
      _staff = results[4] || [];
      _students = results[5] || [];
    });
  }

  function loadAssignments() {
    var schoolId = getSchoolId();
    var role = getProfile().role;

    var p = DataService.getBySchool('assignments', schoolId, { orderBy: 'createdAt', orderDir: 'desc' });

    return p.then(function (all) {
      _assignments = all || [];

      // Load submissions relevant to this context
      var assignmentIds = _assignments.map(function (a) { return a.id; });
      var subPromises = assignmentIds.map(function (aId) {
        return DataService.getBySchool('submissions', schoolId).then(function (subs) {
          return (subs || []).filter(function (s) { return s.assignmentId === aId; });
        });
      });

      return Promise.all(subPromises).then(function (groups) {
        _submissions = [];
        groups.forEach(function (g) {
          _submissions = _submissions.concat(g);
        });
      });
    });
  }

  /* ================================================================== */
  /*  Render — Main Page                                                 */
  /* ================================================================== */

  function render() {
    var container = document.getElementById('main-content');
    if (!container) return;

    cleanup();
    container.innerHTML = loadingSpinner();

    loadBaseData().then(function () {
      return loadAssignments();
    }).then(function () {
      if (isTeacher() || isAdmin()) {
        container.innerHTML = renderTeacherView();
      } else if (isStudent()) {
        container.innerHTML = renderStudentView();
      } else if (isParent()) {
        container.innerHTML = renderParentView();
      } else {
        container.innerHTML = emptyState('\uD83D\uDCCB', 'Access Denied', 'You do not have permission to view assignments.');
      }
      bindEvents();
    }).catch(function (err) {
      console.error('Error loading assignments module:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load assignments. Please refresh.');
      Toast.error('Failed to load assignments.');
    });
  }

  /* ================================================================== */
  /*  TEACHER / ADMIN VIEW                                               */
  /* ================================================================== */

  function renderTeacherView() {
    var myAssignments = _assignments.filter(function (a) {
      if (isAdmin()) return true;
      return a.createdBy === getUid();
    });

    var html = '<div class="assignments-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Assignments</h1>'
      + '<p class="page-header-description">Create and manage assignments, view submissions &amp; grade work</p>'
      + '</div>'
      + '<button class="btn btn-primary" data-action="create-assignment">+ Create Assignment</button>'
      + '</div>'
      + '</div>';

    // Stats row
    var totalSubmissions = _submissions.length;
    var gradedCount = _submissions.filter(function (s) { return s.score !== undefined && s.score !== null && s.score !== ''; }).length;
    var pendingGrading = totalSubmissions - gradedCount;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83D\uDCCB', 'Total Assignments', myAssignments.length, 'var(--primary-600)');
    html += statCard('\uD83D\uDCE5', 'Total Submissions', totalSubmissions, 'var(--info-600)');
    html += statCard('\u2705', 'Graded', gradedCount, 'var(--success-600)');
    html += statCard('\u23F3', 'Pending Grading', pendingGrading, 'var(--warning-600)');
    html += '</div>';

    // Assignment cards
    if (!myAssignments.length) {
      html += emptyState('\uD83D\uDCCB', 'No Assignments', 'Create your first assignment to get started.');
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px">';

      myAssignments.forEach(function (a) {
        var subCount = getSubmissionCount(a);
        var studentCount = getStudentCountForAssignment(a);
        var status = getAssignmentStatus(a);
        var dueStr = a.dueDate ? Utils.formatDate(a.dueDate) : 'No due date';

        html += '<div class="card" style="cursor:pointer;transition:box-shadow 0.15s" data-action="view-assignment" data-id="' + a.id + '">'
          + '<div class="card-body" style="padding:20px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">'
          + '<h3 style="margin:0;font-size:16px;font-weight:600;line-height:1.3">' + Utils.escapeHtml(a.title || 'Untitled') + '</h3>'
          + statusBadge(status)
          + '</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">'
          + '<span style="font-size:12px;color:var(--gray-500);background:var(--gray-100);padding:3px 8px;border-radius:4px">' + Utils.escapeHtml(getSubjectName(a.subjectId)) + '</span>'
          + '<span style="font-size:12px;color:var(--gray-500);background:var(--gray-100);padding:3px 8px;border-radius:4px">' + Utils.escapeHtml(getClassName(a.classId)) + (a.arm ? ' (' + Utils.escapeHtml(a.arm) + ')' : '') + '</span>'
          + '</div>'
          + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<div style="font-size:13px;color:var(--gray-500)">\uD83D\uDD52 Due: ' + dueStr + '</div>'
          + '<div style="font-size:13px;font-weight:600;color:var(--primary-600)">' + subCount + '/' + studentCount + ' submitted</div>'
          + '</div>'
          + '</div></div>';
      });

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function statCard(icon, label, value, color) {
    return '<div class="card" style="padding:16px 20px">'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<div style="width:42px;height:42px;border-radius:10px;background:' + color + '15;display:flex;align-items:center;justify-content:center;font-size:18px">' + icon + '</div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--gray-900)">' + Utils.formatNumber(value) + '</div>'
      + '<div style="font-size:12px;color:var(--gray-500);margin-top:2px">' + label + '</div></div>'
      + '</div></div>';
  }

  function getStudentCountForAssignment(assignment) {
    if (assignment.classId) {
      return _students.filter(function (s) { return s.classId === assignment.classId; }).length || 1;
    }
    return 1;
  }

  function getAssignmentStatus(assignment) {
    if (assignment.status) return assignment.status;
    if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) return 'closed';
    return 'active';
  }

  /* ================================================================== */
  /*  STUDENT VIEW                                                       */
  /* ================================================================== */

  function renderStudentView() {
    var student = getStudentRecord();
    if (!student) {
      return emptyState('\uD83D\uDC64', 'Student Record Not Found', 'Your student profile could not be loaded.');
    }

    var myAssignments = _assignments.filter(function (a) {
      return a.classId === student.classId;
    });

    var html = '<div class="assignments-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">My Assignments</h1>'
      + '<p class="page-header-description">View and submit your class assignments</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    if (!myAssignments.length) {
      html += emptyState('\uD83D\uDCCB', 'No Assignments', 'There are no assignments for your class yet.');
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px">';

      myAssignments.forEach(function (a) {
        var myStatus = getStudentAssignmentStatus(a, getUid());
        var mySub = _submissions.find(function (s) {
          return s.assignmentId === a.id && s.studentId === getUid();
        });
        var dueStr = a.dueDate ? Utils.formatDate(a.dueDate) : 'No due date';
        var scoreDisplay = '';
        if (myStatus === 'graded' && mySub) {
          var maxScore = a.maxScore || 100;
          scoreDisplay = '<div style="margin-top:10px;padding:8px 12px;background:var(--success-50);border-radius:6px;font-size:13px">'
            + '<span style="font-weight:700;color:var(--success-700)">' + (mySub.score || 0) + '</span>'
            + '<span style="color:var(--gray-400)"> / ' + maxScore + '</span></div>';
        }

        var actionBtn = '';
        if (myStatus === 'pending' || myStatus === 'overdue') {
          actionBtn = '<button class="btn btn-sm btn-primary" data-action="submit-assignment" data-id="' + a.id + '" style="margin-top:10px">Submit Assignment</button>';
        } else if (myStatus === 'submitted' || myStatus === 'late') {
          actionBtn = '<div style="margin-top:10px;font-size:12px;color:var(--gray-500)">\u2705 Submitted on ' + (mySub && mySub.submittedAt ? Utils.formatDate(mySub.submittedAt) : 'unknown date') + '</div>';
        }

        html += '<div class="card">'
          + '<div class="card-body" style="padding:20px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">'
          + '<h3 style="margin:0;font-size:16px;font-weight:600;line-height:1.3">' + Utils.escapeHtml(a.title || 'Untitled') + '</h3>'
          + statusBadge(myStatus)
          + '</div>'
          + '<div style="font-size:13px;color:var(--gray-500);margin-bottom:8px">' + Utils.escapeHtml(getSubjectName(a.subjectId)) + '</div>'
          + '<div style="font-size:13px;color:var(--gray-500)">\uD83D\uDD52 Due: ' + dueStr + '</div>'
          + (a.maxScore ? '<div style="font-size:12px;color:var(--gray-400);margin-top:4px">Max Score: ' + a.maxScore + '</div>' : '')
          + scoreDisplay
          + actionBtn
          + '</div></div>';
      });

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  PARENT VIEW                                                        */
  /* ================================================================== */

  function renderParentView() {
    var child = getChildRecord();
    if (!child) {
      return emptyState('\uD83D\uDC68\u200D\uD83D\uDC67', 'No Child Found', 'Could not find a linked student profile.');
    }

    var childName = child.displayName || (child.firstName + ' ' + child.lastName) || 'Your Child';
    var childAssignments = _assignments.filter(function (a) {
      return a.classId === child.classId;
    });

    var html = '<div class="assignments-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">Assignments \u2014 ' + Utils.escapeHtml(childName) + '</h1>'
      + '<p class="page-header-description">View your child\'s assignments and grades (read-only)</p>'
      + '</div>'
      + '</div>'
      + '</div>';

    if (!childAssignments.length) {
      html += emptyState('\uD83D\uDCCB', 'No Assignments', 'There are no assignments for ' + Utils.escapeHtml(childName) + '\'s class yet.');
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px">';

      childAssignments.forEach(function (a) {
        var childUid = child.uid || child.id;
        var childStatus = getStudentAssignmentStatus(a, childUid);
        var childSub = _submissions.find(function (s) {
          return s.assignmentId === a.id && s.studentId === childUid;
        });
        var dueStr = a.dueDate ? Utils.formatDate(a.dueDate) : 'No due date';
        var scoreDisplay = '';
        if (childStatus === 'graded' && childSub) {
          var maxScore = a.maxScore || 100;
          scoreDisplay = '<div style="margin-top:10px;padding:8px 12px;background:var(--success-50);border-radius:6px;font-size:13px">'
            + '<span style="font-weight:700;color:var(--success-700)">' + (childSub.score || 0) + '</span>'
            + '<span style="color:var(--gray-400)"> / ' + maxScore + '</span></div>';
        }

        var subInfo = '';
        if (childStatus === 'submitted' || childStatus === 'late') {
          subInfo = '<div style="margin-top:10px;font-size:12px;color:var(--gray-500)">\u2705 Submitted on ' + (childSub && childSub.submittedAt ? Utils.formatDate(childSub.submittedAt) : 'unknown date') + '</div>';
        }

        html += '<div class="card">'
          + '<div class="card-body" style="padding:20px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">'
          + '<h3 style="margin:0;font-size:16px;font-weight:600;line-height:1.3">' + Utils.escapeHtml(a.title || 'Untitled') + '</h3>'
          + statusBadge(childStatus)
          + '</div>'
          + '<div style="font-size:13px;color:var(--gray-500);margin-bottom:8px">' + Utils.escapeHtml(getSubjectName(a.subjectId)) + '</div>'
          + '<div style="font-size:13px;color:var(--gray-500)">\uD83D\uDD52 Due: ' + dueStr + '</div>'
          + (a.maxScore ? '<div style="font-size:12px;color:var(--gray-400);margin-top:4px">Max Score: ' + a.maxScore + '</div>' : '')
          + scoreDisplay
          + subInfo
          + '</div></div>';
      });

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  MODALS                                                             */
  /* ================================================================== */

  /* ------------------------------------------------------------------ */
  /*  Create Assignment Modal                                            */
  /* ------------------------------------------------------------------ */

  function openCreateAssignmentModal() {
    var classOpts = _classes.map(function (c) {
      return optionTag(c.id, c.name, false);
    }).join('');

    var subjectOpts = _subjects.map(function (s) {
      return optionTag(s.id, s.name, false);
    }).join('');

    var formHtml = '<div class="modal-form" id="create-assignment-form">'
      + '<div style="display:grid;gap:16px">'
      + '<div><label class="form-label">Title <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" name="title" class="form-input" placeholder="e.g. Chapter 5 Practice Problems"></div>'
      + '<div><label class="form-label">Description</label>'
      + '<textarea name="description" class="form-input" rows="4" placeholder="Describe the assignment requirements\u2026" style="resize:vertical"></textarea></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Subject <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="subjectId" class="form-select" id="ca-subject-select">'
      + '<option value="">Select Subject</option>' + subjectOpts + '</select></div>'
      + '<div><label class="form-label">Class <span style="color:var(--danger-500)">*</span></label>'
      + '<select name="classId" class="form-select" id="ca-class-select">'
      + '<option value="">Select Class</option>' + classOpts + '</select></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div><label class="form-label">Due Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="datetime-local" name="dueDate" class="form-input"></div>'
      + '<div><label class="form-label">Max Score</label>'
      + '<input type="number" name="maxScore" class="form-input" placeholder="100" value="100" min="1"></div>'
      + '</div>'
      + '<div style="padding:10px 14px;background:var(--gray-50);border-radius:6px;font-size:13px;color:var(--gray-600)">'
      + '\uD83D\uDCC4 <strong>File Attachments:</strong> Enter the file name(s) as text reference below. Actual file uploads should be handled via your school\'s file storage.'
      + '</div>'
      + '<div><label class="form-label">Attachment File Name(s)</label>'
      + '<input type="text" name="fileName" class="form-input" placeholder="e.g. chapter5_exercises.pdf"></div>'
      + '</div></div>';

    Modal.open('Create Assignment', formHtml, {
      size: 'large',
      actions: [{
        label: 'Create Assignment',
        className: 'btn btn-primary',
        onClick: function () { submitCreateAssignment(); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitCreateAssignment() {
    var form = document.getElementById('create-assignment-form');
    if (!form) return;

    var title = form.querySelector('[name="title"]').value.trim();
    var description = form.querySelector('[name="description"]').value.trim();
    var subjectId = form.querySelector('[name="subjectId"]').value;
    var classId = form.querySelector('[name="classId"]').value;
    var dueDate = form.querySelector('[name="dueDate"]').value;
    var maxScore = parseInt(form.querySelector('[name="maxScore"]').value, 10) || 100;
    var fileName = form.querySelector('[name="fileName"]').value.trim();

    if (!title) { Toast.error('Please enter a title.'); return; }
    if (!subjectId) { Toast.error('Please select a subject.'); return; }
    if (!classId) { Toast.error('Please select a class.'); return; }
    if (!dueDate) { Toast.error('Please set a due date.'); return; }

    var session = getActiveSession();
    var term = getActiveTerm();

    var data = {
      schoolId: getSchoolId(),
      title: title,
      description: description,
      subjectId: subjectId,
      subjectName: getSubjectName(subjectId),
      classId: classId,
      className: getClassName(classId),
      dueDate: dueDate,
      maxScore: maxScore,
      fileName: fileName || '',
      status: 'active',
      createdBy: getUid(),
      createdByName: getProfile().displayName || '',
      sessionId: session ? session.id : '',
      termId: term ? term.id : '',
      createdAt: new Date().toISOString()
    };

    Toast.info('Creating assignment\u2026');

    DataService.add('assignments', data).then(function () {
      Toast.success('Assignment created successfully!');
      Modal.close();
      DataService.logAction('assignment_created', 'assignments', null, { title: title, classId: classId });
      // Reload
      reloadView();
    }).catch(function (err) {
      Toast.error('Failed to create assignment: ' + (err.message || 'Unknown error'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  View Assignment Details / Submissions Modal                        */
  /* ------------------------------------------------------------------ */

  function openViewAssignmentModal(assignmentId) {
    var assignment = _assignments.find(function (a) { return a.id === assignmentId; });
    if (!assignment) { Toast.error('Assignment not found.'); return; }

    var subs = _submissions.filter(function (s) { return s.assignmentId === assignmentId; });
    var studentCount = getStudentCountForAssignment(assignment);
    var gradedCount = subs.filter(function (s) { return s.score !== undefined && s.score !== null && s.score !== ''; }).length;

    var contentHtml = '<div id="assignment-detail-view">';

    // Details
    contentHtml += '<div style="margin-bottom:20px;padding:16px;background:var(--gray-50);border-radius:8px">'
      + '<h3 style="margin:0 0 8px;font-size:17px;font-weight:600">' + Utils.escapeHtml(assignment.title) + '</h3>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">'
      + '<span style="font-size:12px;background:var(--white);padding:4px 10px;border-radius:4px;border:1px solid var(--gray-200)">' + Utils.escapeHtml(getSubjectName(assignment.subjectId)) + '</span>'
      + '<span style="font-size:12px;background:var(--white);padding:4px 10px;border-radius:4px;border:1px solid var(--gray-200)">' + Utils.escapeHtml(getClassName(assignment.classId)) + (assignment.arm ? ' (' + Utils.escapeHtml(assignment.arm) + ')' : '') + '</span>'
      + statusBadge(getAssignmentStatus(assignment))
      + '</div>';

    if (assignment.description) {
      contentHtml += '<p style="font-size:14px;color:var(--gray-600);margin:0 0 8px;line-height:1.5;white-space:pre-wrap">' + Utils.escapeHtml(assignment.description) + '</p>';
    }

    contentHtml += '<div style="display:flex;gap:20px;font-size:13px;color:var(--gray-500);margin-top:8px">'
      + '<span>\uD83D\uDD52 Due: ' + (assignment.dueDate ? Utils.formatDate(assignment.dueDate) : '\u2014') + '</span>'
      + '<span>\u2B50 Max: ' + (assignment.maxScore || 100) + '</span>'
      + (assignment.fileName ? '<span>\uD83D\uDCC4 ' + Utils.escapeHtml(assignment.fileName) + '</span>' : '')
      + '</div>'
      + '</div>';

    // Submissions summary
    contentHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<h4 style="margin:0;font-size:15px;font-weight:600">Submissions (' + subs.length + '/' + studentCount + ')</h4>'
      + '<div style="font-size:13px;color:var(--gray-500)">Graded: ' + gradedCount + '/' + subs.length + '</div>'
      + '</div>';

    if (!subs.length) {
      contentHtml += emptyState('\uD83D\uDCE5', 'No Submissions Yet', 'Students have not submitted any work.');
    } else {
      contentHtml += '<div style="overflow-x:auto;max-height:400px;overflow-y:auto">'
        + '<table class="data-table" id="submissions-table">'
        + '<thead style="position:sticky;top:0;background:var(--white);z-index:1"><tr>'
        + '<th style="width:30px">#</th>'
        + '<th>Student Name</th>'
        + '<th>Submitted</th>'
        + '<th style="width:100px">Score</th>'
        + '<th>Status</th>'
        + '<th>File</th>'
        + '</tr></thead><tbody>';

      subs.forEach(function (sub, idx) {
        var studentName = getStudentName(sub.studentId);
        var isGraded = sub.score !== undefined && sub.score !== null && sub.score !== '';
        var subStatus = isGraded ? 'graded' : 'submitted';

        contentHtml += '<tr>'
          + '<td>' + (idx + 1) + '</td>'
          + '<td style="font-weight:500">' + Utils.escapeHtml(studentName) + '</td>'
          + '<td style="font-size:13px;color:var(--gray-500)">' + (sub.submittedAt ? Utils.formatDate(sub.submittedAt) : '\u2014') + '</td>'
          + '<td>'
          + '<input type="number" class="form-input" style="width:80px;padding:4px 8px;font-size:13px" '
          + 'data-submission-id="' + sub.id + '" data-field="score" '
          + 'value="' + (isGraded ? sub.score : '') + '" '
          + 'min="0" max="' + (assignment.maxScore || 100) + '" '
          + 'placeholder="\u2014">'
          + '</td>'
          + '<td>' + statusBadge(subStatus) + '</td>'
          + '<td style="font-size:13px">' + (sub.fileName ? Utils.escapeHtml(sub.fileName) : '\u2014') + '</td>'
          + '</tr>';
      });

      contentHtml += '</tbody></table></div>';
    }

    contentHtml += '</div>';

    var actions = [{
      label: 'Save Scores',
      className: 'btn btn-primary',
      onClick: function () { saveScores(assignmentId); }
    }, {
      label: 'Delete Assignment',
      className: 'btn btn-ghost',
      style: 'color:var(--danger-600);margin-left:auto',
      onClick: function () {
        Modal.close();
        deleteAssignment(assignmentId);
      }
    }, {
      label: 'Close',
      className: 'btn btn-ghost',
      onClick: function () { Modal.close(); }
    }];

    Modal.open('Assignment Details', contentHtml, {
      size: 'large',
      actions: actions
    });
  }

  function saveScores(assignmentId) {
    var assignment = _assignments.find(function (a) { return a.id === assignmentId; });
    if (!assignment) return;

    var inputs = document.querySelectorAll('#submissions-table input[data-field="score"]');
    if (!inputs.length) {
      Toast.info('No submissions to score.');
      return;
    }

    var promises = [];
    inputs.forEach(function (input) {
      var subId = input.dataset.submissionId;
      var scoreVal = input.value.trim();
      var score = scoreVal !== '' ? Number(scoreVal) : null;

      if (score !== null && isNaN(score)) return;

      var updateData = { score: score, gradedAt: new Date().toISOString() };

      promises.push(
        DataService.update('submissions', subId, updateData)
      );
    });

    Toast.info('Saving scores\u2026');

    Promise.all(promises).then(function () {
      Toast.success('Scores saved successfully!');
      DataService.logAction('assignment_scores_saved', 'submissions', null, { assignmentId: assignmentId });
      // Reload and reopen
      loadAssignments().then(function () {
        Modal.close();
        openViewAssignmentModal(assignmentId);
      });
    }).catch(function (err) {
      Toast.error('Failed to save scores: ' + (err.message || 'Unknown error'));
    });
  }

  function deleteAssignment(assignmentId) {
    var assignment = _assignments.find(function (a) { return a.id === assignmentId; });
    if (!assignment) { Toast.error('Assignment not found.'); return; }

    Modal.confirm(
      'Delete Assignment',
      'Are you sure you want to permanently delete <strong>' + Utils.escapeHtml(assignment.title || 'this assignment') + '</strong>? All associated submissions will also be removed. This action cannot be undone.',
      function () {
        Toast.info('Deleting assignment\u2026');

        // Delete associated submissions first
        var subs = _submissions.filter(function (s) { return s.assignmentId === assignmentId; });
        var subPromises = subs.map(function (s) {
          return DataService.remove('submissions', s.id).catch(function () {});
        });

        Promise.all(subPromises).then(function () {
          return DataService.remove('assignments', assignmentId);
        }).then(function () {
          Toast.success('Assignment deleted successfully.');
          DataService.logAction('assignment_deleted', 'assignments', assignmentId, { title: assignment.title });
          reloadView();
        }).catch(function (err) {
          Toast.error('Failed to delete assignment: ' + (err.message || 'Unknown error'));
        });
      }
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Submit Assignment Modal (Student)                                  */
  /* ------------------------------------------------------------------ */

  function openSubmitAssignmentModal(assignmentId) {
    var assignment = _assignments.find(function (a) { return a.id === assignmentId; });
    if (!assignment) { Toast.error('Assignment not found.'); return; }

    // Check if already submitted
    var existing = _submissions.find(function (s) {
      return s.assignmentId === assignmentId && s.studentId === getUid();
    });
    if (existing) {
      Toast.info('You have already submitted this assignment.');
      return;
    }

    var isLate = assignment.dueDate && new Date(assignment.dueDate) < new Date();

    var formHtml = '<div class="modal-form" id="submit-assignment-form">'
      + '<div style="display:grid;gap:16px">';

    if (isLate) {
      formHtml += '<div style="padding:10px 14px;background:var(--danger-50);border:1px solid var(--danger-200);border-radius:6px;font-size:13px;color:var(--danger-700)">'
        + '\u26A0\uFE0F <strong>Late Submission:</strong> The due date has passed. This will be marked as late.'
        + '</div>';
    }

    formHtml += '<div style="padding:12px 14px;background:var(--gray-50);border-radius:6px">'
      + '<div style="font-weight:600;font-size:15px;margin-bottom:4px">' + Utils.escapeHtml(assignment.title) + '</div>'
      + '<div style="font-size:13px;color:var(--gray-500)">' + Utils.escapeHtml(getSubjectName(assignment.subjectId)) + ' \u2022 Due: ' + (assignment.dueDate ? Utils.formatDate(assignment.dueDate) : '\u2014') + '</div>'
      + (assignment.description ? '<div style="font-size:13px;color:var(--gray-600);margin-top:8px;white-space:pre-wrap">' + Utils.escapeHtml(assignment.description) + '</div>' : '')
      + (assignment.maxScore ? '<div style="font-size:12px;color:var(--gray-400);margin-top:6px">Max Score: ' + assignment.maxScore + '</div>' : '')
      + '</div>';

    if (assignment.fileName) {
      formHtml += '<div style="font-size:13px;color:var(--gray-500)">\uD83D\uDCC4 Attachment: <strong>' + Utils.escapeHtml(assignment.fileName) + '</strong></div>';
    }

    formHtml += '<div><label class="form-label">Your Response</label>'
      + '<textarea name="response" class="form-input" rows="5" placeholder="Type your answer or response here\u2026" style="resize:vertical"></textarea></div>';

    formHtml += '<div style="padding:10px 14px;background:var(--gray-50);border-radius:6px;font-size:13px;color:var(--gray-600)">'
      + '\uD83D\uDCC4 <strong>File Attachments:</strong> Enter the file name of your submission below. Upload actual files via your school\'s file storage system.'
      + '</div>'
      + '<div><label class="form-label">Submission File Name</label>'
      + '<input type="text" name="fileName" class="form-input" placeholder="e.g. my_homework.docx"></div>';

    formHtml += '</div></div>';

    Modal.open('Submit Assignment', formHtml, {
      size: 'large',
      actions: [{
        label: 'Submit',
        className: 'btn btn-primary',
        onClick: function () { submitAssignment(assignmentId, isLate); }
      }, {
        label: 'Cancel',
        className: 'btn btn-ghost',
        onClick: function () { Modal.close(); }
      }]
    });
  }

  function submitAssignment(assignmentId, isLate) {
    var form = document.getElementById('submit-assignment-form');
    if (!form) return;

    var response = form.querySelector('[name="response"]').value.trim();
    var fileName = form.querySelector('[name="fileName"]').value.trim();

    if (!response && !fileName) {
      Toast.error('Please provide a response or file name.');
      return;
    }

    var data = {
      schoolId: getSchoolId(),
      assignmentId: assignmentId,
      studentId: getUid(),
      studentName: getProfile().displayName || '',
      response: response,
      fileName: fileName || '',
      late: !!isLate,
      submittedAt: new Date().toISOString(),
      score: null
    };

    Toast.info('Submitting assignment\u2026');

    DataService.add('submissions', data).then(function () {
      Toast.success('Assignment submitted successfully!');
      Modal.close();
      DataService.logAction('assignment_submitted', 'submissions', null, { assignmentId: assignmentId, late: isLate });
      reloadView();
    }).catch(function (err) {
      Toast.error('Failed to submit: ' + (err.message || 'Unknown error'));
    });
  }

  /* ================================================================== */
  /*  Reload helper                                                      */
  /* ================================================================== */

  function reloadView() {
    var container = document.getElementById('main-content');
    if (!container) return;
    container.innerHTML = loadingSpinner();

    loadAssignments().then(function () {
      if (isTeacher() || isAdmin()) {
        container.innerHTML = renderTeacherView();
      } else if (isStudent()) {
        container.innerHTML = renderStudentView();
      } else if (isParent()) {
        container.innerHTML = renderParentView();
      }
      bindEvents();
    }).catch(function (err) {
      console.error('Error reloading assignments:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to reload. Please refresh.');
    });
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

      switch (action) {
        case 'create-assignment':
          e.preventDefault();
          e.stopPropagation();
          openCreateAssignmentModal();
          break;

        case 'view-assignment':
          e.preventDefault();
          e.stopPropagation();
          openViewAssignmentModal(id);
          break;

        case 'submit-assignment':
          e.preventDefault();
          e.stopPropagation();
          openSubmitAssignmentModal(id);
          break;
      }
    };

    document.addEventListener('click', _clickHandler);
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
    _listeners.forEach(function (unsub) { if (typeof unsub === 'function') unsub(); });
    _listeners = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  window.Modules.assignments = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('assignments');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'Assignments' }
      ]);

      render();
    },

    destroy: function () {
      cleanup();
      _assignments = [];
      _submissions = [];
      _classes = [];
      _subjects = [];
      _students = [];
      _staff = [];
      _sessions = [];
      _terms = [];
    }
  };
})();