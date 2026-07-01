// Classarium - Command Palette
const CommandPalette = {
    el: null,
    input: null,
    results: null,
    isOpen: false,

    init() {
        this.el = document.getElementById('command-palette');
        this.input = document.getElementById('command-palette-input');
        this.results = document.getElementById('command-palette-results');
        this.overlay = document.getElementById('command-palette-overlay');

        document.getElementById('command-palette-overlay').addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        this.input.addEventListener('input', Utils.debounce(() => this.search(), 150));

        document.getElementById('global-search').addEventListener('focus', () => this.open());
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
    },

    open() {
        if (!App.state.user) return;
        this.el.style.display = 'block';
        this.isOpen = true;
        this.input.value = '';
        this.input.focus();
        this.showDefault();
    },

    close() {
        this.el.style.display = 'none';
        this.isOpen = false;
    },

    showDefault() {
        const role = App.state.user?.role;
        const items = Permissions.getNavItems(role).flatMap(s => s.items);
        let html = '<div style="padding:var(--space-2);"><div style="font-size:var(--text-xs);font-weight:var(--weight-semibold);color:var(--text-tertiary);padding:var(--space-2) var(--space-3);text-transform:uppercase;letter-spacing:0.05em;">Navigation</div>';
        items.slice(0, 8).forEach(item => {
            html += `<div class="command-palette-item" data-page="${item.id}" onclick="CommandPalette.navigate('${item.id}')">
                <span style="color:var(--text-tertiary);width:20px;">${Permissions.getIcon(item.icon)}</span>
                <span>${item.label}</span>
            </div>`;
        });
        html += '</div>';
        this.results.innerHTML = html;
    },

    search() {
        const query = this.input.value.toLowerCase().trim();
        if (!query) { this.showDefault(); return; }

        const role = App.state.user?.role;
        const items = Permissions.getNavItems(role).flatMap(s => s.items);
        const filtered = items.filter(i => i.label.toLowerCase().includes(query));

        let html = '<div style="padding:var(--space-2);">';
        if (filtered.length) {
            filtered.forEach(item => {
                html += `<div class="command-palette-item" data-page="${item.id}" onclick="CommandPalette.navigate('${item.id}')">
                    <span style="color:var(--text-tertiary);width:20px;">${Permissions.getIcon(item.icon)}</span>
                    <span>${item.label}</span>
                </div>`;
            });
        } else {
            html += '<div style="padding:var(--space-6);text-align:center;color:var(--text-tertiary);font-size:var(--text-sm);">No results found</div>';
        }
        html += '</div>';
        this.results.innerHTML = html;
    },

    navigate(pageId) {
        this.close();
        Router.navigate(pageId);
    }
};

window.CommandPalette = CommandPalette;