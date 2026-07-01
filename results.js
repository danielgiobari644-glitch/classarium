/**
 * Classarium Result Management Module
 * Comprehensive result entry, review, approval, and report card generation.
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

  var _sessions = [];
  var _terms = [];
  var _classes = [];
  var _subjects = [];
  var _students = [];
  var _scores = [];
  var _staff = [];
  var _schoolConfig = null;
  var _filters = { sessionId: '', termId: '', classId: '', arm: '', subjectId: '' };
  var _listeners = [];
  var _clickHandler = null;
  var _isSubmitting = false;
  var _compiledResults = null;

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function getProfile() {
    return window.App.state.profile || {};
  }

  function getSchoolId() {
    return getProfile().schoolId || '';
  }

  function isAdmin() {
    var r = getProfile().role;
    return r === 'school_admin' || r === 'vice_principal';
  }

  function isTeacher() {
    return getProfile().role === 'teacher';
  }

  function isClassManager() {
    return getProfile().role === 'class_manager';
  }

  function isStudent() {
    return getProfile().role === 'student';
  }

  function isParent() {
    return getProfile().role === 'parent';
  }

  function getSessionName(id) {
    var s = _sessions.find(function (x) { return x.id === id; });
    return s ? (s.name || '\u2014') : '\u2014';
  }

  function getTermName(id) {
    var t = _terms.find(function (x) { return x.id === id; });
    return t ? (t.name || '\u2014') : '\u2014';
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
    var s = _students.find(function (x) { return x.id === id; });
    return s ? (s.displayName || s.firstName + ' ' + s.lastName || '\u2014') : '\u2014';
  }

  function getStaffName(id) {
    var s = _staff.find(function (x) { return x.id === id || x.uid === id; });
    return s ? (s.displayName || s.firstName + ' ' + s.lastName || '\u2014') : '\u2014';
  }

  function getArmsForClass(classId) {
    var cls = _classes.find(function (c) { return c.id === classId; });
    if (!cls || !cls.arms) return [];
    return cls.arms;
  }

  function calcTotal(scores) {
    return (Number(scores.caTest) || 0) + (Number(scores.assignment) || 0) + (Number(scores.exam) || 0);
  }

  function calcGrade(total) {
    return Utils.getGrade(total);
  }

  function statusBadge(status) {
    var map = {
      submitted: { text: 'Submitted', icon: '\u2713', cls: 'info' },
      reviewed:  { text: 'Reviewed', icon: '\u2713', cls: 'warning' },
      approved:  { text: 'Approved', icon: '\u2713', cls: 'success' },
      published: { text: 'Published', icon: '\u2713', cls: 'success' },
      pending:   { text: 'Pending', icon: '\u25CB', cls: 'default' },
      revision:  { text: 'Revision', icon: '\u21BB', cls: 'danger' }
    };
    var s = map[status] || { text: Utils.capitalize(status || 'Pending'), icon: '\u25CB', cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.icon + ' ' + s.text + '</span>';
  }

  function gradeCell(percentage) {
    var g = Utils.getGrade(Number(percentage) || 0);
    return '<span class="grade-badge ' + g.class + '">' + g.grade + '</span> <small class="text-muted">' + g.remark + '</small>';
  }

  function optionTag(value, label, selected) {
    return '<option value="' + (value || '') + '"' + (selected ? ' selected' : '') + '>'
      + Utils.escapeHtml(label || 'Select') + '</option>';
  }

  function card(id, title, actions, bodyHtml) {
    var actionsHtml = actions ? '<div class="card-header-actions">' + actions + '</div>' : '';
    return '<div class="card"' + (id ? ' id="' + id + '"' : '') + '>'
      + '<div class="card-header"><h3 class="card-title">' + title + '</h3>' + actionsHtml + '</div>'
      + '<div class="card-body">' + (bodyHtml || '') + '</div></div>';
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

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    return Promise.all([
      DataService.getBySchool('sessions', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('terms', schoolId, { orderBy: 'order' }),
      DataService.getBySchool('classes', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('subjects', schoolId, { orderBy: 'name' }),
      DataService.getStudents(schoolId),
      DataService.getBySchool('staff', schoolId)
    ]).then(function (results) {
      _sessions = results[0] || [];
      _terms = results[1] || [];
      _classes = results[2] || [];
      _subjects = results[3] || [];
      _students = results[4] || [];
      _staff = results[5] || [];

      // Auto-select first active session and term
      if (!_filters.sessionId) {
        var activeSession = _sessions.find(function (s) { return s.status === 'active'; });
        if (activeSession) _filters.sessionId = activeSession.id;
      }
      if (!_filters.termId) {
        var activeTerm = _terms.find(function (t) { return t.status === 'active'; });
        if (activeTerm) _filters.termId = activeTerm.id;
      }
      if (!_filters.classId && _classes.length) {
        _filters.classId = _classes[0].id;
      }

      return DataService.getSchoolConfig(schoolId);
    }).then(function (config) {
      _schoolConfig = config;
    });
  }

  function loadScores() {
    if (!_filters.sessionId || !_filters.termId || !_filters.classId || !_filters.arm) {
      return Promise.resolve([]);
    }
    var schoolId = getSchoolId();
    var classArm = _filters.classId + '_' + _filters.arm;
    return DataService.getScores(schoolId, _filters.sessionId, _filters.termId, classArm)
      .then(function (scores) {
        _scores = scores || [];
        return _scores;
      });
  }

  function getSubjectsForClass(classId) {
    // Filter subjects relevant to this class based on department
    var cls = _classes.find(function (c) { return c.id === classId; });
    if (!cls) return _subjects;
    // If class has a subjects array, use that; otherwise return all
    if (cls.subjectIds && cls.subjectIds.length) {
      return _subjects.filter(function (s) { return cls.subjectIds.indexOf(s.id) !== -1; });
    }
    return _subjects;
  }

  function getSubjectsForTeacher() {
    var profile = getProfile();
    var teacher = _staff.find(function (s) { return s.uid === profile.uid; });
    if (!teacher) return _subjects;
    if (teacher.assignedSubjects && teacher.assignedSubjects.length) {
      return _subjects.filter(function (s) { return teacher.assignedSubjects.indexOf(s.id) !== -1; });
    }
    return _subjects;
  }

  function getClassesForTeacher() {
    var profile = getProfile();
    var teacher = _staff.find(function (s) { return s.uid === profile.uid; });
    if (!teacher) return _classes;
    if (teacher.assignedClasses && teacher.assignedClasses.length) {
      return _classes.filter(function (c) { return teacher.assignedClasses.indexOf(c.id) !== -1; });
    }
    return _classes;
  }

  /* ------------------------------------------------------------------ */
  /*  Filter Bar Builder                                                 */
  /* ------------------------------------------------------------------ */

  function filterBarHtml(options) {
    var showSession = options.session !== false;
    var showTerm = options.term !== false;
    var showClass = options.class !== false;
    var showArm = options.arm !== false;
    var showSubject = options.subject === true;
    var btnHtml = options.button || '';

    var html = '<div class="filter-bar">';
    if (showSession) {
      html += '<div class="filter-group"><label>Session</label><select id="res-filter-session" class="form-select">'
        + optionTag('', 'Select Session')
        + _sessions.map(function (s) { return optionTag(s.id, s.name, _filters.sessionId === s.id); }).join('')
        + '</select></div>';
    }
    if (showTerm) {
      html += '<div class="filter-group"><label>Term</label><select id="res-filter-term" class="form-select">'
        + optionTag('', 'Select Term')
        + _terms.map(function (t) { return optionTag(t.id, t.name, _filters.termId === t.id); }).join('')
        + '</select></div>';
    }
    if (showClass) {
      var classesToShow = options.classesForTeacher || _classes;
      html += '<div class="filter-group"><label>Class</label><select id="res-filter-class" class="form-select">'
        + optionTag('', 'Select Class')
        + classesToShow.map(function (c) { return optionTag(c.id, c.name, _filters.classId === c.id); }).join('')
        + '</select></div>';
    }
    if (showArm) {
      var arms = _filters.classId ? getArmsForClass(_filters.classId) : [];
      html += '<div class="filter-group"><label>Arm</label><select id="res-filter-arm" class="form-select">'
        + optionTag('', 'Select Arm')
        + arms.map(function (a) {
          var label = typeof a === 'object' ? a.name : a;
          var val = typeof a === 'object' ? a.id || a.name : a;
          return optionTag(val, label, _filters.arm === val);
        }).join('')
        + '</select></div>';
    }
    if (showSubject) {
      var subjectsToShow = options.subjectsForTeacher || getSubjectsForClass(_filters.classId);
      html += '<div class="filter-group"><label>Subject</label><select id="res-filter-subject" class="form-select">'
        + optionTag('', 'Select Subject')
        + subjectsToShow.map(function (s) { return optionTag(s.id, s.name, _filters.subjectId === s.id); }).join('')
        + '</select></div>';
    }
    if (btnHtml) {
      html += '<div class="filter-group" style="align-self:flex-end">' + btnHtml + '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  ADMIN / VP VIEW                                                    */
  /* ------------------------------------------------------------------ */

  function renderAdminView(container) {
    var html = '<div class="results-admin-view">';

    // Page header
    html += '<div class="page-header"><div class="page-header-row"><div>'
      + '<h1 class="page-header-title">Result Management</h1>'
      + '<p class="page-header-description">Monitor and manage result submission, review, and publication</p>'
      + '</div></div></div>';

    // Filter bar
    html += '<div id="res-admin-filters"></div>';

    // Content area
    html += '<div id="res-admin-content">' + loadingSpinner() + '</div>';

    html += '</div>';
    container.innerHTML = html;

    // Render filters
    var filterEl = document.getElementById('res-admin-filters');
    if (filterEl) {
      filterEl.innerHTML = filterBarHtml({
        session: true, term: true, class: true, arm: true,
        button: '<button class="btn btn-primary" id="res-admin-load-btn">Load Results</button>'
      });
    }

    // Auto-load if all filters set
    if (_filters.sessionId && _filters.termId && _filters.classId && _filters.arm) {
      loadAdminContent();
    }

    // Bind events
    bindAdminEvents(container);
  }

  function bindAdminEvents(container) {
    var loadBtn = document.getElementById('res-admin-load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        _filters.sessionId = (document.getElementById('res-filter-session') || {}).value || '';
        _filters.termId = (document.getElementById('res-filter-term') || {}).value || '';
        _filters.classId = (document.getElementById('res-filter-class') || {}).value || '';
        _filters.arm = (document.getElementById('res-filter-arm') || {}).value || '';
        if (!_filters.sessionId || !_filters.termId || !_filters.classId || !_filters.arm) {
          Toast.warn('Please select Session, Term, Class, and Arm.');
          return;
        }
        loadAdminContent();
      });
    }

    // Re-render arm dropdown when class changes
    var classSelect = document.getElementById('res-filter-class');
    if (classSelect) {
      classSelect.addEventListener('change', function () {
        _filters.classId = this.value;
        _filters.arm = '';
        var armEl = document.getElementById('res-filter-arm');
        if (armEl) {
          var arms = getArmsForClass(_filters.classId);
          armEl.innerHTML = optionTag('', 'Select Arm')
            + arms.map(function (a) {
              var label = typeof a === 'object' ? a.name : a;
              var val = typeof a === 'object' ? a.id || a.name : a;
              return optionTag(val, label);
            }).join('');
        }
      });
    }
  }

  function loadAdminContent() {
    var contentEl = document.getElementById('res-admin-content');
    if (!contentEl) return;
    contentEl.innerHTML = loadingSpinner();

    loadScores().then(function () {
      renderAdminResults(contentEl);
    }).catch(function (err) {
      console.error('Error loading scores:', err);
      contentEl.innerHTML = emptyState('\u26A0', 'Error loading results', 'Please try again.');
      Toast.error('Failed to load results.');
    });
  }

  function renderAdminResults(container) {
    var subjects = getSubjectsForClass(_filters.classId);
    var studentsInClass = _students.filter(function (st) {
      return st.classId === _filters.classId && st.arm === _filters.arm && st.status === 'active';
    });

    if (!studentsInClass.length) {
      container.innerHTML = emptyState('\uD83D\uDCDA', 'No students found', 'There are no active students in this class/arm.');
      return;
    }

    var html = '';

    // Completion card
    html += renderCompletionCard(subjects, studentsInClass);

    // Action buttons
    var allApproved = isAllApproved(subjects, studentsInClass);
    if (allApproved) {
      html += '<div style="display:flex;gap:12px;margin:20px 0">'
        + '<button class="btn btn-primary" id="res-generate-btn">\u2699 Generate Results</button>'
        + '<button class="btn btn-success" id="res-publish-btn">\uD83D\uDCE2 Publish Results</button>'
        + '</div>';
    }

    // Students table with compiled overview
    html += renderStudentsOverviewTable(studentsInClass, subjects);

    container.innerHTML = html;

    // Bind generate
    var genBtn = document.getElementById('res-generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        generateCompiledResults(studentsInClass, subjects);
      });
    }

    // Bind publish
    var pubBtn = document.getElementById('res-publish-btn');
    if (pubBtn) {
      pubBtn.addEventListener('click', function () {
        Modal.confirm('Publish Results', 'Are you sure you want to publish these results? Students and parents will be able to view them.', function () {
          publishResults().then(function () {
            Toast.success('Results published successfully!');
            loadAdminContent();
          });
        });
      });
    }
  }

  function getSubjectStatus(subjectId, studentsInClass) {
    var subjectScores = _scores.filter(function (sc) { return sc.subjectId === subjectId; });
    if (!subjectScores.length) return 'pending';
    // Check all statuses
    var statuses = subjectScores.map(function (sc) { return sc.status; });
    if (statuses.every(function (s) { return s === 'approved'; })) return 'approved';
    if (statuses.every(function (s) { return s === 'submitted' || s === 'reviewed' || s === 'approved'; })) {
      if (statuses.some(function (s) { return s === 'reviewed' || s === 'approved'; })) return 'reviewed';
      return 'submitted';
    }
    return 'submitted';
  }

  function getSubjectSubmissionCount(subjectId, studentsInClass) {
    var count = _scores.filter(function (sc) {
      return sc.subjectId === subjectId && sc.status === 'submitted';
    }).length;
    return count;
  }

  function isAllApproved(subjects, studentsInClass) {
    return subjects.every(function (subj) {
      return getSubjectStatus(subj.id, studentsInClass) === 'approved';
    });
  }

  function renderCompletionCard(subjects, studentsInClass) {
    var total = subjects.length;
    if (!total) return '';

    var approvedCount = 0;
    var submittedCount = 0;
    var reviewedCount = 0;
    var pendingCount = 0;

    var rows = subjects.map(function (subj) {
      var status = getSubjectStatus(subj.id, studentsInClass);
      if (status === 'approved') approvedCount++;
      else if (status === 'reviewed') reviewedCount++;
      else if (status === 'submitted') submittedCount++;
      else pendingCount++;

      var pct = studentsInClass.length ? Math.round((_scores.filter(function (sc) {
        return sc.subjectId === subj.id;
      }).length / studentsInClass.length) * 100) : 0;

      return '<tr>'
        + '<td>' + Utils.escapeHtml(subj.name) + '</td>'
        + '<td>' + pct + '%</td>'
        + '<td>' + statusBadge(status) + '</td>'
        + '</tr>';
    }).join('');

    var completedPct = Math.round(((approvedCount + reviewedCount) / total) * 100);

    var html = card('res-completion-card', 'Result Submission Progress', null,
      '<div class="progress-bar-container" style="margin-bottom:16px">'
      + '<div class="progress-bar" style="width:' + completedPct + '%;background:var(--primary)"></div>'
      + '</div>'
      + '<p style="margin-bottom:16px;color:var(--gray-600)">' + completedPct + '% complete \u2014 '
      + approvedCount + ' approved, ' + reviewedCount + ' reviewed, ' + submittedCount + ' submitted, ' + pendingCount + ' pending</p>'
      + '<div class="table-responsive"><table class="table table-sm">'
      + '<thead><tr><th>Subject</th><th>Entry Progress</th><th>Status</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div>'
    );

    return html;
  }

  function renderStudentsOverviewTable(studentsInClass, subjects) {
    var headerCols = '<th>SN</th><th>Student Name</th><th>Admission No.</th>';
    subjects.forEach(function (subj) {
      headerCols += '<th>' + Utils.escapeHtml(subj.name) + '</th>';
    });
    headerCols += '<th>Total</th><th>Average</th><th>Position</th>';

    var studentRows = studentsInClass.map(function (student, idx) {
      var row = '<tr>'
        + '<td>' + (idx + 1) + '</td>'
        + '<td><strong>' + Utils.escapeHtml(student.displayName || student.firstName + ' ' + student.lastName) + '</strong></td>'
        + '<td>' + Utils.escapeHtml(student.admissionNumber || '\u2014') + '</td>';

      var grandTotal = 0;
      var subjectsWithScores = 0;

      subjects.forEach(function (subj) {
        var score = _scores.find(function (sc) {
          return sc.studentId === student.id && sc.subjectId === subj.id;
        });
        if (score && score.total) {
          var g = Utils.getGrade(score.percentage);
          row += '<td><span class="grade-badge ' + g.class + '">' + score.total + '</span></td>';
          grandTotal += score.total;
          subjectsWithScores++;
        } else {
          row += '<td class="text-muted">\u2014</td>';
        }
      });

      var avg = subjectsWithScores ? (grandTotal / subjectsWithScores).toFixed(1) : '\u2014';
      row += '<td><strong>' + grandTotal + '</strong></td>';
      row += '<td>' + avg + '</td>';
      row += '<td>\u2014</td>'; // Position calculated after generate
      row += '</tr>';
      return row;
    }).join('');

    return card('res-students-overview', 'Students Overview (' + studentsInClass.length + ' students)', null,
      '<div class="table-responsive"><table class="table">' +
      '<thead><tr>' + headerCols + '</tr></thead>' +
      '<tbody>' + studentRows + '</tbody></table></div>'
    );
  }

  function generateCompiledResults(studentsInClass, subjects) {
    var compiled = studentsInClass.map(function (student) {
      var studentScores = {};
      var grandTotal = 0;
      var count = 0;

      subjects.forEach(function (subj) {
        var score = _scores.find(function (sc) {
          return sc.studentId === student.id && sc.subjectId === subj.id;
        });
        if (score) {
          studentScores[subj.id] = score;
          grandTotal += score.total || 0;
          count++;
        }
      });

      return {
        studentId: student.id,
        studentName: student.displayName || student.firstName + ' ' + student.lastName,
        admissionNumber: student.admissionNumber || '',
        className: getClassName(_filters.classId),
        arm: _filters.arm,
        sessionName: getSessionName(_filters.sessionId),
        termName: getTermName(_filters.termId),
        scores: studentScores,
        totalScore: grandTotal,
        average: count ? (grandTotal / count).toFixed(1) : 0,
        subjectCount: count
      };
    });

    // Calculate positions
    compiled.sort(function (a, b) { return b.totalScore - a.totalScore; });
    compiled.forEach(function (item, idx) {
      item.position = idx + 1;
    });

    // Save compiled results to state
    _compiledResults = compiled;

    DataService.logAction(getSchoolId(), getProfile().uid, 'generate_results', {
      sessionId: _filters.sessionId,
      termId: _filters.termId,
      classId: _filters.classId,
      arm: _filters.arm,
      studentCount: compiled.length
    });

    Toast.success('Results compiled for ' + compiled.length + ' students. Positions calculated.');

    // Re-render table with positions
    var contentEl = document.getElementById('res-admin-content');
    if (contentEl) renderAdminResults(contentEl);
  }

  function publishResults() {
    var schoolId = getSchoolId();
    var classArm = _filters.classId + '_' + _filters.arm;
    var profile = getProfile();

    // Update all scores for this class/arm to published
    var promises = _scores.map(function (score) {
      return DataService.update('scores', score.id, {
        status: 'published',
        publishedBy: profile.uid,
        publishedAt: new Date()
      });
    });

    return Promise.all(promises).then(function () {
      return DataService.logAction(schoolId, profile.uid, 'publish_results', {
        sessionId: _filters.sessionId,
        termId: _filters.termId,
        classArm: classArm
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  TEACHER VIEW - Enter Results                                       */
  /* ------------------------------------------------------------------ */

  function renderTeacherView(container) {
    var teacherClasses = getClassesForTeacher();
    var teacherSubjects = getSubjectsForTeacher();

    var html = '<div class="results-teacher-view">';
    html += '<div class="page-header"><div class="page-header-row"><div>'
      + '<h1 class="page-header-title">Enter Results</h1>'
      + '<p class="page-header-description">Enter CA Test, Assignment, and Exam scores for your students</p>'
      + '</div></div></div>';

    html += '<div id="res-teacher-filters"></div>';
    html += '<div id="res-teacher-content">' + loadingSpinner() + '</div>';
    html += '</div>';

    container.innerHTML = html;

    // Render filters
    var filterEl = document.getElementById('res-teacher-filters');
    if (filterEl) {
      filterEl.innerHTML = filterBarHtml({
        session: true, term: true, class: true, arm: true, subject: true,
        classesForTeacher: teacherClasses,
        subjectsForTeacher: teacherSubjects,
        button: '<button class="btn btn-primary" id="res-teacher-load-btn">Load Students</button>'
      });
    }

    bindTeacherEvents(container);
  }

  function bindTeacherEvents(container) {
    var loadBtn = document.getElementById('res-teacher-load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        _filters.sessionId = (document.getElementById('res-filter-session') || {}).value || '';
        _filters.termId = (document.getElementById('res-filter-term') || {}).value || '';
        _filters.classId = (document.getElementById('res-filter-class') || {}).value || '';
        _filters.arm = (document.getElementById('res-filter-arm') || {}).value || '';
        _filters.subjectId = (document.getElementById('res-filter-subject') || {}).value || '';
        if (!_filters.sessionId || !_filters.termId || !_filters.classId || !_filters.arm || !_filters.subjectId) {
          Toast.warn('Please select all filters.');
          return;
        }
        loadTeacherContent();
      });
    }

    // Re-render arm dropdown on class change
    var classSelect = document.getElementById('res-filter-class');
    if (classSelect) {
      classSelect.addEventListener('change', function () {
        _filters.classId = this.value;
        _filters.arm = '';
        var armEl = document.getElementById('res-filter-arm');
        if (armEl) {
          var arms = getArmsForClass(_filters.classId);
          armEl.innerHTML = optionTag('', 'Select Arm')
            + arms.map(function (a) {
              var label = typeof a === 'object' ? a.name : a;
              var val = typeof a === 'object' ? a.id || a.name : a;
              return optionTag(val, label);
            }).join('');
        }
        // Also update subjects based on class
        var teacherSubjects = getSubjectsForTeacher();
        var classSubjects = getSubjectsForClass(_filters.classId);
        var validSubjects = teacherSubjects.filter(function (ts) {
          return classSubjects.some(function (cs) { return cs.id === ts.id; });
        });
        var subjectEl = document.getElementById('res-filter-subject');
        if (subjectEl) {
          subjectEl.innerHTML = optionTag('', 'Select Subject')
            + validSubjects.map(function (s) { return optionTag(s.id, s.name); }).join('');
        }
      });
    }
  }

  function loadTeacherContent() {
    var contentEl = document.getElementById('res-teacher-content');
    if (!contentEl) return;
    contentEl.innerHTML = loadingSpinner();

    loadScores().then(function () {
      renderTeacherEntryForm(contentEl);
    }).catch(function (err) {
      console.error('Error loading scores:', err);
      contentEl.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load student data.');
      Toast.error('Failed to load students.');
    });
  }

  function renderTeacherEntryForm(container) {
    var studentsInClass = _students.filter(function (st) {
      return st.classId === _filters.classId && st.arm === _filters.arm && st.status === 'active';
    });

    if (!studentsInClass.length) {
      container.innerHTML = emptyState('\uD83D\uDCDA', 'No students', 'No active students in this class/arm.');
      return;
    }

    // Check if already submitted/approved
    var existingScores = _scores.filter(function (sc) { return sc.subjectId === _filters.subjectId; });
    var allApproved = existingScores.length && existingScores.every(function (s) { return s.status === 'approved' || s.status === 'reviewed'; });

    var html = '';

    if (allApproved) {
      html += '<div class="alert alert-info" style="margin-bottom:16px">'
        + '\u2705 Results for ' + Utils.escapeHtml(getSubjectName(_filters.subjectId))
        + ' have been reviewed/approved. Contact the class manager for revisions.</div>';
    }

    // Instructions card
    html += card(null, 'Score Entry \u2014 ' + Utils.escapeHtml(getSubjectName(_filters.subjectId)),
      '<span class="badge badge-info">' + studentsInClass.length + ' students</span>',
      '<div style="display:flex;gap:24px;margin-bottom:12px;font-size:13px;color:var(--gray-500)">'
      + '<span>CA Test: <strong>max 20</strong></span>'
      + '<span>Assignment: <strong>max 10</strong></span>'
      + '<span>Exam: <strong>max 70</strong></span>'
      + '<span>Total: <strong>100</strong></span>'
      + '</div>'
    );

    // Entry table
    html += '<div class="table-responsive"><table class="table" id="res-entry-table">';
    html += '<thead><tr><th style="width:40px">SN</th><th>Student Name</th>'
      + '<th style="width:100px">CA Test <small>(/20)</small></th>'
      + '<th style="width:100px">Assignment <small>(/10)</small></th>'
      + '<th style="width:100px">Exam <small>(/70)</small></th>'
      + '<th style="width:70px">Total</th>'
      + '<th style="width:70px">%</th>'
      + '<th style="width:80px">Grade</th>'
      + '<th style="width:100px">Remark</th>'
      + '</tr></thead><tbody>';

    studentsInClass.forEach(function (student, idx) {
      var existing = _scores.find(function (sc) {
        return sc.studentId === student.id && sc.subjectId === _filters.subjectId;
      });
      var caTest = existing ? (existing.caTest || 0) : '';
      var assignment = existing ? (existing.assignment || 0) : '';
      var exam = existing ? (existing.exam || 0) : '';
      var total = calcTotal({ caTest: caTest, assignment: assignment, exam: exam });
      var pct = total;
      var grade = calcGrade(pct);
      var isLocked = existing && (existing.status === 'reviewed' || existing.status === 'approved');

      var disabled = isLocked ? ' disabled' : '';
      var rowClass = isLocked ? ' style="opacity:0.6"' : '';

      html += '<tr data-student-id="' + student.id + '"' + rowClass + '>'
        + '<td>' + (idx + 1) + '</td>'
        + '<td><strong>' + Utils.escapeHtml(student.displayName || student.firstName + ' ' + student.lastName) + '</strong>'
        + (isLocked ? ' <span class="badge badge-success" style="font-size:10px">Locked</span>' : '')
        + '</td>'
        + '<td><input type="number" class="form-input score-ca" data-sid="' + student.id + '" min="0" max="20" step="1" value="' + caTest + '"' + disabled + '></td>'
        + '<td><input type="number" class="form-input score-asgn" data-sid="' + student.id + '" min="0" max="10" step="1" value="' + assignment + '"' + disabled + '></td>'
        + '<td><input type="number" class="form-input score-exam" data-sid="' + student.id + '" min="0" max="70" step="1" value="' + exam + '"' + disabled + '></td>'
        + '<td class="score-total" data-sid="' + student.id + '"><strong>' + (total || '\u2014') + '</strong></td>'
        + '<td class="score-pct" data-sid="' + student.id + '">' + (pct ? pct + '%' : '\u2014') + '</td>'
        + '<td class="score-grade" data-sid="' + student.id + '">' + (total ? gradeCell(pct) : '\u2014') + '</td>'
        + '<td class="score-remark" data-sid="' + student.id + '"><small>' + (total ? grade.remark : '\u2014') + '</small></td>'
        + '</tr>';
    });

    html += '</tbody></table></div>';

    // Submit button
    if (!allApproved) {
      html += '<div style="margin-top:20px;display:flex;gap:12px">'
        + '<button class="btn btn-primary" id="res-submit-all-btn" style="min-width:160px">'
        + '\uD83D\uDCE4 Submit All Results</button>'
        + '<button class="btn btn-outline" id="res-clear-btn">Clear All</button>'
        + '</div>';
    }

    container.innerHTML = html;

    // Bind auto-calculation
    container.querySelectorAll('.score-ca, .score-asgn, .score-exam').forEach(function (input) {
      input.addEventListener('input', function () {
        var sid = this.getAttribute('data-sid');
        var row = this.closest('tr');
        var ca = Number(row.querySelector('.score-ca').value) || 0;
        var asgn = Number(row.querySelector('.score-asgn').value) || 0;
        var exam = Number(row.querySelector('.score-exam').value) || 0;

        // Clamp values
        if (ca > 20) { ca = 20; row.querySelector('.score-ca').value = 20; }
        if (asgn > 10) { asgn = 10; row.querySelector('.score-asgn').value = 10; }
        if (exam > 70) { exam = 70; row.querySelector('.score-exam').value = 70; }

        var total = ca + asgn + exam;
        var grade = calcGrade(total);

        container.querySelector('.score-total[data-sid="' + sid + '"]').innerHTML = '<strong>' + (total || '\u2014') + '</strong>';
        container.querySelector('.score-pct[data-sid="' + sid + '"]').textContent = total ? total + '%' : '\u2014';
        container.querySelector('.score-grade[data-sid="' + sid + '"]').innerHTML = total ? gradeCell(total) : '\u2014';
        container.querySelector('.score-remark[data-sid="' + sid + '"]').innerHTML = '<small>' + (total ? grade.remark : '\u2014') + '</small>';
      });
    });

    // Bind submit
    var submitBtn = document.getElementById('res-submit-all-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        submitTeacherScores(studentsInClass);
      });
    }

    // Bind clear
    var clearBtn = document.getElementById('res-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        container.querySelectorAll('.score-ca, .score-asgn, .score-exam').forEach(function (inp) { inp.value = ''; });
        container.querySelectorAll('.score-total, .score-pct, .score-grade, .score-remark').forEach(function (el) {
          el.innerHTML = '\u2014';
        });
      });
    }
  }

  function submitTeacherScores(studentsInClass) {
    if (_isSubmitting) return;
    _isSubmitting = true;

    var profile = getProfile();
    var schoolId = getSchoolId();
    var classArm = _filters.classId + '_' + _filters.arm;
    var promises = [];
    var errorCount = 0;

    studentsInClass.forEach(function (student) {
      var row = document.querySelector('#res-entry-table tr[data-student-id="' + student.id + '"]');
      if (!row) return;

      var ca = Number(row.querySelector('.score-ca').value) || 0;
      var asgn = Number(row.querySelector('.score-asgn').value) || 0;
      var exam = Number(row.querySelector('.score-exam').value) || 0;

      if (ca === 0 && asgn === 0 && exam === 0) return; // skip empty rows

      // Check if locked
      var existing = _scores.find(function (sc) {
        return sc.studentId === student.id && sc.subjectId === _filters.subjectId;
      });
      if (existing && (existing.status === 'reviewed' || existing.status === 'approved')) return;

      promises.push(
        DataService.submitSubjectScore({
          schoolId: schoolId,
          sessionId: _filters.sessionId,
          termId: _filters.termId,
          classArm: classArm,
          subjectId: _filters.subjectId,
          studentId: student.id,
          scores: { caTest: ca, assignment: asgn, exam: exam },
          submittedBy: profile.uid
        }).catch(function (err) {
          console.error('Error submitting score for ' + student.id, err);
          errorCount++;
        })
      );
    });

    if (!promises.length) {
      _isSubmitting = false;
      Toast.warn('No scores to submit. Enter at least one score.');
      return;
    }

    Toast.info('Submitting ' + promises.length + ' scores\u2026');

    Promise.all(promises).then(function () {
      _isSubmitting = false;
      if (errorCount) {
        Toast.warn(promises.length - errorCount + ' of ' + promises.length + ' scores submitted. ' + errorCount + ' failed.');
      } else {
        Toast.success('All ' + promises.length + ' scores submitted successfully!');
      }
      DataService.logAction(schoolId, profile.uid, 'submit_scores', {
        sessionId: _filters.sessionId,
        termId: _filters.termId,
        classArm: classArm,
        subjectId: _filters.subjectId,
        count: promises.length
      });
      loadTeacherContent();
    }).catch(function (err) {
      _isSubmitting = false;
      Toast.error('Error submitting scores.');
      console.error(err);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  CLASS MANAGER VIEW - Review Results                                */
  /* ------------------------------------------------------------------ */

  function renderClassManagerView(container) {
    var html = '<div class="results-class-manager-view">';
    html += '<div class="page-header"><div class="page-header-row"><div>'
      + '<h1 class="page-header-title">Review Results</h1>'
      + '<p class="page-header-description">Review, approve, or request revisions for submitted results</p>'
      + '</div></div></div>';

    html += '<div id="res-cm-filters"></div>';
    html += '<div id="res-cm-content">' + loadingSpinner() + '</div>';
    html += '</div>';

    container.innerHTML = html;

    var filterEl = document.getElementById('res-cm-filters');
    if (filterEl) {
      filterEl.innerHTML = filterBarHtml({
        session: true, term: true, class: true, arm: true,
        button: '<button class="btn btn-primary" id="res-cm-load-btn">Load Results</button>'
      });
    }

    if (_filters.sessionId && _filters.termId && _filters.classId && _filters.arm) {
      loadClassManagerContent();
    }

    // Bind events
    var loadBtn = document.getElementById('res-cm-load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        _filters.sessionId = (document.getElementById('res-filter-session') || {}).value || '';
        _filters.termId = (document.getElementById('res-filter-term') || {}).value || '';
        _filters.classId = (document.getElementById('res-filter-class') || {}).value || '';
        _filters.arm = (document.getElementById('res-filter-arm') || {}).value || '';
        if (!_filters.sessionId || !_filters.termId || !_filters.classId || !_filters.arm) {
          Toast.warn('Please select all filters.');
          return;
        }
        loadClassManagerContent();
      });
    }

    var classSelect = document.getElementById('res-filter-class');
    if (classSelect) {
      classSelect.addEventListener('change', function () {
        _filters.classId = this.value;
        _filters.arm = '';
        var armEl = document.getElementById('res-filter-arm');
        if (armEl) {
          var arms = getArmsForClass(_filters.classId);
          armEl.innerHTML = optionTag('', 'Select Arm')
            + arms.map(function (a) {
              var label = typeof a === 'object' ? a.name : a;
              var val = typeof a === 'object' ? a.id || a.name : a;
              return optionTag(val, label);
            }).join('');
        }
      });
    }
  }

  function loadClassManagerContent() {
    var contentEl = document.getElementById('res-cm-content');
    if (!contentEl) return;
    contentEl.innerHTML = loadingSpinner();

    loadScores().then(function () {
      renderClassManagerContent(contentEl);
    }).catch(function (err) {
      console.error('Error loading scores:', err);
      contentEl.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load results.');
      Toast.error('Failed to load results.');
    });
  }

  function renderClassManagerContent(container) {
    var subjects = getSubjectsForClass(_filters.classId);
    var studentsInClass = _students.filter(function (st) {
      return st.classId === _filters.classId && st.arm === _filters.arm && st.status === 'active';
    });

    if (!studentsInClass.length) {
      container.innerHTML = emptyState('\uD83D\uDCDA', 'No students', 'No active students found.');
      return;
    }

    var html = '';

    // Subject status overview
    html += renderCompletionCard(subjects, studentsInClass);

    // Per-subject review sections
    subjects.forEach(function (subj) {
      var subjectScores = _scores.filter(function (sc) { return sc.subjectId === subj.id; });
      if (!subjectScores.length) return;

      var allSubmitted = subjectScores.every(function (sc) { return sc.status === 'submitted'; });
      var allReviewed = subjectScores.every(function (sc) { return sc.status === 'reviewed'; });
      var allApproved = subjectScores.every(function (sc) { return sc.status === 'approved'; });

      var statusLabel = allApproved ? 'All Approved' : allReviewed ? 'All Reviewed' : allSubmitted ? 'All Submitted' : 'Mixed Status';

      html += card(null, Utils.escapeHtml(subj.name) + ' \u2014 ' + statusLabel,
        allSubmitted ? '<button class="btn btn-sm btn-primary" data-cm-approve="' + subj.id + '">\u2713 Approve All</button>'
        + (allSubmitted ? ' <button class="btn btn-sm btn-outline" data-cm-revision="' + subj.id + '">\u21BB Request Revision</button>' : '')
        : allReviewed ? '<button class="btn btn-sm btn-success" data-cm-approve="' + subj.id + '">\u2713 Approve All</button>' : '',
        renderReviewTable(subjectScores, studentsInClass)
      );
    });

    // Action buttons
    var allApproved = subjects.every(function (subj) {
      var ss = _scores.filter(function (sc) { return sc.subjectId === subj.id; });
      return ss.length && ss.every(function (s) { return s.status === 'approved'; });
    });

    if (allApproved) {
      html += '<div style="display:flex;gap:12px;margin:20px 0">'
        + '<button class="btn btn-primary" id="res-cm-generate-btn">\u2699 Generate Results</button>'
        + '<button class="btn btn-success" id="res-cm-publish-btn">\uD83D\uDCE2 Publish Results</button>'
        + '</div>';
    }

    container.innerHTML = html;

    // Bind approve all per subject
    container.querySelectorAll('[data-cm-approve]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var subjectId = this.getAttribute('data-cm-approve');
        approveSubjectScores(subjectId, studentsInClass);
      });
    });

    // Bind revision request per subject
    container.querySelectorAll('[data-cm-revision]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var subjectId = this.getAttribute('data-cm-revision');
        requestRevision(subjectId);
      });
    });

    // Generate & publish
    var genBtn = document.getElementById('res-cm-generate-btn');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        generateCompiledResults(studentsInClass, subjects);
      });
    }

    var pubBtn = document.getElementById('res-cm-publish-btn');
    if (pubBtn) {
      pubBtn.addEventListener('click', function () {
        Modal.confirm('Publish Results', 'Publish these results so students and parents can view them?', function () {
          publishResults().then(function () {
            Toast.success('Results published!');
            loadClassManagerContent();
          });
        });
      });
    }
  }

  function renderReviewTable(subjectScores, studentsInClass) {
    var html = '<div class="table-responsive"><table class="table table-sm">';
    html += '<thead><tr><th>Student</th><th>CA Test</th><th>Assignment</th><th>Exam</th><th>Total</th><th>%</th><th>Grade</th><th>Status</th></tr></thead>';
    html += '<tbody>';

    subjectScores.forEach(function (score) {
      var studentName = getStudentName(score.studentId);
      var g = Utils.getGrade(score.percentage || 0);
      html += '<tr>'
        + '<td>' + Utils.escapeHtml(studentName) + '</td>'
        + '<td>' + (score.caTest || 0) + '</td>'
        + '<td>' + (score.assignment || 0) + '</td>'
        + '<td>' + (score.exam || 0) + '</td>'
        + '<td><strong>' + (score.total || 0) + '</strong></td>'
        + '<td>' + (score.percentage || 0) + '%</td>'
        + '<td><span class="grade-badge ' + g.class + '">' + g.grade + '</span></td>'
        + '<td>' + statusBadge(score.status) + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function approveSubjectScores(subjectId, studentsInClass) {
    var profile = getProfile();
    var promises = _scores
      .filter(function (sc) { return sc.subjectId === subjectId && sc.status !== 'approved'; })
      .map(function (sc) {
        return DataService.update('scores', sc.id, {
          status: 'approved',
          approvedBy: profile.uid,
          approvedAt: new Date()
        });
      });

    if (!promises.length) {
      Toast.info('All scores for this subject are already approved.');
      return;
    }

    Toast.info('Approving scores\u2026');
    Promise.all(promises).then(function () {
      Toast.success('All scores for ' + getSubjectName(subjectId) + ' approved!');
      DataService.logAction(getSchoolId(), profile.uid, 'approve_scores', {
        subjectId: subjectId,
        sessionId: _filters.sessionId,
        termId: _filters.termId
      });
      loadClassManagerContent();
    }).catch(function (err) {
      Toast.error('Error approving scores.');
      console.error(err);
    });
  }

  function requestRevision(subjectId) {
    Modal.open({
      title: 'Request Revision',
      content: '<div class="form-group"><label>Reason for revision request</label>'
        + '<textarea id="res-revision-reason" class="form-textarea" rows="3" placeholder="Describe what needs to be revised\u2026"></textarea></div>',
      size: 'sm',
      footer: '<button class="btn btn-outline" onclick="window.Modal.close()">Cancel</button>'
        + '<button class="btn btn-primary" id="res-revision-submit-btn">Send Request</button>'
    });

    setTimeout(function () {
      var submitBtn = document.getElementById('res-revision-submit-btn');
      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          var reason = (document.getElementById('res-revision-reason') || {}).value || '';
          if (!reason.trim()) {
            Toast.warn('Please provide a reason.');
            return;
          }

          var profile = getProfile();
          var promises = _scores
            .filter(function (sc) { return sc.subjectId === subjectId; })
            .map(function (sc) {
              return DataService.update('scores', sc.id, {
                status: 'revision',
                revisionReason: reason,
                revisionRequestedBy: profile.uid,
                revisionRequestedAt: new Date()
              });
            });

          Promise.all(promises).then(function () {
            Modal.close();
            Toast.success('Revision request sent for ' + getSubjectName(subjectId));
            loadClassManagerContent();
          }).catch(function () {
            Toast.error('Error sending revision request.');
          });
        });
      }
    }, 100);
  }

  /* ------------------------------------------------------------------ */
  /*  STUDENT / PARENT VIEW - My Results                                 */
  /* ------------------------------------------------------------------ */

  function renderStudentParentView(container) {
    var isParentView = isParent();
    var title = isParentView ? 'Child Results' : 'My Results';
    var desc = isParentView
      ? 'View your child\'s academic performance across sessions'
      : 'View your academic performance across sessions';

    var html = '<div class="results-student-view">';
    html += '<div class="page-header"><div class="page-header-row"><div>'
      + '<h1 class="page-header-title">' + title + '</h1>'
      + '<p class="page-header-description">' + desc + '</p>'
      + '</div></div></div>';

    html += '<div id="res-sp-filters"></div>';
    html += '<div id="res-sp-content">' + loadingSpinner() + '</div>';
    html += '</div>';

    container.innerHTML = html;

    var filterEl = document.getElementById('res-sp-filters');
    if (filterEl) {
      filterEl.innerHTML = filterBarHtml({
        session: true, term: true,
        button: '<button class="btn btn-primary" id="res-sp-load-btn">View Results</button>'
      });
    }

    // Bind
    var loadBtn = document.getElementById('res-sp-load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        _filters.sessionId = (document.getElementById('res-filter-session') || {}).value || '';
        _filters.termId = (document.getElementById('res-filter-term') || {}).value || '';
        if (!_filters.sessionId || !_filters.termId) {
          Toast.warn('Please select Session and Term.');
          return;
        }
        loadStudentParentContent(container);
      });
    }

    // Auto-load if selected
    if (_filters.sessionId && _filters.termId) {
      loadStudentParentContent(container);
    }
  }

  function getTargetStudent() {
    if (isStudent()) {
      var profile = getProfile();
      return _students.find(function (s) { return s.uid === profile.uid; }) || { id: profile.uid };
    }
    if (isParent()) {
      // Parent sees their child's results
      var parentProfile = getProfile();
      var parentStudent = _students.find(function (s) { return s.parentId === parentProfile.uid || s.guardianId === parentProfile.uid; });
      return parentStudent || null;
    }
    return null;
  }

  function loadStudentParentContent(container) {
    var contentEl = document.getElementById('res-sp-content');
    if (!contentEl) return;
    contentEl.innerHTML = loadingSpinner();

    var student = getTargetStudent();
    if (!student) {
      contentEl.innerHTML = emptyState('\uD83D\uDC64', 'Student not found', 'No student record linked to your account.');
      return;
    }

    var schoolId = getSchoolId();
    var classArm = (student.classId || '') + '_' + (student.arm || '');

    DataService.getScores(schoolId, _filters.sessionId, _filters.termId, classArm)
      .then(function (scores) {
        var myScores = scores.filter(function (sc) { return sc.studentId === student.id; });
        // Only show published results
        myScores = myScores.filter(function (sc) { return sc.status === 'published'; });
        renderStudentResultView(contentEl, student, myScores);
      }).catch(function (err) {
        console.error('Error:', err);
        contentEl.innerHTML = emptyState('\u26A0', 'Error', 'Could not load results.');
        Toast.error('Failed to load results.');
      });
  }

  function renderStudentResultView(container, student, scores) {
    if (!scores.length) {
      container.innerHTML = emptyState('\uD83D\uDCCB', 'No Results Available',
        'Results for the selected session/term have not been published yet.');
      return;
    }

    var html = '';

    // Student summary card
    var totalScore = 0;
    var subjectCount = scores.length;
    scores.forEach(function (sc) { totalScore += (sc.total || 0); });
    var average = subjectCount ? (totalScore / subjectCount).toFixed(1) : 0;
    var avgGrade = Utils.getGrade(Number(average));

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px">';

    html += '<div class="stat-card"><div class="stat-card-icon" style="background:#EBF5FF">\uD83D\uDCDA</div>'
      + '<div class="stat-card-value">' + subjectCount + '</div><div class="stat-card-label">Subjects</div></div>';

    html += '<div class="stat-card"><div class="stat-card-icon" style="background:#ECFDF5">\u2705</div>'
      + '<div class="stat-card-value">' + totalScore + '</div><div class="stat-card-label">Total Score</div></div>';

    html += '<div class="stat-card"><div class="stat-card-icon" style="background:#FEF3C7">\u2B50</div>'
      + '<div class="stat-card-value">' + average + '%</div><div class="stat-card-label">Average</div></div>';

    html += '<div class="stat-card"><div class="stat-card-icon" style="background:#FDE8E8">'
      + '<span class="grade-badge ' + avgGrade.class + '" style="font-size:18px">' + avgGrade.grade + '</span></div>'
      + '<div class="stat-card-label">' + avgGrade.remark + '</div></div>';

    html += '</div>';

    // Result table
    html += card(null, 'Result Sheet \u2014 ' + Utils.escapeHtml(getSessionName(_filters.sessionId))
      + ', ' + Utils.escapeHtml(getTermName(_filters.termId)),
      '<div style="display:flex;gap:8px">'
      + '<button class="btn btn-sm btn-primary" id="res-download-report-btn">\u2B07 Download Report Card</button>'
      + '<button class="btn btn-sm btn-outline" id="res-print-report-btn">\uD83D\uDDA8 Print</button>'
      + '</div>',
      renderStudentResultTable(scores)
    );

    // Hidden report card for printing
    html += buildReportCardHtml(student, scores);

    container.innerHTML = html;

    // Bind download
    var dlBtn = document.getElementById('res-download-report-btn');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        downloadReportCard(student, scores);
      });
    }

    // Bind print
    var printBtn = document.getElementById('res-print-report-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        Utils.printElement('report-card-content');
      });
    }
  }

  function renderStudentResultTable(scores) {
    var html = '<div class="table-responsive"><table class="table">';
    html += '<thead><tr><th>S/N</th><th>Subject</th><th>CA Test</th><th>Assignment</th><th>Exam</th>'
      + '<th>Total</th><th>%</th><th>Grade</th><th>Remark</th></tr></thead>';
    html += '<tbody>';

    scores.forEach(function (sc, idx) {
      var g = Utils.getGrade(sc.percentage || 0);
      html += '<tr>'
        + '<td>' + (idx + 1) + '</td>'
        + '<td><strong>' + Utils.escapeHtml(getSubjectName(sc.subjectId)) + '</strong></td>'
        + '<td>' + (sc.caTest || 0) + '</td>'
        + '<td>' + (sc.assignment || 0) + '</td>'
        + '<td>' + (sc.exam || 0) + '</td>'
        + '<td><strong>' + (sc.total || 0) + '</strong></td>'
        + '<td>' + (sc.percentage || 0) + '%</td>'
        + '<td><span class="grade-badge ' + g.class + '">' + g.grade + '</span></td>'
        + '<td><small>' + g.remark + '</small></td>'
        + '</tr>';
    });

    // Summary row
    var grandTotal = 0;
    scores.forEach(function (sc) { grandTotal += (sc.total || 0); });
    var avg = scores.length ? (grandTotal / scores.length).toFixed(1) : 0;
    var avgG = Utils.getGrade(Number(avg));

    html += '<tr style="background:var(--gray-50);font-weight:600">'
      + '<td colspan="5" style="text-align:right"><strong>TOTAL / AVERAGE</strong></td>'
      + '<td>' + grandTotal + '</td>'
      + '<td>' + avg + '%</td>'
      + '<td><span class="grade-badge ' + avgG.class + '">' + avgG.grade + '</span></td>'
      + '<td>' + avgG.remark + '</td>'
      + '</tr>';

    html += '</tbody></table></div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Report Card Generation                                             */
  /* ------------------------------------------------------------------ */

  function buildReportCardHtml(student, scores) {
    var schoolName = _schoolConfig ? (_schoolConfig.schoolName || 'Classarium School') : 'Classarium School';
    var schoolAddress = _schoolConfig ? (_schoolConfig.address || '') : '';
    var schoolEmail = _schoolConfig ? (_schoolConfig.email || '') : '';
    var schoolMotto = _schoolConfig ? (_schoolConfig.motto || '') : '';
    var schoolLogo = _schoolConfig ? (_schoolConfig.logoUrl || '') : '';
    var className = getClassName(student.classId) || '';
    var arm = student.arm || '';
    var sessionName = getSessionName(_filters.sessionId);
    var termName = getTermName(_filters.termId);

    var totalScore = 0;
    scores.forEach(function (sc) { totalScore += (sc.total || 0); });
    var avg = scores.length ? (totalScore / scores.length).toFixed(1) : 0;
    var avgGrade = Utils.getGrade(Number(avg));

    var html = '<div id="report-card-content" class="report-card" style="display:none">';

    // Header
    html += '<div class="report-card-header" style="text-align:center;border-bottom:3px solid var(--gray-800);padding-bottom:16px;margin-bottom:24px">';
    if (schoolLogo) {
      html += '<img src="' + Utils.escapeHtml(schoolLogo) + '" alt="School Logo" style="height:64px;margin-bottom:8px">';
    }
    html += '<h1 style="font-size:22px;font-weight:700;margin:0">' + Utils.escapeHtml(schoolName) + '</h1>';
    if (schoolAddress) {
      html += '<p style="color:var(--gray-600);margin:4px 0">' + Utils.escapeHtml(schoolAddress) + '</p>';
    }
    if (schoolEmail) {
      html += '<p style="color:var(--gray-500);margin:2px 0">' + Utils.escapeHtml(schoolEmail) + '</p>';
    }
    if (schoolMotto) {
      html += '<p style="color:var(--primary);font-style:italic;margin-top:4px;font-size:13px">"' + Utils.escapeHtml(schoolMotto) + '"</p>';
    }
    html += '</div>';

    // Title
    html += '<h2 style="text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;color:var(--gray-700)">Student Report Card</h2>';

    // Student Info
    html += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;margin-bottom:24px;align-items:start">';
    html += '<div>';
    html += '<table style="width:100%;font-size:13px">';
    html += '<tr><td style="padding:4px 8px;font-weight:600;width:120px">Student Name:</td><td style="padding:4px 8px">' + Utils.escapeHtml(student.displayName || student.firstName + ' ' + student.lastName) + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;font-weight:600">Admission No.:</td><td style="padding:4px 8px">' + Utils.escapeHtml(student.admissionNumber || '\u2014') + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;font-weight:600">Class:</td><td style="padding:4px 8px">' + Utils.escapeHtml(className) + ' ' + Utils.escapeHtml(arm) + '</td></tr>';
    html += '</table></div>';

    // Photo placeholder
    html += '<div style="width:80px;height:96px;border:2px dashed var(--gray-300);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--gray-50)">'
      + '<span style="color:var(--gray-400);font-size:11px;text-align:center">Photo</span></div>';

    html += '<div>';
    html += '<table style="width:100%;font-size:13px">';
    html += '<tr><td style="padding:4px 8px;font-weight:600;width:120px">Session:</td><td style="padding:4px 8px">' + Utils.escapeHtml(sessionName) + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;font-weight:600">Term:</td><td style="padding:4px 8px">' + Utils.escapeHtml(termName) + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;font-weight:600">Total Attendance:</td><td style="padding:4px 8px">' + (student.presentDays || 0) + ' days</td></tr>';
    html += '</table></div>';
    html += '</div>';

    // Result Table
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">';
    html += '<thead><tr style="background:var(--gray-800);color:#fff">'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:left">S/N</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:left">Subject</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:center">CA Test (20)</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:center">Asgn (10)</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:center">Exam (70)</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:center">Total (100)</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:center">Grade</th>'
      + '<th style="padding:8px;border:1px solid var(--gray-300);text-align:left">Remark</th>'
      + '</tr></thead><tbody>';

    scores.forEach(function (sc, idx) {
      var bg = idx % 2 === 0 ? '#fff' : 'var(--gray-50)';
      var g = Utils.getGrade(sc.percentage || 0);
      html += '<tr style="background:' + bg + '">'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200);text-align:center">' + (idx + 1) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200)">' + Utils.escapeHtml(getSubjectName(sc.subjectId)) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200);text-align:center">' + (sc.caTest || 0) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200);text-align:center">' + (sc.assignment || 0) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200);text-align:center">' + (sc.exam || 0) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200);text-align:center;font-weight:600">' + (sc.total || 0) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200);text-align:center">' + g.grade + '</td>'
        + '<td style="padding:6px 8px;border:1px solid var(--gray-200)">' + g.remark + '</td>'
        + '</tr>';
    });

    // Summary row
    html += '<tr style="background:var(--gray-100);font-weight:700">'
      + '<td colspan="5" style="padding:8px;border:1px solid var(--gray-200);text-align:right">TOTAL / AVERAGE:</td>'
      + '<td style="padding:8px;border:1px solid var(--gray-200);text-align:center">' + totalScore + '</td>'
      + '<td style="padding:8px;border:1px solid var(--gray-200);text-align:center">' + avgGrade.grade + ' (' + avg + '%)</td>'
      + '<td style="padding:8px;border:1px solid var(--gray-200)">' + avgGrade.remark + '</td>'
      + '</tr>';

    html += '</tbody></table>';

    // Grading Key
    html += '<div style="margin-bottom:20px;font-size:11px;color:var(--gray-600)">'
      + '<strong>Grading Key:</strong> '
      + 'A (70-100) = Excellent | B (60-69) = Very Good | C (50-59) = Good | D (45-49) = Fair | F (0-44) = Poor'
      + '</div>';

    // Comment sections
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px">';
    html += '<div>'
      + '<strong style="font-size:13px">Class Manager\'s Comment:</strong>'
      + '<div style="border:1px solid var(--gray-200);border-radius:4px;min-height:60px;padding:8px;margin-top:4px;font-size:13px;color:var(--gray-600)">'
      + '</div></div>';
    html += '<div>'
      + '<strong style="font-size:13px">Principal\'s Comment:</strong>'
      + '<div style="border:1px solid var(--gray-200);border-radius:4px;min-height:60px;padding:8px;margin-top:4px;font-size:13px;color:var(--gray-600)">'
      + '</div></div>';
    html += '</div>';

    // Signatures
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;margin-top:40px">';
    html += '<div style="text-align:center">'
      + '<div style="border-bottom:1px solid var(--gray-400);margin-bottom:4px;min-height:40px"></div>'
      + '<span style="font-size:12px;font-weight:600">Class Manager</span>'
      + '</div>';
    html += '<div style="text-align:center">'
      + '<div style="border-bottom:1px solid var(--gray-400);margin-bottom:4px;min-height:40px"></div>'
      + '<span style="font-size:12px;font-weight:600">Principal</span>'
      + '</div>';
    html += '<div style="text-align:center">'
      + '<div style="border-bottom:1px solid var(--gray-400);margin-bottom:4px;min-height:40px"></div>'
      + '<span style="font-size:12px;font-weight:600">Date</span>'
      + '</div>';
    html += '</div>';

    html += '</div>'; // end report-card

    return html;
  }

  function downloadReportCard(student, scores) {
    var reportEl = document.getElementById('report-card-content');
    if (!reportEl) return;

    reportEl.style.display = 'block';

    var html = '<!DOCTYPE html><html><head><title>Report Card - ' + Utils.escapeHtml(student.displayName || 'Student') + '</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">'
      + '<style>'
      + '* { margin:0; padding:0; box-sizing:border-box; }'
      + 'body { font-family:"Inter",sans-serif; padding:24px; max-width:800px; margin:0 auto; color:#1a1a2e; }'
      + '@media print { body { padding:0; } @page { size:A4 portrait; margin:15mm; } }'
      + '</style></head><body>' + reportEl.innerHTML + '</body></html>';

    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Report_Card_' + (student.admissionNumber || 'student') + '_' + getSessionName(_filters.sessionId).replace(/\s+/g, '_') + '.html';
    a.click();
    URL.revokeObjectURL(url);

    Toast.success('Report card downloaded!');

    setTimeout(function () {
      reportEl.style.display = 'none';
    }, 500);
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  function cleanup() {
    _listeners.forEach(function (unsub) { if (typeof unsub === 'function') unsub(); });
    _listeners = [];
    if (_clickHandler) {
      document.removeEventListener('click', _clickHandler);
      _clickHandler = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  var ResultsModule = {
    render: function () {
      var container = document.getElementById('main-content');
      if (!container) return;

      cleanup();

      container.innerHTML = loadingSpinner();

      loadBaseData().then(function () {
        var role = getProfile().role;

        if (isAdmin()) {
          renderAdminView(container);
        } else if (isTeacher()) {
          renderTeacherView(container);
        } else if (isClassManager()) {
          renderClassManagerView(container);
        } else if (isStudent() || isParent()) {
          renderStudentParentView(container);
        } else {
          container.innerHTML = emptyState('\uD83D\uDCDC', 'Access Denied', 'You do not have permission to view results.');
        }
      }).catch(function (err) {
        console.error('Error loading results module:', err);
        container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load results module. Please refresh.');
        Toast.error('Failed to load results.');
      });
    },

    destroy: function () {
      cleanup();
    }
  };

  window.Modules.results = ResultsModule;
})();