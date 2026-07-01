// Classarium - Header Component
const HeaderComponent = {
    init() {
        // Theme toggle
        document.getElementById('theme-toggle-btn').addEventListener('click', () => this.toggleTheme());

        // Profile dropdown
        const profileBtn = document.getElementById('header-profile');
        const profileDropdown = document.getElementById('profile-dropdown');
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = profileBtn.getBoundingClientRect();
            profileDropdown.style.top = (rect.bottom + 8) + 'px';
            profileDropdown.style.right = (window.innerWidth - rect.right) + 'px';
            profileDropdown.style.display = profileDropdown.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            profileDropdown.style.display = 'none';
            document.getElementById('notification-panel').style.display = 'none';
        });

        // Profile dropdown actions
        profileDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const action = item.dataset.action;
                profileDropdown.style.display = 'none';
                if (action === 'logout') App.logout();
                if (action === 'profile') Router.navigate('profile');
                if (action === 'settings') Router.navigate('school-settings');
            });
        });

        // Notification panel
        const notifBtn = document.getElementById('notification-btn');
        const notifPanel = document.getElementById('notification-panel');
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = notifBtn.getBoundingClientRect();
            notifPanel.style.top = (rect.bottom + 8) + 'px';
            notifPanel.style.right = (window.innerWidth - rect.right) + 'px';
            notifPanel.style.display = notifPanel.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('mark-all-read')?.addEventListener('click', () => {
            document.getElementById('notification-dot').style.display = 'none';
            Toast.success('All notifications marked as read');
        });

        // Load saved theme
        const savedTheme = localStorage.getItem('classarium-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('classarium-theme', next);
        this.updateThemeIcon(next);
    },

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-icon');
        if (theme === 'dark') {
            icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        } else {
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
        }
    },

    updateUserInfo(user, profile) {
        const initials = Utils.getInitials(profile?.displayName || user.email);
        document.getElementById('header-avatar').textContent = initials;
        document.getElementById('header-profile-name').textContent = profile?.displayName || 'User';
        document.getElementById('header-profile-role').textContent = Utils.getRoleName(profile?.role || 'student');
        document.getElementById('dropdown-name').textContent = profile?.displayName || 'User';
        document.getElementById('dropdown-email').textContent = user.email;
    },

    setBreadcrumb(text) {
        // Accept both string and array of {label} objects
        if (Array.isArray(text)) {
            const labels = text.map(i => i.label).join(' / ');
            document.getElementById('breadcrumb-current').textContent = labels;
        } else {
            document.getElementById('breadcrumb-current').textContent = text;
        }
    }
};

window.HeaderComponent = HeaderComponent;