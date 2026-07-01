// ============================================
// CLASSARIUM - Main Application
// ============================================

// Global App State
window.App = {
    state: {
        user: null,
        profile: null,
        school: null,
        currentRoute: 'dashboard',
        initialized: false
    },

    async init() {
        try {
            // Initialize components
            HeaderComponent.init();
            SidebarComponent.init();
            Toast.init();
            CommandPalette.init();

            // Listen for auth state
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        // Get user profile
                        const profileDoc = await db.collection('users').doc(user.uid).get();
                        const profile = profileDoc.exists ? profileDoc.data() : null;

                        if (!profile) {
                            console.error('No user profile found');
                            this.showAuth('login');
                            return;
                        }

                        // Check email verification
                        if (!user.emailVerified && profile.role !== 'super_admin') {
                            this.showAuth('verify');
                            document.getElementById('verify-email-display').textContent = user.email;
                            return;
                        }

                        this.state.user = user;
                        this.state.profile = profile;

                        // Load school data for non-super-admin
                        if (profile.schoolId && profile.role !== 'super_admin') {
                            try {
                                const schoolDoc = await db.collection('schools').doc(profile.schoolId).get();
                                this.state.school = schoolDoc.exists ? schoolDoc.data() : null;
                            } catch (e) {
                                console.warn('Could not load school:', e);
                            }

                            // Check if school is suspended
                            if (this.state.school && this.state.school.status === 'suspended') {
                                Toast.error('Your school account has been suspended. Please contact support.');
                                await auth.signOut();
                                this.showAuth('login');
                                return;
                            }

                            // Check if setup is complete
                            if (this.state.school && !this.state.school.setupComplete && profile.role === 'school_admin') {
                                this.showApp();
                                Router.navigate('setup-wizard');
                                return;
                            }
                        }

                        // Super admin check
                        if (profile.role === 'super_admin') {
                            this.state.school = { schoolId: 'system', name: 'Classarium Platform' };
                        }

                        this.showApp();
                        this.initRouter();

                        // Setup initial view
                        const hash = window.location.hash.replace('#/', '');
                        if (hash) {
                            Router.navigate(hash);
                        } else {
                            Router.navigate('dashboard');
                        }

                    } catch (err) {
                        console.error('Error loading user:', err);
                        this.showAuth('login');
                    }
                } else {
                    this.state.user = null;
                    this.state.profile = null;
                    this.state.school = null;
                    this.showAuth('login');
                }
            });

        } catch (err) {
            console.error('App init error:', err);
            Toast.error('Failed to initialize application');
        }
    },

    showAuth(page) {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';

        // Hide all auth pages
        document.querySelectorAll('.auth-page').forEach(p => p.style.display = 'none');

        // Show requested page
        const pageMap = {
            'login': 'auth-login',
            'register': 'auth-register',
            'forgot': 'auth-forgot',
            'verify': 'auth-verify'
        };

        const targetId = pageMap[page] || 'auth-login';
        const target = document.getElementById(targetId);
        if (target) target.style.display = page === 'register' ? 'block' : 'flex';

        this.bindAuthEvents();
    },

    showApp() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';

        // Setup UI
        const role = this.state.profile?.role;
        const schoolName = this.state.school?.name || 'Classarium';

        document.getElementById('sidebar-school-name').textContent = schoolName;
        SidebarComponent.render(role);
        HeaderComponent.updateUserInfo(this.state.user, this.state.profile);
    },

    bindAuthEvents() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm && !loginForm._bound) {
            loginForm._bound = true;
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                const errorEl = document.getElementById('login-error');
                const btn = document.getElementById('login-btn');

                btn.querySelector('.btn-text').style.display = 'none';
                btn.querySelector('.btn-loading').style.display = 'inline-flex';
                errorEl.style.display = 'none';

                try {
                    await AuthService.login(email, password);
                } catch (err) {
                    errorEl.style.display = 'block';
                    let msg = 'Login failed. Please check your credentials.';
                    if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
                    if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
                    if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
                    if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Please try again later.';
                    if (err.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
                    errorEl.textContent = msg;
                } finally {
                    btn.querySelector('.btn-text').style.display = 'inline';
                    btn.querySelector('.btn-loading').style.display = 'none';
                }
            });
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm && !registerForm._bound) {
            registerForm._bound = true;
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('reg-password').value;
                const confirmPassword = document.getElementById('reg-confirm-password').value;
                const errorEl = document.getElementById('register-error');
                const btn = document.getElementById('register-btn');

                if (password !== confirmPassword) {
                    errorEl.style.display = 'block';
                    errorEl.textContent = 'Passwords do not match.';
                    return;
                }

                if (password.length < 8) {
                    errorEl.style.display = 'block';
                    errorEl.textContent = 'Password must be at least 8 characters.';
                    return;
                }

                btn.querySelector('.btn-text').style.display = 'none';
                btn.querySelector('.btn-loading').style.display = 'inline-flex';
                errorEl.style.display = 'none';

                try {
                    const result = await AuthService.registerSchool({
                        schoolName: document.getElementById('reg-school-name').value.trim(),
                        schoolMotto: document.getElementById('reg-school-motto').value.trim(),
                        schoolType: document.getElementById('reg-school-type').value,
                        establishedYear: document.getElementById('reg-year').value,
                        country: document.getElementById('reg-country').value.trim(),
                        state: document.getElementById('reg-state').value.trim(),
                        city: document.getElementById('reg-city').value.trim(),
                        address: document.getElementById('reg-address').value.trim(),
                        schoolEmail: document.getElementById('reg-school-email').value.trim(),
                        phone: document.getElementById('reg-phone').value.trim(),
                        website: document.getElementById('reg-website').value.trim(),
                        ownerName: document.getElementById('reg-owner-name').value.trim(),
                        ownerEmail: document.getElementById('reg-owner-email').value.trim(),
                        password: password
                    });

                    // Show verification page
                    this.showAuth('verify');
                    document.getElementById('verify-email-display').textContent = result.user.email;
                    Toast.success('Account created! Please check your email to verify.');

                } catch (err) {
                    errorEl.style.display = 'block';
                    let msg = 'Registration failed. Please try again.';
                    if (err.code === 'auth/email-already-in-use') msg = 'An account with this email already exists.';
                    if (err.code === 'auth/weak-password') msg = 'Password is too weak. Use at least 8 characters.';
                    if (err.code === 'auth/invalid-email') msg = 'Invalid email address.';
                    errorEl.textContent = msg;
                    console.error('Registration error:', err);
                } finally {
                    btn.querySelector('.btn-text').style.display = 'inline';
                    btn.querySelector('.btn-loading').style.display = 'none';
                }
            });
        }

        // Forgot password form
        const forgotForm = document.getElementById('forgot-form');
        if (forgotForm && !forgotForm._bound) {
            forgotForm._bound = true;
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('forgot-email').value.trim();
                const errorEl = document.getElementById('forgot-error');
                const successEl = document.getElementById('forgot-success');

                try {
                    await AuthService.resetPassword(email);
                    successEl.style.display = 'block';
                    errorEl.style.display = 'none';
                } catch (err) {
                    successEl.style.display = 'none';
                    errorEl.style.display = 'block';
                    errorEl.textContent = 'Could not send reset email. Please check the address.';
                }
            });
        }

        // Navigation links
        const goToRegister = document.getElementById('go-to-register');
        if (goToRegister && !goToRegister._bound) {
            goToRegister._bound = true;
            goToRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuth('register');
            });
        }

        const goToLogin = document.getElementById('go-to-login');
        if (goToLogin && !goToLogin._bound) {
            goToLogin._bound = true;
            goToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuth('login');
            });
        }

        const forgotLink = document.getElementById('forgot-password-link');
        if (forgotLink && !forgotLink._bound) {
            forgotLink._bound = true;
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuth('forgot');
            });
        }

        const backToLogin = document.getElementById('back-to-login');
        if (backToLogin && !backToLogin._bound) {
            backToLogin._bound = true;
            backToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuth('login');
            });
        }

        const verifyToLogin = document.getElementById('verify-to-login');
        if (verifyToLogin && !verifyToLogin._bound) {
            verifyToLogin._bound = true;
            verifyToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAuth('login');
            });
        }

        // Resend verification
        const resendVerify = document.getElementById('resend-verify');
        if (resendVerify && !resendVerify._bound) {
            resendVerify._bound = true;
            resendVerify.addEventListener('click', async () => {
                if (auth.currentUser) {
                    try {
                        await auth.currentUser.sendEmailVerification();
                        Toast.success('Verification email sent!');
                    } catch (e) {
                        Toast.error('Could not send verification email.');
                    }
                }
            });
        }
    },

    initRouter() {
        if (this.state.initialized) return;
        this.state.initialized = true;

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#/', '').replace('#', '');
            if (hash && hash !== this.state.currentRoute) {
                Router.navigate(hash);
            }
        });
    },

    async logout() {
        try {
            if (this.state.profile) {
                await DataService.logAction(
                    this.state.profile.schoolId || 'system',
                    this.state.profile.uid,
                    'LOGOUT',
                    'User logged out'
                );
            }
            await auth.signOut();
            this.state = { user: null, profile: null, school: null, currentRoute: 'dashboard', initialized: false };
            window.location.hash = '';
            Toast.info('Signed out successfully');
        } catch (e) {
            console.error('Logout error:', e);
        }
    }
};

