// SortManager.js - Handles sorting logic and UI

class SortManager {
    constructor() {
        this.currentSort = { type: 'date', dir: 'desc' }; // 'date' asc/desc, 'votes', 'score'
        this.init();
    }

    init() {
        this.initSortDropdown();
    }

    initSortDropdown() {
        const wrapper = document.querySelector('.sort-wrapper');
        const btn = document.querySelector('.sort-btn');
        if (!wrapper || !btn) return;
        
        wrapper.style.position = 'relative';
        const menu = document.createElement('div');
        menu.className = 'sort-menu';
        menu.style.position = 'absolute';
        menu.style.right = '0';
        menu.style.top = '100%';
        menu.style.border = '1px solid var(--color-text)';
        menu.style.background = 'var(--color-bg)';
        menu.style.color = 'var(--color-text)';
        menu.style.padding = '0';
        menu.style.display = 'none';
        menu.style.minWidth = '160px';
        menu.style.zIndex = '1000';
        menu.innerHTML = `
            <button data-type="date" data-dir="asc" class="sort-menu-btn" style="width:100%; margin:0; justify-content:flex-start; border-bottom:1px solid var(--color-text); border-radius:0; padding:8px 12px">DD-MM ↑</button>
            <button data-type="date" data-dir="desc" class="sort-menu-btn" style="width:100%; margin:0; justify-content:flex-start; border-bottom:1px solid var(--color-text); border-radius:0; padding:8px 12px">DD-MM ↓</button>
            <button data-type="votes" class="sort-menu-btn" style="width:100%; margin:0; justify-content:flex-start; border-bottom:1px solid var(--color-text); border-radius:0; padding:8px 12px">Votes</button>
            <button data-type="score" class="sort-menu-btn" style="width:100%; margin:0; justify-content:flex-start; margin:0; border-radius:0; padding:8px 12px">Score</button>
        `;
        wrapper.appendChild(menu);

        const hideMenu = () => { menu.style.display = 'none'; };
        const toggleMenu = () => { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };

        btn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
        document.addEventListener('click', () => hideMenu());
        menu.addEventListener('click', (ev) => {
            const t = ev.target;
            const type = t && t.getAttribute && t.getAttribute('data-type');
            if (!type) return;
            const dir = t.getAttribute('data-dir') || null;
            this.currentSort = { type, dir: dir || (type === 'date' ? 'desc' : null) };
            hideMenu();
            this.onSortChange();
        });
    }

    sortPrompts(prompts, dataService) {
        const arr = (prompts || []).slice();
        if (!arr.length) return arr;
        
        arr.sort((a, b) => {
            if (this.currentSort.type === 'date') {
                const av = dataService.parseIso(dataService.getCreatedAtSafe(a));
                const bv = dataService.parseIso(dataService.getCreatedAtSafe(b));
                return this.currentSort.dir === 'asc' ? (av - bv) : (bv - av);
            }
            if (this.currentSort.type === 'votes') {
                const av = dataService.getVotesSafe(a);
                const bv = dataService.getVotesSafe(b);
                return bv - av; // highest votes first
            }
            if (this.currentSort.type === 'score') {
                const av = dataService.getScoreSafe(a);
                const bv = dataService.getScoreSafe(b);
                return bv - av; // highest score first
            }
            return 0;
        });
        return arr;
    }

    getLeftHeaderLabel() {
        if (this.currentSort.type === 'date') {
            return this.currentSort.dir === 'asc' ? 'DD-MM ↑' : 'DD-MM ↓';
        }
        if (this.currentSort.type === 'votes') return 'Votes';
        if (this.currentSort.type === 'score') return 'Score';
        return 'Rank';
    }

    getLeftCellText(p, fallbackIndex, dataService) {
        if (this.currentSort.type === 'date') {
            return this.formatDateShort(dataService.getCreatedAtSafe(p)) || `#${fallbackIndex}`;
        }
        if (this.currentSort.type === 'votes') {
            return String(dataService.getVotesSafe(p));
        }
        if (this.currentSort.type === 'score') {
            const s = dataService.getScoreSafe(p);
            return (s || s === 0) ? String(s) : `#${fallbackIndex}`;
        }
        return `#${fallbackIndex}`;
    }

    formatDateShort(iso) {
        try {
            const d = new Date(iso);
            if (!d || isNaN(d.getTime())) return '';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}-${month}`;
        } catch { return ''; }
    }

    onSortChange() {
        // This will be called when sort changes
        // Dispatch a custom event that BranchManager can listen to
        window.dispatchEvent(new CustomEvent('sort-changed', { 
            detail: { sortType: this.currentSort.type, sortDir: this.currentSort.dir } 
        }));
    }

    getCurrentSort() {
        return { ...this.currentSort };
    }
}

// Export for use in other modules
window.SortManager = SortManager;
