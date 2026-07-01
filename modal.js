// Classarium - Modal System
const Modal = {
    container: null,

    init() {
        this.container = document.getElementById('modal-container');
    },

    open({ title = '', content = '', size = 'md', footer = '', onClose = null, closeOnOverlay = true } = {}) {
        if (!this.container) this.init();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-${size}" onclick="event.stopPropagation()">
                ${title ? `
                <div class="modal-header">
                    <h3 class="modal-title" style="font-size:var(--text-lg);font-weight:var(--weight-semibold);color:var(--text-primary);">${title}</h3>
                    <button class="modal-close" onclick="Modal.close(this.closest('.modal-overlay'))">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>` : ''}
                <div class="modal-body">${content}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        if (closeOnOverlay) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) Modal.close(modal);
            });
        }

        modal._onClose = onClose;
        this.container.appendChild(modal);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('active'));

        return modal;
    },

    close(modal) {
        if (!modal) modal = this.container.querySelector('.modal-overlay');
        if (!modal) return;
        modal.classList.remove('active');
        if (modal._onClose) modal._onClose();
        setTimeout(() => {
            modal.remove();
            if (!this.container.querySelector('.modal-overlay')) {
                document.body.style.overflow = '';
            }
        }, 200);
    },

    confirm({ title = 'Confirm', message = '', confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger', onConfirm }) {
        return this.open({
            title,
            size: 'sm',
            content: `<p style="color:var(--text-secondary);font-size:var(--text-sm);line-height:var(--leading-relaxed);">${message}</p>`,
            footer: `
                <button class="btn btn-ghost" onclick="Modal.close()">${cancelText}</button>
                <button class="btn btn-${type === 'danger' ? 'danger' : 'primary'}" id="modal-confirm-btn">${confirmText}</button>
            `,
            onClose: () => {}
        }).then(() => {
            document.getElementById('modal-confirm-btn').addEventListener('click', () => {
                Modal.close();
                if (onConfirm) onConfirm();
            });
        });
    },

    alert({ title = 'Alert', message = '', type = 'info' }) {
        return this.open({
            title,
            size: 'sm',
            content: `<p style="color:var(--text-secondary);font-size:var(--text-sm);">${message}</p>`,
            footer: `<button class="btn btn-primary" onclick="Modal.close()">OK</button>`
        });
    }
};

window.Modal = Modal;