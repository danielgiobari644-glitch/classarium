// Classarium - Sidebar Component
const SidebarComponent = {
    el: null,
    nav: null,
    collapsed: false,

    init() {
        this.el = document.getElementById('sidebar');
        this.nav = document.getElementById('sidebar-nav');

        document.getElementById('sidebar-collapse-btn').addEventListener('click', () => this.toggle());
        document.getElementById('mobile-menu-btn')?.addEventListener('click', () => this.toggleMobile());
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => this.closeMobile());
    },

    render(role) {
        const sections = Permissions.getNavItems(role);
        let html = '';
        sections.forEach(section => {
            html += `<div class="sidebar-section">
                <div class="sidebar-section-title">${section.section}</div>`;
            section.items.forEach(item => {
                html += `<a class="sidebar-item" data-page="${item.id}" href="#/${item.id}">
                    <span class="sidebar-item-icon">${Permissions.getIcon(item.icon)}</span>
                    <span class="sidebar-item-label">${item.label}</span>
                </a>`;
            });
            html += '</div>';
        });
        this.nav.innerHTML = html;

        // Bind click events
        this.nav.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                Router.navigate(page);
                this.setActive(page);
                this.closeMobile();
            });
        });
    },

    setActive(pageId) {
        this.nav.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageId);
        });
    },

    toggle() {
        this.collapsed = !this.collapsed;
        this.el.classList.toggle('collapsed', this.collapsed);
        document.getElementById('main-content').classList.toggle('sidebar-collapsed', this.collapsed);
    },

    toggleMobile() {
        this.el.classList.toggle('mobile-open');
        document.getElementById('sidebar-overlay')?.classList.toggle('visible');
    },

    closeMobile() {
        this.el.classList.remove('mobile-open');
        document.getElementById('sidebar-overlay')?.classList.remove('visible');
    }
};

window.SidebarComponent = SidebarComponent;