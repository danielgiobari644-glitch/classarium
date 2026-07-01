/**
 * Classarium First-Login Setup Wizard
 * 7-step guided setup for school_admin: Session, Terms, Departments, Classes, Arms, Subjects, Grading.
 */
(function () {
  'use strict';

  window.Modules = window.Modules || {};

  var Utils = window.Utils;
  var Toast = window.Toast;
  var DataService = window.DataService;
  var Modal = window.Modal;
  var Router = window.Router;

  /* ------------------------------------------------------------------ */
  /*  Constants                                                          */
  /* ------------------------------------------------------------------ */

  var TOTAL_STEPS = 7;

  var STEP_TITLES = [
    'Create Academic Session',
    'Create Terms',
    'Create Departments',
    'Create Classes',
    'Create Arms',
    'Create Subjects',
    'Configure Grading & Invite Staff'
  ];

  var STEP_DESCRIPTIONS = [
    'Set up your first academic session (e.g. 2025/2026).',
    'Add the three terms for the academic session.',
    'Create departments to organize classes and subjects.',
    'Add classes under each department.',
    'Add class arms (sections) with capacity.',
    'Add subjects taught in your school.',
    'Set up the grading system and invite teachers.'
  ];

  var DEFAULT_SUBJECTS = [
    { name: 'English Language', code: 'ENG' },
    { name: 'Mathematics', code: 'MTH' },
    { name: 'Basic Science', code: 'BSC' },
    { name: 'Social Studies', code: 'SST' },
    { name: 'Civic Education', code: 'CIV' },
    { name: 'Basic Technology', code: 'BTE' },
    { name: 'Physical & Health Education', code: 'PHE' },
    { name: 'Computer Studies', code: 'CMP' },
    { name: 'Christian Religious Knowledge', code: 'CRK' },
    { name: 'Islamic Religious Knowledge', code: 'IRK' },
    { name: 'Business Studies', code: 'BST' },
    { name: 'Creative Arts', code: 'CRA' },
    { name: 'Agricultural Science', code: 'AGR' },
    { name: 'French', code: 'FRE' },
    { name: 'History', code: 'HIS' },
    { name: 'Geography', code: 'GEO' },
    { name: 'Literature in English', code: 'LIT' },
    { name: 'Economics', code: 'ECO' },
    { name: 'Physics', code: 'PHY' },
    { name: 'Chemistry', code: 'CHM' },
    { name: 'Biology', code: 'BIO' },
    { name: 'Further Mathematics', code: 'FMT' },
    { name: 'Government', code: 'GOV' },
    { name: 'Yoruba', code: 'YOR' },
    { name: 'Igbo', code: 'IGB' },
    { name: 'Hausa', code: 'HAU' }
  ];

  var DEFAULT_GRADES = [
    { grade: 'A', minScore: 70, maxScore: 100, remark: 'Excellent' },
    { grade: 'B', minScore: 60, maxScore: 69, remark: 'Very Good' },
    { grade: 'C', minScore: 50, maxScore: 59, remark: 'Good' },
    { grade: 'D', minScore: 45, maxScore: 49, remark: 'Fair' },
    { grade: 'F', minScore: 0, maxScore: 44, remark: 'Fail' }
  ];

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _currentStep = 1;
  var _clickHandler = null;

  // Wizard data collected across steps
  var _wizardData = {
    session: { name: '', startDate: '', endDate: '', setActive: true },
    terms: [
      { name: 'First Term', startDate: '', endDate: '' },
      { name: 'Second Term', startDate: '', endDate: '' },
      { name: 'Third Term', startDate: '', endDate: '' }
    ],
    departments: [
      { name: '', hod: '' },
      { name: '', hod: '' },
      { name: '', hod: '' }
    ],
    classes: [],
    arms: [],        // { classId, classIndex, name, capacity }
    subjects: DEFAULT_SUBJECTS.map(function (s) { return { name: s.name, code: s.code, selected: true }; }),
    grading: JSON.parse(JSON.stringify(DEFAULT_GRADES)),
    caWeight: 40,
    examWeight: 60,
    caTestMax: 20,
    assignmentMax: 10,
    examMax: 70,
    staffEmails: []
  };

  // Track created Firestore IDs for referencing
  var _createdIds = {
    session: null,
    terms: [],
    departments: [],
    classes: [],
    arms: []
  };

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  function getSchoolId() {
    var profile = window.App && window.App.state && window.App.state.profile;
    return profile ? profile.schoolId : '';
  }

  /* ------------------------------------------------------------------ */
  /*  Render — Main Wizard                                               */
  /* ------------------------------------------------------------------ */

  function render() {
    var html = '<div class="wizard-container" style="max-width:800px;margin:0 auto;padding:20px 0">';

    // Progress indicator
    html += renderProgress();

    // Current step
    html += '<div class="wizard-card" style="background:var(--white);border-radius:12px;border:1px solid var(--gray-200);padding:32px;margin-top:24px">';
    html += '<h2 class="wizard-step-title" style="margin:0 0 8px;font-size:20px;font-weight:700">Step ' + _currentStep + ': ' + STEP_TITLES[_currentStep - 1] + '</h2>';
    html += '<p class="wizard-step-description" style="margin:0 0 24px;font-size:14px;color:var(--gray-500)">' + STEP_DESCRIPTIONS[_currentStep - 1] + '</p>';
    html += '<div class="wizard-step" id="wizard-step-content">';
    html += renderStep();
    html += '</div>';
    html += '</div>';

    // Navigation
    html += '<div class="wizard-actions" style="display:flex;justify-content:space-between;margin-top:24px">';
    if (_currentStep > 1) {
      html += '<button class="btn btn-ghost" data-action="wizard-back" style="min-width:120px">← Back</button>';
    } else {
      html += '<div></div>';
    }

    if (_currentStep < TOTAL_STEPS) {
      html += '<button class="btn btn-primary" data-action="wizard-next" style="min-width:120px">Next →</button>';
    } else {
      html += '<button class="btn btn-primary" data-action="wizard-complete" style="min-width:160px;background:var(--success-600);border-color:var(--success-600)">✓ Complete Setup</button>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderProgress() {
    var html = '<div class="wizard-progress" style="display:flex;align-items:center;justify-content:center;gap:0;padding:0 20px">';

    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var isCompleted = i < _currentStep;
      var isCurrent = i === _currentStep;

      // Dot
      html += '<div class="wizard-step-dot" style="display:flex;flex-direction:column;align-items:center;flex:0 0 auto">'
        + '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;border:2px solid '
        + (isCompleted ? 'var(--success-500)' : isCurrent ? 'var(--primary-600)' : 'var(--gray-300)')
        + ';color:'
        + (isCompleted ? 'var(--success-600)' : isCurrent ? 'var(--white)' : 'var(--gray-400)')
        + ';background:'
        + (isCompleted ? 'var(--success-50)' : isCurrent ? 'var(--primary-600)' : 'var(--white)')
        + '">'
        + (isCompleted ? '✓' : i)
        + '</div>'
        + '<div style="font-size:11px;margin-top:6px;color:' + (isCurrent ? 'var(--primary-600)' : 'var(--gray-400)') + ';font-weight:' + (isCurrent ? '600' : '400') + ';max-width:70px;text-align:center;line-height:1.2">'
        + ['Session', 'Terms', 'Depts', 'Classes', 'Arms', 'Subjects', 'Grade'][i - 1]
        + '</div>'
        + '</div>';

      // Line between dots
      if (i < TOTAL_STEPS) {
        html += '<div class="wizard-step-line" style="flex:1;height:2px;margin:0 4px;margin-bottom:20px;background:'
          + (i < _currentStep ? 'var(--success-400)' : 'var(--gray-200)')
          + '"></div>';
      }
    }

    html += '</div>';
    return html;
  }

  function renderStep() {
    switch (_currentStep) {
      case 1: return renderStep1_Session();
      case 2: return renderStep2_Terms();
      case 3: return renderStep3_Departments();
      case 4: return renderStep4_Classes();
      case 5: return renderStep5_Arms();
      case 6: return renderStep6_Subjects();
      case 7: return renderStep7_Grading();
      default: return '';
    }
  }

  /* ================================================================== */
  /*  STEP 1: Academic Session                                           */
  /* ================================================================== */

  function renderStep1_Session() {
    var s = _wizardData.session;
    var today = new Date().toISOString().split('T')[0];

    return '<div style="display:grid;gap:16px;max-width:500px">'
      + '<div>'
      + '<label class="form-label">Session Name <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="text" id="wiz-session-name" class="form-input" placeholder="e.g. 2025/2026" value="' + Utils.escapeHtml(s.name) + '">'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div>'
      + '<label class="form-label">Start Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" id="wiz-session-start" class="form-input" value="' + (s.startDate || '') + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">End Date <span style="color:var(--danger-500)">*</span></label>'
      + '<input type="date" id="wiz-session-end" class="form-input" value="' + (s.endDate || '') + '">'
      + '</div>'
      + '</div>'
      + '<label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">'
      + '<input type="checkbox" id="wiz-session-active" checked> Set as active session'
      + '</label>'
      + '</div>';
  }

  /* ================================================================== */
  /*  STEP 2: Terms                                                     */
  /* ================================================================== */

  function renderStep2_Terms() {
    var html = '<div id="wiz-terms-container" style="display:grid;gap:20px">';

    _wizardData.terms.forEach(function (t, i) {
      html += '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:16px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<strong style="font-size:15px">Term ' + (i + 1) + '</strong>'
        + (i >= 3 ? '<button class="btn btn-sm btn-ghost" style="color:var(--danger-600)" data-action="wizard-remove-term" data-index="' + i + '">Remove</button>' : '')
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
        + '<div>'
        + '<label class="form-label">Term Name</label>'
        + '<input type="text" id="wiz-term-name-' + i + '" class="form-input" value="' + Utils.escapeHtml(t.name) + '" placeholder="e.g. First Term">'
        + '</div>'
        + '<div>'
        + '<label class="form-label">Start Date</label>'
        + '<input type="date" id="wiz-term-start-' + i + '" class="form-input" value="' + (t.startDate || '') + '">'
        + '</div>'
        + '<div>'
        + '<label class="form-label">End Date</label>'
        + '<input type="date" id="wiz-term-end-' + i + '" class="form-input" value="' + (t.endDate || '') + '">'
        + '</div>'
        + '</div></div>';
    });

    html += '</div>';
    html += '<button class="btn btn-ghost" style="margin-top:12px" data-action="wizard-add-term">+ Add Another Term</button>';

    return html;
  }

  /* ================================================================== */
  /*  STEP 3: Departments                                               */
  /* ================================================================== */

  function renderStep3_Departments() {
    // Pre-fill with suggestions if names are empty
    var suggestions = ['Science', 'Arts', 'Commercial'];
    _wizardData.departments.forEach(function (d, i) {
      if (!d.name && suggestions[i]) d.name = suggestions[i];
    });

    var html = '<div id="wiz-depts-container" style="display:grid;gap:16px">';

    _wizardData.departments.forEach(function (d, i) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end">'
        + '<div>'
        + '<label class="form-label">Department Name <span style="color:var(--danger-500)">*</span></label>'
        + '<input type="text" id="wiz-dept-name-' + i + '" class="form-input" value="' + Utils.escapeHtml(d.name) + '" placeholder="e.g. Science">'
        + '</div>'
        + '<div>'
        + '<label class="form-label">Head of Department</label>'
        + '<input type="text" id="wiz-dept-hod-' + i + '" class="form-input" value="' + Utils.escapeHtml(d.hod) + '" placeholder="e.g. Mr. Smith">'
        + '</div>'
        + '<div>'
        + '<button class="btn btn-ghost btn-sm" style="color:var(--danger-600);margin-bottom:1px" data-action="wizard-remove-dept" data-index="' + i + '">✕</button>'
        + '</div>'
        + '</div>';
    });

    html += '</div>';
    html += '<button class="btn btn-ghost" style="margin-top:12px" data-action="wizard-add-dept">+ Add Another Department</button>';

    return html;
  }

  /* ================================================================== */
  /*  STEP 4: Classes                                                   */
  /* ================================================================== */

  function renderStep4_Classes() {
    var defaultClasses = ['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'];

    // Pre-fill on first render
    if (!_wizardData.classes.length) {
      _wizardData.classes = defaultClasses.map(function (c) {
        return { name: c, departmentIndex: 0 };
      });
    }

    var deptOptions = _wizardData.departments.map(function (d, i) {
      return '<option value="' + i + '">' + Utils.escapeHtml(d.name || 'Dept ' + (i + 1)) + '</option>';
    }).join('');

    var html = '<div id="wiz-classes-container" style="display:grid;gap:12px">';

    _wizardData.classes.forEach(function (c, i) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end">'
        + '<div>'
        + '<label class="form-label">Class Name <span style="color:var(--danger-500)">*</span></label>'
        + '<input type="text" id="wiz-class-name-' + i + '" class="form-input" value="' + Utils.escapeHtml(c.name) + '" placeholder="e.g. JSS 1">'
        + '</div>'
        + '<div>'
        + '<label class="form-label">Department</label>'
        + '<select id="wiz-class-dept-' + i + '" class="form-select">'
        + deptOptions
        + '</select>'
        + '</div>'
        + '<div>'
        + '<button class="btn btn-ghost btn-sm" style="color:var(--danger-600);margin-bottom:1px" data-action="wizard-remove-class" data-index="' + i + '">✕</button>'
        + '</div>'
        + '</div>';
    });

    html += '</div>';
    html += '<button class="btn btn-ghost" style="margin-top:12px" data-action="wizard-add-class">+ Add Another Class</button>';

    return html;
  }

  /* ================================================================== */
  /*  STEP 5: Arms                                                      */
  /* ================================================================== */

  function renderStep5_Arms() {
    // Pre-fill arms for each class if not done
    if (!_wizardData.arms.length && _wizardData.classes.length) {
      _wizardData.classes.forEach(function (c, ci) {
        ['A', 'B', 'C'].forEach(function (arm) {
          _wizardData.arms.push({
            classIndex: ci,
            className: c.name,
            arm: arm,
            capacity: 40
          });
        });
      });
    }

    var html = '<p style="font-size:13px;color:var(--gray-500);margin:0 0 16px">Add arms (sections) for each class. Default capacity is 40 students.</p>';
    html += '<div id="wiz-arms-container" style="display:grid;gap:8px">';

    _wizardData.arms.forEach(function (a, i) {
      html += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:12px;align-items:end;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:12px">'
        + '<div>'
        + '<label class="form-label">Class</label>'
        + '<input type="text" class="form-input" value="' + Utils.escapeHtml(a.className || _wizardData.classes[a.classIndex] ? _wizardData.classes[a.classIndex].name : 'Class') + '" disabled style="background:var(--gray-100)">'
        + '</div>'
        + '<div>'
        + '<label class="form-label">Arm</label>'
        + '<input type="text" id="wiz-arm-name-' + i + '" class="form-input" value="' + Utils.escapeHtml(a.arm) + '" placeholder="e.g. A">'
        + '</div>'
        + '<div>'
        + '<label class="form-label">Capacity</label>'
        + '<input type="number" id="wiz-arm-cap-' + i + '" class="form-input" value="' + a.capacity + '" min="1">'
        + '</div>'
        + '<div>'
        + '<button class="btn btn-ghost btn-sm" style="color:var(--danger-600);margin-bottom:1px" data-action="wizard-remove-arm" data-index="' + i + '">✕</button>'
        + '</div>'
        + '</div>';
    });

    html += '</div>';
    html += '<button class="btn btn-ghost" style="margin-top:12px" data-action="wizard-add-arm">+ Add Another Arm</button>';

    return html;
  }

  /* ================================================================== */
  /*  STEP 6: Subjects                                                  */
  /* ================================================================== */

  function renderStep6_Subjects() {
    var html = '<p style="font-size:13px;color:var(--gray-500);margin:0 0 16px">Select the subjects taught in your school. Uncheck any that do not apply.</p>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="wiz-subjects-container">';

    _wizardData.subjects.forEach(function (s, i) {
      html += '<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--gray-200);border-radius:6px;cursor:pointer;font-size:14px;transition:all 0.15s'
        + (s.selected ? ';background:var(--primary-50);border-color:var(--primary-200)' : '')
        + '">'
        + '<input type="checkbox" id="wiz-subject-' + i + '" data-subject-index="' + i + '"' + (s.selected ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:var(--primary-600)">'
        + '<span style="font-weight:500">' + Utils.escapeHtml(s.name) + '</span>'
        + '<span style="color:var(--gray-400);font-size:12px;margin-left:auto">(' + Utils.escapeHtml(s.code) + ')</span>'
        + '</label>';
    });

    html += '</div>';

    // Custom subject input
    html += '<div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end">'
      + '<div>'
      + '<label class="form-label">Subject Name</label>'
      + '<input type="text" id="wiz-custom-subject-name" class="form-input" placeholder="e.g. Music">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Subject Code</label>'
      + '<input type="text" id="wiz-custom-subject-code" class="form-input" placeholder="e.g. MUS">'
      + '</div>'
      + '<button class="btn btn-ghost" data-action="wizard-add-subject" style="margin-bottom:1px">+ Add</button>'
      + '</div>';

    return html;
  }

  /* ================================================================== */
  /*  STEP 7: Grading & Invite Staff                                     */
  /* ================================================================== */

  function renderStep7_Grading() {
    var html = '<div style="display:grid;gap:24px">';

    // Grading table
    html += '<div>'
      + '<h3 style="margin:0 0 12px;font-size:16px;font-weight:600">Grading System</h3>'
      + '<p style="margin:0 0 12px;font-size:13px;color:var(--gray-500)">Review the default grading system. You can modify it later in Settings.</p>'
      + '<div class="data-table-wrapper"><table class="data-table">'
      + '<thead><tr><th>Grade</th><th>Min Score</th><th>Max Score</th><th>Remark</th></tr></thead><tbody>';

    _wizardData.grading.forEach(function (g) {
      html += '<tr>'
        + '<td style="font-weight:700;text-align:center;font-size:18px;color:var(--primary-600)">' + Utils.escapeHtml(g.grade) + '</td>'
        + '<td style="text-align:center">' + g.minScore + '</td>'
        + '<td style="text-align:center">' + g.maxScore + '</td>'
        + '<td>' + Utils.escapeHtml(g.remark) + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';

    // Weights and max scores
    html += '<div>'
      + '<h3 style="margin:0 0 12px;font-size:16px;font-weight:600">Score Configuration</h3>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'
      + '<div>'
      + '<label class="form-label">CA Test Max Score</label>'
      + '<input type="number" id="wiz-ca-test-max" class="form-input" value="' + _wizardData.caTestMax + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Assignment Max Score</label>'
      + '<input type="number" id="wiz-assign-max" class="form-input" value="' + _wizardData.assignmentMax + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Exam Max Score</label>'
      + '<input type="number" id="wiz-exam-max" class="form-input" value="' + _wizardData.examMax + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">CA Weight (%)</label>'
      + '<input type="number" id="wiz-ca-weight" class="form-input" value="' + _wizardData.caWeight + '">'
      + '</div>'
      + '<div>'
      + '<label class="form-label">Exam Weight (%)</label>'
      + '<input type="number" id="wiz-exam-weight" class="form-input" value="' + _wizardData.examWeight + '">'
      + '</div>'
      + '</div></div>';

    // Invite staff
    html += '<div>'
      + '<h3 style="margin:0 0 12px;font-size:16px;font-weight:600">Invite Staff</h3>'
      + '<p style="margin:0 0 12px;font-size:13px;color:var(--gray-500)">Add email addresses of teachers to invite. They will receive setup instructions.</p>'
      + '<div id="wiz-staff-emails-container">';

    _wizardData.staffEmails.forEach(function (email, i) {
      html += '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end;margin-bottom:8px">'
        + '<div>'
        + '<input type="email" id="wiz-staff-email-' + i + '" class="form-input" value="' + Utils.escapeHtml(email) + '" placeholder="teacher@example.com">'
        + '</div>'
        + '<button class="btn btn-ghost btn-sm" style="color:var(--danger-600);margin-bottom:1px" data-action="wizard-remove-email" data-index="' + i + '">✕</button>'
        + '</div>';
    });

    html += '</div>'
      + '<button class="btn btn-ghost btn-sm" data-action="wizard-add-email" style="margin-top:4px">+ Add Another Email</button>'
      + '</div>';

    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Step Data Collection                                               */
  /* ------------------------------------------------------------------ */

  function collectStepData(step) {
    switch (step) {
      case 1:
        _wizardData.session.name = ((document.getElementById('wiz-session-name') || {}).value || '').trim();
        _wizardData.session.startDate = (document.getElementById('wiz-session-start') || {}).value || '';
        _wizardData.session.endDate = (document.getElementById('wiz-session-end') || {}).value || '';
        _wizardData.session.setActive = (document.getElementById('wiz-session-active') || {}).checked;
        return _wizardData.session.name && _wizardData.session.startDate && _wizardData.session.endDate;

      case 2:
        _wizardData.terms.forEach(function (t, i) {
          t.name = ((document.getElementById('wiz-term-name-' + i) || {}).value || '').trim();
          t.startDate = (document.getElementById('wiz-term-start-' + i) || {}).value || '';
          t.endDate = (document.getElementById('wiz-term-end-' + i) || {}).value || '';
        });
        return _wizardData.terms.every(function (t) { return t.name; });

      case 3:
        _wizardData.departments.forEach(function (d, i) {
          d.name = ((document.getElementById('wiz-dept-name-' + i) || {}).value || '').trim();
          d.hod = ((document.getElementById('wiz-dept-hod-' + i) || {}).value || '').trim();
        });
        return _wizardData.departments.every(function (d) { return d.name; });

      case 4:
        _wizardData.classes.forEach(function (c, i) {
          c.name = ((document.getElementById('wiz-class-name-' + i) || {}).value || '').trim();
          c.departmentIndex = parseInt((document.getElementById('wiz-class-dept-' + i) || {}).value || '0', 10);
        });
        return _wizardData.classes.every(function (c) { return c.name; });

      case 5:
        _wizardData.arms.forEach(function (a, i) {
          a.arm = ((document.getElementById('wiz-arm-name-' + i) || {}).value || '').trim();
          a.capacity = parseInt((document.getElementById('wiz-arm-cap-' + i) || {}).value || '40', 10) || 40;
        });
        return _wizardData.arms.length > 0;

      case 6:
        _wizardData.subjects.forEach(function (s, i) {
          var cb = document.getElementById('wiz-subject-' + i);
          s.selected = cb ? cb.checked : s.selected;
        });
        return true;

      case 7:
        _wizardData.caTestMax = parseFloat((document.getElementById('wiz-ca-test-max') || {}).value) || 20;
        _wizardData.assignmentMax = parseFloat((document.getElementById('wiz-assign-max') || {}).value) || 10;
        _wizardData.examMax = parseFloat((document.getElementById('wiz-exam-max') || {}).value) || 70;
        _wizardData.caWeight = parseFloat((document.getElementById('wiz-ca-weight') || {}).value) || 40;
        _wizardData.examWeight = parseFloat((document.getElementById('wiz-exam-weight') || {}).value) || 60;
        _wizardData.staffEmails = [];
        _wizardData.staffEmails.forEach(function () {}); // no-op, re-collect below
        // Collect staff emails
        var emails = [];
        var idx = 0;
        while (true) {
          var input = document.getElementById('wiz-staff-email-' + idx);
          if (!input) break;
          var val = (input.value || '').trim();
          if (val) emails.push(val);
          idx++;
        }
        _wizardData.staffEmails = emails;
        return true;

      default:
        return true;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Save All Data to Firestore                                         */
  /* ------------------------------------------------------------------ */

  function completeSetup() {
    var schoolId = getSchoolId();
    var profile = window.App && window.App.state && window.App.state.profile;

    Toast.info('Saving setup data...');

    // 1. Create Session
    var sessionData = {
      name: _wizardData.session.name,
      startDate: _wizardData.session.startDate,
      endDate: _wizardData.session.endDate,
      status: _wizardData.session.setActive ? 'active' : 'upcoming',
      schoolId: schoolId,
      createdBy: profile ? profile.uid : '',
      createdAt: new Date().toISOString()
    };

    DataService.add('sessions', sessionData).then(function (sessionRef) {
      var sessionId = sessionRef.id || sessionRef;
      _createdIds.session = sessionId;

      // 2. Create Terms
      var termPromises = _wizardData.terms.map(function (t) {
        return DataService.add('terms', {
          name: t.name,
          sessionId: sessionId,
          startDate: t.startDate,
          endDate: t.endDate,
          status: 'upcoming',
          schoolId: schoolId,
          createdBy: profile ? profile.uid : '',
          createdAt: new Date().toISOString()
        }).then(function (ref) {
          _createdIds.terms.push(ref.id || ref);
        });
      });

      return Promise.all(termPromises);
    }).then(function () {
      // 3. Create Departments
      var deptPromises = _wizardData.departments.map(function (d) {
        return DataService.add('departments', {
          name: d.name,
          hod: d.hod,
          schoolId: schoolId,
          createdBy: profile ? profile.uid : '',
          createdAt: new Date().toISOString()
        }).then(function (ref) {
          _createdIds.departments.push(ref.id || ref);
        });
      });

      return Promise.all(deptPromises);
    }).then(function () {
      // 4. Create Classes
      var classPromises = _wizardData.classes.map(function (c) {
        var deptId = _createdIds.departments[c.departmentIndex] || '';
        return DataService.add('classes', {
          name: c.name,
          departmentId: deptId,
          schoolId: schoolId,
          createdBy: profile ? profile.uid : '',
          createdAt: new Date().toISOString()
        }).then(function (ref) {
          _createdIds.classes.push(ref.id || ref);
        });
      });

      return Promise.all(classPromises);
    }).then(function () {
      // 5. Create Arms
      var armPromises = _wizardData.arms.map(function (a) {
        var classId = _createdIds.classes[a.classIndex] || '';
        return DataService.add('classArms', {
          name: a.arm,
          classId: classId,
          className: a.className,
          capacity: a.capacity,
          schoolId: schoolId,
          createdBy: profile ? profile.uid : '',
          createdAt: new Date().toISOString()
        }).then(function (ref) {
          _createdIds.arms.push(ref.id || ref);
        });
      });

      return Promise.all(armPromises);
    }).then(function () {
      // 6. Create Subjects
      var selectedSubjects = _wizardData.subjects.filter(function (s) { return s.selected; });
      var subjectPromises = selectedSubjects.map(function (s) {
        return DataService.add('subjects', {
          name: s.name,
          code: s.code,
          schoolId: schoolId,
          createdBy: profile ? profile.uid : '',
          createdAt: new Date().toISOString()
        });
      });

      return Promise.all(subjectPromises);
    }).then(function () {
      // 7. Save grading config
      return DataService.updateSchoolConfig({
        gradingSystem: _wizardData.grading,
        caTestMaxScore: _wizardData.caTestMax,
        assignmentMaxScore: _wizardData.assignmentMax,
        examMaxScore: _wizardData.examMax,
        caWeight: _wizardData.caWeight,
        examWeight: _wizardData.examWeight
      });
    }).then(function () {
      // 8. Store staff invitations
      var invitePromises = _wizardData.staffEmails.map(function (email) {
        return DataService.add('staffInvitations', {
          email: email,
          schoolId: schoolId,
          invitedBy: profile ? profile.uid : '',
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      });

      return Promise.all(invitePromises);
    }).then(function () {
      // 9. Mark setup as complete
      return DataService.update('schools', schoolId, {
        setupComplete: true,
        updatedAt: new Date().toISOString()
      });
    }).then(function () {
      Toast.success('School setup completed successfully! Welcome to Classarium.');
      DataService.logAction && DataService.logAction('complete_setup', 'schools', schoolId, {});

      // Navigate to dashboard after short delay
      setTimeout(function () {
        if (Router) Router.navigate('/dashboard');
      }, 1500);
    }).catch(function (err) {
      Toast.error('Setup error: ' + (err.message || 'Unknown error. Please try again.'));
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Event Binding                                                      */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    _clickHandler = function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.dataset.action;

      switch (action) {
        case 'wizard-back':
          e.preventDefault();
          goBack();
          break;
        case 'wizard-next':
          e.preventDefault();
          goNext();
          break;
        case 'wizard-complete':
          e.preventDefault();
          completeSetup();
          break;

        // Dynamic add/remove items
        case 'wizard-add-term':
          e.preventDefault();
          _wizardData.terms.push({ name: '', startDate: '', endDate: '' });
          refreshStep();
          break;
        case 'wizard-remove-term':
          e.preventDefault();
          var tIdx = parseInt(target.dataset.index, 10);
          _wizardData.terms.splice(tIdx, 1);
          refreshStep();
          break;

        case 'wizard-add-dept':
          e.preventDefault();
          _wizardData.departments.push({ name: '', hod: '' });
          refreshStep();
          break;
        case 'wizard-remove-dept':
          e.preventDefault();
          var dIdx = parseInt(target.dataset.index, 10);
          _wizardData.departments.splice(dIdx, 1);
          refreshStep();
          break;

        case 'wizard-add-class':
          e.preventDefault();
          _wizardData.classes.push({ name: '', departmentIndex: 0 });
          refreshStep();
          break;
        case 'wizard-remove-class':
          e.preventDefault();
          var cIdx = parseInt(target.dataset.index, 10);
          _wizardData.classes.splice(cIdx, 1);
          // Also remove related arms
          _wizardData.arms = _wizardData.arms.filter(function (a) { return a.classIndex !== cIdx; });
          _wizardData.arms.forEach(function (a) { if (a.classIndex > cIdx) a.classIndex--; });
          refreshStep();
          break;

        case 'wizard-add-arm':
          e.preventDefault();
          if (_wizardData.classes.length) {
            _wizardData.arms.push({
              classIndex: _wizardData.classes.length - 1,
              className: _wizardData.classes[_wizardData.classes.length - 1].name,
              arm: '',
              capacity: 40
            });
          }
          refreshStep();
          break;
        case 'wizard-remove-arm':
          e.preventDefault();
          var aIdx = parseInt(target.dataset.index, 10);
          _wizardData.arms.splice(aIdx, 1);
          refreshStep();
          break;

        case 'wizard-add-subject':
          e.preventDefault();
          var sName = ((document.getElementById('wiz-custom-subject-name') || {}).value || '').trim();
          var sCode = ((document.getElementById('wiz-custom-subject-code') || {}).value || '').trim();
          if (sName) {
            _wizardData.subjects.push({ name: sName, code: sCode || sName.substring(0, 3).toUpperCase(), selected: true });
            refreshStep();
          } else {
            Toast.error('Subject name is required');
          }
          break;

        case 'wizard-add-email':
          e.preventDefault();
          _wizardData.staffEmails.push('');
          refreshStep();
          break;
        case 'wizard-remove-email':
          e.preventDefault();
          var eIdx = parseInt(target.dataset.index, 10);
          _wizardData.staffEmails.splice(eIdx, 1);
          refreshStep();
          break;
      }
    };

    document.addEventListener('click', _clickHandler);
  }

  function goBack() {
    collectStepData(_currentStep);
    if (_currentStep > 1) {
      _currentStep--;
      reRender();
    }
  }

  function goNext() {
    var valid = collectStepData(_currentStep);
    if (!valid) {
      Toast.error('Please fill in all required fields');
      return;
    }
    if (_currentStep < TOTAL_STEPS) {
      _currentStep++;
      reRender();
    }
  }

  function refreshStep() {
    var container = document.getElementById('wizard-step-content');
    if (container) container.innerHTML = renderStep();
  }

  function reRender() {
    // Full re-render of the wizard page
    var appContent = document.getElementById('app-content') || document.querySelector('main') || document.body;
    appContent.innerHTML = render();
  }

  /* ------------------------------------------------------------------ */
  /*  Module Definition                                                 */
  /* ------------------------------------------------------------------ */

  window.Modules['setup-wizard'] = {
    render: function () {
      return render();
    },

    bind: function () {
      setTimeout(function () {
        bindEvents();
      }, 0);
    },

    destroy: function () {
      if (_clickHandler) {
        document.removeEventListener('click', _clickHandler);
        _clickHandler = null;
      }
      _currentStep = 1;
      _wizardData = {
        session: { name: '', startDate: '', endDate: '', setActive: true },
        terms: [
          { name: 'First Term', startDate: '', endDate: '' },
          { name: 'Second Term', startDate: '', endDate: '' },
          { name: 'Third Term', startDate: '', endDate: '' }
        ],
        departments: [
          { name: '', hod: '' },
          { name: '', hod: '' },
          { name: '', hod: '' }
        ],
        classes: [],
        arms: [],
        subjects: DEFAULT_SUBJECTS.map(function (s) { return { name: s.name, code: s.code, selected: true }; }),
        grading: JSON.parse(JSON.stringify(DEFAULT_GRADES)),
        caWeight: 40,
        examWeight: 60,
        caTestMax: 20,
        assignmentMax: 10,
        examMax: 70,
        staffEmails: []
      };
      _createdIds = { session: null, terms: [], departments: [], classes: [], arms: [] };
    }
  };
})();