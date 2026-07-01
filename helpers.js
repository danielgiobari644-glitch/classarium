// Classarium - Utility Functions
const Utils = {
    // Generate unique ID
    uid() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // Generate school ID
    generateSchoolId(name) {
        const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
        return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
    },

    // Generate admission number
    generateAdmissionNumber(schoolId, classArm, count) {
        const year = new Date().getFullYear().toString().slice(-2);
        return `${schoolId.substring(0,3)}/${year}/${String(count + 1).padStart(4, '0')}`;
    },

    // Format date
    formatDate(timestamp) {
        if (!timestamp) return '-';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    // Format time
    formatTime(timestamp) {
        if (!timestamp) return '-';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },

    // Format date-time
    formatDateTime(timestamp) {
        if (!timestamp) return '-';
        return `${this.formatDate(timestamp)} at ${this.formatTime(timestamp)}`;
    },

    // Relative time
    timeAgo(timestamp) {
        if (!timestamp) return '';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return this.formatDate(timestamp);
    },

    // Get initials from name
    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
    },

    // Capitalize first letter
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Format number with commas
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString();
    },

    // Calculate percentage
    percentage(value, total) {
        if (!total) return 0;
        return Math.round((value / total) * 100);
    },

    // Get grade from score
    getGrade(score) {
        if (score >= 70) return { grade: 'A', remark: 'Excellent', class: 'grade-a' };
        if (score >= 60) return { grade: 'B', remark: 'Very Good', class: 'grade-b' };
        if (score >= 50) return { grade: 'C', remark: 'Good', class: 'grade-c' };
        if (score >= 45) return { grade: 'D', remark: 'Fair', class: 'grade-d' };
        return { grade: 'F', remark: 'Poor', class: 'grade-f' };
    },

    // Debounce function
    debounce(fn, delay = 300) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    // Throttle function
    throttle(fn, delay = 100) {
        let last = 0;
        return function(...args) {
            const now = Date.now();
            if (now - last >= delay) {
                last = now;
                fn.apply(this, args);
            }
        };
    },

    // Deep clone
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Escape HTML
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Get role display name
    getRoleName(role) {
        const names = {
            'super_admin': 'Platform Super Admin',
            'school_admin': 'School Admin',
            'vice_principal': 'Vice Principal',
            'class_manager': 'Class Manager',
            'teacher': 'Teacher',
            'student': 'Student',
            'parent': 'Parent',
            'librarian': 'Librarian',
            'hostel_manager': 'Hostel Manager',
            'transport_officer': 'Transport Officer'
        };
        return names[role] || role;
    },

    // Show loading skeleton
    showSkeleton(container, count = 5) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `<div class="skeleton-text" style="width:${60 + Math.random() * 40}%;margin-bottom:12px;"></div>`;
        }
        container.innerHTML = html;
    },

    // CSV export
    exportCSV(data, filename) {
        if (!data || !data.length) return;
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // Print element
    printElement(elementId) {
        const content = document.getElementById(elementId);
        if (!content) return;
        const win = window.open('', '_blank');
        win.document.write(`
            <html><head><title>Print</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'Inter',sans-serif; padding:20px; }
                table { width:100%; border-collapse:collapse; }
                th,td { padding:8px 12px; border:1px solid #e2e8f0; text-align:left; font-size:13px; }
                th { background:#f8fafc; font-weight:600; }
                @media print { body { padding:0; } }
            </style></head><body>${content.innerHTML}</body></html>
        `);
        win.document.close();
        win.print();
    }
};

// Make available globally
window.Utils = Utils;