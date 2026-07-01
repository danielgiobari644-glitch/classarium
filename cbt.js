/**
 * Classarium CBT (Computer-Based Testing) Module
 * Teachers create & manage exams with multiple question types.
 * Students take exams in a secure CBT interface with timer and navigation.
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

  var EXAM_STATUSES = {
    draft: { text: 'Draft', cls: 'warning' },
    published: { text: 'Published', cls: 'info' },
    active: { text: 'Active', cls: 'success' },
    completed: { text: 'Completed', cls: 'default' }
  };

  var QUESTION_TYPES = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True / False' },
    { value: 'fill_gap', label: 'Fill in the Gap' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' },
    { value: 'matching', label: 'Matching' }
  ];

  var POSITIVE_CATEGORIES = ['Leadership', 'Teamwork', 'Punctuality', 'Respectfulness'];
  var NEGATIVE_CATEGORIES = ['Fighting', 'Bullying', 'Cheating', 'Disrespect'];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _exams = [];
  var _questions = {};       // examId -> [questions]
  var _submissions = [];     // cbtSubmissions for current school
  var _classes = [];
  var _subjects = [];
  var _students = [];
  var _listeners = [];
  var _clickHandler = null;
  var _changeHandler = null;
  var _keyHandler = null;
  var _intervalId = null;

  // CBT session state (student taking exam)
  var _cbtState = {
    active: false,
    exam: null,
    questions: [],
    answers: {},
    currentIndex: 0,
    timeRemaining: 0,
    timerInterval: null,
    submitted: false
  };

  // Sub-view state for teacher
  var _subView = 'list';   // 'list' | 'editor' | 'results'
  var _editingExamId = null;

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

  function canManage() {
    return isAdmin() || isTeacher();
  }

  function getClassName(id) {
    var c = _classes.find(function (x) { return x.id === id; });
    return c ? (c.name || c.className || '\u2014') : '\u2014';
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
    var s = EXAM_STATUSES[status] || { text: Utils.capitalize(status || 'Unknown'), cls: 'default' };
    return '<span class="badge badge-' + s.cls + '">' + s.text + '</span>';
  }

  function statCard(icon, label, value, color) {
    return '<div class="card" style="padding:16px 20px">'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<div style="width:42px;height:42px;border-radius:10px;background:' + color + '15;display:flex;align-items:center;justify-content:center;font-size:18px">' + icon + '</div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--gray-900)">' + Utils.formatNumber(value) + '</div>'
      + '<div style="font-size:12px;color:var(--gray-500);margin-top:2px">' + label + '</div></div>'
      + '</div></div>';
  }

  function formatTimer(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function getQuestionCount(examId) {
    return (_questions[examId] || []).length;
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    var promises = [
      DataService.getBySchool('classes', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('subjects', schoolId, { orderBy: 'name' })
    ];

    if (canManage()) {
      promises.push(DataService.getStudents(schoolId));
    } else {
      promises.push(Promise.resolve([]));
    }

    return Promise.all(promises).then(function (results) {
      _classes = results[0] || [];
      _subjects = results[1] || [];
      _students = results[2] || [];
    });
  }

  function loadExams() {
    var schoolId = getSchoolId();
    return DataService.getBySchool('cbtExams', schoolId, { orderBy: 'createdAt', orderDir: 'desc' })
      .then(function (data) {
        _exams = data || [];
        // Load questions for each exam
        var qPromises = _exams.map(function (exam) {
          return DataService.get('cbtQuestions', exam.id).then(function (qs) {
            _questions[exam.id] = qs || [];
          }).catch(function () {
            _questions[exam.id] = [];
          });
        });
        return Promise.all(qPromises);
      });
  }

  function loadSubmissions() {
    var schoolId = getSchoolId();
    return DataService.getBySchool('cbtSubmissions', schoolId, { orderBy: 'submittedAt', orderDir: 'desc' })
      .then(function (data) {
        _submissions = data || [];
      });
  }

  function loadQuestionsForExam(examId) {
    return DataService.get('cbtQuestions', examId).then(function (qs) {
      _questions[examId] = qs || [];
    }).catch(function () {
      _questions[examId] = [];
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
      return loadExams();
    }).then(function () {
      return canManage() ? loadSubmissions() : Promise.resolve();
    }).then(function () {
      if (isStudent()) {
        container.innerHTML = renderStudentView();
      } else if (canManage()) {
        if (_subView === 'editor' && _editingExamId) {
          container.innerHTML = renderQuestionEditorView();
        } else if (_subView === 'results' && _editingExamId) {
          container.innerHTML = renderResultsView();
        } else {
          container.innerHTML = renderManageView();
        }
      } else {
        container.innerHTML = emptyState('\uD83D\uDD12', 'Access Denied', 'You do not have permission to access CBT exams.');
      }
      bindEvents();
    }).catch(function (err) {
      console.error('Error loading CBT module:', err);
      container.innerHTML = emptyState('\u26A0', 'Error', 'Failed to load CBT exams. Please refresh.');
      Toast.error('Failed to load CBT exams.');
    });
  }

  /* ================================================================== */
  /*  TEACHER / ADMIN VIEW — Exam Management                             */
  /* ================================================================== */

  function renderManageView() {
    var myExams = _exams.filter(function (e) {
      if (isAdmin()) return true;
      return e.createdBy === getUid();
    });

    var html = '<div class="cbt-page">';

    // Header
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">CBT Exams</h1>'
      + '<p class="page-header-description">Create and manage computer-based tests</p>'
      + '</div>'
      + '<button class="btn btn-primary" data-action="create-exam">+ Create Exam</button>'
      + '</div>'
      + '</div>';

    // Stats
    var draftCount = myExams.filter(function (e) { return e.status === 'draft'; }).length;
    var publishedCount = myExams.filter(function (e) { return e.status === 'published' || e.status === 'active'; }).length;
    var completedCount = myExams.filter(function (e) { return e.status === 'completed'; }).length;
    var totalQuestions = 0;
    myExams.forEach(function (e) { totalQuestions += getQuestionCount(e.id); });

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
    html += statCard('\uD83D\uDCDD', 'Total Exams', myExams.length, 'var(--primary-600)');
    html += statCard('\uD83D\uDD34', 'Draft', draftCount, 'var(--warning-600)');
    html += statCard('\uD83D\uDFE2', 'Published/Active', publishedCount, 'var(--success-600)');
    html += statCard('\u2705', 'Completed', completedCount, 'var(--gray-600)');
    html += statCard('\u2753', 'Total Questions', totalQuestions, 'var(--info-600)');
    html += '</div>';

    // Exam list
    if (!myExams.length) {
      html += emptyState('\uD83D\uDCDD', 'No Exams Yet', 'Create your first CBT exam to get started.');
    } else {
      html += '<div class="card" style="overflow:hidden">'
        + '<div style="overflow-x:auto">'
        + '<table class="table" style="min-width:700px">'
        + '<thead><tr>'
        + '<th>Title</th><th>Subject</th><th>Class</th><th>Duration</th>'
        + '<th>Questions</th><th>Status</th><th>Actions</th>'
        + '</tr></thead><tbody>';

      myExams.forEach(function (exam) {
        var qCount = getQuestionCount(exam.id);
        var durationStr = (exam.duration || 0) + ' min';
        html += '<tr>'
          + '<td><strong>' + Utils.escapeHtml(exam.title || 'Untitled') + '</strong></td>'
          + '<td>' + Utils.escapeHtml(getSubjectName(exam.subjectId)) + '</td>'
          + '<td>' + Utils.escapeHtml(getClassName(exam.classId)) + '</td>'
          + '<td>' + durationStr + '</td>'
          + '<td>' + qCount + '</td>'
          + '<td>' + statusBadge(exam.status) + '</td>'
          + '<td><div style="display:flex;gap:6px;flex-wrap:wrap">';

        if (exam.status === 'draft') {
          html += '<button class="btn btn-sm btn-outline-primary" data-action="edit-questions" data-id="' + exam.id + '">Questions</button>';
          if (qCount > 0) {
            html += '<button class="btn btn-sm btn-outline-success" data-action="publish-exam" data-id="' + exam.id + '">Publish</button>';
          }
          html += '<button class="btn btn-sm btn-outline-danger" data-action="delete-exam" data-id="' + exam.id + '">Delete</button>';
        } else if (exam.status === 'published') {
          html += '<button class="btn btn-sm btn-outline-success" data-action="activate-exam" data-id="' + exam.id + '">Activate</button>';
          html += '<button class="btn btn-sm btn-outline-danger" data-action="unpublish-exam" data-id="' + exam.id + '">Unpublish</button>';
        } else if (exam.status === 'active') {
          html += '<button class="btn btn-sm btn-outline-secondary" data-action="end-exam" data-id="' + exam.id + '">End</button>';
        } else if (exam.status === 'completed') {
          html += '<button class="btn btn-sm btn-outline-primary" data-action="view-results" data-id="' + exam.id + '">Results</button>';
        }

        html += '</div></td></tr>';
      });

      html += '</tbody></table></div></div>';
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  QUESTION EDITOR VIEW                                               */
  /* ================================================================== */

  function renderQuestionEditorView() {
    var exam = _exams.find(function (e) { return e.id === _editingExamId; });
    if (!exam) {
      _subView = 'list';
      return renderManageView();
    }

    var questions = _questions[_editingExamId] || [];
    var html = '<div class="cbt-page">';

    // Header with back button
    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<button class="btn btn-outline-secondary btn-sm" data-action="back-to-list" style="margin-right:4px">\u2190 Back</button>'
      + '<div>'
      + '<h1 class="page-header-title">' + Utils.escapeHtml(exam.title || 'Untitled Exam') + '</h1>'
      + '<p class="page-header-description">Add and manage questions (' + questions.length + ' questions)</p>'
      + '</div></div>'
      + '<div style="display:flex;gap:8px">'
      + '<button class="btn btn-outline-primary" data-action="import-questions">Import from Bank</button>'
      + '<button class="btn btn-primary" data-action="add-question">+ Add Question</button>'
      + '</div>'
      + '</div></div>';

    // Exam info card
    html += '<div class="card" style="padding:16px 20px;margin-bottom:20px">'
      + '<div style="display:flex;gap:24px;flex-wrap:wrap;font-size:14px;color:var(--gray-600)">'
      + '<span><strong>Subject:</strong> ' + Utils.escapeHtml(getSubjectName(exam.subjectId)) + '</span>'
      + '<span><strong>Class:</strong> ' + Utils.escapeHtml(getClassName(exam.classId)) + '</span>'
      + '<span><strong>Duration:</strong> ' + (exam.duration || 0) + ' min</span>'
      + '<span><strong>Pass Mark:</strong> ' + (exam.passMark || 0) + '%</span>'
      + '<span><strong>Status:</strong> ' + statusBadge(exam.status) + '</span>'
      + '</div></div>';

    // Question list
    if (!questions.length) {
      html += emptyState('\u2753', 'No Questions', 'Click "Add Question" to start building this exam.');
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:12px">';

      questions.forEach(function (q, idx) {
        var typeLabel = QUESTION_TYPES.find(function (t) { return t.value === q.type; });
        typeLabel = typeLabel ? typeLabel.label : (q.type || 'Unknown');

        html += '<div class="card" style="padding:16px 20px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
          + '<div style="flex:1">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
          + '<span style="font-weight:700;color:var(--gray-500);font-size:13px">Q' + (idx + 1) + '</span>'
          + '<span class="badge badge-default" style="font-size:11px">' + typeLabel + '</span>'
          + '<span style="font-size:12px;color:var(--gray-400)">(' + (q.score || 0) + ' pts)</span>'
          + '</div>'
          + '<p style="margin:0;font-size:14px;line-height:1.5;color:var(--gray-800)">' + Utils.escapeHtml(q.text || '') + '</p>';

        if (q.type === 'multiple_choice' && q.options) {
          html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">';
          q.options.forEach(function (opt) {
            var isCorrect = opt.value === q.correctAnswer;
            html += '<div style="font-size:13px;color:' + (isCorrect ? 'var(--success-700)' : 'var(--gray-600)') + '">'
              + '<span style="font-weight:600;margin-right:6px">' + Utils.escapeHtml(opt.label || '') + '.</span>'
              + Utils.escapeHtml(opt.text || '')
              + (isCorrect ? ' \u2705' : '')
              + '</div>';
          });
          html += '</div>';
        } else if (q.type === 'true_false') {
          html += '<div style="margin-top:8px;font-size:13px;color:var(--success-700)">Answer: ' + Utils.escapeHtml(q.correctAnswer || '') + '</div>';
        } else if (q.type === 'fill_gap') {
          html += '<div style="margin-top:8px;font-size:13px;color:var(--success-700)">Answer: ' + Utils.escapeHtml(q.answer || '') + '</div>';
        } else if (q.type === 'matching' && q.columnA && q.columnB) {
          html += '<div style="margin-top:8px;font-size:13px">';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
          html += '<div><strong>Column A:</strong>';
          q.columnA.forEach(function (item) {
            html += '<div style="padding:2px 0">' + Utils.escapeHtml(item) + '</div>';
          });
          html += '</div><div><strong>Column B:</strong>';
          q.columnB.forEach(function (item) {
            html += '<div style="padding:2px 0">' + Utils.escapeHtml(item) + '</div>';
          });
          html += '</div></div></div>';
        }

        html += '</div>'
          + '<div style="display:flex;gap:6px;flex-shrink:0">'
          + '<button class="btn btn-sm btn-outline-primary" data-action="edit-question" data-id="' + q.id + '" data-idx="' + idx + '">Edit</button>'
          + '<button class="btn btn-sm btn-outline-danger" data-action="delete-question" data-id="' + q.id + '">Delete</button>'
          + '</div></div></div>';
      });

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  RESULTS VIEW                                                       */
  /* ================================================================== */

  function renderResultsView() {
    var exam = _exams.find(function (e) { return e.id === _editingExamId; });
    if (!exam) {
      _subView = 'list';
      return renderManageView();
    }

    var examSubmissions = _submissions.filter(function (s) { return s.examId === _editingExamId; });
    var totalQuestions = getQuestionCount(_editingExamId);
    var totalPossible = 0;
    (_questions[_editingExamId] || []).forEach(function (q) { totalPossible += (q.score || 0); });

    var html = '<div class="cbt-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div style="display:flex;align-items:center;gap:12px">'
      + '<button class="btn btn-outline-secondary btn-sm" data-action="back-to-list" style="margin-right:4px">\u2190 Back</button>'
      + '<div>'
      + '<h1 class="page-header-title">Results: ' + Utils.escapeHtml(exam.title || 'Exam') + '</h1>'
      + '<p class="page-header-description">' + examSubmissions.length + ' submissions, Pass mark: ' + (exam.passMark || 0) + '%</p>'
      + '</div></div>'
      + '</div></div>';

    // Summary stats
    if (examSubmissions.length > 0) {
      var passed = 0;
      var totalScore = 0;
      examSubmissions.forEach(function (sub) {
        var pct = totalPossible > 0 ? ((sub.totalScore || 0) / totalPossible) * 100 : 0;
        if (pct >= (exam.passMark || 0)) passed++;
        totalScore += pct;
      });
      var avgScore = (totalScore / examSubmissions.length).toFixed(1);
      var passRate = ((passed / examSubmissions.length) * 100).toFixed(1);

      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">';
      html += statCard('\uD83D\uDCCA', 'Total Submitted', examSubmissions.length, 'var(--primary-600)');
      html += statCard('\u2705', 'Passed', passed, 'var(--success-600)');
      html += statCard('\u274C', 'Failed', examSubmissions.length - passed, 'var(--danger-600)');
      html += statCard('\uD83D\uDCC8', 'Average Score', avgScore + '%', 'var(--info-600)');
      html += statCard('\uD83D\uDD04', 'Pass Rate', passRate + '%', 'var(--warning-600)');
      html += '</div>';
    }

    // Submissions table
    if (!examSubmissions.length) {
      html += emptyState('\uD83D\uDCCA', 'No Submissions', 'No students have taken this exam yet.');
    } else {
      html += '<div class="card" style="overflow:hidden">'
        + '<div style="overflow-x:auto">'
        + '<table class="table" style="min-width:500px">'
        + '<thead><tr>'
        + '<th>Student</th><th>Score</th><th>Percentage</th><th>Status</th><th>Time Taken</th><th>Submitted</th>'
        + '</tr></thead><tbody>';

      examSubmissions.forEach(function (sub) {
        var pct = totalPossible > 0 ? ((sub.totalScore || 0) / totalPossible) * 100 : 0;
        var passed = pct >= (exam.passMark || 0);
        var timeTaken = sub.timeTaken ? Math.round(sub.timeTaken / 60) + ' min' : '\u2014';

        html += '<tr>'
          + '<td><strong>' + Utils.escapeHtml(getStudentName(sub.studentId)) + '</strong></td>'
          + '<td>' + (sub.totalScore || 0) + ' / ' + totalPossible + '</td>'
          + '<td>' + pct.toFixed(1) + '%</td>'
          + '<td>' + (passed
            ? '<span class="badge badge-success">Passed</span>'
            : '<span class="badge badge-danger">Failed</span>') + '</td>'
          + '<td>' + timeTaken + '</td>'
          + '<td>' + (sub.submittedAt ? Utils.formatDate(sub.submittedAt) : '\u2014') + '</td>'
          + '</tr>';
      });

      html += '</tbody></table></div></div>';
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  STUDENT VIEW                                                       */
  /* ================================================================== */

  function renderStudentView() {
    // If CBT session is active, show the CBT interface
    if (_cbtState.active && !_cbtState.submitted) {
      return renderCBTInterface();
    }

    // Show available and past exams
    var availableExams = _exams.filter(function (e) {
      return (e.status === 'published' || e.status === 'active')
        && e.classId && _students.find(function (s) {
          return (s.id === getUid() || s.uid === getUid()) && s.classId === e.classId;
        })
        && !_submissions.find(function (sub) {
          return sub.examId === e.id && sub.studentId === getUid();
        });
    });

    var takenExams = _submissions.filter(function (sub) { return sub.studentId === getUid(); });

    var html = '<div class="cbt-page">';

    html += '<div class="page-header">'
      + '<div class="page-header-row">'
      + '<div>'
      + '<h1 class="page-header-title">CBT Exams</h1>'
      + '<p class="page-header-description">Take computer-based tests</p>'
      + '</div>'
      + '</div></div>';

    // Available exams
    html += '<h3 style="margin-bottom:16px;font-size:16px">Available Exams</h3>';

    if (!availableExams.length) {
      html += emptyState('\u2705', 'All Caught Up', 'No exams available right now. Check back later.');
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;margin-bottom:32px">';

      availableExams.forEach(function (exam) {
        var qCount = getQuestionCount(exam.id);
        html += '<div class="card" style="padding:20px">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
          + '<h3 style="margin:0;font-size:16px;font-weight:600">' + Utils.escapeHtml(exam.title || 'Untitled') + '</h3>'
          + statusBadge(exam.status)
          + '</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;font-size:13px;color:var(--gray-500)">'
          + '<span>\uD83D\uDCD6 ' + Utils.escapeHtml(getSubjectName(exam.subjectId)) + '</span>'
          + '<span>\uD83C\uDFEB ' + Utils.escapeHtml(getClassName(exam.classId)) + '</span>'
          + '<span>\u23F1 ' + (exam.duration || 0) + ' min</span>'
          + '<span>\u2753 ' + qCount + ' questions</span>'
          + '</div>'
          + (exam.description ? '<p style="font-size:13px;color:var(--gray-500);margin-bottom:14px;line-height:1.4">' + Utils.escapeHtml(exam.description) + '</p>' : '')
          + '<button class="btn btn-primary btn-block" data-action="start-exam" data-id="' + exam.id + '">Start Exam</button>'
          + '</div>';
      });

      html += '</div>';
    }

    // Past submissions
    if (takenExams.length > 0) {
      html += '<h3 style="margin-bottom:16px;font-size:16px">Completed Exams</h3>';
      html += '<div class="card" style="overflow:hidden"><div style="overflow-x:auto">'
        + '<table class="table" style="min-width:500px">'
        + '<thead><tr><th>Exam</th><th>Score</th><th>Percentage</th><th>Status</th><th>Submitted</th></tr></thead><tbody>';

      takenExams.forEach(function (sub) {
        var exam = _exams.find(function (e) { return e.id === sub.examId; });
        if (!exam) return;
        var totalPossible = 0;
        (_questions[exam.id] || []).forEach(function (q) { totalPossible += (q.score || 0); });
        var pct = totalPossible > 0 ? ((sub.totalScore || 0) / totalPossible) * 100 : 0;
        var passed = pct >= (exam.passMark || 0);
        var showResult = exam.showResults !== false;

        html += '<tr>'
          + '<td><strong>' + Utils.escapeHtml(exam.title || 'Exam') + '</strong></td>'
          + '<td>' + (showResult ? (sub.totalScore || 0) + ' / ' + totalPossible : 'Hidden') + '</td>'
          + '<td>' + (showResult ? pct.toFixed(1) + '%' : 'Hidden') + '</td>'
          + '<td>' + (showResult
            ? (passed ? '<span class="badge badge-success">Passed</span>' : '<span class="badge badge-danger">Failed</span>')
            : '<span class="badge badge-default">Awaiting</span>') + '</td>'
          + '<td>' + (sub.submittedAt ? Utils.formatDate(sub.submittedAt) : '\u2014') + '</td>'
          + '</tr>';
      });

      html += '</tbody></table></div></div>';
    }

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  CBT EXAM INTERFACE (Student taking exam)                           */
  /* ================================================================== */

  function renderCBTInterface() {
    var state = _cbtState;
    var exam = state.exam;
    var questions = state.questions;
    var idx = state.currentIndex;
    var q = questions[idx];
    var total = questions.length;
    var answered = Object.keys(state.answers).filter(function (k) { return state.answers[k] !== '' && state.answers[k] !== undefined; }).length;
    var progressPct = total > 0 ? (answered / total) * 100 : 0;
    var timerClass = state.timeRemaining < 300 ? 'cbt-timer-warning' : '';

    var html = '<div class="cbt-container">';

    // Header
    html += '<div class="cbt-header">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">'
      + '<div>'
      + '<h2 style="margin:0;font-size:18px;font-weight:700;color:var(--gray-900)">' + Utils.escapeHtml(exam.title || 'Exam') + '</h2>'
      + '<p style="margin:0;font-size:13px;color:var(--gray-500)">' + Utils.escapeHtml(getSubjectName(exam.subjectId)) + ' &bull; ' + (idx + 1) + ' of ' + total + '</p>'
      + '</div>'
      + '<div class="cbt-timer ' + timerClass + '" id="cbt-timer-display">'
      + '<span style="font-size:14px;color:var(--gray-500)">Time Remaining: </span>'
      + '<span style="font-size:28px;font-weight:700;letter-spacing:1px">' + formatTimer(state.timeRemaining) + '</span>'
      + '</div>'
      + '</div>'
      + '<div class="cbt-progress-bar" style="margin-top:12px">'
      + '<div class="cbt-progress-fill" style="width:' + progressPct + '%"></div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--gray-500);margin-top:4px">' + answered + ' of ' + total + ' questions answered</div>'
      + '</div>';

    // Question card
    if (q) {
      var typeLabel = QUESTION_TYPES.find(function (t) { return t.value === q.type; });
      typeLabel = typeLabel ? typeLabel.label : (q.type || '');

      html += '<div class="cbt-question-card">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">'
        + '<span style="font-weight:700;color:var(--gray-500);font-size:14px">Question ' + (idx + 1) + '</span>'
        + '<span class="badge badge-default" style="font-size:11px">' + typeLabel + '</span>'
        + '<span style="font-size:12px;color:var(--gray-400)">(' + (q.score || 0) + ' pts)</span>'
        + '</div>'
        + '<div class="cbt-question-text">' + Utils.escapeHtml(q.text || '') + '</div>';

      // Answer area based on question type
      var currentAnswer = state.answers[q.id] || '';

      if (q.type === 'multiple_choice' && q.options) {
        html += '<div class="cbt-options">';
        q.options.forEach(function (opt, oIdx) {
          var letter = opt.label || String.fromCharCode(65 + oIdx);
          var isSelected = currentAnswer === opt.value;
          html += '<div class="cbt-option' + (isSelected ? ' selected' : '') + '" data-action="select-option" data-qid="' + q.id + '" data-value="' + Utils.escapeHtml(opt.value) + '">'
            + '<span class="cbt-option-letter">' + letter + '</span>'
            + '<span class="cbt-option-text">' + Utils.escapeHtml(opt.text || '') + '</span>'
            + '</div>';
        });
        html += '</div>';
      } else if (q.type === 'true_false') {
        html += '<div class="cbt-options">';
        ['True', 'False'].forEach(function (val) {
          var isSelected = currentAnswer === val;
          html += '<div class="cbt-option' + (isSelected ? ' selected' : '') + '" data-action="select-option" data-qid="' + q.id + '" data-value="' + val + '">'
            + '<span class="cbt-option-text">' + val + '</span>'
            + '</div>';
        });
        html += '</div>';
      } else if (q.type === 'fill_gap') {
        html += '<div style="margin-top:16px">'
          + '<input type="text" class="form-control" id="cbt-fill-input" placeholder="Type your answer here..." '
          + 'value="' + Utils.escapeHtml(currentAnswer || '') + '" data-action="fill-input" style="max-width:500px">'
          + '</div>';
      } else if (q.type === 'short_answer' || q.type === 'essay') {
        html += '<div style="margin-top:16px">'
          + '<textarea class="form-control" id="cbt-text-input" placeholder="Type your answer here..." '
          + 'rows="' + (q.type === 'essay' ? '8' : '3') + '" data-action="text-input" '
          + 'style="max-width:700px">' + Utils.escapeHtml(currentAnswer || '') + '</textarea>'
          + '</div>';
      } else if (q.type === 'matching' && q.columnA && q.columnB) {
        // Matching: user types the matching for each Column A item
        html += '<div style="margin-top:16px">';
        html += '<p style="font-size:13px;color:var(--gray-500);margin-bottom:12px">Match each item in Column A with the correct item from Column B</p>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:700px">';
        html += '<div><strong style="font-size:13px;color:var(--gray-700)">Column A</strong>';
        q.columnA.forEach(function (item, i) {
          var matchVal = currentAnswer ? (currentAnswer[i] || '') : '';
          html += '<div style="margin-bottom:10px">'
            + '<div style="font-size:14px;font-weight:500;margin-bottom:4px">' + (i + 1) + '. ' + Utils.escapeHtml(item) + '</div>'
            + '<select class="form-control form-control-sm" data-action="match-select" data-qid="' + q.id + '" data-idx="' + i + '">'
            + '<option value="">-- Select match --</option>';
          if (q.columnB) {
            q.columnB.forEach(function (bItem, bIdx) {
              var letter = String.fromCharCode(65 + bIdx);
              html += '<option value="' + bIdx + '"' + (matchVal == bIdx ? ' selected' : '') + '>' + letter + '. ' + Utils.escapeHtml(bItem) + '</option>';
            });
          }
          html += '</select></div>';
        });
        html += '</div>';
        html += '<div><strong style="font-size:13px;color:var(--gray-700)">Column B</strong>';
        if (q.columnB) {
          q.columnB.forEach(function (item, i) {
            var letter = String.fromCharCode(65 + i);
            html += '<div style="padding:6px 0;font-size:14px">' + letter + '. ' + Utils.escapeHtml(item) + '</div>';
          });
        }
        html += '</div></div></div>';
      }

      html += '</div>';
    }

    // Navigation
    html += '<div class="cbt-nav" style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding:16px 0">'
      + '<button class="btn btn-outline-secondary" data-action="prev-question"' + (idx === 0 ? ' disabled' : '') + '>\u2190 Previous</button>'
      + '<button class="btn btn-primary" data-action="submit-exam-confirm" style="background:var(--danger-600);border-color:var(--danger-600)">Submit Exam</button>'
      + '<button class="btn btn-outline-secondary" data-action="next-question"' + (idx >= total - 1 ? ' disabled' : '') + '>Next \u2192</button>'
      + '</div>';

    // Question grid
    html += '<div class="cbt-question-grid" style="margin-top:20px">'
      + '<p style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:10px">Question Navigator</p>'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px">';

    questions.forEach(function (qItem, qIdx) {
      var isAnswered = state.answers[qItem.id] !== '' && state.answers[qItem.id] !== undefined;
      var isCurrent = qIdx === idx;
      html += '<button class="cbt-question-grid-btn'
        + (isCurrent ? ' current' : '')
        + (isAnswered ? ' answered' : '')
        + '" data-action="goto-question" data-idx="' + qIdx + '">'
        + (qIdx + 1)
        + '</button>';
    });

    html += '</div></div>';

    html += '</div>';
    return html;
  }

  /* ================================================================== */
  /*  Timer Management                                                   */
  /* ================================================================== */

  function startTimer() {
    stopTimer();
    _cbtState.timerInterval = setInterval(function () {
      _cbtState.timeRemaining--;
      var timerEl = document.getElementById('cbt-timer-display');
      if (timerEl) {
        var span = timerEl.querySelector('span:last-child');
        if (span) span.textContent = formatTimer(_cbtState.timeRemaining);
        if (_cbtState.timeRemaining < 300) {
          timerEl.classList.add('cbt-timer-warning');
        }
      }

      // Update progress
      var answered = Object.keys(_cbtState.answers).filter(function (k) { return _cbtState.answers[k] !== '' && _cbtState.answers[k] !== undefined; }).length;
      var progressFill = document.querySelector('.cbt-progress-fill');
      if (progressFill) {
        var pct = _cbtState.questions.length > 0 ? (answered / _cbtState.questions.length) * 100 : 0;
        progressFill.style.width = pct + '%';
      }

      if (_cbtState.timeRemaining <= 0) {
        stopTimer();
        autoSubmitExam();
      }
    }, 1000);
  }

  function stopTimer() {
    if (_cbtState.timerInterval) {
      clearInterval(_cbtState.timerInterval);
      _cbtState.timerInterval = null;
    }
  }

  function autoSubmitExam() {
    _cbtState.submitted = true;
    saveSubmission();
    Toast.warning('Time is up! Your exam has been submitted automatically.');
    _subView = 'list';
    _cbtState.active = false;
    render();
  }

  /* ================================================================== */
  /*  Submission Logic                                                   */
  /* ================================================================== */

  function saveSubmission() {
    var state = _cbtState;
    var exam = state.exam;
    var questions = state.questions;
    var answers = state.answers;

    // Calculate score for auto-gradable types
    var totalScore = 0;
    var totalPossible = 0;
    var details = [];

    questions.forEach(function (q) {
      totalPossible += (q.score || 0);
      var userAnswer = answers[q.id] || '';
      var score = 0;
      var correct = false;

      if (q.type === 'multiple_choice') {
        correct = userAnswer === q.correctAnswer;
        score = correct ? (q.score || 0) : 0;
      } else if (q.type === 'true_false') {
        correct = userAnswer === q.correctAnswer;
        score = correct ? (q.score || 0) : 0;
      } else if (q.type === 'fill_gap') {
        correct = userAnswer.trim().toLowerCase() === (q.answer || '').trim().toLowerCase();
        score = correct ? (q.score || 0) : 0;
      } else if (q.type === 'matching') {
        // Auto-grade matching if correctMapping exists
        if (q.correctMapping && Array.isArray(userAnswer)) {
          var allCorrect = true;
          q.correctMapping.forEach(function (correctIdx, i) {
            if (userAnswer[i] != correctIdx) allCorrect = false;
          });
          correct = allCorrect;
          score = allCorrect ? (q.score || 0) : 0;
        }
      }
      // short_answer and essay are not auto-graded

      totalScore += score;
      details.push({
        questionId: q.id,
        type: q.type,
        userAnswer: userAnswer,
        score: score,
        maxScore: q.score || 0,
        correct: correct
      });
    });

    var timeTaken = (exam.duration || 0) * 60 - state.timeRemaining;

    var submission = {
      schoolId: getSchoolId(),
      examId: exam.id,
      studentId: getUid(),
      answers: answers,
      details: details,
      totalScore: totalScore,
      totalPossible: totalPossible,
      timeTaken: timeTaken,
      submittedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    DataService.add('cbtSubmissions', submission).then(function () {
      DataService.logAction('cbt_submit', 'Submitted CBT exam: ' + (exam.title || ''));
    }).catch(function (err) {
      console.error('Error saving CBT submission:', err);
      Toast.error('Failed to save submission. Please contact your teacher.');
    });
  }

  /* ================================================================== */
  /*  Modals                                                             */
  /* ================================================================== */

  function openCreateExamModal() {
    var classOpts = '<option value="">Select Class</option>'
      + _classes.map(function (c) {
        return optionTag(c.id, c.name || c.className);
      }).join('');

    var subjectOpts = '<option value="">Select Subject</option>'
      + _subjects.map(function (s) {
        return optionTag(s.id, s.name);
      }).join('');

    var formHtml = '<form id="cbt-create-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Exam Title <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" class="form-control" name="title" required placeholder="e.g. First Term Mathematics Exam">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Description</label>'
      + '<textarea class="form-control" name="description" rows="3" placeholder="Brief description of the exam..."></textarea>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div class="form-group">'
      + '<label class="form-label">Subject <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="subjectId" required>' + subjectOpts + '</select>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Class <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="classId" required>' + classOpts + '</select>'
      + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div class="form-group">'
      + '<label class="form-label">Duration (minutes) <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="number" class="form-control" name="duration" required min="5" max="300" value="60">'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Pass Mark (%)</label>'
      + '<input type="number" class="form-control" name="passMark" min="0" max="100" value="50">'
      + '</div>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label" style="margin-bottom:12px;font-weight:600">Settings</label>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      + '<label class="form-check"><input type="checkbox" name="randomizeQuestions" value="true"> Randomize Questions</label>'
      + '<label class="form-check"><input type="checkbox" name="randomizeOptions" value="true"> Randomize Options</label>'
      + '<label class="form-check"><input type="checkbox" name="oneAttemptOnly" value="true" checked> One Attempt Only</label>'
      + '<label class="form-check"><input type="checkbox" name="showResults" value="true" checked> Show Results</label>'
      + '<label class="form-check"><input type="checkbox" name="fullscreenMode" value="true"> Fullscreen Mode</label>'
      + '<label class="form-check"><input type="checkbox" name="antiCheating" value="true"> Anti-cheating</label>'
      + '</div>'
      + '</div>'
      + '</form>';

    Modal.open({
      title: 'Create CBT Exam',
      content: formHtml,
      size: 'lg',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="cbt-save-exam-btn">Create Exam</button>'
    });

    // Bind save button
    setTimeout(function () {
      var saveBtn = document.getElementById('cbt-save-exam-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('cbt-create-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var examData = {
            schoolId: getSchoolId(),
            title: fd.get('title'),
            description: fd.get('description'),
            subjectId: fd.get('subjectId'),
            classId: fd.get('classId'),
            duration: parseInt(fd.get('duration')) || 60,
            passMark: parseInt(fd.get('passMark')) || 50,
            randomizeQuestions: !!fd.get('randomizeQuestions'),
            randomizeOptions: !!fd.get('randomizeOptions'),
            oneAttemptOnly: !!fd.get('oneAttemptOnly'),
            showResults: !!fd.get('showResults'),
            fullscreenMode: !!fd.get('fullscreenMode'),
            antiCheating: !!fd.get('antiCheating'),
            status: 'draft',
            createdBy: getUid(),
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
          };

          DataService.add('cbtExams', examData).then(function (docRef) {
            Modal.close();
            Toast.success('Exam created successfully! Now add questions.');
            DataService.logAction('cbt_create', 'Created CBT exam: ' + examData.title);

            // Navigate to question editor
            if (docRef && docRef.id) {
              _editingExamId = docRef.id;
              _subView = 'editor';
            }
            render();
          }).catch(function (err) {
            console.error('Error creating exam:', err);
            Toast.error('Failed to create exam.');
          });
        });
      }
    }, 50);
  }

  function openAddQuestionModal(editId, editIdx) {
    var isEdit = !!editId;
    var existingQ = null;

    if (isEdit) {
      var qs = _questions[_editingExamId] || [];
      existingQ = qs.find(function (q) { return q.id === editId; }) || qs[editIdx];
    }

    var typeOpts = QUESTION_TYPES.map(function (t) {
      return optionTag(t.value, t.label, existingQ && existingQ.type === t.value);
    }).join('');

    var formHtml = '<form id="cbt-question-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Question Type <span style="color:var(--danger-500)">*</span></label>'
      + '<select class="form-control" name="type" id="cbt-q-type">' + typeOpts + '</select>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Question Text <span style="color:var(--danger-500)">*</span></label>'
      + '<textarea class="form-control" name="text" rows="3" required placeholder="Enter the question text...">'
      + Utils.escapeHtml(existingQ ? existingQ.text || '' : '') + '</textarea>'
      + '</div>'
      + '<div id="cbt-type-fields"></div>'
      + '<div class="form-group">'
      + '<label class="form-label">Score (points) <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="number" class="form-control" name="score" required min="1" max="100" value="' + (existingQ ? existingQ.score || 1 : 1) + '">'
      + '</div>'
      + '</form>';

    Modal.open({
      title: isEdit ? 'Edit Question' : 'Add Question',
      content: formHtml,
      size: 'lg',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="cbt-save-question-btn">' + (isEdit ? 'Update' : 'Save') + ' Question</button>'
    });

    setTimeout(function () {
      var typeSelect = document.getElementById('cbt-q-type');
      if (typeSelect) {
        renderTypeFields(typeSelect.value, existingQ);
        typeSelect.addEventListener('change', function () {
          renderTypeFields(this.value, null);
        });
      }

      var saveBtn = document.getElementById('cbt-save-question-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var form = document.getElementById('cbt-question-form');
          if (!form || !form.checkValidity()) {
            form.reportValidity();
            return;
          }

          var fd = new FormData(form);
          var qType = fd.get('type');
          var qData = {
            type: qType,
            text: fd.get('text'),
            score: parseInt(fd.get('score')) || 1
          };

          // Type-specific fields
          if (qType === 'multiple_choice') {
            var options = [];
            for (var i = 0; i < 4; i++) {
              options.push({
                label: String.fromCharCode(65 + i),
                text: fd.get('opt_' + i) || '',
                value: String.fromCharCode(65 + i)
              });
            }
            qData.options = options;
            qData.correctAnswer = fd.get('correctAnswer') || '';
          } else if (qType === 'true_false') {
            qData.correctAnswer = fd.get('tfAnswer') || 'True';
          } else if (qType === 'fill_gap') {
            qData.answer = fd.get('gapAnswer') || '';
          } else if (qType === 'short_answer') {
            qData.modelAnswer = fd.get('shortModelAnswer') || '';
          } else if (qType === 'essay') {
            qData.modelAnswer = fd.get('essayModelAnswer') || '';
          } else if (qType === 'matching') {
            var colA = [];
            var colB = [];
            var mapping = [];
            for (var j = 0; j < 5; j++) {
              var aVal = fd.get('colA_' + j);
              var bVal = fd.get('colB_' + j);
              if (aVal && aVal.trim()) colA.push(aVal.trim());
              if (bVal && bVal.trim()) colB.push(bVal.trim());
            }
            // Correct mapping: index of Column A item -> index of matching Column B item
            for (var k = 0; k < colA.length; k++) {
              var mVal = fd.get('match_' + k);
              mapping.push(mVal !== '' ? parseInt(mVal) : 0);
            }
            qData.columnA = colA;
            qData.columnB = colB;
            qData.correctMapping = mapping;
          }

          if (isEdit && existingQ) {
            // Update
            qData.updatedAt = new Date().toISOString();
            DataService.update('cbtQuestions', _editingExamId, editId, qData).then(function () {
              Modal.close();
              Toast.success('Question updated.');
              render();
            }).catch(function (err) {
              console.error('Error updating question:', err);
              Toast.error('Failed to update question.');
            });
          } else {
            // Add
            qData.schoolId = getSchoolId();
            qData.examId = _editingExamId;
            qData.createdAt = new Date().toISOString();
            qData.timestamp = Date.now();

            DataService.add('cbtQuestions', qData, _editingExamId).then(function () {
              Modal.close();
              Toast.success('Question added.');
              render();
            }).catch(function (err) {
              console.error('Error adding question:', err);
              Toast.error('Failed to add question.');
            });
          }
        });
      }
    }, 50);
  }

  function renderTypeFields(type, existingQ) {
    var container = document.getElementById('cbt-type-fields');
    if (!container) return;

    var html = '';

    if (type === 'multiple_choice') {
      var opts = (existingQ && existingQ.options) || [
        { label: 'A', text: '' }, { label: 'B', text: '' },
        { label: 'C', text: '' }, { label: 'D', text: '' }
      ];
      var correct = existingQ ? existingQ.correctAnswer || '' : '';

      html += '<div style="margin-bottom:16px">'
        + '<label class="form-label">Options</label>';
      opts.forEach(function (opt, i) {
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
          + '<span style="font-weight:700;color:var(--gray-500);width:24px">' + opt.label + '.</span>'
          + '<input type="text" class="form-control" name="opt_' + i + '" value="' + Utils.escapeHtml(opt.text || '') + '" placeholder="Option ' + opt.label + '">'
          + '<input type="radio" name="correctAnswer" value="' + opt.label + '"' + (correct === opt.label ? ' checked' : '') + ' title="Correct answer">'
          + '</div>';
      });
      html += '<p style="font-size:12px;color:var(--gray-400);margin:4px 0 0">Select the radio button next to the correct answer</p></div>';
    } else if (type === 'true_false') {
      var tfAnswer = existingQ ? existingQ.correctAnswer || 'True' : 'True';
      html += '<div class="form-group">'
        + '<label class="form-label">Correct Answer</label>'
        + '<div style="display:flex;gap:16px">'
        + '<label class="form-check"><input type="radio" name="tfAnswer" value="True"' + (tfAnswer === 'True' ? ' checked' : '') + '> True</label>'
        + '<label class="form-check"><input type="radio" name="tfAnswer" value="False"' + (tfAnswer === 'False' ? ' checked' : '') + '> False</label>'
        + '</div></div>';
    } else if (type === 'fill_gap') {
      html += '<div class="form-group">'
        + '<label class="form-label">Answer (for the blank)</label>'
        + '<input type="text" class="form-control" name="gapAnswer" value="' + Utils.escapeHtml(existingQ ? existingQ.answer || '' : '') + '" placeholder="The correct answer for ___blank___">'
        + '<p style="font-size:12px;color:var(--gray-400);margin:4px 0 0">Use ___blank___ in the question text to mark the gap</p>'
        + '</div>';
    } else if (type === 'short_answer') {
      html += '<div class="form-group">'
        + '<label class="form-label">Model Answer</label>'
        + '<textarea class="form-control" name="shortModelAnswer" rows="2" placeholder="Expected answer for reference...">'
        + Utils.escapeHtml(existingQ ? existingQ.modelAnswer || '' : '') + '</textarea>'
        + '</div>';
    } else if (type === 'essay') {
      html += '<div class="form-group">'
        + '<label class="form-label">Model Answer / Grading Guide</label>'
        + '<textarea class="form-control" name="essayModelAnswer" rows="4" placeholder="Detailed model answer or grading criteria...">'
        + Utils.escapeHtml(existingQ ? existingQ.modelAnswer || '' : '') + '</textarea>'
        + '</div>';
    } else if (type === 'matching') {
      var colA = (existingQ && existingQ.columnA) || ['', '', '', '', ''];
      var colB = (existingQ && existingQ.columnB) || ['', '', '', '', ''];
      var mapping = (existingQ && existingQ.correctMapping) || [0, 1, 2, 3, 4];

      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
        + '<div class="form-group"><label class="form-label">Column A</label>';
      for (var i = 0; i < 5; i++) {
        html += '<input type="text" class="form-control" name="colA_' + i + '" value="' + Utils.escapeHtml(colA[i] || '') + '" placeholder="Item ' + (i + 1) + '" style="margin-bottom:6px">';
      }
      html += '</div>'
        + '<div class="form-group"><label class="form-label">Column B (scrambled)</label>';
      for (var j = 0; j < 5; j++) {
        html += '<input type="text" class="form-control" name="colB_' + j + '" value="' + Utils.escapeHtml(colB[j] || '') + '" placeholder="Item ' + String.fromCharCode(65 + j) + '" style="margin-bottom:6px">';
      }
      html += '</div>'
        + '<div class="form-group"><label class="form-label">A \u2192 B</label>';
      for (var k = 0; k < 5; k++) {
        html += '<select class="form-control" name="match_' + k + '" style="margin-bottom:6px">'
          + '<option value="0"' + (mapping[k] == 0 ? ' selected' : '') + '>A</option>'
          + '<option value="1"' + (mapping[k] == 1 ? ' selected' : '') + '>B</option>'
          + '<option value="2"' + (mapping[k] == 2 ? ' selected' : '') + '>C</option>'
          + '<option value="3"' + (mapping[k] == 3 ? ' selected' : '') + '>D</option>'
          + '<option value="4"' + (mapping[k] == 4 ? ' selected' : '') + '>E</option>'
          + '</select>';
      }
      html += '</div></div>';
    }

    container.innerHTML = html;
  }

  function openImportQuestionsModal() {
    var formHtml = '<form id="cbt-import-form">'
      + '<div class="form-group">'
      + '<label class="form-label">Question Bank</label>'
      + '<p style="font-size:13px;color:var(--gray-500)">Import questions from the school question bank into this exam.</p>'
      + '</div>'
      + '<div class="form-group">'
      + '<label class="form-label">Filter by Subject</label>'
      + '<select class="form-control" name="subjectFilter" id="cbt-import-subject">'
      + '<option value="">All Subjects</option>'
      + _subjects.map(function (s) { return optionTag(s.id, s.name); }).join('')
      + '</select>'
      + '</div>'
      + '<div id="cbt-import-list">' + loadingSpinner() + '</div>'
      + '</form>';

    Modal.open({
      title: 'Import from Question Bank',
      content: formHtml,
      size: 'lg',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Cancel</button>'
        + '<button class="btn btn-primary" id="cbt-import-btn">Import Selected</button>'
    });

    setTimeout(function () {
      loadQuestionBank('');
      var subjectSelect = document.getElementById('cbt-import-subject');
      if (subjectSelect) {
        subjectSelect.addEventListener('change', function () {
          loadQuestionBank(this.value);
        });
      }

      var importBtn = document.getElementById('cbt-import-btn');
      if (importBtn) {
        importBtn.addEventListener('click', function () {
          var checkboxes = document.querySelectorAll('#cbt-import-list input[name="import_q"]:checked');
          if (!checkboxes.length) {
            Toast.warning('Select at least one question to import.');
            return;
          }

          var promises = [];
          checkboxes.forEach(function (cb) {
            var qData = JSON.parse(cb.dataset.question || '{}');
            qData.schoolId = getSchoolId();
            qData.examId = _editingExamId;
            qData.importedFrom = qData.id;
            delete qData.id;
            qData.createdAt = new Date().toISOString();
            qData.timestamp = Date.now();
            promises.push(DataService.add('cbtQuestions', qData, _editingExamId));
          });

          Promise.all(promises).then(function () {
            Modal.close();
            Toast.success(checkboxes.length + ' question(s) imported.');
            render();
          }).catch(function (err) {
            console.error('Error importing questions:', err);
            Toast.error('Failed to import questions.');
          });
        });
      }
    }, 50);
  }

  function loadQuestionBank(subjectId) {
    var listEl = document.getElementById('cbt-import-list');
    if (!listEl) return;

    var schoolId = getSchoolId();
    var query = { orderBy: 'createdAt', orderDir: 'desc' };
    if (subjectId) query.filters = { subjectId: subjectId };

    DataService.getBySchool('questionBank', schoolId, query).then(function (questions) {
      questions = questions || [];
      if (!questions.length) {
        listEl.innerHTML = '<p style="color:var(--gray-500);font-size:13px">No questions found in the question bank.</p>';
        return;
      }

      var html = '<div style="max-height:300px;overflow-y:auto">';
      questions.forEach(function (q, idx) {
        var typeLabel = QUESTION_TYPES.find(function (t) { return t.value === q.type; });
        typeLabel = typeLabel ? typeLabel.label : (q.type || '');
        html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--gray-100)">'
          + '<input type="checkbox" name="import_q" data-question="' + Utils.escapeHtml(JSON.stringify(q)).replace(/"/g, '&quot;') + '">'
          + '<div style="flex:1">'
          + '<div style="font-size:13px;font-weight:500">' + Utils.escapeHtml(q.text || 'Untitled') + '</div>'
          + '<div style="font-size:11px;color:var(--gray-400);margin-top:2px">' + typeLabel + ' &bull; ' + (q.score || 0) + ' pts</div>'
          + '</div></div>';
      });
      html += '</div>';
      listEl.innerHTML = html;
    }).catch(function () {
      listEl.innerHTML = '<p style="color:var(--danger-500);font-size:13px">Failed to load question bank.</p>';
    });
  }

  function openStudentBehaviorModal(studentId) {
    var studentName = getStudentName(studentId);
    var records = _behaviorRecords.filter(function (r) { return r.studentId === studentId; });

    var totalPositive = 0, totalNegative = 0;
    records.forEach(function (r) {
      if (r.type === 'positive') totalPositive += (r.points || 0);
      else totalNegative += Math.abs(r.points || 0);
    });
    var behaviorScore = totalPositive - totalNegative;

    var html = '<div>';
    html += '<div style="text-align:center;margin-bottom:20px">'
      + '<div style="width:80px;height:80px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;'
      + (behaviorScore >= 0 ? 'background:var(--success-100);color:var(--success-700)' : 'background:var(--danger-100);color:var(--danger-700)')
      + '">' + (behaviorScore >= 0 ? '+' : '') + behaviorScore + '</div>'
      + '<h3 style="margin:0">' + Utils.escapeHtml(studentName) + '</h3>'
      + '<p style="margin:4px 0 0;font-size:13px;color:var(--gray-500)">Behavior Score</p>'
      + '</div>';

    html += '<div style="display:flex;gap:16px;justify-content:center;margin-bottom:20px">'
      + '<div style="text-align:center;padding:12px 20px;background:var(--success-50);border-radius:8px">'
      + '<div style="font-size:20px;font-weight:700;color:var(--success-700)">+' + totalPositive + '</div>'
      + '<div style="font-size:12px;color:var(--success-600)">Positive</div></div>'
      + '<div style="text-align:center;padding:12px 20px;background:var(--danger-50);border-radius:8px">'
      + '<div style="font-size:20px;font-weight:700;color:var(--danger-700)">-' + totalNegative + '</div>'
      + '<div style="font-size:12px;color:var(--danger-600)">Negative</div></div>'
      + '</div>';

    if (!records.length) {
      html += '<p style="text-align:center;color:var(--gray-500);font-size:13px">No behavior records found.</p>';
    } else {
      html += '<div style="max-height:300px;overflow-y:auto">';
      records.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
      records.forEach(function (r) {
        var isPos = r.type === 'positive';
        html += '<div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100);align-items:flex-start">'
          + '<div style="width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0;background:' + (isPos ? 'var(--success-500)' : 'var(--danger-500)') + '"></div>'
          + '<div style="flex:1">'
          + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<span class="badge badge-' + (isPos ? 'success' : 'danger') + '" style="font-size:11px">' + Utils.escapeHtml(r.category || '') + '</span>'
          + '<span style="font-size:12px;font-weight:600;color:' + (isPos ? 'var(--success-600)' : 'var(--danger-600)') + '">'
          + (isPos ? '+' : '') + (r.points || 0) + '</span>'
          + '</div>'
          + '<p style="margin:4px 0 0;font-size:13px;color:var(--gray-600)">' + Utils.escapeHtml(r.description || '') + '</p>'
          + '<p style="margin:2px 0 0;font-size:11px;color:var(--gray-400)">' + (r.date ? Utils.formatDate(r.date) : '') + '</p>'
          + '</div></div>';
      });
      html += '</div>';
    }

    html += '</div>';

    Modal.open({
      title: 'Student Behavior Profile',
      content: html,
      size: 'md',
      footer: '<button class="btn btn-outline-secondary" data-modal-close>Close</button>'
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
      var idx = btn.dataset.idx;

      switch (action) {
        case 'create-exam':
          e.preventDefault();
          e.stopPropagation();
          openCreateExamModal();
          break;

        case 'edit-questions':
          e.preventDefault();
          e.stopPropagation();
          _editingExamId = id;
          _subView = 'editor';
          loadQuestionsForExam(id).then(function () { render(); });
          break;

        case 'publish-exam':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Publish this exam? Students will be able to see it.').then(function (confirmed) {
            if (confirmed) {
              DataService.update('cbtExams', getSchoolId(), id, { status: 'published' }).then(function () {
                Toast.success('Exam published.');
                DataService.logAction('cbt_publish', 'Published CBT exam: ' + id);
                render();
              });
            }
          });
          break;

        case 'activate-exam':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Activate this exam? Students can now start taking it.').then(function (confirmed) {
            if (confirmed) {
              DataService.update('cbtExams', getSchoolId(), id, { status: 'active' }).then(function () {
                Toast.success('Exam activated.');
                DataService.logAction('cbt_activate', 'Activated CBT exam: ' + id);
                render();
              });
            }
          });
          break;

        case 'unpublish-exam':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Unpublish this exam? Students will no longer see it.').then(function (confirmed) {
            if (confirmed) {
              DataService.update('cbtExams', getSchoolId(), id, { status: 'draft' }).then(function () {
                Toast.success('Exam unpublished.');
                render();
              });
            }
          });
          break;

        case 'end-exam':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('End this exam? No more submissions will be accepted.').then(function (confirmed) {
            if (confirmed) {
              DataService.update('cbtExams', getSchoolId(), id, { status: 'completed' }).then(function () {
                Toast.success('Exam ended.');
                DataService.logAction('cbt_end', 'Ended CBT exam: ' + id);
                render();
              });
            }
          });
          break;

        case 'delete-exam':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Delete this exam and all its questions? This cannot be undone.').then(function (confirmed) {
            if (confirmed) {
              DataService.remove('cbtExams', getSchoolId(), id).then(function () {
                Toast.success('Exam deleted.');
                DataService.logAction('cbt_delete', 'Deleted CBT exam: ' + id);
                render();
              });
            }
          });
          break;

        case 'view-results':
          e.preventDefault();
          e.stopPropagation();
          _editingExamId = id;
          _subView = 'results';
          render();
          break;

        case 'back-to-list':
          e.preventDefault();
          e.stopPropagation();
          _subView = 'list';
          _editingExamId = null;
          render();
          break;

        case 'add-question':
          e.preventDefault();
          e.stopPropagation();
          openAddQuestionModal();
          break;

        case 'edit-question':
          e.preventDefault();
          e.stopPropagation();
          openAddQuestionModal(id, parseInt(idx));
          break;

        case 'delete-question':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Delete this question?').then(function (confirmed) {
            if (confirmed) {
              DataService.remove('cbtQuestions', _editingExamId, id).then(function () {
                Toast.success('Question deleted.');
                render();
              });
            }
          });
          break;

        case 'import-questions':
          e.preventDefault();
          e.stopPropagation();
          openImportQuestionsModal();
          break;

        // Student actions
        case 'start-exam':
          e.preventDefault();
          e.stopPropagation();
          startExam(id);
          break;

        // CBT interface actions
        case 'select-option':
          e.preventDefault();
          e.stopPropagation();
          handleSelectOption(btn);
          break;

        case 'prev-question':
          e.preventDefault();
          e.stopPropagation();
          if (_cbtState.currentIndex > 0) {
            _cbtState.currentIndex--;
            refreshCBTDisplay();
          }
          break;

        case 'next-question':
          e.preventDefault();
          e.stopPropagation();
          if (_cbtState.currentIndex < _cbtState.questions.length - 1) {
            _cbtState.currentIndex++;
            refreshCBTDisplay();
          }
          break;

        case 'goto-question':
          e.preventDefault();
          e.stopPropagation();
          _cbtState.currentIndex = parseInt(idx);
          refreshCBTDisplay();
          break;

        case 'submit-exam-confirm':
          e.preventDefault();
          e.stopPropagation();
          Modal.confirm('Are you sure you want to submit your exam? You cannot change your answers after submission.').then(function (confirmed) {
            if (confirmed) {
              // Save any pending text input
              savePendingTextInputs();
              stopTimer();
              _cbtState.submitted = true;
              saveSubmission();
              Toast.success('Exam submitted successfully!');
              DataService.logAction('cbt_submit', 'Submitted CBT exam');
              _cbtState.active = false;
              _subView = 'list';
              render();
            }
          });
          break;
      }
    };

    document.addEventListener('click', _clickHandler);

    // Handle input/change events for CBT text fields
    _changeHandler = function (e) {
      var el = e.target;
      if (!el) return;

      // Handle fill-in-the-gap and text inputs during exam
      if (el.dataset.action === 'fill-input' && _cbtState.active) {
        var qid = el.closest('.cbt-question-card') ? _cbtState.questions[_cbtState.currentIndex].id : null;
        if (qid) _cbtState.answers[qid] = el.value;
      }

      if (el.dataset.action === 'text-input' && _cbtState.active) {
        var qid2 = _cbtState.questions[_cbtState.currentIndex] ? _cbtState.questions[_cbtState.currentIndex].id : null;
        if (qid2) _cbtState.answers[qid2] = el.value;
      }

      if (el.dataset.action === 'match-select' && _cbtState.active) {
        var matchQid = el.dataset.qid;
        var matchIdx = parseInt(el.dataset.idx);
        if (!_cbtState.answers[matchQid]) _cbtState.answers[matchQid] = [];
        _cbtState.answers[matchQid][matchIdx] = el.value;
      }
    };

    document.addEventListener('input', _changeHandler);
    document.addEventListener('change', _changeHandler);

    // Keyboard navigation during CBT
    if (_cbtState.active) {
      _keyHandler = function (e) {
        if (!_cbtState.active || _cbtState.submitted) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (_cbtState.currentIndex < _cbtState.questions.length - 1) {
            _cbtState.currentIndex++;
            refreshCBTDisplay();
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (_cbtState.currentIndex > 0) {
            _cbtState.currentIndex--;
            refreshCBTDisplay();
          }
        }
      };
      document.addEventListener('keydown', _keyHandler);
    }
  }

  function handleSelectOption(btn) {
    if (!_cbtState.active) return;
    var qid = btn.dataset.qid;
    var value = btn.dataset.value;
    if (!qid) return;

    // Deselect siblings
    var card = btn.closest('.cbt-options');
    if (card) {
      card.querySelectorAll('.cbt-option').forEach(function (el) {
        el.classList.remove('selected');
      });
    }
    btn.classList.add('selected');
    _cbtState.answers[qid] = value;
    refreshCBTGrid();
    updateProgress();
  }

  function savePendingTextInputs() {
    if (!_cbtState.active) return;
    var fillInput = document.getElementById('cbt-fill-input');
    var textInput = document.getElementById('cbt-text-input');
    var currentQ = _cbtState.questions[_cbtState.currentIndex];
    if (!currentQ) return;

    if (fillInput && currentQ.type === 'fill_gap') {
      _cbtState.answers[currentQ.id] = fillInput.value;
    }
    if (textInput && (currentQ.type === 'short_answer' || currentQ.type === 'essay')) {
      _cbtState.answers[currentQ.id] = textInput.value;
    }
  }

  function refreshCBTDisplay() {
    savePendingTextInputs();
    var container = document.getElementById('main-content');
    if (container) {
      container.innerHTML = renderCBTInterface();
      // Rebind input/change for new DOM elements
      bindCBTInputListeners();
    }
  }

  function refreshCBTGrid() {
    // Update just the grid buttons
    var gridBtns = document.querySelectorAll('.cbt-question-grid-btn');
    var questions = _cbtState.questions;
    gridBtns.forEach(function (btn, i) {
      var q = questions[i];
      if (!q) return;
      var isAnswered = _cbtState.answers[q.id] !== '' && _cbtState.answers[q.id] !== undefined;
      btn.classList.toggle('answered', isAnswered);
    });
  }

  function updateProgress() {
    var answered = Object.keys(_cbtState.answers).filter(function (k) { return _cbtState.answers[k] !== '' && _cbtState.answers[k] !== undefined; }).length;
    var total = _cbtState.questions.length;
    var progressFill = document.querySelector('.cbt-progress-fill');
    if (progressFill) {
      progressFill.style.width = (total > 0 ? (answered / total) * 100 : 0) + '%';
    }
    var progressText = document.querySelector('.cbt-header div:last-child');
    if (progressText) {
      progressText.textContent = answered + ' of ' + total + ' questions answered';
    }
  }

  function bindCBTInputListeners() {
    var fillInput = document.getElementById('cbt-fill-input');
    var textInput = document.getElementById('cbt-text-input');

    if (fillInput) {
      fillInput.addEventListener('input', function () {
        var q = _cbtState.questions[_cbtState.currentIndex];
        if (q) {
          _cbtState.answers[q.id] = this.value;
          refreshCBTGrid();
          updateProgress();
        }
      });
    }

    if (textInput) {
      textInput.addEventListener('input', function () {
        var q = _cbtState.questions[_cbtState.currentIndex];
        if (q) {
          _cbtState.answers[q.id] = this.value;
          refreshCBTGrid();
          updateProgress();
        }
      });
    }

    // Match selects
    document.querySelectorAll('[data-action="match-select"]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var matchQid = this.dataset.qid;
        var matchIdx = parseInt(this.dataset.idx);
        if (!_cbtState.answers[matchQid]) _cbtState.answers[matchQid] = [];
        _cbtState.answers[matchQid][matchIdx] = this.value;
        refreshCBTGrid();
        updateProgress();
      });
    });
  }

  function startExam(examId) {
    var exam = _exams.find(function (e) { return e.id === examId; });
    if (!exam) return;

    var questions = _questions[examId] || [];
    if (!questions.length) {
      Toast.error('This exam has no questions.');
      return;
    }

    // Check if already submitted
    var existing = _submissions.find(function (s) { return s.examId === examId && s.studentId === getUid(); });
    if (existing && exam.oneAttemptOnly) {
      Toast.warning('You have already taken this exam.');
      return;
    }

    // Check anti-cheating / fullscreen
    if (exam.antiCheating) {
      try {
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } catch (e) { /* ignore */ }
    }

    // Prepare questions (randomize if needed)
    var examQuestions = questions.slice();
    if (exam.randomizeQuestions) {
      examQuestions.sort(function () { return Math.random() - 0.5; });
    }
    if (exam.randomizeOptions) {
      examQuestions.forEach(function (q) {
        if (q.type === 'multiple_choice' && q.options) {
          q.options.sort(function () { return Math.random() - 0.5; });
        }
      });
    }

    // Initialize CBT state
    _cbtState = {
      active: true,
      exam: exam,
      questions: examQuestions,
      answers: {},
      currentIndex: 0,
      timeRemaining: (exam.duration || 60) * 60,
      timerInterval: null,
      submitted: false
    };

    startTimer();

    // Render CBT interface
    var container = document.getElementById('main-content');
    if (container) {
      container.innerHTML = renderCBTInterface();
      bindCBTInputListeners();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  function cleanup() {
    stopTimer();
    if (_clickHandler) {
      document.removeEventListener('click', _clickHandler);
      _clickHandler = null;
    }
    if (_changeHandler) {
      document.removeEventListener('input', _changeHandler);
      document.removeEventListener('change', _changeHandler);
      _changeHandler = null;
    }
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
      _keyHandler = null;
    }
    _listeners.forEach(function (unsub) { if (typeof unsub === 'function') unsub(); });
    _listeners = [];

    // Try to exit fullscreen
    try {
      if (document.fullscreenElement) document.exitFullscreen();
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  window.Modules.cbt = {
    render: function () {
      if (window.SidebarComponent) window.SidebarComponent.setActive('cbt');
      if (window.HeaderComponent) window.HeaderComponent.setBreadcrumb([
        { label: 'School' },
        { label: 'CBT Exams' }
      ]);
      _subView = 'list';
      _editingExamId = null;
      _cbtState = {
        active: false, exam: null, questions: [], answers: {},
        currentIndex: 0, timeRemaining: 0, timerInterval: null, submitted: false
      };
      render();
    },

    destroy: function () {
      cleanup();
      _exams = [];
      _questions = {};
      _submissions = [];
      _classes = [];
      _subjects = [];
      _students = [];
      _subView = 'list';
      _editingExamId = null;
      _cbtState = {
        active: false, exam: null, questions: [], answers: {},
        currentIndex: 0, timeRemaining: 0, timerInterval: null, submitted: false
      };
    }
  };
})();