// SidebarManager.js - Handles sidebar operations and evaluation display

class SidebarManager {
    constructor() {
        this.evalSummaryElement = null;
        this.init();
    }

    init() {
        this.evalSummaryElement = document.getElementById('evalSummary');
    }

    // Sidebar summary management
    setSidebarSummary(html) {
        console.log('📋 SidebarManager: Setting summary:', html ? html.substring(0, 100) + '...' : 'empty');
        
        if (!this.evalSummaryElement) {
            console.log('❌ SidebarManager: No evalSummary element found');
            return;
        }
        
        if (!html) {
            console.log('🧹 SidebarManager: Clearing summary');
            this.evalSummaryElement.innerHTML = '';
            return;
        }
        
        console.log('✅ SidebarManager: Setting HTML content');
        this.evalSummaryElement.innerHTML = html;
    }

    getSidebarSummary() {
        return this.evalSummaryElement ? this.evalSummaryElement.innerHTML : '';
    }

    clearSidebarSummary() {
        this.setSidebarSummary('');
    }

    // Utility methods
    isSidebarVisible() {
        return this.evalSummaryElement && this.evalSummaryElement.innerHTML.trim() !== '';
    }

    // Update sidebar with loading state
    showLoading(message = 'Loading...') {
        this.setSidebarSummary(`<div class="loading">${message}</div>`);
    }

    // Update sidebar with error state
    showError(message = 'An error occurred') {
        this.setSidebarSummary(`<div class="error">${message}</div>`);
    }

    // Update sidebar with success state
    showSuccess(message = 'Operation completed successfully') {
        this.setSidebarSummary(`<div class="success">${message}</div>`);
    }
}

// Export for use in other modules
window.SidebarManager = SidebarManager;
