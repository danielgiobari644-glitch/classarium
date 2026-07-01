// Classarium - Toast Notification System
const Toast = {
    container: null,
    maxToasts: 5,

    init() {
        this.container = document.getElementById('toast-container');
    },

    show(message, type = 'info', duration = 4000, actions = null) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        let actionsHtml = '';
        if (actions) {
            actionsHtml = actions.map(a => `<button class="btn btn-ghost btn-sm toast-action" style="color:var(--color-primary);font-size:var(--text-xs);">${a.label}</button>`).join('');
        }

        toast.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:var(--space-3);flex:1;">
                <span style="flex-shrink:0;margin-top:1px;">${icons[type] || icons.info}</span>
                <div style="flex:1;">
                    <div style="font-size:var(--text-sm);font-weight:var(--weight-medium);color:var(--text-primary);">${Utils.escapeHtml(message)}</div>
                    ${actionsHtml}
                </div>
                <button class="toast-close" onclick="Toast.dismiss(this.closest('.toast'))" style="flex-shrink:0;color:var(--text-tertiary);cursor:pointer;background:none;border:none;padding:2px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        // Bind action buttons
        if (actions) {
            const btns = toast.querySelectorAll('.toast-action');
            btns.forEach((btn, i) => {
                btn.addEventListener('click', () => {
                    if (actions[i].onClick) actions[i].onClick();
                    Toast.dismiss(toast);
                });
            });
        }

        this.container.appendChild(toast);

        // Limit toasts
        const toasts = this.container.querySelectorAll('.toast');
        if (toasts.length > this.maxToasts) {
            this.dismiss(toasts[0]);
        }

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        return toast;
    },

    success(message, duration) { return this.show(message, 'success', duration); },
    error(message, duration) { return this.show(message, 'error', duration || 6000); },
    warning(message, duration) { return this.show(message, 'warning', duration); },
    info(message, duration) { return this.show(message, 'info', duration); },

    dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        toast.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => toast.remove(), 200);
    }
};

window.Toast = Toast;