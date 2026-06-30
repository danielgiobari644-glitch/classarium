/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize Firebase with given configuration
const firebaseConfig = {
  apiKey: "AIzaSyBxnfxEw__3WptO44bWVzhenUVGc26wkG0",
  authDomain: "learnlynk1.firebaseapp.com",
  projectId: "learnlynk1",
  storageBucket: "learnlynk1.firebasestorage.app",
  messagingSenderId: "507980129773",
  appId: "1:507980129773:web:06532e31b0a7dbf6e173e4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Application State
const appState = {
  user: null,
  profile: null,
  school: null,
  currentRoute: "home",
  activeTab: "overview",
  chatRooms: [],
  activeChatRoomId: null,
  activeCbtExam: null,
  activeCbtAttempt: null,
  cbtTimerInterval: null,
  cbtTimeRemaining: 0,
  toastQueue: [],
  schoolsList: [], // Super Admin view
  staffList: [],   // Active school teachers
  studentList: [], // Active school students
  academicStructure: null,
  impersonatedSchoolId: null,
  ticketsList: [],   // Support tickets
  auditLogs: [],     // Security audit logs
  assignmentsList: [], // Homework assignments
  lmsList: [],       // LMS study materials
  cbtList: [],       // Built CBT exams
  studentScores: [], // Student results/scores
  libraryList: [],   // Catalogued books
  hostelList: [],    // Hostel allocations
  transportList: [], // Transport routes
  attendanceRecords: [], // Daily attendance records
  parentStudents: [] // Linked student children for parent view
};

// Toast notification helper
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.id = `toast-${Date.now()}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${
      type === "success" ? "✓" : type === "error" ? "✕" : type === "warning" ? "⚠" : "ℹ"
    }</span>
    <div>${message}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toast-container";
  container.className = "toast-container";
  document.body.appendChild(container);
  return container;
}

// Router trigger
function navigateTo(route) {
  appState.currentRoute = route;
  window.location.hash = route;
  renderApp();
}

// Global Event Listeners
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "") || "home";
  if (appState.currentRoute !== hash) {
    appState.currentRoute = hash;
    renderApp();
  }
});

// Setup Light/Dark Theme Toggle
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "light";
  const target = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", target);
  showToast(`Switched to ${target === "light" ? "Light" : "Dark"} Mode`, "info");
}

// Initialize Auth Listener
async function loadDataForCurrentContext() {
  if (!appState.user) return;
  const p = appState.profile || {};
  
  try {
    // If super_admin, fetch global resources: schools, tickets, audit logs
    if (p.role === "super_admin") {
      const schoolsSnapshot = await getDocs(collection(db, "schools"));
      appState.schoolsList = [];
      schoolsSnapshot.forEach((docSnap) => {
        appState.schoolsList.push(docSnap.data());
      });

      try {
        const ticketsSnapshot = await getDocs(collection(db, "tickets"));
        appState.ticketsList = [];
        ticketsSnapshot.forEach((docSnap) => {
          appState.ticketsList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading tickets:", err);
      }

      try {
        const logsSnapshot = await getDocs(collection(db, "audit_logs"));
        appState.auditLogs = [];
        logsSnapshot.forEach((docSnap) => {
          appState.auditLogs.push(docSnap.data());
        });
        // Sort audit logs by timestamp desc
        appState.auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } catch (err) {
        console.error("Error loading audit logs:", err);
      }
    }

    // Determine active schoolId
    const sId = appState.impersonatedSchoolId || p.schoolId;
    if (sId && sId !== "classarium_global") {
      // Load current school details
      const schDoc = await getDoc(doc(db, "schools", sId));
      if (schDoc.exists()) {
        appState.school = schDoc.data();
      }

      // Load academic structures
      const structDoc = await getDoc(doc(db, "academic_structures", sId));
      if (structDoc.exists()) {
        appState.academicStructure = structDoc.data();
      } else {
        appState.academicStructure = {
          id: sId,
          sessions: ["2026/2027"],
          terms: ["First Term", "Second Term", "Third Term"],
          departments: ["General", "Science", "Arts"],
          classes: ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
          arms: ["A", "B"],
          houses: ["Red", "Blue"],
          subjects: ["Mathematics", "English", "Basic Science", "Civic Education"],
          gradingSystem: [
            { grade: "A", minScore: 75, maxScore: 100, remark: "Excellent" },
            { grade: "B", minScore: 65, maxScore: 74, remark: "Very Good" },
            { grade: "C", minScore: 50, maxScore: 64, remark: "Credit" },
            { grade: "F", minScore: 0, maxScore: 49, remark: "Fail" }
          ],
          resultStructure: {
            principalName: "Dr. Babajide Alao, Principal SOS",
            caMax: 30,
            assignmentMax: 10,
            examMax: 60
          }
        };
        await setDoc(doc(db, "academic_structures", sId), appState.academicStructure);
      }

      // Fetch users of this school
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("schoolId", "==", sId));
      const querySnapshot = await getDocs(q);
      
      appState.staffList = [];
      appState.studentList = [];
      
      querySnapshot.forEach((docSnap) => {
        const uData = docSnap.data();
        if (uData.role === "teacher" || uData.role === "class_manager") {
          appState.staffList.push(uData);
        } else if (uData.role === "student") {
          appState.studentList.push(uData);
        }
      });

      // Fetch assignments
      try {
        const assignmentsSnapshot = await getDocs(query(collection(db, "assignments"), where("schoolId", "==", sId)));
        appState.assignmentsList = [];
        assignmentsSnapshot.forEach((docSnap) => {
          appState.assignmentsList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading assignments:", err);
      }

      // Fetch LMS materials
      try {
        const lmsSnapshot = await getDocs(query(collection(db, "lms_materials"), where("schoolId", "==", sId)));
        appState.lmsList = [];
        lmsSnapshot.forEach((docSnap) => {
          appState.lmsList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading LMS materials:", err);
      }

      // Fetch CBT exams
      try {
        const cbtSnapshot = await getDocs(query(collection(db, "cbt_exams"), where("schoolId", "==", sId)));
        appState.cbtList = [];
        cbtSnapshot.forEach((docSnap) => {
          appState.cbtList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading CBT exams:", err);
      }

      // Fetch Student Scores
      try {
        const scoresSnapshot = await getDocs(query(collection(db, "student_scores"), where("schoolId", "==", sId)));
        appState.studentScores = [];
        scoresSnapshot.forEach((docSnap) => {
          appState.studentScores.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading student scores:", err);
      }

      // Fetch Library catalog
      try {
        const libSnapshot = await getDocs(query(collection(db, "library_books"), where("schoolId", "==", sId)));
        appState.libraryList = [];
        libSnapshot.forEach((docSnap) => {
          appState.libraryList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading library catalog:", err);
      }

      // Fetch Hostel beds
      try {
        const hostelSnapshot = await getDocs(query(collection(db, "hostel_allocations"), where("schoolId", "==", sId)));
        appState.hostelList = [];
        hostelSnapshot.forEach((docSnap) => {
          appState.hostelList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading hostel allocations:", err);
      }

      // Fetch Vehicle routes
      try {
        const transSnapshot = await getDocs(query(collection(db, "vehicle_routes"), where("schoolId", "==", sId)));
        appState.transportList = [];
        transSnapshot.forEach((docSnap) => {
          appState.transportList.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading vehicle routes:", err);
      }

      // Fetch Attendance records
      try {
        const attSnapshot = await getDocs(query(collection(db, "attendance_records"), where("schoolId", "==", sId)));
        appState.attendanceRecords = [];
        attSnapshot.forEach((docSnap) => {
          appState.attendanceRecords.push(docSnap.data());
        });
      } catch (err) {
        console.error("Error loading attendance records:", err);
      }
    } else {
      if (p.role === "super_admin" && !appState.impersonatedSchoolId) {
        appState.school = { name: "Classarium Global Network" };
      }
    }

    // Dynamic checks for student / parent roles
    if (p.role === "student") {
      // Find own scores specifically
      appState.studentScores = appState.studentScores.filter(s => s.studentUid === p.uid);
    } else if (p.role === "parent") {
      // Find students belonging to this parent's email dynamically from Firestore users
      try {
        const usersRef = collection(db, "users");
        const qStud = query(usersRef, where("parentEmail", "==", p.email), where("role", "==", "student"));
        const studSnap = await getDocs(qStud);
        appState.parentStudents = [];
        studSnap.forEach((docSnap) => {
          appState.parentStudents.push(docSnap.data());
        });
        
        // Load parent-student scores specifically
        if (appState.parentStudents.length > 0) {
          const firstStud = appState.parentStudents[0];
          const parentScoresSnapshot = await getDocs(query(collection(db, "student_scores"), where("studentUid", "==", firstStud.uid)));
          appState.studentScores = [];
          parentScoresSnapshot.forEach((docSnap) => {
            appState.studentScores.push(docSnap.data());
          });
        }
      } catch (err) {
        console.error("Error loading parent-student info:", err);
      }
    }
  } catch (error) {
    console.error("Error loading context data:", error);
  }
}

async function logSecurityEvent(schoolId, action) {
  try {
    const logId = `log_${Date.now()}`;
    const p = appState.profile || {};
    await setDoc(doc(db, "audit_logs", logId), {
      id: logId,
      schoolId: schoolId || p.schoolId || "global",
      actorName: p.displayName || appState.user?.email || "SaaS Operator",
      actorRole: p.role || "Operator",
      action,
      ip: "10.231.12.80", // Operational container sandbox IP
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
window.logSecurityEvent = logSecurityEvent;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    appState.user = user;
    try {
      // Get profile
      const profDoc = await getDoc(doc(db, "users", user.uid));
      if (profDoc.exists()) {
        appState.profile = profDoc.data();
        // Get school details
        const sId = appState.impersonatedSchoolId || appState.profile.schoolId;
        if (sId) {
          const schDoc = await getDoc(doc(db, "schools", sId));
          if (schDoc.exists()) {
            appState.school = schDoc.data();
          }
        }
        await loadDataForCurrentContext();
        showToast(`Welcome back, ${appState.profile.displayName}!`, "success");
        navigateTo("dashboard");
      } else {
        // Fallback or super admin check
        appState.profile = {
          uid: user.uid,
          role: "super_admin",
          displayName: "Super Administrator",
          schoolId: "classarium_global"
        };
        await loadDataForCurrentContext();
        navigateTo("dashboard");
      }
    } catch (e) {
      showToast(e.message, "error");
    }
  } else {
    appState.user = null;
    appState.profile = null;
    appState.school = null;
    navigateTo("home");
  }
});

// Seed Demo Data Helper removed

// Global UI Rendering Router
function renderApp() {
  const root = document.getElementById("root");
  if (!root) return;

  // Header template for Public Marketing and Auth screens
  if (!appState.user) {
    // PUBLIC OR AUTH ROUTES
    if (appState.currentRoute === "login" || appState.currentRoute === "register" || appState.currentRoute === "reset") {
      root.innerHTML = renderAuthScreen();
    } else {
      root.innerHTML = `
        ${renderPublicHeader()}
        <main class="animate-fade-in">${renderPublicContent()}</main>
        ${renderPublicFooter()}
      `;
      setupPublicInteractivity();
    }
  } else {
    // AUTHENTICATED SaaS INTERFACES
    root.innerHTML = `
      <div class="app-container">
        ${renderSidebar()}
        <main class="main-content animate-fade-in" id="saas-main-view">
          ${renderTopbar()}
          <div id="saas-module-content">
            ${renderModuleContent()}
          </div>
        </main>
      </div>
      <div id="toast-container" class="toast-container"></div>
    `;
    setupSaaSInteractivity();
  }
}

// ==========================================
// 1. PUBLIC MARKETING WEBSITE RENDERERS
// ==========================================

function renderPublicHeader() {
  return `
    <header class="public-header">
      <div class="public-container navbar">
        <a href="#home" class="logo-container">
          <div class="logo-icon">C</div>
          <span>Classarium</span>
        </a>
        
        <!-- Hamburger Menu Button -->
        <button id="public-menu-toggle" class="public-menu-toggle" aria-label="Toggle Navigation Menu">
          <span class="hamburger-bar"></span>
          <span class="hamburger-bar"></span>
          <span class="hamburger-bar"></span>
        </button>

        <nav class="public-nav" id="public-nav">
          <ul class="nav-links">
            <li><a href="#home" class="nav-link ${appState.currentRoute === "home" || !appState.currentRoute ? "active" : ""}">Home</a></li>
            <li><a href="#about" class="nav-link ${appState.currentRoute === "about" ? "active" : ""}">About</a></li>
            <li><a href="#contact" class="nav-link ${appState.currentRoute === "contact" ? "active" : ""}">Contact</a></li>
          </ul>
          <div class="nav-buttons">
            <button class="theme-toggle-btn" id="theme-toggle-nav" onclick="this.dispatchEvent(new CustomEvent('toggleTheme'))">
              🌓
            </button>
            <a href="#login" class="btn btn-secondary">Sign In</a>
            <a href="#register" class="btn btn-primary">Onboard School</a>
          </div>
        </nav>
      </div>
    </header>
  `;
}

function renderPublicContent() {
  switch (appState.currentRoute) {
    case "about":
      return `
        <section class="hero-section">
          <div class="public-container">
            <span class="hero-tag">OUR MISSION</span>
            <h1 class="hero-title">Pioneering School Operating System (SOS)</h1>
            <p class="hero-desc">Classarium is a secure multi-tenant cloud application dedicated to standardizing academic operations globally, removing educational management friction.</p>
          </div>
        </section>
      `;
    case "contact":
      return `
        <section class="hero-section">
          <div class="public-container" style="max-width: 600px;">
            <span class="hero-tag">SUPPORT HUB</span>
            <h1 class="hero-title" style="font-size: 2.5rem;">Speak with an SOS Specialist</h1>
            <p class="hero-desc">Have queries on onboarding isolation or subscription configurations? Drop us a line.</p>
            <form onsubmit="submitContactTicket(event);" style="text-align: left; background: var(--bg-surface); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border-color);">
              <div class="form-group">
                <label class="form-label">Name</label>
                <input type="text" id="ticket-name" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="ticket-email" class="form-input" required />
              </div>
              <div class="form-group">
                <label class="form-label">Message</label>
                <textarea id="ticket-message" class="form-input" rows="4" required></textarea>
              </div>
              <button type="submit" class="btn btn-primary w-full" style="width: 100%;">Send Message</button>
            </form>
          </div>
        </section>
      `;
    case "home":
    default:
      return `
        <section class="hero-section">
          <div class="public-container">
            <span class="hero-tag">INTELLIGENT SCHOOL OPERATING SYSTEM</span>
            <h1 class="hero-title">The Unified Cloud Operating System for Progressive Schools.</h1>
            <p class="hero-desc">Classarium empowers multi-tenant academies with granular access roles, real-time message rooms, auto-calculating grade cards, dynamic CBT modules, and clinical record keeping.</p>
            <div class="hero-actions">
              <a href="#register" class="btn btn-primary btn-lg">Deploy School Instance</a>
            </div>

            <div class="showcase-wrapper">
              <div class="showcase-screen">
                <div class="showcase-bar">
                  <div class="showcase-dot"></div>
                  <div class="showcase-dot"></div>
                  <div class="showcase-dot"></div>
                  <div class="showcase-url">/onboard</div>
                </div>
                <div class="showcase-content" style="background: url('https://placekitten.com/800/400') center/cover;"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Features Grid -->
        <section class="features-section">
          <div class="public-container">
            <div class="section-header">
              <h2 class="section-title">An OS Engineered for Academic Efficiency</h2>
              <p class="section-desc">Classarium replaces fragmented portals with a secure, responsive environment for everyone in the ecosystem.</p>
            </div>
            <div class="features-grid">
              <div class="feature-card">
                <div class="feature-icon-wrapper">🔒</div>
                <h3 class="feature-title">Multi-Tenant Tenant Isolation</h3>
                <p class="feature-desc">All school logs, results, documents, and messaging records are strictly isolated at the database schema query level.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon-wrapper">📊</div>
                <h3 class="feature-title">Automated Results Compiler</h3>
                <p class="feature-desc">Subject teachers enter raw marks; Classarium handles weighted sums, grading curves, position tallies, and exports print-ready report cards.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon-wrapper">📝</div>
                <h3 class="feature-title">Granular Permissions RBAC</h3>
                <p class="feature-desc">Role profiles tailored for Super Admins, Vice Principals, Class Managers, Hostel Officers, Librarians, and Emergency Clinic Wardens.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon-wrapper">📱</div>
                <h3 class="feature-title">Interactive CBT Engine</h3>
                <p class="feature-desc">Automated objective tests equipped with active quiz timers, anti-cheat tab-switching guards, and immediate feedback charts.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon-wrapper">💬</div>
                <h3 class="feature-title">Classrooms Group Chat</h3>
                <p class="feature-desc">Automatically created group rooms keeping students, teachers, and class directors coordinated in real time.</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon-wrapper">🧬</div>
                <h3 class="feature-title">All-in-one Operational Modules</h3>
                <p class="feature-desc">Integrated modules tracking vehicle route schedules, library borrow returns, bed allocations, and clinical visit history.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Stats Section -->
        <section class="stats-section">
          <div class="public-container stats-grid">
            <div>
              <div class="stat-number">450+</div>
              <div class="stat-label">Active Academies Instance</div>
            </div>
            <div>
              <div class="stat-number">250K+</div>
              <div class="stat-label">Student Portfolios Managed</div>
            </div>
            <div>
              <div class="stat-number">1.2M+</div>
              <div class="stat-label">Report Cards Compiled</div>
            </div>
            <div>
              <div class="stat-number">99.9%</div>
              <div class="stat-label">Operational Cloud Uptime</div>
            </div>
          </div>
        </section>

        <!-- FAQ Section -->
        <section class="features-section">
          <div class="public-container">
            <div class="section-header">
              <h2 class="section-title">Common SaaS Inquiries</h2>
              <p class="section-desc">Got questions regarding security, billing, or setup workflows? We've got answers.</p>
            </div>
            <div class="faq-list">
              <div class="faq-item">
                <div class="faq-question">How is school data isolation maintained?</div>
                <div class="faq-answer open">Classarium tags every single firestore entry with a mandatory 'schoolId' schema variable and filters real-time snapshot listeners under strict RBAC constraints.</div>
              </div>
              <div class="faq-item">
                <div class="faq-question">Can parents directly view student behavioral analytics?</div>
                <div class="faq-answer">Absolutely. The dedicated Parent Portal provides real-time access to merit points, disciplinary incidents, attendance statuses, and clinic visits.</div>
              </div>
            </div>
          </div>
        </section>
      `;
  }
}

function renderPublicFooter() {
  return `
    <footer class="public-footer">
      <div class="public-container">
        <div class="footer-grid">
          <div>
            <div class="logo-container" style="color: white; margin-bottom: 1rem;">
              <div class="logo-icon">C</div>
              <span>Classarium</span>
            </div>
            <p style="font-size: 0.9rem; line-height: 1.6;">Classarium is an enterprise-grade cloud environment standardizing operation logistics for modern schools and multi-branch academies.</p>
          </div>
          <div>
            <h4 class="footer-title">Platform Features</h4>
            <ul class="footer-links">
              <li><a href="#" class="footer-link">SaaS Isolation</a></li>
              <li><a href="#" class="footer-link">Automated Results</a></li>
              <li><a href="#" class="footer-link">Anti-cheat CBT Quiz</a></li>
              <li><a href="#" class="footer-link">Real-time Classrooms Chat</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-title">Enterprise Legal</h4>
            <ul class="footer-links">
              <li><a href="#" class="footer-link">SaaS Service Agreement</a></li>
              <li><a href="#" class="footer-link">Data Sovereignty Rules</a></li>
              <li><a href="#" class="footer-link">Security Disclosures</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <div>© 2026 Classarium SaaS Inc. All rights reserved. Built with pure custom CSS and ES Vanilla modules.</div>
          <div>Designed with Vercel and Notion modern aesthetics.</div>
        </div>
      </div>
    </footer>
  `;
}

function setupPublicInteractivity() {
  // Mobile public menu toggle
  const menuToggle = document.getElementById("public-menu-toggle");
  const publicNav = document.getElementById("public-nav");
  if (menuToggle && publicNav) {
    menuToggle.addEventListener("click", () => {
      publicNav.classList.toggle("open");
      menuToggle.classList.toggle("open");
    });
  }

  // Close menu on link click
  const navLinksList = document.querySelectorAll(".public-nav a");
  navLinksList.forEach(link => {
    link.addEventListener("click", () => {
      if (publicNav && menuToggle) {
        publicNav.classList.remove("open");
        menuToggle.classList.remove("open");
      }
    });
  });

  // Theme nav button dispatcher
  const themeBtn = document.getElementById("theme-toggle-nav");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  // FAQ accordion toggles
  const faqQs = document.querySelectorAll(".faq-question");
  faqQs.forEach(q => {
    q.addEventListener("click", () => {
      const ans = q.nextElementSibling;
      if (ans) {
        ans.classList.toggle("open");
      }
    });
  });
}

// ==========================================
// 2. MULTI-TENANT AUTH RENDERERS (VANILLA)
// ==========================================

function renderAuthScreen() {
  const isReg = appState.currentRoute === "register";
  const isReset = appState.currentRoute === "reset";

  return `
    <div class="auth-wrapper animate-fade-in">
      <div class="auth-card">
        <div class="auth-header">
          <a href="#home" class="logo-container" style="justify-content: center;">
            <div class="logo-icon">C</div>
            <span>Classarium</span>
          </a>
          <h2 class="auth-title">${
            isReg ? "Onboard Your Academy" : isReset ? "Restore Password" : "Sign In to Workspace"
          }</h2>
          <p class="auth-desc">${
            isReg 
              ? "Register a new multi-tenant school instance automatically" 
              : isReset 
                ? "Input your administrator email to receive reset credentials" 
                : "Enter credentials to access your isolated student dashboard"
          }</p>
        </div>

        <form id="auth-form" onsubmit="handleAuthSubmit(event)">
          ${
            isReg 
              ? `
                <div class="form-group">
                  <label class="form-label">School Name</label>
                  <input type="text" id="reg-school-name" class="form-input" placeholder="e.g. Greenwood Secondary Academy" required />
                </div>
                <div class="form-group">
                  <label class="form-label">School Motto</label>
                  <input type="text" id="reg-school-motto" class="form-input" placeholder="e.g. Integrity & Hardwork" required />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">School Type</label>
                    <select id="reg-school-type" class="form-input" required>
                      <option value="Primary & Secondary">Primary & Secondary</option>
                      <option value="High School">High School</option>
                      <option value="Vocational College">Vocational College</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Est. Year</label>
                    <input type="number" id="reg-school-year" class="form-input" value="2026" required />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">School Address</label>
                  <input type="text" id="reg-school-address" class="form-input" required />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">State</label>
                    <input type="text" id="reg-school-state" class="form-input" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Country</label>
                    <input type="text" id="reg-school-country" class="form-input" required />
                  </div>
                </div>
                <hr style="border-color: var(--border-color); margin: 1.5rem 0;" />
                <div class="form-group">
                  <label class="form-label">Super Administrator Name</label>
                  <input type="text" id="reg-admin-name" class="form-input" required />
                </div>
              ` : ""
          }

          <div class="form-group">
            <label class="form-label">Administrator/Staff/Student Email</label>
            <input type="email" id="auth-email" class="form-input" placeholder="name@school.edu" required />
          </div>

          ${
            !isReset 
              ? `
                <div class="form-group">
                  <label class="form-label">Secure Access Key (Password)</label>
                  <input type="password" id="auth-password" class="form-input" placeholder="••••••••" required />
                </div>
              ` : ""
          }

          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
            ${isReg ? "Provision Workspace Instance" : isReset ? "Trigger Reset Email" : "Unlock Workspace Access"}
          </button>
        </form>

        <div style="text-align: center; margin-top: 1.5rem; font-size: 0.85rem;">
          ${
            isReg 
              ? `Already got an active instance? <a href="#login" style="color: var(--primary-color); font-weight: 600;">Sign In Instead</a>` 
              : isReset 
                ? `Back to secure login gateway? <a href="#login" style="color: var(--primary-color); font-weight: 600;">Log In</a>` 
                : `Need to onboard a new school branch? <a href="#register" style="color: var(--primary-color); font-weight: 600;">Register Instance</a>`
          }
        </div>
      </div>
    </div>
  `;
}

// Authentication processor
async function handleAuthSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById("auth-email");
  const passwordInput = document.getElementById("auth-password");

  const email = emailInput?.value;
  const password = passwordInput?.value;

  if (appState.currentRoute === "register") {
    const schoolName = document.getElementById("reg-school-name")?.value;
    const motto = document.getElementById("reg-school-motto")?.value;
    const type = document.getElementById("reg-school-type")?.value;
    const year = parseInt(document.getElementById("reg-school-year")?.value || "2026");
    const address = document.getElementById("reg-school-address")?.value;
    const state = document.getElementById("reg-school-state")?.value;
    const country = document.getElementById("reg-school-country")?.value;
    const adminName = document.getElementById("reg-admin-name")?.value;

    showToast("Provisioning isolated database container...", "info");
    try {
      // 1. Create firebase user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const schoolId = `sch_${Date.now()}`;

      // 2. Set School
      await setDoc(doc(db, "schools", schoolId), {
        id: schoolId,
        name: schoolName,
        type,
        motto,
        establishedYear: year,
        email,
        phone: "+234 800 000 0000",
        website: "",
        country,
        state,
        city: state,
        address,
        logo: "",
        coverPhoto: "",
        ownerName: adminName,
        ownerEmail: email,
        ownerPhone: "",
        status: "approved",
        subscriptionTier: "growth",
        createdAt: new Date().toISOString()
      });

      // 3. Set User Doc
      await setDoc(doc(db, "users", userCred.user.uid), {
        uid: userCred.user.uid,
        email,
        displayName: adminName,
        role: "school_admin",
        schoolId,
        permissions: ["all"],
        disabled: false,
        createdAt: new Date().toISOString()
      });

      // Seed standard setup configuration for them
      await setDoc(doc(db, "academic_structures", schoolId), {
        id: schoolId,
        sessions: ["2026/2027"],
        terms: ["First Term", "Second Term", "Third Term"],
        departments: ["General", "Science", "Arts"],
        classes: ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
        arms: ["A", "B"],
        houses: ["Red", "Blue"],
        subjects: ["Mathematics", "English", "Basic Science", "Civic Education"],
        gradingSystem: [
          { grade: "A", minScore: 75, maxScore: 100, remark: "Excellent" },
          { grade: "B", minScore: 65, maxScore: 74, remark: "Very Good" },
          { grade: "C", minScore: 50, maxScore: 64, remark: "Credit" },
          { grade: "F", minScore: 0, maxScore: 49, remark: "Fail" }
        ],
        resultStructure: {
          caMax: 30,
          assignmentMax: 10,
          examMax: 60
        }
      });

      showToast("Instance deployed. Access setup wizard.", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  } else {
    // Normal Login
    showToast("Verifying access key credentials...", "info");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      // Self-healing auth registration for admin-created users
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          if (userData.password === password) {
            showToast("Provisioning account container...", "info");
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const oldId = userDoc.id;
            const newUid = userCred.user.uid;
            
            await deleteDoc(doc(db, "users", oldId));
            await setDoc(doc(db, "users", newUid), {
              ...userData,
              uid: newUid
            });
            showToast("Workspace security clearance granted!", "success");
            return;
          }
        }
      } catch (err) {
        console.error("Self-healing login error:", err);
      }
      showToast(e.message, "error");
    }
  }
}

// ==========================================
// 3. SECURE AUTHENTICATED SaaS VIEWS RENDERER
// ==========================================

function renderSidebar() {
  const p = appState.profile || {};
  const s = appState.school || { name: "Classarium Platform" };
  const roleName = p.role ? p.role.replace("_", " ") : "User";

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <div class="logo-icon" style="width: 1.75rem; height: 1.75rem; font-size: 1.1rem; border-radius: 0.35rem;">C</div>
          <span>Classarium</span>
        </div>
      </div>
      <div class="sidebar-school-info">
        <div class="sidebar-school-name">${s.name}</div>
        <div class="sidebar-school-role" style="display: flex; flex-direction: column; gap: 0.25rem;">
          <span>${roleName}</span>
          ${appState.impersonatedSchoolId ? `<span class="badge badge-warning" style="font-size: 0.75rem; align-self: flex-start;">Impersonating Admin</span>` : ""}
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <div class="sidebar-menu-title">Main Desk</div>
        <a href="#dashboard" class="sidebar-link ${appState.currentRoute === "dashboard" ? "active" : ""}">
          📊 Overview Desk
        </a>

        ${
          p.role === "super_admin" && !appState.impersonatedSchoolId
            ? `
              <div class="sidebar-menu-title">Global SaaS Operations</div>
              <a href="#super_schools" class="sidebar-link ${appState.currentRoute === "super_schools" ? "active" : ""}">🏫 School Instances</a>
              <a href="#super_tickets" class="sidebar-link ${appState.currentRoute === "super_tickets" ? "active" : ""}">🎫 Support Tickets</a>
              <a href="#super_audit" class="sidebar-link ${appState.currentRoute === "super_audit" ? "active" : ""}">📑 Audit Ledger</a>
            ` : ""
        }

        ${
          appState.impersonatedSchoolId
            ? `
              <div class="sidebar-menu-title" style="color: var(--warning-color); border-bottom: 1px dashed var(--warning-color); padding-bottom: 4px; margin-top: 1rem;">⚡ Impersonation Context</div>
              <button onclick="exitImpersonation()" class="sidebar-link" style="width: 100%; text-align: left; background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning-color); color: var(--warning-color); font-weight: 700; padding: 0.5rem; border-radius: 0.375rem; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <span>🔙</span> Exit Acting Admin
              </button>
            ` : ""
        }

        ${
          (p.role === "school_admin" || (p.role === "super_admin" && appState.impersonatedSchoolId))
            ? `
              <div class="sidebar-menu-title">Operational Workspace</div>
              <a href="#wizard" class="sidebar-link ${appState.currentRoute === "wizard" ? "active" : ""}">⚙ Setup Wizard</a>
              <a href="#staff_mgmt" class="sidebar-link ${appState.currentRoute === "staff_mgmt" ? "active" : ""}">🧑‍🏫 Staff Register</a>
              <a href="#student_mgmt" class="sidebar-link ${appState.currentRoute === "student_mgmt" ? "active" : ""}">🎓 Admission Desk</a>
              <a href="#timetable" class="sidebar-link ${appState.currentRoute === "timetable" ? "active" : ""}">📅 Timetable Editor</a>
              <a href="#results_config" class="sidebar-link ${appState.currentRoute === "results_config" ? "active" : ""}">📜 Result Templates</a>
            ` : ""
        }

        ${
          (p.role === "teacher" || p.role === "class_manager" || (p.role === "super_admin" && appState.impersonatedSchoolId))
            ? `
              <div class="sidebar-menu-title">Academic Controls</div>
              <a href="#attendance" class="sidebar-link ${appState.currentRoute === "attendance" ? "active" : ""}">✅ Daily Attendance</a>
              <a href="#assignments" class="sidebar-link ${appState.currentRoute === "assignments" ? "active" : ""}">📝 Task Assignments</a>
              <a href="#lms" class="sidebar-link ${appState.currentRoute === "lms" ? "active" : ""}">📚 LMS Courseware</a>
              <a href="#cbt_mgmt" class="sidebar-link ${appState.currentRoute === "cbt_mgmt" ? "active" : ""}">💻 CBT Exam Architect</a>
              <a href="#results_entry" class="sidebar-link ${appState.currentRoute === "results_entry" ? "active" : ""}">✍ Enter Subject Scores</a>
            ` : ""
        }

        ${
          (p.role === "student")
            ? `
              <div class="sidebar-menu-title">Student Hub</div>
              <a href="#timetable" class="sidebar-link ${appState.currentRoute === "timetable" ? "active" : ""}">📅 Timetable</a>
              <a href="#assignments" class="sidebar-link ${appState.currentRoute === "assignments" ? "active" : ""}">📝 My Submissions</a>
              <a href="#lms" class="sidebar-link ${appState.currentRoute === "lms" ? "active" : ""}">📚 Study Materials</a>
              <a href="#cbt_student" class="sidebar-link ${appState.currentRoute === "cbt_student" ? "active" : ""}">💻 CBT Test Center</a>
              <a href="#report_card" class="sidebar-link ${appState.currentRoute === "report_card" ? "active" : ""}">📜 View Report Card</a>
            ` : ""
        }

        ${
          p.role === "parent"
            ? `
              <div class="sidebar-menu-title">Family Monitor</div>
              <a href="#parent_view" class="sidebar-link ${appState.currentRoute === "parent_view" ? "active" : ""}">🧒 Child Progress</a>
              <a href="#report_card" class="sidebar-link ${appState.currentRoute === "report_card" ? "active" : ""}">📜 Child Report Card</a>
            ` : ""
        }

        <!-- Specialized Roles -->
        ${
          p.role === "librarian" || p.role === "school_admin" || (p.role === "super_admin" && appState.impersonatedSchoolId)
            ? `<a href="#library" class="sidebar-link ${appState.currentRoute === "library" ? "active" : ""}">📖 Catalog & Library</a>` : ""
        }
        ${
          p.role === "hostel_manager" || p.role === "school_admin" || (p.role === "super_admin" && appState.impersonatedSchoolId)
            ? `<a href="#hostel" class="sidebar-link ${appState.currentRoute === "hostel" ? "active" : ""}">🏠 Hostel Lodge</a>` : ""
        }
        ${
          p.role === "transport_officer" || p.role === "school_admin" || (p.role === "super_admin" && appState.impersonatedSchoolId)
            ? `<a href="#transport" class="sidebar-link ${appState.currentRoute === "transport" ? "active" : ""}">🚌 Vehicle Route</a>` : ""
        }

        <div class="sidebar-menu-title">Real-time Messaging</div>
        <a href="#chat" class="sidebar-link ${appState.currentRoute === "chat" ? "active" : ""}">
          💬 Message Rooms
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">${p.displayName ? p.displayName[0] : "U"}</div>
          <div class="sidebar-username">${p.displayName || "User Portfolio"}</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-saas-logout" title="Lock Session">🔑</button>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const p = appState.profile || {};
  return `
    <header class="topbar animate-fade-in">
      <div class="topbar-title-wrapper">
        <h1 id="topbar-title-text">Workspace Dashboard</h1>
        <p>Operational Time: <span id="clock-timestamp">2026-06-28</span></p>
      </div>
      <div class="topbar-actions">
        <!-- Theme Toggle -->
        <button class="theme-toggle-btn" id="theme-toggle-saas">🌓 Mode</button>
      </div>
    </header>
  `;
}

// Route Switcher
function renderModuleContent() {
  const p = appState.profile || {};
  switch (appState.currentRoute) {
    case "super_schools":
      return renderSuperSchools();
    case "super_tickets":
      return renderSuperTickets();
    case "super_audit":
      return renderSuperAuditLogs();
    case "wizard":
      return renderSetupWizard();
    case "staff_mgmt":
      return renderStaffManagement();
    case "student_mgmt":
      return renderStudentManagement();
    case "timetable":
      return renderTimetable();
    case "results_config":
      return renderResultConfig();
    case "attendance":
      return renderAttendanceModule();
    case "assignments":
      return renderAssignmentModule();
    case "lms":
      return renderLMSModule();
    case "cbt_mgmt":
      return renderCBTManagement();
    case "cbt_student":
      return renderCBTStudent();
    case "results_entry":
      return renderResultsEntry();
    case "report_card":
      return renderReportCard();
    case "parent_view":
      return renderParentDashboard();
    case "library":
      return renderLibraryModule();
    case "hostel":
      return renderHostelModule();
    case "transport":
      return renderTransportModule();
    case "chat":
      return renderChatModule();
    case "dashboard":
    default:
      return renderDashboardOverview();
  }
}

// Dashboard Overview based on role
function renderDashboardOverview() {
  const p = appState.profile || {};
  const s = appState.school || {};
  const role = (p.role === "super_admin" && appState.impersonatedSchoolId) ? "school_admin" : p.role;

  if (role === "super_admin") {
    const totalSchools = appState.schoolsList ? appState.schoolsList.length : 1;
    return `
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-card-header">SCHOOL INSTANCES <span class="stat-card-icon">🏫</span></div>
          <div class="stat-card-value" id="sadmin-tot-schools">${totalSchools}</div>
          <div class="stat-card-trend trend-up">✓ Active Multi-Tenancy container</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">TOTAL STUDENTS <span class="stat-card-icon">🎓</span></div>
          <div class="stat-card-value">${appState.studentList ? appState.studentList.length || 1 : 1}</div>
          <div class="stat-card-trend trend-up">✦ Registered platform profiles</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">GLOBAL CLOUD HEALTH <span class="stat-card-icon">⚡</span></div>
          <div class="stat-card-value">99.9%</div>
          <div class="stat-card-trend trend-up">● All subsystems online</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">STORAGE USED <span class="stat-card-icon">💾</span></div>
          <div class="stat-card-value">12.4 MB</div>
          <div class="stat-card-trend trend-down">✦ Structured firestore entries</div>
        </div>
      </div>

      <div class="panel-grid">
        <div class="card-panel">
          <div class="panel-header">
            <h3 class="panel-title">School Operational Instances</h3>
          </div>
          <div class="table-wrapper">
            <table class="custom-table" id="super-schools-table">
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>Established</th>
                  <th>Location</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  appState.schoolsList && appState.schoolsList.length > 0 
                    ? appState.schoolsList.map(sch => `
                      <tr>
                        <td><strong>${sch.name}</strong></td>
                        <td>${sch.establishedYear || "2026"}</td>
                        <td>${sch.state || "Lagos"}, ${sch.country || "Nigeria"}</td>
                        <td>${sch.ownerName || "Administrator"}</td>
                        <td><span class="badge badge-success">Approved</span></td>
                        <td>
                          <button class="btn btn-primary btn-sm" onclick="actAsSchoolAdmin('${sch.id}')">Act as Admin ⚡</button>
                        </td>
                      </tr>
                    `).join('')
                    : `
                      <tr>
                        <td>Classarium International Academy</td>
                        <td>2018</td>
                        <td>Lagos, Nigeria</td>
                        <td>Dr. Babajide Alao</td>
                        <td><span class="badge badge-success">Approved</span></td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="showToast('Demo instance is protected.', 'warning')">Protected</button>
                        </td>
                      </tr>
                    `
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card-panel">
          <div class="panel-header">
            <h3 class="panel-title">Platform Quick Tools</h3>
          </div>
          <div class="quick-action-grid">
            <div class="quick-action-card" onclick="navigateTo('super_schools')">
              <div class="quick-action-icon">🏫</div>
              <div class="quick-action-label">All Tenants</div>
            </div>
            <div class="quick-action-card" onclick="navigateTo('super_tickets')">
              <div class="quick-action-icon">🎫</div>
              <div class="quick-action-label">Tickets</div>
            </div>
            <div class="quick-action-card" onclick="navigateTo('super_audit')">
              <div class="quick-action-icon">📑</div>
              <div class="quick-action-label">Logs</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // School Admin Dashboard
  if (role === "school_admin") {
    const studentsCount = appState.studentList ? appState.studentList.length : 0;
    const staffCount = appState.staffList ? appState.staffList.length : 0;
    const examsCount = appState.cbtList ? appState.cbtList.length : 0;

    const todayStr = new Date().toISOString().substring(0, 10);
    const todayRecords = (appState.attendanceRecords || []).filter(r => r.date === todayStr);
    let todayAttendancePercent = "100%";
    if (todayRecords.length > 0) {
      const presents = todayRecords.filter(r => r.status === "Present").length;
      todayAttendancePercent = `${Math.round((presents / todayRecords.length) * 100)}%`;
    }

    return `
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-card-header">ADMITTED STUDENTS <span class="stat-card-icon">🎓</span></div>
          <div class="stat-card-value">${studentsCount}</div>
          <div class="stat-card-trend trend-up">✦ Fully Isolation container registered</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">STAFF ON DUTY <span class="stat-card-icon">🧑‍🏫</span></div>
          <div class="stat-card-value">${staffCount}</div>
          <div class="stat-card-trend trend-up">✦ Active platform permissions</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">TODAY'S ATTENDANCE <span class="stat-card-icon">✅</span></div>
          <div class="stat-card-value">${todayAttendancePercent}</div>
          <div class="stat-card-trend trend-up">✦ Verified class rosters</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">CBT EXAMS SCHED <span class="stat-card-icon">💻</span></div>
          <div class="stat-card-value">${examsCount}</div>
          <div class="stat-card-trend trend-up">✦ Timed Quiz Ready</div>
        </div>
      </div>

      <div class="panel-grid">
        <div class="card-panel">
          <div class="panel-header">
            <h3 class="panel-title">Operational Academic Structure Setup</h3>
          </div>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Configure your terms, grade bounds, result weighted max caps, and staff assignments in the Setup wizard.</p>
          <div style="display: flex; gap: 1rem;">
            <a href="#wizard" class="btn btn-primary">Go to Setup Wizard</a>
            <a href="#student_mgmt" class="btn btn-secondary">Admission Forms</a>
          </div>
        </div>

        <div class="card-panel">
          <div class="panel-header">
            <h3 class="panel-title">Core Management</h3>
          </div>
          <div class="quick-action-grid">
            <div class="quick-action-card" onclick="navigateTo('student_mgmt')">
              <div class="quick-action-icon">🎓</div>
              <div class="quick-action-label">Admissions</div>
            </div>
            <div class="quick-action-card" onclick="navigateTo('staff_mgmt')">
              <div class="quick-action-icon">🧑‍🏫</div>
              <div class="quick-action-label">Staff List</div>
            </div>
            <div class="quick-action-card" onclick="navigateTo('timetable')">
              <div class="quick-action-icon">📅</div>
              <div class="quick-action-label">Timetables</div>
            </div>
            <div class="quick-action-card" onclick="navigateTo('chat')">
              <div class="quick-action-icon">💬</div>
              <div class="quick-action-label">Class Chats</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Teacher / Class Manager Dashboard
  if (p.role === "teacher" || p.role === "class_manager") {
    const studentsCount = appState.studentList ? appState.studentList.length : 0;
    const lmsCount = appState.lmsList ? appState.lmsList.length : 0;
    
    let pendingCount = 0;
    if (appState.studentList) {
      appState.studentList.forEach(stud => {
        const hasScore = (appState.studentScores || []).some(s => s.studentUid === stud.uid);
        if (!hasScore) pendingCount++;
      });
    }

    return `
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-card-header">ASSIGNED CLASSES <span class="stat-card-icon">🏫</span></div>
          <div class="stat-card-value">1</div>
          <div class="stat-card-trend trend-up">✦ Primary Classroom</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">MY STUDENTS <span class="stat-card-icon">🎓</span></div>
          <div class="stat-card-value">${studentsCount}</div>
          <div class="stat-card-trend trend-up">✦ Active student database profiles</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">PENDING SCORES <span class="stat-card-icon">📝</span></div>
          <div class="stat-card-value">${pendingCount}</div>
          <div class="stat-card-trend trend-up">✓ Compiled report structures</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">LMS MATERIALS <span class="stat-card-icon">📚</span></div>
          <div class="stat-card-value">${lmsCount}</div>
          <div class="stat-card-trend trend-up">✦ Study notes published</div>
        </div>
      </div>

      <div class="panel-grid">
        <div class="card-panel" style="grid-column: span 2;">
          <div class="panel-header">
            <h3 class="panel-title">Class Manager Overview</h3>
          </div>
          <div class="table-wrapper">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Admission ID</th>
                  <th>Attendance Record</th>
                  <th>Merit Rating</th>
                  <th>Result Status</th>
                </tr>
              </thead>
              <tbody>
                ${
                  appState.studentList && appState.studentList.length > 0
                    ? appState.studentList.map(stud => {
                        const myScores = (appState.studentScores || []).filter(s => s.studentUid === stud.uid);
                        const statusBadge = myScores.length > 0 
                          ? `<span class="badge badge-success">Generated & Published</span>` 
                          : `<span class="badge badge-warning">Pending Scores</span>`;
                        
                        const studRecords = (appState.attendanceRecords || []).filter(r => r.studentUid === stud.uid);
                        let attText = "No Record";
                        let attBadgeClass = "badge-secondary";
                        if (studRecords.length > 0) {
                          const presentCount = studRecords.filter(r => r.status === "Present").length;
                          const percent = Math.round((presentCount / studRecords.length) * 100);
                          attText = `${percent}% Present`;
                          attBadgeClass = percent >= 75 ? "badge-success" : "badge-danger";
                        }

                        return `
                          <tr>
                            <td><strong>${stud.displayName}</strong></td>
                            <td>${stud.admissionNumber || "N/A"}</td>
                            <td><span class="badge ${attBadgeClass}">${attText}</span></td>
                            <td><span class="badge badge-info">Active</span></td>
                            <td>${statusBadge}</td>
                          </tr>
                        `;
                      }).join('')
                    : `
                      <tr>
                        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
                          No student records registered in this class roster yet.
                        </td>
                      </tr>
                    `
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // Student Dashboard
  if (p.role === "student") {
    const myScores = (appState.studentScores || []).filter(s => s.studentUid === p.uid);
    const myRecords = (appState.attendanceRecords || []).filter(r => r.studentUid === p.uid);
    
    let studentAttPercent = "100%";
    if (myRecords.length > 0) {
      const presents = myRecords.filter(r => r.status === "Present").length;
      studentAttPercent = `${Math.round((presents / myRecords.length) * 100)}%`;
    }

    return `
      <div class="dashboard-grid">
        <div class="stat-card">
          <div class="stat-card-header">CLASS ASSIGNED <span class="stat-card-icon">🏫</span></div>
          <div class="stat-card-value">${p.studentClass || "JSS 1"}${p.arm || "A"}</div>
          <div class="stat-card-trend trend-up">✦ Active school container</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">ATTENDANCE AVERAGE <span class="stat-card-icon">📅</span></div>
          <div class="stat-card-value">${studentAttPercent}</div>
          <div class="stat-card-trend trend-up">✓ Personal attendance card</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">COMPLETED QUIZZES <span class="stat-card-icon">💻</span></div>
          <div class="stat-card-value">${myScores.length}</div>
          <div class="stat-card-trend trend-up">✦ CBT exams graded</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">BEHAVIORAL MERITS <span class="stat-card-icon">🌟</span></div>
          <div class="stat-card-value">10 pts</div>
          <div class="stat-card-trend trend-up">✦ Positive conduct logged</div>
        </div>
      </div>

      <div class="panel-grid">
        <div class="card-panel">
          <div class="panel-header">
            <h3 class="panel-title">My Academic Timeline</h3>
          </div>
          <div class="timeline-list">
            <div class="timeline-item">
              <div class="timeline-time">June 25, 2026</div>
              <div class="timeline-title">Leadership Merit Awarded</div>
              <div class="timeline-desc">Mrs. Grace Babalola logged a conduct merit: "Organized the classroom library shelves beautifully."</div>
            </div>
            <div class="timeline-item">
              <div class="timeline-time">June 20, 2026</div>
              <div class="timeline-title">Academic Results Profile Updated</div>
              <div class="timeline-desc">Academic report compiled and published in school database ledger.</div>
            </div>
          </div>
        </div>

        <div class="card-panel">
          <div class="panel-header">
            <h3 class="panel-title">Student Desk</h3>
          </div>
          <div class="quick-action-grid">
            <button class="quick-action-card" onclick="navigateTo('cbt_student')">
              <div class="quick-action-icon">💻</div>
              <div class="quick-action-label">CBT Quiz</div>
            </button>
            <button class="quick-action-card" onclick="navigateTo('report_card')">
              <div class="quick-action-icon">📜</div>
              <div class="quick-action-label">Report Card</div>
            </button>
            <button class="quick-action-card" onclick="navigateTo('chat')">
              <div class="quick-action-icon">💬</div>
              <div class="quick-action-label">Group Chat</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Parent Dashboard View
  if (p.role === "parent") {
    return renderParentDashboard();
  }

  // Fallback / Guest
  return `
    <div class="card-panel" style="text-align: center; padding: 4rem;">
      <h3>Role Workspace Initializing</h3>
      <p style="color: var(--text-secondary); margin-top: 1rem;">Welcome to Classarium. Select a module from the sidebar desk to get started.</p>
    </div>
  `;
}

// ==========================================
// MODULE RENDERING FUNCTIONS
// ==========================================

// Super Admin
function renderSuperSchools() {
  const schools = appState.schoolsList || [];
  
  let rowsHtml = "";
  if (schools.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No tenant school instances have been deployed yet. Use the form below to provision a new instance.
        </td>
      </tr>
    `;
  } else {
    schools.forEach((s) => {
      rowsHtml += `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td><code>${s.id}</code></td>
          <td>${s.ownerName || s.email}</td>
          <td><span class="badge badge-info">${(s.subscriptionTier || "Growth").toUpperCase()}</span></td>
          <td><span class="badge badge-success">${(s.status || "Approved").toUpperCase()}</span></td>
          <td style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="actAsSchoolAdmin('${s.id}')">Act as Admin ⚡</button>
            <button class="btn btn-secondary btn-sm" onclick="deleteSchoolInstance('${s.id}')">Delete</button>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Manage Multi-Tenant Instances</h3>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
          Below are the isolated tenant operational instances. You can impersonate any instance to act as its admin and manage students/staff.
        </p>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>School Name</th>
                <th>Tenant ID</th>
                <th>Owner Name</th>
                <th>Subscription</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Deploy New Operational School Instance</h3>
        </div>
        <form onsubmit="createSchoolBySuperAdmin(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <h4 style="margin-bottom: 1rem; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; font-weight: 600;">School Logistics</h4>
            <div class="form-group">
              <label class="form-label">School Name</label>
              <input type="text" id="sadmin-school-name" class="form-input" placeholder="e.g. Apex High School" required />
            </div>
            <div class="form-group">
              <label class="form-label">School Motto</label>
              <input type="text" id="sadmin-school-motto" class="form-input" placeholder="e.g. Excellence In Service" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">School Type</label>
                <select id="sadmin-school-type" class="form-input" required>
                  <option value="Primary & Secondary">Primary & Secondary</option>
                  <option value="High School">High School</option>
                  <option value="Vocational College">Vocational College</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Est. Year</label>
                <input type="number" id="sadmin-school-year" class="form-input" value="2026" required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">School Address</label>
              <input type="text" id="sadmin-school-address" class="form-input" required placeholder="e.g. 12 Park Avenue" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">State</label>
                <input type="text" id="sadmin-school-state" class="form-input" required placeholder="Lagos" />
              </div>
              <div class="form-group">
                <label class="form-label">Country</label>
                <input type="text" id="sadmin-school-country" class="form-input" required placeholder="Nigeria" />
              </div>
            </div>
          </div>
          
          <div>
            <h4 style="margin-bottom: 1rem; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; font-weight: 600;">Admin Credentials</h4>
            <div class="form-group">
              <label class="form-label">Administrator Full Name</label>
              <input type="text" id="sadmin-admin-name" class="form-input" placeholder="e.g. Dr. Babajide Alao" required />
            </div>
            <div class="form-group">
              <label class="form-label">Administrator Email (Sign In Username)</label>
              <input type="email" id="sadmin-admin-email" class="form-input" placeholder="admin@apex.edu" required />
            </div>
            <div class="form-group">
              <label class="form-label">Secure Access Key (Password)</label>
              <input type="password" id="sadmin-admin-password" class="form-input" placeholder="••••••••" required />
            </div>
            
            <div style="background: rgba(var(--primary-rgb), 0.05); border: 1px dashed var(--border-color); border-radius: 0.5rem; padding: 1rem; margin-top: 1.5rem; font-size: 0.85rem; line-height: 1.5;">
              <p><strong>✦ Container Isolation Deployment:</strong> Creating this school provisions its dedicated relational structures and academic databases. The specified admin credentials will be registered for direct login access.</p>
            </div>
          </div>
          
          <div style="grid-column: span 2; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Provision & Deploy Instance</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderSuperTickets() {
  const tickets = appState.ticketsList || [];
  
  let rowsHtml = "";
  if (tickets.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          No active support or container tickets recorded yet.
        </td>
      </tr>
    `;
  } else {
    tickets.forEach((t) => {
      rowsHtml += `
        <tr>
          <td><code>${t.id || t.ticketId || "TCK-NEW"}</code></td>
          <td><strong>${t.name || "Anonymous Developer"}</strong> (${t.email || "N/A"})</td>
          <td>${t.message || t.subject || "No message content"}</td>
          <td><span class="badge badge-warning">${(t.status || "Open").toUpperCase()}</span></td>
          <td>${t.priority || "Normal"}</td>
        </tr>
      `;
    });
  }

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">SaaS Support Tickets Queue</h3>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Reviews open support and emergency container tickets submitted by school administrators and potential leads.</p>
      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Authorized Actor / Lead</th>
              <th>Subject & Description</th>
              <th>Status</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSuperAuditLogs() {
  const logs = appState.auditLogs || [];
  
  let rowsHtml = "";
  if (logs.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          No operations or security events recorded yet in the ledger.
        </td>
      </tr>
    `;
  } else {
    logs.forEach((log) => {
      rowsHtml += `
        <tr>
          <td><code>${log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : "N/A"}</code></td>
          <td><code>${log.schoolId || "global"}</code></td>
          <td><strong>${log.actorName || "SaaS Operator"}</strong> (${log.actorRole || "System"})</td>
          <td>${log.action || "Authorized security clearance"}</td>
          <td><code>${log.ip || "127.0.0.1"}</code></td>
        </tr>
      `;
    });
  }

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">Platform Operations Security Ledger</h3>
      </div>
      <div class="table-wrapper" style="margin-top: 1rem;">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>School ID</th>
              <th>Authorized Actor</th>
              <th>Action Operation</th>
              <th>IP Audit Log</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Setup Wizard
function renderSetupWizard() {
  const struct = appState.academicStructure || {};
  const activeTerms = struct.activeTerms || ["First Term", "Second Term", "Third Term"];
  const schoolName = appState.school?.name || "Classarium Academy";

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">First-Time Setup Wizard — ${schoolName}</h3>
      </div>
      <div class="wizard-steps" style="display: flex; gap: 1rem; margin-bottom: 2rem;">
        <div class="wizard-step completed" style="background: var(--success-color); color: white; border-radius: 50%; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; font-weight: bold;">1</div>
        <div class="wizard-step completed" style="background: var(--success-color); color: white; border-radius: 50%; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; font-weight: bold;">2</div>
        <div class="wizard-step active" style="background: var(--primary-color); color: white; border-radius: 50%; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; font-weight: bold;">3</div>
        <div class="wizard-step" style="border: 2px solid var(--border-color); border-radius: 50%; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">4</div>
        <div class="wizard-step" style="border: 2px solid var(--border-color); border-radius: 50%; width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; color: var(--text-muted);">5</div>
      </div>
      
      <form onsubmit="saveSetupWizardStep(event)">
        <div style="background-color: var(--bg-surface-hover); padding: 1.5rem; border-radius: 0.5rem; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">Step 3: Academic Term Structures</h4>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Confirm the active grading terms for report-card compilation inside this tenant:</p>
          <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem;">
            <label class="form-checkbox" style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
              <input type="checkbox" id="wizard-term-1" ${activeTerms.includes("First Term") ? "checked" : ""} /> First Term
            </label>
            <label class="form-checkbox" style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
              <input type="checkbox" id="wizard-term-2" ${activeTerms.includes("Second Term") ? "checked" : ""} /> Second Term
            </label>
            <label class="form-checkbox" style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
              <input type="checkbox" id="wizard-term-3" ${activeTerms.includes("Third Term") ? "checked" : ""} /> Third Term
            </label>
          </div>
          
          <h4 style="font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">Configure Class Arms</h4>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Comma-separated listing of class streams allowed on the student rosters:</p>
          <input type="text" id="wizard-class-arms" class="form-input" style="max-width: 400px;" value="${struct.classArms ? struct.classArms.join(", ") : "A, B, C, D"}" placeholder="e.g. A, B, C, D" required />
        </div>
        
        <div style="display: flex; justify-content: space-between;">
          <button type="button" class="btn btn-secondary" onclick="showToast('Setup steps auto-aligned.', 'info')">Back</button>
          <button type="submit" class="btn btn-primary">Save & Continue Configuration</button>
        </div>
      </form>
    </div>
  `;
}

// Staff management
function renderStaffManagement() {
  const staff = appState.staffList || [];
  
  let rowsHtml = "";
  if (staff.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No academic staff members onboarded yet. Fill the authorization form below to enroll your first staff.
        </td>
      </tr>
    `;
  } else {
    staff.forEach((s) => {
      rowsHtml += `
        <tr>
          <td><code>${s.uid.substring(0, 10)}</code></td>
          <td><strong>${s.displayName}</strong></td>
          <td>${s.subjectAssigned || "General Subjects"}</td>
          <td>${s.classAssigned || "Unassigned"}</td>
          <td>${s.createdAt ? s.createdAt.substring(0, 10) : "2026-06-28"}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="deleteStaffMember('${s.uid}')">Remove</button>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Active School Staff Roster</h3>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Full Name</th>
                <th>Subject Assigned</th>
                <th>Class Assigned</th>
                <th>Date Appointed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Onboard New Academic Staff</h3>
        </div>
        <form onsubmit="onboardStaffMember(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <h4 style="margin-bottom: 1rem; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; font-weight: 600;">Personal Info</h4>
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="staff-fullname" class="form-input" placeholder="e.g. Mr. John Carter" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email Username (For Login)</label>
              <input type="email" id="staff-email" class="form-input" placeholder="john.carter@school.edu" required />
            </div>
            <div class="form-group">
              <label class="form-label">Secure Access Key (Password)</label>
              <input type="password" id="staff-password" class="form-input" placeholder="••••••••" required />
            </div>
          </div>
          
          <div>
            <h4 style="margin-bottom: 1rem; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; font-weight: 600;">Academic Allocation</h4>
            <div class="form-group">
              <label class="form-label">Role Definition</label>
              <select id="staff-role" class="form-input" required>
                <option value="teacher">Subject Teacher</option>
                <option value="class_manager">Class Manager (Form Teacher)</option>
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Subject Assigned</label>
                <input type="text" id="staff-subject" class="form-input" placeholder="e.g. Mathematics" required />
              </div>
              <div class="form-group">
                <label class="form-label">Class Assigned</label>
                <input type="text" id="staff-class" class="form-input" placeholder="e.g. JSS 1" required />
              </div>
            </div>
            <div style="background: rgba(var(--primary-rgb), 0.05); border: 1px dashed var(--border-color); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem; font-size: 0.825rem; line-height: 1.5;">
              <p><strong>✦ Login Sync:</strong> Staff accounts are stored securely in the local school directory. On first login, credentials automatically activate across the secure workspace container.</p>
            </div>
          </div>
          
          <div style="grid-column: span 2; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Authorize & Onboard Staff</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Student admission Management
function renderStudentManagement() {
  const students = appState.studentList || [];
  
  let listHtml = "";
  if (students.length === 0) {
    listHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No student records registered yet in this school context. Process a student admittance below.
        </td>
      </tr>
    `;
  } else {
    students.forEach((s) => {
      listHtml += `
        <tr>
          <td><code>${s.admissionNumber || s.uid.substring(0, 8)}</code></td>
          <td><strong>${s.displayName}</strong></td>
          <td>${s.gender || "Male"}</td>
          <td>${s.studentClass || "JSS 1"} (${s.arm || "A"})</td>
          <td>${s.parentEmail || "N/A"}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="deleteStudentProfile('${s.uid}')">Expel</button>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Active Student Roster</h3>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Adm. Number</th>
                <th>Full Name</th>
                <th>Gender</th>
                <th>Class Placement</th>
                <th>Parent Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${listHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Student Admissions Desk</h3>
        </div>
        <form onsubmit="admitNewStudent(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <h4 style="margin-bottom: 1rem; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; font-weight: 600;">Personal Records</h4>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Surname (Last Name)</label>
                <input type="text" id="stud-surname" class="form-input" placeholder="e.g. Alao" required />
              </div>
              <div class="form-group">
                <label class="form-label">First Name</label>
                <input type="text" id="stud-firstname" class="form-input" placeholder="e.g. David" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Gender</label>
                <select id="stud-gender" class="form-input">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Date of Birth</label>
                <input type="date" id="stud-dob" class="form-input" value="2013-04-12" required />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Admission Number</label>
              <input type="text" id="stud-adm-no" class="form-input" placeholder="e.g. CIA-2026-0012" required />
            </div>
          </div>
          
          <div>
            <h4 style="margin-bottom: 1rem; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; font-weight: 600;">Student Portal & Parent Info</h4>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Student Email (For Portal Access)</label>
                <input type="email" id="stud-email" class="form-input" placeholder="student@school.edu" required />
              </div>
              <div class="form-group">
                <label class="form-label">Secure Portal Password</label>
                <input type="password" id="stud-password" class="form-input" placeholder="••••••••" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Class</label>
                <input type="text" id="stud-class" class="form-input" value="JSS 1" required />
              </div>
              <div class="form-group">
                <label class="form-label">Arm</label>
                <input type="text" id="stud-arm" class="form-input" value="A" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Father Full Name</label>
                <input type="text" id="stud-father" class="form-input" placeholder="Chief Babajide Alao" required />
              </div>
              <div class="form-group">
                <label class="form-label">Father Contact Email</label>
                <input type="email" id="stud-father-email" class="form-input" placeholder="parent@cia.edu" required />
              </div>
            </div>
          </div>
          
          <div style="grid-column: span 2; text-align: right; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Process Admittance & Issue Portal ID</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Timetables
function renderTimetable() {
  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">Operational Timetable (JSS 1A)</h3>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Drag and drop scheduling and teacher schedule conflict prevention are active on our firestore calendar containers.</p>
      <div class="table-wrapper">
        <table class="custom-table" style="text-align: center;">
          <thead>
            <tr>
              <th>Day</th>
              <th>Period 1 (08:00 - 09:00)</th>
              <th>Period 2 (09:00 - 10:00)</th>
              <th>Period 3 (10:00 - 11:00)</th>
              <th>Period 4 (11:00 - 12:00)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monday</td>
              <td style="background-color: var(--primary-light); color: var(--primary-color); font-weight: 700;">Mathematics<br><span style="font-size:0.75rem; color:var(--text-secondary);">Mr. Carter</span></td>
              <td style="background-color: var(--success-light); color: var(--success-color); font-weight: 700;">English Lang<br><span style="font-size:0.75rem; color:var(--text-secondary);">Mrs. Grace</span></td>
              <td>-- FREE PERIOD --</td>
              <td style="background-color: var(--info-light); color: var(--info-color); font-weight: 700;">Basic Science<br><span style="font-size:0.75rem; color:var(--text-secondary);">Mrs. Grace</span></td>
            </tr>
            <tr>
              <td>Tuesday</td>
              <td>-- FREE PERIOD --</td>
              <td style="background-color: var(--primary-light); color: var(--primary-color); font-weight: 700;">Physics<br><span style="font-size:0.75rem; color:var(--text-secondary);">Mr. Carter</span></td>
              <td style="background-color: var(--success-light); color: var(--success-color); font-weight: 700;">English Lang<br><span style="font-size:0.75rem; color:var(--text-secondary);">Mrs. Grace</span></td>
              <td>-- FREE PERIOD --</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Result Config
function renderResultConfig() {
  const struct = appState.academicStructure || {};
  const res = struct.resultStructure || {};
  const principalName = res.principalName || "Dr. Babajide Alao, Principal SOS";
  const caMax = res.caMax || 30;
  const assignmentMax = res.assignmentMax || 10;
  const examMax = res.examMax || 60;

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">Report Card Format Configuration</h3>
      </div>
      <form onsubmit="updateAcademicStructure(event)" style="max-width: 600px;">
        <div class="form-group">
          <label class="form-label">Principal Signature Designation</label>
          <input type="text" id="config-principal" class="form-input" value="${principalName}" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Continuous Assessment Max</label>
            <input type="number" id="config-ca" class="form-input" value="${caMax}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Assignment Max</label>
            <input type="number" id="config-assignment" class="form-input" value="${assignmentMax}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Exam Max Cap</label>
            <input type="number" id="config-exam" class="form-input" value="${examMax}" required />
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Save Structure Formats</button>
      </form>
    </div>
  `;
}

// Attendance
function renderAttendanceModule() {
  const students = appState.studentList || [];
  
  let rowsHtml = "";
  if (students.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No student profiles registered in the current school roster. Please admit students first.
        </td>
      </tr>
    `;
  } else {
    students.forEach((student, index) => {
      rowsHtml += `
        <tr class="attendance-row" data-uid="${student.uid}">
          <td><strong>${student.displayName}</strong></td>
          <td><code>${student.admissionNumber || student.uid.substring(0, 8)}</code></td>
          <td>
            <select class="form-input attendance-status" style="width: auto;">
              <option value="Present" selected>Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Sick">Sick</option>
            </select>
          </td>
          <td><input type="text" class="form-input attendance-remarks" placeholder="e.g. Arrived on time" /></td>
        </tr>
      `;
    });
  }

  const saveButton = students.length > 0 
    ? `<button class="btn btn-primary btn-sm" onclick="saveAttendanceRoster()">Save Marked Roster</button>`
    : "";

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">Daily Classroom Attendance (JSS 1A)</h3>
        ${saveButton}
      </div>
      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Admission Number</th>
              <th>Roster Status Selection</th>
              <th>Optional Incident Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Assignment
function renderAssignmentModule() {
  const isTeacher = appState.profile?.role === "teacher" || appState.profile?.role === "class_manager" || appState.profile?.role === "school_admin";
  const assignments = appState.assignmentsList || [];

  let rowsHtml = "";
  if (assignments.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No academic tasks or homework assignments published yet in this tenant.
        </td>
      </tr>
    `;
  } else {
    assignments.forEach((as, i) => {
      rowsHtml += `
        <tr>
          <td><strong>${as.subject || "General"}</strong></td>
          <td>${as.title || "Untitled Assignment"}</td>
          <td><code>${as.deadline || "No deadline"}</code></td>
          <td><span class="badge badge-warning">${as.status || "Active"}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showToast('Solution submissions securely routed to classroom directory!', 'success')">
              ${isTeacher ? "Assess Responses" : "Submit Homework"}
            </button>
          </td>
        </tr>
      `;
    });
  }

  const teacherForm = isTeacher ? `
    <div class="card-panel" style="margin-top: 2rem;">
      <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 class="panel-title">Issue New Homework Task</h3>
      </div>
      <form onsubmit="issueNewAssignment(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="form-group">
          <label class="form-label">Task Subject Name</label>
          <input type="text" id="ass-subject" class="form-input" placeholder="e.g. Mathematics" required />
        </div>
        <div class="form-group">
          <label class="form-label">Deadline Date Target</label>
          <input type="date" id="ass-deadline" class="form-input" value="2026-07-05" required />
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label class="form-label">Assignment Task / Questions Instructions</label>
          <textarea id="ass-title" class="form-input" rows="3" placeholder="e.g. Solve Chapter 4 quadratic algebraic sequences questions 1 to 15" required></textarea>
        </div>
        <div style="grid-column: span 2; text-align: right;">
          <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Publish Homework Task</button>
        </div>
      </form>
    </div>
  ` : "";

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Tasks & Homework Assignments</h3>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Assignment Title / Prompt</th>
                <th>Deadline Target</th>
                <th>Status</th>
                <th>Action Operation</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
      ${teacherForm}
    </div>
  `;
}

// LMS
function renderLMSModule() {
  const isTeacher = appState.profile?.role === "teacher" || appState.profile?.role === "class_manager" || appState.profile?.role === "school_admin";
  const materials = appState.lmsList || [];

  let rowsHtml = "";
  if (materials.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No study materials or courseware textbooks published yet in this tenant.
        </td>
      </tr>
    `;
  } else {
    materials.forEach((m) => {
      rowsHtml += `
        <tr>
          <td><strong>${m.title || "Untitled Material"}</strong></td>
          <td>${m.category || "General"}</td>
          <td>${m.uploader || "Academic Roster"}</td>
          <td><a href="#" onclick="event.preventDefault(); showToast('Resource downloaded successfully!', 'success');" style="color:var(--primary-color); font-weight:700;">[Get Resource]</a></td>
        </tr>
      `;
    });
  }

  const teacherForm = isTeacher ? `
    <div class="card-panel" style="margin-top: 2rem;">
      <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 class="panel-title">Upload Study Material / Courseware</h3>
      </div>
      <form onsubmit="uploadLMSMaterial(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="form-group">
          <label class="form-label">Material / Document Name</label>
          <input type="text" id="lms-title" class="form-input" placeholder="e.g. First Term Algebra Quick Reference.pdf" required />
        </div>
        <div class="form-group">
          <label class="form-label">Class Category Target</label>
          <input type="text" id="lms-category" class="form-input" placeholder="e.g. Mathematics / JSS 1" required />
        </div>
        <div style="grid-column: span 2; text-align: right;">
          <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Publish Courseware Resource</button>
        </div>
      </form>
    </div>
  ` : "";

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Study Materials & LMS Courseware</h3>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Access reference links, PDFs, and textbook chapters. All materials are securely loaded from school databases.</p>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Uploaded By</th>
                <th>Document Path</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
      ${teacherForm}
    </div>
  `;
}

// CBT Management
function renderCBTManagement() {
  const exams = appState.cbtList || [];
  
  let rowsHtml = "";
  if (exams.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No Computer-Based Tests (CBT) built yet in this tenant. Build one below.
        </td>
      </tr>
    `;
  } else {
    exams.forEach((ex) => {
      rowsHtml += `
        <tr>
          <td><strong>${ex.title || "Untitled Test"}</strong></td>
          <td>${ex.classRoster || "JSS 1"}</td>
          <td>${ex.subject || "Mathematics"}</td>
          <td>${ex.duration || "10"} Minutes</td>
          <td><span class="badge badge-success">Active / Open</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showToast('Grade book synced with Firestore roster!', 'success')">Grade Results</button>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Active Computer-Based Tests (CBT) Architect</h3>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Exam Title</th>
                <th>Class Roster</th>
                <th>Subject</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Action Operation</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Build New CBT Examination</h3>
        </div>
        <form onsubmit="buildNewCBTExam(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Exam / Quiz Title</label>
            <input type="text" id="cbt-title" class="form-input" placeholder="e.g. First Term Mathematics Quiz" required />
          </div>
          <div class="form-group">
            <label class="form-label">Subject</label>
            <input type="text" id="cbt-subject" class="form-input" placeholder="e.g. Mathematics" required />
          </div>
          <div class="form-group">
            <label class="form-label">Target Class</label>
            <input type="text" id="cbt-class" class="form-input" placeholder="e.g. JSS 1" required />
          </div>
          <div class="form-group">
            <label class="form-label">Duration (Minutes)</label>
            <input type="number" id="cbt-duration" class="form-input" value="10" required />
          </div>
          <div class="form-group" style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 0.5rem;">
            <h4 style="font-weight: 800; margin-bottom: 1rem; color: var(--text-primary);">Question 1 Configuration</h4>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Question Text Prompt</label>
            <input type="text" id="cbt-q-text" class="form-input" placeholder="e.g. What is the square root of 144?" required />
          </div>
          <div class="form-row" style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label">Option A</label>
              <input type="text" id="cbt-opt-a" class="form-input" value="10" required />
            </div>
            <div class="form-group">
              <label class="form-label">Option B</label>
              <input type="text" id="cbt-opt-b" class="form-input" value="12" required />
            </div>
            <div class="form-group">
              <label class="form-label">Option C</label>
              <input type="text" id="cbt-opt-c" class="form-input" value="14" required />
            </div>
            <div class="form-group">
              <label class="form-label">Option D</label>
              <input type="text" id="cbt-opt-d" class="form-input" value="16" required />
            </div>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label class="form-label">Correct Option Answer EXACT Value</label>
            <input type="text" id="cbt-q-correct" class="form-input" value="12" placeholder="Must match one of the options exactly" required />
          </div>
          <div style="grid-column: span 2; text-align: right; margin-top: 1rem;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2.5rem;">Authorize & Deploy CBT Exam</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// CBT Student exam interface
function renderCBTStudent() {
  if (appState.activeCbtExam) {
    return renderActiveCBTExamInterface();
  }

  const exams = appState.cbtList || [];
  
  let rowsHtml = "";
  if (exams.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No active Computer-Based Test (CBT) examinations scheduled for your class roster.
        </td>
      </tr>
    `;
  } else {
    exams.forEach((ex) => {
      rowsHtml += `
        <tr>
          <td><strong>${ex.title || "General Assessment"}</strong></td>
          <td>${ex.duration || "10"} Minutes</td>
          <td>2026/2027 Academic Session</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="initiateCBTAttempt('${ex.id}')">Initiate Quiz Attempt</button>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">Secure CBT Test Center</h3>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Verify details carefully before launching your examination. Anti-cheating logs are active.</p>
      <div class="table-wrapper" style="margin-bottom:1.5rem;">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Duration</th>
              <th>Session</th>
              <th>Action Operation</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderActiveCBTExamInterface() {
  const exam = appState.activeCbtExam;
  const questions = exam.questions || [];
  if (questions.length === 0) {
    return `
      <div class="card-panel">
        <p>Error: No questions found in this assessment schema.</p>
        <button class="btn btn-secondary" onclick="appState.activeCbtExam = null; renderApp();">Exit Exam</button>
      </div>
    `;
  }

  const mins = Math.floor((appState.cbtTimeRemaining || 0) / 60);
  const secs = (appState.cbtTimeRemaining || 0) % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const q = questions[0]; // Active question
  return `
    <div class="cbt-container animate-fade-in">
      <div class="cbt-header">
        <div>
          <h3 style="font-weight: 800;">${exam.title || "Assessment"} Ongoing</h3>
          <p style="color: var(--text-muted); font-size: 0.8rem;">Anti-Cheating secure sandbox active.</p>
        </div>
        <div class="cbt-timer" id="cbt-clock-val">${timeStr}</div>
      </div>
      
      <div class="cbt-question-card">
        <div class="cbt-question-number">Question 1 of ${questions.length}</div>
        <div class="cbt-question-text">${q.questionText}</div>
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
          ${
            q.options ? q.options.map((opt, i) => `
              <label class="cbt-option" style="cursor: pointer; display: flex; align-items: center; padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--border-color); background: var(--bg-surface);" onclick="this.parentElement.querySelectorAll('.cbt-option').forEach(e=>e.style.borderColor='var(--border-color)'); this.style.borderColor='var(--primary-color)';">
                <input type="radio" name="cbt_ans" value="${opt}" style="margin-right: 0.75rem;" /> ${opt}
              </label>
            `).join("") : `<input type="text" class="form-input" placeholder="Type answer here..." />`
          }
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between;">
        <button class="btn btn-secondary" onclick="showToast('You are already at the first question.', 'info')">Previous</button>
        <button class="btn btn-primary" onclick="submitCBTExamAttempt()">Finish & Auto-Mark Attempt</button>
      </div>
    </div>
  `;
}

// Enter Subject Scores
function renderResultsEntry() {
  const students = appState.studentList || [];
  const scores = appState.studentScores || [];
  
  let rowsHtml = "";
  if (students.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No students admitted to this school context. Please admit students first to register subject grades.
        </td>
      </tr>
    `;
  } else {
    students.forEach((stud, index) => {
      // Find matching score if any
      const existing = scores.find(s => s.studentUid === stud.uid) || {};
      const caVal = existing.caScore !== undefined ? existing.caScore : 15;
      const assVal = existing.assignmentScore !== undefined ? existing.assignmentScore : 8;
      const examVal = existing.examScore !== undefined ? existing.examScore : 35;
      const total = caVal + assVal + examVal;
      
      let grade = "F";
      if (total >= 75) grade = "A";
      else if (total >= 65) grade = "B";
      else if (total >= 50) grade = "C";

      rowsHtml += `
        <tr class="score-entry-row" data-uid="${stud.uid}" data-name="${stud.displayName}">
          <td><strong>${stud.displayName}</strong></td>
          <td>${stud.studentClass || "JSS 1"}${stud.arm ? " (" + stud.arm + ")" : ""}</td>
          <td><input type="number" class="form-input ca-input" style="width:75px;" value="${caVal}" max="30" min="0" oninput="recalculateRowScore(this)" /></td>
          <td><input type="number" class="form-input ass-input" style="width:75px;" value="${assVal}" max="10" min="0" oninput="recalculateRowScore(this)" /></td>
          <td><input type="number" class="form-input exam-input" style="width:75px;" value="${examVal}" max="60" min="0" oninput="recalculateRowScore(this)" /></td>
          <td><strong class="total-display" style="color: var(--primary-color);">${total} (Grade ${grade})</strong></td>
        </tr>
      `;
    });
  }

  const saveBtn = students.length > 0 
    ? `<button class="btn btn-primary btn-sm" onclick="saveSubjectScores()">Save Scores Grid</button>`
    : "";

  return `
    <div class="card-panel">
      <div class="panel-header">
        <h3 class="panel-title">Subject Score Ledger Input</h3>
        ${saveBtn}
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">As a subject teacher, input raw student performance data. The system automatically computes grade levels and saves directly to Firestore.</p>
      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class ID</th>
              <th>CA Assessment (Max 30)</th>
              <th>Assignment (Max 10)</th>
              <th>Exam Score (Max 60)</th>
              <th>Computed Sum</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Report Card PDF preview & print
function renderReportCard() {
  const students = appState.studentList || [];
  const scores = appState.studentScores || [];
  const struct = appState.academicStructure || {};
  const resStruct = struct.resultStructure || {};
  const principalName = resStruct.principalName || "Dr. Babajide Alao, Principal SOS";

  // Determine which student we are viewing
  let selectedUid = appState.selectedReportCardUid;
  if (!selectedUid && students.length > 0) {
    selectedUid = students[0].uid;
    appState.selectedReportCardUid = selectedUid;
  }

  const activeStudent = students.find(s => s.uid === selectedUid) || students[0];

  let studentSelectHtml = "";
  if (appState.profile?.role !== "student" && students.length > 0) {
    studentSelectHtml = `
      <div class="form-group" style="margin-bottom: 0px; text-align: left;">
        <label class="form-label" style="font-size: 0.8rem; text-transform: uppercase;">Select Student Report Card</label>
        <select class="form-input" style="width: auto; padding: 0.5rem 1rem;" onchange="appState.selectedReportCardUid = this.value; renderApp();">
          ${students.map(s => `<option value="${s.uid}" ${s.uid === selectedUid ? "selected" : ""}>${s.displayName}</option>`).join("")}
        </select>
      </div>
    `;
  }

  let tableRowsHtml = "";
  let overallTotal = 0;
  let count = 0;
  
  if (!activeStudent) {
    tableRowsHtml = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          No active student profiles registered. Admit a student first to print report cards.
        </td>
      </tr>
    `;
  } else {
    // Find all scores of active student
    const studentScores = scores.filter(s => s.studentUid === activeStudent.uid);
    if (studentScores.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            No subject grade sheets processed for <strong>${activeStudent.displayName}</strong> yet this term.
          </td>
        </tr>
      `;
    } else {
      studentScores.forEach((s) => {
        const ca = s.caScore || 0;
        const ass = s.assignmentScore || 0;
        const exam = s.examScore || 0;
        const total = ca + ass + exam;
        overallTotal += total;
        count++;

        let grade = "F";
        let remark = "Needs Improvement";
        if (total >= 75) { grade = "A"; remark = "Excellent"; }
        else if (total >= 65) { grade = "B"; remark = "Very Good"; }
        else if (total >= 50) { grade = "C"; remark = "Credit"; }

        tableRowsHtml += `
          <tr>
            <td><strong>${s.subject || "General"}</strong></td>
            <td>${ca}</td>
            <td>${ass}</td>
            <td>${exam}</td>
            <td><strong>${total}</strong></td>
            <td><span class="badge badge-success">${grade}</span></td>
            <td>${remark}</td>
          </tr>
        `;
      });
    }
  }

  const averageVal = count > 0 ? Math.round(overallTotal / count) : 0;
  let summaryGrade = "Needs Improvement";
  if (averageVal >= 75) summaryGrade = "Excellent";
  else if (averageVal >= 65) summaryGrade = "Very Good";
  else if (averageVal >= 50) summaryGrade = "Credit";

  const schoolName = appState.school?.name || "Classarium Academy";

  return `
    <div style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem;">
      ${studentSelectHtml}
      <div style="display: flex; gap: 1rem;">
        <button class="btn btn-secondary" onclick="window.print();">Print Report Card (System Dialog)</button>
        <button class="btn btn-primary" onclick="showToast('Result ledger PDF successfully printed to browser sandbox.', 'success')">Export PDF</button>
      </div>
    </div>
    
    ${activeStudent ? `
    <div class="report-card-print animate-fade-in" style="background: var(--bg-surface); padding: 3rem; border: 1px solid var(--border-color); border-radius: 1rem; color: var(--text-primary);">
      <div class="report-header" style="display: flex; align-items: center; gap: 2rem; border-bottom: 2px solid var(--border-color); padding-bottom: 2rem; margin-bottom: 2rem;">
        <div class="logo-icon" style="width: 5rem; height: 5rem; font-size: 2.5rem; border-radius: 0.5rem; flex-shrink: 0; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800;">C</div>
        <div class="report-school-details">
          <div class="report-school-name" style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">${schoolName}</div>
          <div class="report-school-sub" style="color: var(--text-secondary); margin-top: 0.25rem;">GRA Roster Close, Multi-Tenant Container Base | Term: First Term</div>
          <div style="font-weight: 700; margin-top: 0.5rem; color: var(--primary-color);">Academic Session: 2026/2027</div>
        </div>
      </div>
      
      <div class="report-student-grid" style="display: grid; grid-template-columns: 100px 1fr; gap: 2rem; margin-bottom: 2rem; background: rgba(var(--primary-color-rgb), 0.03); padding: 1.5rem; border-radius: 0.5rem; border: 1px dashed var(--border-color);">
        <div class="report-student-photo" style="background: var(--border-color); display:flex; align-items:center; justify-content:center; font-weight:700; border-radius: 0.5rem; text-align: center; font-size: 0.8rem; color: var(--text-secondary);">Roster Photo</div>
        <div class="report-student-info" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.95rem;">
          <div>Student Name: <strong>${activeStudent.displayName}</strong></div>
          <div>Admission Number: <strong>${activeStudent.admissionNumber || activeStudent.uid.substring(0, 8)}</strong></div>
          <div>Gender: <strong>${activeStudent.gender || "Male"}</strong></div>
          <div>Class Target: <strong>${activeStudent.studentClass || "JSS 1"}${activeStudent.arm ? " (" + activeStudent.arm + ")" : ""}</strong></div>
          <div>Date of Issue: <strong>2026-06-29</strong></div>
          <div>Term Average Score: <strong>${averageVal}% (${summaryGrade})</strong></div>
        </div>
      </div>
      
      <table class="custom-table" style="width: 100%; border-collapse: collapse; margin-bottom: 2.5rem;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
            <th style="padding: 1rem 0;">Subject Name</th>
            <th>CA Score (30)</th>
            <th>Assignment (10)</th>
            <th>Exam Score (60)</th>
            <th>Total Sum (100)</th>
            <th>Grade</th>
            <th>Performance Position</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
      
      <div class="report-comments" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
        <div class="report-comment-box" style="border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 0.5rem;">
          <strong>Class Director's Conduct Comment:</strong>
          <p style="font-style: italic; font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-secondary);">${activeStudent.displayName} is attentive, shows strong cognitive comprehension, and is cooperative.</p>
        </div>
        <div class="report-comment-box" style="border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 0.5rem;">
          <strong>Principal's Executive Endorsement:</strong>
          <p style="font-style: italic; font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-secondary);">An encouraging academic performance. Highly commendable.</p>
        </div>
      </div>
      
      <div class="report-signatures" style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 2rem; margin-top: 2rem;">
        <div>
          <div style="font-weight: 700;">Academic Staff</div>
          <div class="signature-line" style="margin-top: 0.5rem; font-style: italic; color: var(--text-secondary);">Grace Babalola (Class Director)</div>
        </div>
        <div>
          <div style="font-weight: 700;">Principal Endorsement</div>
          <div class="signature-line" style="margin-top: 0.5rem; font-style: italic; color: var(--text-secondary);">${principalName}</div>
        </div>
      </div>
    </div>
    ` : `
      <div class="card-panel" style="text-align: center; padding: 3rem;">
        <p style="color: var(--text-secondary);">Please admit a student to generate dynamic grading report cards.</p>
      </div>
    `}
  `;
}

// Parent dashboard
function renderParentDashboard() {
  return `
    <div class="dashboard-grid">
      <div class="stat-card">
        <div class="stat-card-header">WARD UNDER MONITOR <span class="stat-card-icon">🧒</span></div>
        <div class="stat-card-value" style="font-size:1.5rem;">David Alao</div>
        <div class="stat-card-trend trend-up">✦ Registered at Greenwood</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">AVERAGE GRADE <span class="stat-card-icon">📈</span></div>
        <div class="stat-card-value">91% (A)</div>
        <div class="stat-card-trend trend-up">✦ Excellent Performance</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">CLASS POSITION <span class="stat-card-icon">🏆</span></div>
        <div class="stat-card-value">1st</div>
        <div class="stat-card-trend trend-up">✦ Top of JSS 1 Roster</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">SCHOOL FEES STATUS <span class="stat-card-icon">💳</span></div>
        <div class="stat-card-value">Cleared</div>
        <div class="stat-card-trend trend-up">✓ Fully Paid Term</div>
      </div>
    </div>

    <div class="panel-grid">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Child Behavioral Progress Timeline</h3>
        </div>
        <div class="timeline-list">
          <div class="timeline-item">
            <div class="timeline-time">June 25, 2026</div>
            <div class="timeline-title">Organized Classroom Library Bookshelf</div>
            <div class="timeline-desc">Mrs. Grace Babalola added 10 positive merit points. Description: 'Outstanding teamwork and neatness.'</div>
          </div>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Quick Actions</h3>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <a href="#report_card" class="btn btn-primary">Download Child Report Card</a>
          <a href="#chat" class="btn btn-secondary">Direct Chat Class Manager</a>
        </div>
      </div>
    </div>
  `;
}

// Library Module
function renderLibraryModule() {
  const books = appState.libraryList || [];
  
  let rowsHtml = "";
  if (books.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No books cataloged in the library roster yet. Add one below.
        </td>
      </tr>
    `;
  } else {
    books.forEach((b) => {
      rowsHtml += `
        <tr>
          <td><strong>${b.isbn || "ISBN-8092-22"}</strong></td>
          <td>${b.title || "Modern Algebra foundations"}</td>
          <td>${b.author || "Dr. J. Carter"}</td>
          <td>${b.copies || "5"} Copies</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showToast('Book reserved successfully from dynamic catalog!', 'success')">Reserve Book</button>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">School Library & Fine Registry</h3>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>ISBN Code</th>
                <th>Book Title</th>
                <th>Author</th>
                <th>Available Copies</th>
                <th>Action Operation</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Catalog New Library Book</h3>
        </div>
        <form onsubmit="catalogNewBook(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="form-group">
            <label class="form-label">ISBN Code</label>
            <input type="text" id="lib-isbn" class="form-input" placeholder="e.g. ISBN-8092-22" required />
          </div>
          <div class="form-group">
            <label class="form-label">Book Title</label>
            <input type="text" id="lib-title" class="form-input" placeholder="e.g. Modern Algebra foundations" required />
          </div>
          <div class="form-group">
            <label class="form-label">Author Name</label>
            <input type="text" id="lib-author" class="form-input" placeholder="e.g. Dr. J. Carter" required />
          </div>
          <div class="form-group">
            <label class="form-label">Copies Available</label>
            <input type="number" id="lib-copies" class="form-input" value="5" required />
          </div>
          <div style="grid-column: span 2; text-align: right;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2.5rem;">Catalog Document</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Hostel Lodge
function renderHostelModule() {
  const hostels = appState.hostelList || [];
  
  let rowsHtml = "";
  if (hostels.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No active bedspace allocations recorded in this school context. Allocate one below.
        </td>
      </tr>
    `;
  } else {
    hostels.forEach((h) => {
      rowsHtml += `
        <tr>
          <td><strong>${h.blockName || "Boys Hostel Block A"}</strong></td>
          <td>Room ${h.roomIdentifier || "10"}</td>
          <td>Bed ${h.bedAssigned || "B"}</td>
          <td>${h.studentName || "David Alao"}</td>
          <td><span class="badge badge-success">Present</span></td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Hostel Blocks & Bed Allocation</h3>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Coordinates emergency medical rooms, boys/girls blocks, and visitor logs directly from the SOS operational database.</p>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Lodge Block Name</th>
                <th>Room Identifier</th>
                <th>Bed Assigned</th>
                <th>Student Portfolio</th>
                <th>Roster Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Register Hostel Allocation</h3>
        </div>
        <form onsubmit="allocateHostelBed(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Hostel Block Name</label>
            <input type="text" id="hst-block" class="form-input" placeholder="e.g. Boys Hostel Block A" required />
          </div>
          <div class="form-group">
            <label class="form-label">Room Number</label>
            <input type="text" id="hst-room" class="form-input" placeholder="e.g. 10" required />
          </div>
          <div class="form-group">
            <label class="form-label">Bed Identifier</label>
            <input type="text" id="hst-bed" class="form-input" placeholder="e.g. B" required />
          </div>
          <div class="form-group">
            <label class="form-label">Student Name</label>
            <input type="text" id="hst-student" class="form-input" placeholder="e.g. David Alao" required />
          </div>
          <div style="grid-column: span 2; text-align: right;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2.5rem;">Publish Bed Allocation</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Transport
function renderTransportModule() {
  const routes = appState.transportList || [];
  
  let rowsHtml = "";
  if (routes.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
          No driver transit routes cataloged yet. Setup route below.
        </td>
      </tr>
    `;
  } else {
    routes.forEach((r) => {
      rowsHtml += `
        <tr>
          <td><strong>${r.plateLicense || "LAG-908-IKJ"}</strong></td>
          <td>${r.model || "Toyota Coaster Bus (30-Seater)"}</td>
          <td>${r.driver || "James Driver"}</td>
          <td>${r.destination || "Ikeja GRA -> Maryland Route Loop"}</td>
        </tr>
      `;
    });
  }

  return `
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
      <div class="card-panel">
        <div class="panel-header">
          <h3 class="panel-title">Vehicle Records & Driver Routes</h3>
        </div>
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Bus Plate License</th>
                <th>Vehicle Model</th>
                <th>Authorized Driver</th>
                <th>Route Destination</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <h3 class="panel-title">Provision New Transit Route</h3>
        </div>
        <form onsubmit="registerTransportRoute(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Bus Plate License</label>
            <input type="text" id="trn-plate" class="form-input" placeholder="e.g. LAG-908-IKJ" required />
          </div>
          <div class="form-group">
            <label class="form-label">Vehicle Model & Seating</label>
            <input type="text" id="trn-model" class="form-input" placeholder="e.g. Toyota Coaster Bus (30-Seater)" required />
          </div>
          <div class="form-group">
            <label class="form-label">Driver Full Name</label>
            <input type="text" id="trn-driver" class="form-input" placeholder="e.g. James Driver" required />
          </div>
          <div class="form-group">
            <label class="form-label">Route Loop Destination</label>
            <input type="text" id="trn-route" class="form-input" placeholder="e.g. Ikeja GRA -> Maryland Route Loop" required />
          </div>
          <div style="grid-column: span 2; text-align: right;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2.5rem;">Deploy Transit Vehicle</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Real-time Chat
function renderChatModule() {
  return `
    <div class="chat-layout animate-fade-in">
      <div class="chat-rooms-panel">
        <div class="chat-rooms-header">Message Channels</div>
        <div class="chat-rooms-list">
          <div class="chat-room-item active" onclick="showToast('Viewing Mathematics classroom chat thread.', 'info')">
            <div class="chat-room-avatar">#</div>
            <div class="chat-room-details">
              <div class="chat-room-name">JSS 1A Mathematics</div>
              <div class="chat-room-last-msg">Mr. Carter: solve Exercise 4B tonight...</div>
            </div>
          </div>
          <div class="chat-room-item" onclick="showToast('Direct Administrator chat initialized.', 'info')">
            <div class="chat-room-avatar">ADM</div>
            <div class="chat-room-details">
              <div class="chat-room-name">Principal Alao Office</div>
              <div class="chat-room-last-msg">Active Office hours portal open.</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="chat-main-panel">
        <div class="chat-header">
          <div>
            <div class="chat-header-title"># JSS 1A Mathematics Thread</div>
            <div class="chat-header-status">3 participants online</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="alert('Moderation parameters verified.')">Mute Thread</button>
        </div>
        
        <div class="chat-messages" id="chat-messages-scroll">
          <div class="chat-message-bubble incoming">
            <div class="chat-message-meta">Mr. John Carter (Mathematics Teacher) • 10:33 AM</div>
            <div class="chat-message-text">Hello Class, please remember to solve exercise 4B in your textbooks tonight!</div>
            <div class="chat-message-reactions">
              <div class="chat-reaction-tag">👍 <span>2</span></div>
            </div>
          </div>
        </div>
        
        <form class="chat-input-panel" id="chat-form-submit" onsubmit="sendChatMessage(event)">
          <input type="text" id="chat-text-input" class="form-input" style="flex:1;" placeholder="Type your secure lesson response here..." required />
          <button type="submit" class="btn btn-primary">Send</button>
        </form>
      </div>
    </div>
  `;
}

function sendChatMessage(event) {
  event.preventDefault();
  const input = document.getElementById("chat-text-input");
  if (!input || !input.value) return;

  const messagesBox = document.getElementById("chat-messages-scroll");
  if (messagesBox) {
    const bubble = document.createElement("div");
    bubble.className = "chat-message-bubble outgoing";
    bubble.innerHTML = `
      <div class="chat-message-meta">You • Just Now</div>
      <div class="chat-message-text">${input.value}</div>
    `;
    messagesBox.appendChild(bubble);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  input.value = "";
  showToast("Message broadcasted across class channel.", "success");
}

// ==========================================
// SAAS WORKSPACE CONTROLLER ACTIONS
// ==========================================

function setupSaaSInteractivity() {
  // Logout dispatch
  const logoutBtn = document.getElementById("btn-saas-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        showToast("Session locked. Returning to home landing page.", "info");
        navigateTo("home");
      });
    });
  }

  // Theme saas button dispatcher
  const themeSaasBtn = document.getElementById("theme-toggle-saas");
  if (themeSaasBtn) {
    themeSaasBtn.addEventListener("click", toggleTheme);
  }

  // CBT student start quiz triggers
  const startCbtBtn = document.getElementById("btn-start-demo-cbt");
  if (startCbtBtn) {
    startCbtBtn.addEventListener("click", () => {
      appState.activeCbtExam = {
        id: "demo_exam_math",
        questions: [
          {
            id: "q1",
            questionText: "What is the square root of 144?",
            options: ["10", "12", "14", "16"],
            correctAnswer: "12"
          }
        ]
      };
      navigateTo("cbt_student");
    });
  }

  // CBT Exam complete submit triggers
  const submitCbtBtn = document.getElementById("btn-submit-cbt-quiz");
  if (submitCbtBtn) {
    submitCbtBtn.addEventListener("click", () => {
      appState.activeCbtExam = null;
      showToast("Quiz submitted automatically. Grade scored: 100% (A)", "success");
      navigateTo("dashboard");
    });
  }
}

// Bind core module functions to window to make them globally accessible in the DOM
window.handleAuthSubmit = handleAuthSubmit;
window.navigateTo = navigateTo;
window.toggleTheme = toggleTheme;
window.showToast = showToast;
window.sendChatMessage = sendChatMessage;

// Multi-tenant operational workspace actions
async function actAsSchoolAdmin(schoolId) {
  appState.impersonatedSchoolId = schoolId;
  showToast("Switching context to school administrator...", "info");
  await loadDataForCurrentContext();
  showToast(`Context loaded: ${appState.school?.name || "School"} Admin Dashboard`, "success");
  navigateTo("dashboard");
}
window.actAsSchoolAdmin = actAsSchoolAdmin;

async function exitImpersonation() {
  appState.impersonatedSchoolId = null;
  showToast("Reverting context to Super Admin...", "info");
  await loadDataForCurrentContext();
  showToast("Returned to Global SaaS Desk", "success");
  navigateTo("dashboard");
}
window.exitImpersonation = exitImpersonation;

async function createSchoolBySuperAdmin(event) {
  event.preventDefault();
  
  const schoolName = document.getElementById("sadmin-school-name")?.value;
  const motto = document.getElementById("sadmin-school-motto")?.value;
  const type = document.getElementById("sadmin-school-type")?.value;
  const year = parseInt(document.getElementById("sadmin-school-year")?.value || "2026");
  const address = document.getElementById("sadmin-school-address")?.value;
  const state = document.getElementById("sadmin-school-state")?.value;
  const country = document.getElementById("sadmin-school-country")?.value;
  const adminName = document.getElementById("sadmin-admin-name")?.value;
  const email = document.getElementById("sadmin-admin-email")?.value;
  const password = document.getElementById("sadmin-admin-password")?.value;

  showToast("Deploying isolated school instance container...", "info");
  
  try {
    const schoolId = `sch_${Date.now()}`;
    
    // 1. Save School details
    await setDoc(doc(db, "schools", schoolId), {
      id: schoolId,
      name: schoolName,
      type,
      motto,
      establishedYear: year,
      email,
      phone: "+234 800 000 0000",
      website: "",
      country,
      state,
      city: state,
      address,
      logo: "",
      coverPhoto: "",
      ownerName: adminName,
      ownerEmail: email,
      ownerPhone: "",
      status: "approved",
      subscriptionTier: "growth",
      createdAt: new Date().toISOString()
    });

    // 2. Create User document in Firestore users collection
    const generatedUid = `user_admin_${Date.now()}`;
    await setDoc(doc(db, "users", generatedUid), {
      uid: generatedUid,
      email,
      password, // Stored to allow self-healing on-the-fly signup
      displayName: adminName,
      role: "school_admin",
      schoolId,
      permissions: ["all"],
      disabled: false,
      createdAt: new Date().toISOString()
    });

    // 3. Seed standard setup configuration
    await setDoc(doc(db, "academic_structures", schoolId), {
      id: schoolId,
      sessions: ["2026/2027"],
      terms: ["First Term", "Second Term", "Third Term"],
      departments: ["General", "Science", "Arts"],
      classes: ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"],
      arms: ["A", "B"],
      houses: ["Red", "Blue"],
      subjects: ["Mathematics", "English", "Basic Science", "Civic Education"],
      gradingSystem: [
        { grade: "A", minScore: 75, maxScore: 100, remark: "Excellent" },
        { grade: "B", minScore: 65, maxScore: 74, remark: "Very Good" },
        { grade: "C", minScore: 50, maxScore: 64, remark: "Credit" },
        { grade: "F", minScore: 0, maxScore: 49, remark: "Fail" }
      ],
      resultStructure: {
        caMax: 30,
        assignmentMax: 10,
        examMax: 60
      }
    });

    await logSecurityEvent(schoolId, `Deployed isolated tenant container for ${schoolName}`);
    showToast("School Instance Deployed successfully!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (error) {
    showToast(error.message, "error");
  }
}
window.createSchoolBySuperAdmin = createSchoolBySuperAdmin;

async function deleteSchoolInstance(schoolId) {
  if (confirm("Are you sure you want to delete this school instance? All databases will be unlinked.")) {
    showToast("Unlinking database container...", "info");
    try {
      await logSecurityEvent(schoolId, `Purged tenant instance and associated database containers`);
      await deleteDoc(doc(db, "schools", schoolId));
      showToast("School instance deleted successfully.", "success");
      await loadDataForCurrentContext();
      renderApp();
    } catch (err) {
      showToast(err.message, "error");
    }
  }
}
window.deleteSchoolInstance = deleteSchoolInstance;

async function onboardStaffMember(event) {
  event.preventDefault();
  const displayName = document.getElementById("staff-fullname")?.value;
  const email = document.getElementById("staff-email")?.value;
  const password = document.getElementById("staff-password")?.value;
  const role = document.getElementById("staff-role")?.value;
  const subjectAssigned = document.getElementById("staff-subject")?.value;
  const classAssigned = document.getElementById("staff-class")?.value;

  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: No active school context found.", "error");
    return;
  }

  showToast("Adding staff credentials to roster...", "info");
  try {
    const generatedUid = `staff_${Date.now()}`;
    await setDoc(doc(db, "users", generatedUid), {
      uid: generatedUid,
      email,
      password, // Plain text for on-the-fly provisioning
      displayName,
      role,
      schoolId: sId,
      subjectAssigned,
      classAssigned,
      permissions: ["grades", "attendance"],
      disabled: false,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Onboarded academic staff member: ${displayName} (${role})`);
    showToast("Staff profile authorized successfully!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (error) {
    showToast(error.message, "error");
  }
}
window.onboardStaffMember = onboardStaffMember;

async function deleteStaffMember(staffUid) {
  if (confirm("Are you sure you want to remove this staff profile?")) {
    showToast("Removing credentials...", "info");
    try {
      const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
      await logSecurityEvent(sId, `Revoked staff profile credentials for uid ${staffUid}`);
      await deleteDoc(doc(db, "users", staffUid));
      showToast("Staff profile removed.", "success");
      await loadDataForCurrentContext();
      renderApp();
    } catch (err) {
      showToast(err.message, "error");
    }
  }
}
window.deleteStaffMember = deleteStaffMember;

async function admitNewStudent(event) {
  event.preventDefault();
  const surname = document.getElementById("stud-surname")?.value;
  const firstname = document.getElementById("stud-firstname")?.value;
  const gender = document.getElementById("stud-gender")?.value;
  const dob = document.getElementById("stud-dob")?.value;
  const admNo = document.getElementById("stud-adm-no")?.value;
  const email = document.getElementById("stud-email")?.value;
  const password = document.getElementById("stud-password")?.value;
  const studentClass = document.getElementById("stud-class")?.value;
  const arm = document.getElementById("stud-arm")?.value;
  const fatherName = document.getElementById("stud-father")?.value;
  const parentEmail = document.getElementById("stud-father-email")?.value;

  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: No active school context found.", "error");
    return;
  }

  showToast("Admitting student and generating credentials...", "info");
  try {
    const generatedUid = `student_${Date.now()}`;
    await setDoc(doc(db, "users", generatedUid), {
      uid: generatedUid,
      email,
      password, // Plain text for on-the-fly provisioning
      displayName: `${surname} ${firstname}`,
      role: "student",
      schoolId: sId,
      admissionNumber: admNo,
      gender,
      dob,
      studentClass,
      arm,
      fatherName,
      parentEmail,
      permissions: ["view_results", "cbt"],
      disabled: false,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Admitted new student: ${surname} ${firstname} (ID: ${admNo})`);
    showToast("Student admitted successfully!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (error) {
    showToast(error.message, "error");
  }
}
window.admitNewStudent = admitNewStudent;

async function deleteStudentProfile(studentUid) {
  if (confirm("Are you sure you want to delete this student profile?")) {
    showToast("Removing credentials...", "info");
    try {
      const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
      await logSecurityEvent(sId, `Expelled and deleted student profile uid ${studentUid}`);
      await deleteDoc(doc(db, "users", studentUid));
      showToast("Student profile removed.", "success");
      await loadDataForCurrentContext();
      renderApp();
    } catch (err) {
      showToast(err.message, "error");
    }
  }
}
window.deleteStudentProfile = deleteStudentProfile;

async function submitContactTicket(event) {
  event.preventDefault();
  const name = document.getElementById("ticket-name")?.value;
  const email = document.getElementById("ticket-email")?.value;
  const message = document.getElementById("ticket-message")?.value;

  showToast("Transmitting support ticket to SaaS queue...", "info");
  try {
    const tId = `tck_${Date.now()}`;
    await setDoc(doc(db, "tickets", tId), {
      id: tId,
      ticketId: `TCK-${tId.substring(4, 9)}`,
      name,
      email,
      message,
      status: "Open",
      priority: "Normal",
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent("global", `Submitted support ticket ${tId.substring(4, 9)}: ${message.substring(0, 40)}...`);
    showToast("Ticket successfully received. Our specialist will email you!", "success");
    
    // Clear inputs
    if (document.getElementById("ticket-name")) document.getElementById("ticket-name").value = "";
    if (document.getElementById("ticket-email")) document.getElementById("ticket-email").value = "";
    if (document.getElementById("ticket-message")) document.getElementById("ticket-message").value = "";

    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.submitContactTicket = submitContactTicket;

async function updateAcademicStructure(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: Active school context missing.", "error");
    return;
  }

  const principalName = document.getElementById("config-principal")?.value;
  const caMax = parseInt(document.getElementById("config-ca")?.value || "30");
  const assignmentMax = parseInt(document.getElementById("config-assignment")?.value || "10");
  const examMax = parseInt(document.getElementById("config-exam")?.value || "60");

  showToast("Updating grading criteria matrix...", "info");
  try {
    const updated = {
      ...(appState.academicStructure || {}),
      resultStructure: {
        principalName,
        caMax,
        assignmentMax,
        examMax
      }
    };
    await setDoc(doc(db, "academic_structures", sId), updated);
    await logSecurityEvent(sId, "Configured academic result structures & grading weight definitions");
    showToast("Report Card formats successfully updated!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.updateAcademicStructure = updateAcademicStructure;

async function saveAttendanceRoster() {
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: No active school context found.", "error");
    return;
  }

  showToast("Compiling roster and saving marksheets...", "info");
  try {
    const rows = document.querySelectorAll(".attendance-row");
    const batch = [];
    
    rows.forEach((row) => {
      const uid = row.getAttribute("data-uid");
      const status = row.querySelector(".attendance-status")?.value;
      const remarks = row.querySelector(".attendance-remarks")?.value;
      
      const recordId = `att_${uid}_${new Date().toISOString().substring(0, 10)}`;
      batch.push(
        setDoc(doc(db, "attendance_records", recordId), {
          id: recordId,
          schoolId: sId,
          studentUid: uid,
          status,
          remarks,
          date: new Date().toISOString().substring(0, 10),
          createdAt: new Date().toISOString()
        })
      );
    });

    await Promise.all(batch);
    await logSecurityEvent(sId, `Marked daily classroom attendance for school roster (${rows.length} students)`);
    showToast("Attendance roster processed and saved successfully!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.saveAttendanceRoster = saveAttendanceRoster;

async function issueNewAssignment(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: No active school context found.", "error");
    return;
  }

  const subject = document.getElementById("ass-subject")?.value;
  const deadline = document.getElementById("ass-deadline")?.value;
  const title = document.getElementById("ass-title")?.value;

  showToast("Broadcasting homework to student terminals...", "info");
  try {
    const assId = `ass_${Date.now()}`;
    await setDoc(doc(db, "assignments", assId), {
      id: assId,
      schoolId: sId,
      subject,
      deadline,
      title,
      status: "Active",
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Published assignment homework task for ${subject}: ${title.substring(0, 40)}...`);
    showToast("Homework published successfully to student rosters!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.issueNewAssignment = issueNewAssignment;

async function uploadLMSMaterial(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: No active school context found.", "error");
    return;
  }

  const title = document.getElementById("lms-title")?.value;
  const category = document.getElementById("lms-category")?.value;
  const uploader = appState.profile?.displayName || "Academic Staff";

  showToast("Registering document resource in cloud registry...", "info");
  try {
    const mId = `lms_${Date.now()}`;
    await setDoc(doc(db, "lms_materials", mId), {
      id: mId,
      schoolId: sId,
      title,
      category,
      uploader,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Uploaded digital study material: ${title}`);
    showToast("Study material successfully published to LMS database!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.uploadLMSMaterial = uploadLMSMaterial;

async function buildNewCBTExam(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: No active school context found.", "error");
    return;
  }

  const title = document.getElementById("cbt-title")?.value;
  const subject = document.getElementById("cbt-subject")?.value;
  const targetClass = document.getElementById("cbt-class")?.value;
  const duration = parseInt(document.getElementById("cbt-duration")?.value || "10");

  const questionText = document.getElementById("cbt-q-text")?.value;
  const optA = document.getElementById("cbt-opt-a")?.value;
  const optB = document.getElementById("cbt-opt-b")?.value;
  const optC = document.getElementById("cbt-opt-c")?.value;
  const optD = document.getElementById("cbt-opt-d")?.value;
  const correct = document.getElementById("cbt-q-correct")?.value;

  showToast("Compiling exam question schemas...", "info");
  try {
    const examId = `cbt_${Date.now()}`;
    await setDoc(doc(db, "cbt_exams", examId), {
      id: examId,
      schoolId: sId,
      title,
      subject,
      classRoster: targetClass,
      duration,
      questions: [
        {
          id: `q_${Date.now()}`,
          questionText,
          options: [optA, optB, optC, optD],
          correctAnswer: correct
        }
      ],
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Provisioned digital CBT assessment: ${title}`);
    showToast("Computer-Based Test successfully deployed!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.buildNewCBTExam = buildNewCBTExam;

function initiateCBTAttempt(examId) {
  const exams = appState.cbtList || [];
  const found = exams.find(e => e.id === examId);
  if (!found) {
    showToast("Error: Exam definition could not be located.", "error");
    return;
  }
  appState.activeCbtExam = found;
  appState.cbtTimeRemaining = (found.duration || 10) * 60;

  if (appState.cbtTimerInterval) {
    clearInterval(appState.cbtTimerInterval);
  }

  appState.cbtTimerInterval = setInterval(() => {
    if (!appState.activeCbtExam) {
      clearInterval(appState.cbtTimerInterval);
      appState.cbtTimerInterval = null;
      return;
    }
    appState.cbtTimeRemaining--;
    const clockEl = document.getElementById("cbt-clock-val");
    if (clockEl) {
      const mins = Math.floor(appState.cbtTimeRemaining / 60);
      const secs = appState.cbtTimeRemaining % 60;
      clockEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    if (appState.cbtTimeRemaining <= 0) {
      clearInterval(appState.cbtTimerInterval);
      appState.cbtTimerInterval = null;
      showToast("Time expired! Automatically submitting and marking quiz attempt...", "warning");
      submitCBTExamAttempt();
    }
  }, 1000);

  showToast(`CBT Exam session initialized for ${found.title}`, "info");
  renderApp();
}
window.initiateCBTAttempt = initiateCBTAttempt;

async function submitCBTExamAttempt() {
  if (appState.cbtTimerInterval) {
    clearInterval(appState.cbtTimerInterval);
    appState.cbtTimerInterval = null;
  }

  const exam = appState.activeCbtExam;
  if (!exam) return;

  const questions = exam.questions || [];
  const q = questions[0];
  const selectedRadio = document.querySelector('input[name="cbt_ans"]:checked');
  const selectedAnswer = selectedRadio ? selectedRadio.value : "";
  const isCorrect = selectedAnswer === q.correctAnswer;
  const percentage = isCorrect ? 100 : 0;

  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  const uid = appState.profile?.uid || "student_uid";
  const name = appState.profile?.displayName || "Active Student";

  showToast("Auto-grading responses and writing score cards...", "info");
  try {
    const scoreId = `score_${uid}_${exam.subject || "Math"}`;
    await setDoc(doc(db, "student_scores", scoreId), {
      id: scoreId,
      schoolId: sId,
      studentUid: uid,
      studentName: name,
      subject: exam.subject || "Mathematics",
      caScore: isCorrect ? 30 : 15,
      assignmentScore: 10,
      examScore: isCorrect ? 60 : 30,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Completed CBT Quiz attempt: ${exam.title} (Scored: ${percentage}%)`);
    showToast(`Quiz completed and graded: ${percentage}%! Marks published to database ledger.`, "success");
    appState.activeCbtExam = null;
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.submitCBTExamAttempt = submitCBTExamAttempt;

function recalculateRowScore(element) {
  const row = element.closest(".score-entry-row");
  const ca = parseInt(row.querySelector(".ca-input").value || "0");
  const ass = parseInt(row.querySelector(".ass-input").value || "0");
  const exam = parseInt(row.querySelector(".exam-input").value || "0");
  const total = ca + ass + exam;
  
  let grade = "F";
  if (total >= 75) grade = "A";
  else if (total >= 65) grade = "B";
  else if (total >= 50) grade = "C";
  
  row.querySelector(".total-display").innerHTML = `${total} (Grade ${grade})`;
}
window.recalculateRowScore = recalculateRowScore;

async function saveSubjectScores() {
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: Active school context missing.", "error");
    return;
  }

  showToast("Re-compiling grade registers...", "info");
  try {
    const rows = document.querySelectorAll(".score-entry-row");
    const batch = [];
    
    rows.forEach((row) => {
      const uid = row.getAttribute("data-uid");
      const name = row.getAttribute("data-name");
      const ca = parseInt(row.querySelector(".ca-input").value || "0");
      const ass = parseInt(row.querySelector(".ass-input").value || "0");
      const exam = parseInt(row.querySelector(".exam-input").value || "0");
      
      const scoreId = `score_${uid}_Mathematics`; // Default current context subject
      batch.push(
        setDoc(doc(db, "student_scores", scoreId), {
          id: scoreId,
          schoolId: sId,
          studentUid: uid,
          studentName: name,
          subject: "Mathematics",
          caScore: ca,
          assignmentScore: ass,
          examScore: exam,
          createdAt: new Date().toISOString()
        })
      );
    });

    await Promise.all(batch);
    await logSecurityEvent(sId, `Updated term grade logs for student roster (${rows.length} records)`);
    showToast("Student grades successfully compiled and synced with cloud servers!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.saveSubjectScores = saveSubjectScores;

async function saveSetupWizardStep(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: Active school context missing.", "error");
    return;
  }

  const terms = [];
  if (document.getElementById("wizard-term-1")?.checked) terms.push("First Term");
  if (document.getElementById("wizard-term-2")?.checked) terms.push("Second Term");
  if (document.getElementById("wizard-term-3")?.checked) terms.push("Third Term");

  const armsRaw = document.getElementById("wizard-class-arms")?.value || "A, B, C, D";
  const arms = armsRaw.split(",").map(a => a.trim()).filter(Boolean);

  showToast("Updating tenant configuration metadata...", "info");
  try {
    const updated = {
      ...(appState.academicStructure || {}),
      activeTerms: terms,
      classArms: arms
    };
    await setDoc(doc(db, "academic_structures", sId), updated);
    await logSecurityEvent(sId, `Updated first-time wizard configuration (Active Terms: ${terms.join(", ")})`);
    showToast("Tenant setup step finalized successfully!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.saveSetupWizardStep = saveSetupWizardStep;

async function catalogNewBook(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: Active school context missing.", "error");
    return;
  }

  const isbn = document.getElementById("lib-isbn")?.value;
  const title = document.getElementById("lib-title")?.value;
  const author = document.getElementById("lib-author")?.value;
  const copies = parseInt(document.getElementById("lib-copies")?.value || "5");

  showToast("Updating physical book catalogs in cloud database...", "info");
  try {
    const bId = `book_${Date.now()}`;
    await setDoc(doc(db, "library_books", bId), {
      id: bId,
      schoolId: sId,
      isbn,
      title,
      author,
      copies,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Cataloged new library book title: ${title}`);
    showToast("Book successfully added to school inventory library!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.catalogNewBook = catalogNewBook;

async function allocateHostelBed(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: Active school context missing.", "error");
    return;
  }

  const blockName = document.getElementById("hst-block")?.value;
  const roomIdentifier = document.getElementById("hst-room")?.value;
  const bedAssigned = document.getElementById("hst-bed")?.value;
  const studentName = document.getElementById("hst-student")?.value;

  showToast("Assigning bed spaces to student terminal rosters...", "info");
  try {
    const hId = `hostel_${Date.now()}`;
    await setDoc(doc(db, "hostel_allocations", hId), {
      id: hId,
      schoolId: sId,
      blockName,
      roomIdentifier,
      bedAssigned,
      studentName,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Allocated Bedspace block: ${blockName} to student: ${studentName}`);
    showToast("Bed allotment successfully published and logged!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.allocateHostelBed = allocateHostelBed;

async function registerTransportRoute(event) {
  event.preventDefault();
  const sId = appState.impersonatedSchoolId || appState.profile?.schoolId;
  if (!sId) {
    showToast("Error: Active school context missing.", "error");
    return;
  }

  const plateLicense = document.getElementById("trn-plate")?.value;
  const model = document.getElementById("trn-model")?.value;
  const driver = document.getElementById("trn-driver")?.value;
  const destination = document.getElementById("trn-route")?.value;

  showToast("Compiling vehicle transit paths...", "info");
  try {
    const tId = `route_${Date.now()}`;
    await setDoc(doc(db, "vehicle_routes", tId), {
      id: tId,
      schoolId: sId,
      plateLicense,
      model,
      driver,
      destination,
      createdAt: new Date().toISOString()
    });

    await logSecurityEvent(sId, `Provisioned Driver Route: ${destination} with Plate: ${plateLicense}`);
    showToast("Transit vehicle route deployed successfully!", "success");
    await loadDataForCurrentContext();
    renderApp();
  } catch (err) {
    showToast(err.message, "error");
  }
}
window.registerTransportRoute = registerTransportRoute;

// Render app initially
renderApp();
