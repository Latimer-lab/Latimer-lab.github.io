// layout-new.js - Main orchestrator for the modular Hackly system

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing modular Hackly system...');
    
    // Initialize all managers
    const panelManager = new PanelManager();
    console.log('✅ PanelManager initialized');
    
    const dataService = new DataService();
    console.log('✅ DataService initialized');
    
    const sortManager = new SortManager();
    console.log('✅ SortManager initialized');
    
    const modalManager = new ModalManager();
    console.log('✅ ModalManager initialized');
    
    const fileManager = new FileManager();
    console.log('✅ FileManager initialized');
    
    const editorManager = new EditorManager();
    console.log('✅ EditorManager initialized');
    
    const evaluationManager = new EvaluationManager();
    console.log('✅ EvaluationManager initialized');
    
    const sidebarManager = new SidebarManager();
    console.log('✅ SidebarManager initialized');
    
    // Initialize performance optimizers
    const performanceOptimizer = new PerformanceOptimizer();
    console.log('🚀 PerformanceOptimizer initialized');
    
    const domOptimizer = new DOMOptimizer();
    console.log('⚡ DOMOptimizer initialized');
    
    const branchManager = new BranchManager();
    console.log('✅ BranchManager initialized');

    // Set up dependencies between managers
    console.log('🔗 Setting up dependencies...');
    branchManager.setDependencies(
        dataService, 
        sortManager, 
        fileManager, 
        editorManager, 
        evaluationManager, 
        sidebarManager, 
        modalManager,
        performanceOptimizer,
        domOptimizer
    );
    console.log('✅ Dependencies set up');

    // Initialize branches when Firebase is ready
    window.addEventListener('firebase-ready', () => { 
        // Re-initialize branches when Firebase is ready
        branchManager.initBranches().catch(console.warn); 
    });

    // Expose minimal API for round handling (maintaining compatibility)
    window.hackly = window.hackly || {};
    window.hackly.getCachedPrompts = () => branchManager.getCachedPrompts();
    window.hackly.fetchBranchContent = (branchId) => dataService.fetchBranchContent(branchId);
    window.hackly.clearProjectsUI = () => branchManager.clearProjectsUI();
    window.hackly.pickBestPrompt = () => branchManager.pickBestPrompt();
    
    // Expose managers globally for theme management and other utilities
    window.editorManager = editorManager;
    window.branchManager = branchManager;
    window.dataService = dataService;
});