// ============================================
// ROUTER
// ============================================

window.Router = {
    currentPage: null,

    navigate(pageId) {
        // Destroy current page
        if (this.currentPage && window.Modules[this.currentPage] && window.Modules[this.currentPage].destroy) {
            window.Modules[this.currentPage].destroy();
        }

        this.currentPage = pageId;
        App.state.currentRoute = pageId;
        window.location.hash = pageId;

        // Update sidebar active state
        SidebarComponent.setActive(pageId);

        // Find and render module
        const moduleMap = {
            'dashboard': 'dashboard',
            'analytics': 'analytics',
            'schools': 'schools',
            'platform-users': 'dashboard',
            'announcements': 'dashboard',
            'support': 'dashboard',
            'system-settings': 'settings',
            'audit-logs': 'settings',
            'feature-toggles': 'settings',
            'students': 'students',
            'student-profile': 'students',
            'staff': 'staff',
            'staff-profile': 'staff',
            'parents': 'students',
            'academic-structure': 'academic',
            'attendance': 'attendance',
            'results': 'results',
            'timetable': 'timetable',
            'assignments': 'assignments',
            'cbt': 'cbt',
            'messages': 'communication',
            'behavior': 'behavior',
            'discipline': 'discipline',
            'library': 'library',
            'library-catalog': 'library',
            'library-transactions': 'library',
            'hostel': 'hostel',
            'hostel-attendance': 'hostel',
            'hostel-visitors': 'hostel',
            'transport': 'transport',
            'transport-routes': 'transport',
            'medical': 'medical',
            'school-settings': 'settings',
            'documents': 'settings',
            'setup-wizard': 'setup-wizard',
            'my-results': 'results',
            'child-results': 'results',
            'child-attendance': 'attendance',
            'child-behavior': 'behavior',
            'child-discipline': 'discipline',
            'child-assignments': 'assignments',
            'profile': 'settings',
        };

        const moduleName = moduleMap[pageId];
        const module = window.Modules[moduleName];

        const content = document.getElementById('page-content');

        if (module && module.render) {
            // Set breadcrumb
            const navItems = Permissions.getNavItems(App.state.profile?.role).flatMap(s => s.items);
            const navItem = navItems.find(i => i.id === pageId);
            if (navItem) {
                HeaderComponent.setBreadcrumb(navItem.label);
            } else {
                const pageNames = {
                    'student-profile': 'Student Profile',
                    'staff-profile': 'Staff Profile',
                    'setup-wizard': 'Setup Wizard',
                    'my-results': 'My Results',
                    'child-results': 'Child Results',
                    'child-attendance': 'Child Attendance',
                    'child-behavior': 'Child Behavior',
                    'child-discipline': 'Child Discipline',
                    'child-assignments': 'Child Assignments',
                    'profile': 'My Profile'
                };
                HeaderComponent.setBreadcrumb(pageNames[pageId] || pageId);
            }

            // Show loading
            content.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:400px;"><span class="spinner spinner-lg"></span></div>';

            // Render page (with slight delay for loading animation)
            requestAnimationFrame(() => {
                try {
                    module.render(pageId);
                } catch (err) {
                    console.error(`Error rendering ${moduleName}:`, err);
                    content.innerHTML = `
                        <div class="empty-state" style="padding:var(--space-16) var(--space-6);text-align:center;">
                            <div class="empty-state-icon" style="color:var(--color-danger);">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            </div>
                            <h3 style="margin:var(--space-4) 0 var(--space-2);color:var(--text-primary);">Something went wrong</h3>
                            <p style="color:var(--text-secondary);margin-bottom:var(--space-4);">Error loading this page. Please try again.</p>
                            <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Go to Dashboard</button>
                        </div>`;
                }
            });

            // Scroll to top
            content.scrollTop = 0;
        } else {
            content.innerHTML = `
                <div class="empty-state" style="padding:var(--space-16) var(--space-6);text-align:center;">
                    <div class="empty-state-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <h3 style="margin:var(--space-4) 0 var(--space-2);color:var(--text-primary);">Page Not Found</h3>
                    <p style="color:var(--text-secondary);margin-bottom:var(--space-4);">The page "${Utils.escapeHtml(pageId)}" doesn't exist.</p>
                    <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Go to Dashboard</button>
                </div>`;
        }
    }
};

// ============================================
// INITIALIZE
// ============================================

// Initialize Modules namespace
window.Modules = window.Modules || {};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K - Command Palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        CommandPalette.toggle();
    }
    // Escape - Close modals/command palette
    if (e.key === 'Escape') {
        if (CommandPalette.isOpen) CommandPalette.close();
        const modal = document.querySelector('.modal-overlay');
        if (modal) Modal.close(modal);
        document.getElementById('profile-dropdown').style.display = 'none';
        document.getElementById('notification-panel').style.display = 'none';
    }
});