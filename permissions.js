// Classarium - Role-Based Permissions
const Permissions = {
    // Navigation items per role
    navItems: {
        super_admin: [
            { section: 'Overview', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'analytics', label: 'Analytics', icon: 'chart' },
            ]},
            { section: 'Management', items: [
                { id: 'schools', label: 'Schools', icon: 'building' },
                { id: 'platform-users', label: 'All Users', icon: 'users' },
                { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
                { id: 'support', label: 'Support Tickets', icon: 'life-buoy' },
            ]},
            { section: 'System', items: [
                { id: 'system-settings', label: 'System Settings', icon: 'settings' },
                { id: 'audit-logs', label: 'Audit Logs', icon: 'file-text' },
                { id: 'feature-toggles', label: 'Feature Toggles', icon: 'toggle' },
            ]},
        ],
        school_admin: [
            { section: 'Overview', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'analytics', label: 'Analytics', icon: 'chart' },
            ]},
            { section: 'People', items: [
                { id: 'students', label: 'Students', icon: 'users' },
                { id: 'staff', label: 'Staff', icon: 'briefcase' },
                { id: 'parents', label: 'Parents', icon: 'user-check' },
            ]},
            { section: 'Academic', items: [
                { id: 'academic-structure', label: 'Academic Structure', icon: 'layers' },
                { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
                { id: 'results', label: 'Results', icon: 'award' },
                { id: 'timetable', label: 'Timetable', icon: 'clock' },
                { id: 'assignments', label: 'Assignments', icon: 'file-plus' },
                { id: 'cbt', label: 'CBT Exams', icon: 'monitor' },
            ]},
            { section: 'Communication', items: [
                { id: 'messages', label: 'Messages', icon: 'message-circle' },
                { id: 'announcements', label: 'Announcements', icon: 'megaphone' },
            ]},
            { section: 'Operations', items: [
                { id: 'behavior', label: 'Behavior', icon: 'heart' },
                { id: 'discipline', label: 'Discipline', icon: 'alert-triangle' },
                { id: 'library', label: 'Library', icon: 'book-open' },
                { id: 'hostel', label: 'Hostel', icon: 'home' },
                { id: 'transport', label: 'Transport', icon: 'truck' },
                { id: 'medical', label: 'Medical', icon: 'activity' },
            ]},
            { section: 'Settings', items: [
                { id: 'school-settings', label: 'School Settings', icon: 'settings' },
                { id: 'documents', label: 'Documents', icon: 'folder' },
            ]},
        ],
        vice_principal: [
            { section: 'Overview', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'analytics', label: 'Analytics', icon: 'chart' },
            ]},
            { section: 'Academic', items: [
                { id: 'students', label: 'Students', icon: 'users' },
                { id: 'staff', label: 'Staff', icon: 'briefcase' },
                { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
                { id: 'results', label: 'Results', icon: 'award' },
                { id: 'timetable', label: 'Timetable', icon: 'clock' },
                { id: 'discipline', label: 'Discipline', icon: 'alert-triangle' },
                { id: 'behavior', label: 'Behavior', icon: 'heart' },
            ]},
            { section: 'Communication', items: [
                { id: 'messages', label: 'Messages', icon: 'message-circle' },
            ]},
        ],
        class_manager: [
            { section: 'Overview', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
            ]},
            { section: 'My Class', items: [
                { id: 'students', label: 'Students', icon: 'users' },
                { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
                { id: 'results', label: 'Results', icon: 'award' },
                { id: 'behavior', label: 'Behavior', icon: 'heart' },
                { id: 'discipline', label: 'Discipline', icon: 'alert-triangle' },
            ]},
            { section: 'Communication', items: [
                { id: 'messages', label: 'Messages', icon: 'message-circle' },
            ]},
        ],
        teacher: [
            { section: 'Overview', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
            ]},
            { section: 'Academic', items: [
                { id: 'attendance', label: 'Attendance', icon: 'calendar-check' },
                { id: 'results', label: 'Results', icon: 'award' },
                { id: 'assignments', label: 'Assignments', icon: 'file-plus' },
                { id: 'cbt', label: 'CBT Exams', icon: 'monitor' },
            ]},
            { section: 'Communication', items: [
                { id: 'messages', label: 'Messages', icon: 'message-circle' },
            ]},
        ],
        student: [
            { section: 'Learning', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'my-results', label: 'My Results', icon: 'award' },
                { id: 'assignments', label: 'Assignments', icon: 'file-plus' },
                { id: 'cbt', label: 'CBT Exams', icon: 'monitor' },
                { id: 'timetable', label: 'Timetable', icon: 'clock' },
                { id: 'attendance', label: 'My Attendance', icon: 'calendar-check' },
            ]},
            { section: 'Communication', items: [
                { id: 'messages', label: 'Messages', icon: 'message-circle' },
            ]},
        ],
        parent: [
            { section: 'Overview', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
            ]},
            { section: 'My Children', items: [
                { id: 'child-results', label: 'Results', icon: 'award' },
                { id: 'child-attendance', label: 'Attendance', icon: 'calendar-check' },
                { id: 'child-behavior', label: 'Behavior', icon: 'heart' },
                { id: 'child-discipline', label: 'Discipline', icon: 'alert-triangle' },
                { id: 'child-assignments', label: 'Assignments', icon: 'file-plus' },
            ]},
            { section: 'Communication', items: [
                { id: 'messages', label: 'Messages', icon: 'message-circle' },
            ]},
        ],
        librarian: [
            { section: 'Library', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'library', label: 'Library', icon: 'book-open' },
                { id: 'library-catalog', label: 'Catalog', icon: 'book' },
                { id: 'library-transactions', label: 'Transactions', icon: 'repeat' },
            ]},
        ],
        hostel_manager: [
            { section: 'Hostel', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'hostel', label: 'Hostel', icon: 'home' },
                { id: 'hostel-attendance', label: 'Attendance', icon: 'calendar-check' },
                { id: 'hostel-visitors', label: 'Visitors', icon: 'user' },
            ]},
        ],
        transport_officer: [
            { section: 'Transport', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'transport', label: 'Transport', icon: 'truck' },
                { id: 'transport-routes', label: 'Routes', icon: 'map' },
            ]},
        ],
    },

    // SVG icons for nav items
    icons: {
        grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18Z"/><path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2"/><path d="M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>',
        users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
        briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>',
        userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>',
        layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        'calendar-check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg>',
        award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        'file-plus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
        monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
        'message-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
        megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
        heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
        'alert-triangle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        'book-open': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
        book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
        home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
        activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
        settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
        'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
        toggle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/></svg>',
        folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
        'life-buoy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="14.83" y1="9.17" x2="18.36" y2="5.64"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>',
        map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
        user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
    },

    // Get nav items for a role
    getNavItems(role) {
        return this.navItems[role] || [];
    },

    // Check if a role has access to a module
    hasAccess(role, moduleId) {
        const items = this.navItems[role] || [];
        return items.some(section => section.items.some(item => item.id === moduleId));
    },

    // Get icon SVG for a nav item
    getIcon(iconName) {
        return this.icons[iconName] || this.icons.grid;
    }
};

window.Permissions = Permissions;