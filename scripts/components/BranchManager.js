// BranchManager.js - Main coordinator for branch operations and rendering

class BranchManager {
    constructor() {
        this.dataService = null;
        this.sortManager = null;
        this.fileManager = null;
        this.editorManager = null;
        this.evaluationManager = null;
        this.sidebarManager = null;
        this.modalManager = null;
        this.performanceOptimizer = null;
        this.domOptimizer = null;
        this.searchTerm = '';
        this.init();
    }

    setDependencies(dataService, sortManager, fileManager, editorManager, evaluationManager, sidebarManager, modalManager, performanceOptimizer, domOptimizer) {
        this.dataService = dataService;
        this.sortManager = sortManager;
        this.fileManager = fileManager;
        this.editorManager = editorManager;
        this.evaluationManager = evaluationManager;
        this.sidebarManager = sidebarManager;
        this.modalManager = modalManager;
        this.performanceOptimizer = performanceOptimizer;
        this.domOptimizer = domOptimizer;
        
        // Set up cross-references
        if (this.fileManager) {
            this.fileManager.setModalManager(this.modalManager);
            this.fileManager.setSidebarManager(this.sidebarManager);
        }
        if (this.editorManager) this.editorManager.setDataService(this.dataService);
        if (this.evaluationManager) {
            this.evaluationManager.setDataService(this.dataService);
            this.evaluationManager.setSidebarManager(this.sidebarManager);
            this.evaluationManager.setFileManager(this.fileManager);
        }
        
        // Now that all dependencies are set, initialize branches
        this.initBranches().catch(console.warn);
        
        // Set up periodic button state updates for auth system initialization
        this.setupAuthStateMonitoring();
    }

    init() {
        this.bindEvents();
        // Don't initialize branches here - wait for dependencies to be set
    }

    bindEvents() {
        // Bind the "+ New Branch" button
        const newBranchBtn = document.querySelector('.btn-new-branch');
        if (newBranchBtn) {
            newBranchBtn.onclick = () => this.createNewPrompt();
            
            // Add visual feedback for authentication state
            this.updateNewBranchButtonState();
        }

        // Bind the search input with debouncing
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase().trim();
                
                // Use debouncing for better performance
                if (this.performanceOptimizer) {
                    this.performanceOptimizer.debounce('search', () => {
                        this.filterBranches();
                    }, 300);
                } else {
                    this.filterBranches();
                }
            });
        }

        // Listen for sort changes
        window.addEventListener('sort-changed', () => {
            this.applySortAndRender();
        });
        
        // Listen for authentication changes
        window.addEventListener('auth-changed', () => {
            this.updateNewBranchButtonState();
        });
        
        // Listen for leaderboard updates to refresh user ranks
        window.addEventListener('leaderboard-updated', () => {
            this.refreshUserRanks();
        });
    }

    // Branch rendering with performance optimization
    renderBranchesList(prompts) {
        const container = document.getElementById('branchesContainer');
        if (!container) return;
        
        // Use DOM optimization for better performance
        if (this.domOptimizer && Array.isArray(prompts) && prompts.length > 10) {
            this.renderBranchesOptimized(container, prompts);
        } else {
            this.renderBranchesStandard(container, prompts);
        }
    }

    // Standard rendering for small lists
    renderBranchesStandard(container, prompts) {
        container.innerHTML = '';

        if (Array.isArray(prompts)) {
            this.dataService.setCachedPrompts(prompts);
            let index = 0;
            
            for (const p of prompts) {
                console.log('🏗️ Creating branch elements for prompt:', {
                    id: p.id,
                    title: p.title || p.name,
                    userData: p
                });
                const { row, details } = this.createBranchElements(p, ++index);
                container.appendChild(row);
                container.appendChild(details);
            }
            
            this.updateHeaderLabel();
            
            // Refresh user ranks after rendering
            setTimeout(() => this.refreshUserRanks(), 100);
        }
    }

    // Optimized rendering for large lists
    renderBranchesOptimized(container, prompts) {
        this.dataService.setCachedPrompts(prompts);
        
        // Use document fragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        let index = 0;
        
        for (const p of prompts) {
            const { row, details } = this.createBranchElements(p, ++index);
            fragment.appendChild(row);
            fragment.appendChild(details);
        }
        
        container.innerHTML = '';
        container.appendChild(fragment);
        this.updateHeaderLabel();
        
        // Refresh user ranks after rendering
        setTimeout(() => this.refreshUserRanks(), 100);
    }

        // Create branch elements
    createBranchElements(p, index) {
        console.log('🎨 createBranchElements called for prompt:', {
            id: p.id,
            title: p.title || p.name,
            userData: p
        });
        
        const row = document.createElement('div');
        row.className = 'branch-row';
        row.setAttribute('data-branch-id', p.id ?? 'unknown');
        row.setAttribute('data-collection', this.dataService.currentBranchesCollection);

        const rankLabel = this.sortManager.getLeftCellText(p, index, this.dataService);
        const title = p.title || p.name || (p.is_main ? 'Main' : '(untitled)');
        const truncatedTitle = this.truncateTitle(title);
        const owner = this.getOwnerDisplayName(p);
        
        console.log('📝 Branch element data:', {
            rankLabel,
            title,
            truncatedTitle,
            owner
        });

                        const rowHTML = `
            <div class="branch-col branch-col-rank">${rankLabel}</div>
            <div class="branch-col branch-col-title">${truncatedTitle}</div>
            <div class="branch-col branch-col-owner">${owner}</div>
        `;
        
        console.log('🔧 Setting row HTML:', rowHTML);
        row.innerHTML = rowHTML;
        
        row.onclick = (event) => {
            if (event.target.classList.contains('branch-col-rank')) return;
            this.expandBranch(p.id ?? 'unknown');
        };
        
        const details = document.createElement('div');
        details.className = 'branch-details';
        details.setAttribute('data-branch-id', p.id ?? 'unknown');
        details.innerHTML = `
            <div class="branch-details-inner">
                <div class="editor-host" id="editor-${p.id}"></div>
                <div class="branch-toolbar">
                    <div class="branch-toolbar-left">
                        <div class="file-tabs" id="fileTabs-${p.id}"></div>
                        <button class="login-btn" id="addFile-${p.id}">Add file</button>
                    </div>
                    <div class="branch-toolbar-right">
                        <select id="modelSelect-${p.id}">
                            <option value="Auto" selected>Auto</option>
                            <option value="claude-4-sonnet">claude-4-sonnet</option>
                            <option value="gpt-5">gpt-5</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                            <option value="claude-3.5-sonnet">claude-3.5-sonnet</option>
                            <option value="sonic">sonic</option>
                        </select>
                        <button class="btn-evaluate" id="runBtn-${p.id}">Evaluate</button>
                    </div>
                </div>
            </div>
        `;
        
        return { row, details };
    }

    // Update header label
    updateHeaderLabel() {
        const headerRank = document.querySelector('.branches-header .branch-col-rank');
        if (headerRank) {
            headerRank.textContent = this.sortManager.getLeftHeaderLabel();
        }
    }

    // Branch expansion
    expandBranch(id) {
        const clickedRow = document.querySelector(`.branch-row[data-branch-id="${id}"]`);
        const wasActive = clickedRow?.classList.contains('active');

        // Collapse all rows and panels
        document.querySelectorAll('.branch-row').forEach(row => row.classList.remove('active'));
        document.querySelectorAll('.branch-details').forEach(panel => {
            panel.style.maxHeight = '0px';
        });

        // Toggle selected
        if (clickedRow && !wasActive) {
            clickedRow.classList.add('active');
            const details = document.querySelector(`.branch-details[data-branch-id="${id}"]`);
            if (details) {
                details.style.maxHeight = details.scrollHeight + 'px';
                
                // Lazy init editor after expand (always for now, since performance optimization is new)
                this.editorManager.ensureEditorForBranch(id).catch((err) => {
                    console.warn(`Failed to initialize editor for branch ${id}:`, err);
                });
                
                // Load and display latest evaluation in the sidebar
                if (id === 'blank') {
                    console.log('🎯 BranchManager: Blank prompt expanded, skipping evaluation load');
                    this.sidebarManager.setSidebarSummary('');
                } else {
                    const prompt = this.dataService.getCachedPrompts().find(p => p.id === id);
                    if (prompt) {
                        this.evaluationManager.tryLoadLatestEvaluationForPrompt(prompt);
                    } else {
                        this.sidebarManager.setSidebarSummary('');
                    }
                }
                
                // Bind toolbar handlers + load files
                this.bindToolbarHandlers(id);
                this.fileManager.loadFilesForBranch(id).catch(() => {});
                
                // Start observing this branch for performance optimization
                if (this.performanceOptimizer) {
                    this.performanceOptimizer.observeBranch(clickedRow);
                }
            }
        } else {
            // Branch was closed, clear the sidebar evaluation
            this.sidebarManager.setSidebarSummary('');
        }
    }

    // New prompt creation
    createNewPrompt() {
        console.log('🚀 BranchManager: Creating new prompt...');
        
        // Check if auth system is ready
        if (!window.authService) {
            console.log('⏳ BranchManager: Auth service not ready yet, waiting...');
            // Wait a bit for auth service to initialize
            setTimeout(() => this.createNewPrompt(), 500);
            return;
        }
        
        // Check if user is authenticated
        if (!window.authService.isAuthenticated()) {
            console.log('🔒 BranchManager: User not authenticated, showing auth modal...');
            if (window.mainAuth) {
                window.mainAuth.showAuthModal();
            } else {
                console.error('❌ BranchManager: MainAuth not available');
            }
            return;
        }
        
        const container = document.getElementById('branchesContainer');
        if (!container) {
            console.error('❌ BranchManager: No branches container found');
            return;
        }
        
        // Check if blank row already exists
        const existingBlank = container.querySelector('[data-branch-id="blank"]');
        if (existingBlank) {
            console.log('🔄 BranchManager: Blank prompt already exists, expanding...');
            // If it exists, check if it's already open
            const isAlreadyOpen = existingBlank.classList.contains('active');
            if (!isAlreadyOpen) {
                // Only expand if it's not already open
                this.expandBranch('blank');
            }
            // Always scroll to it
            this.scrollToBlankPrompt();
            return;
        }
        
        console.log('🎨 BranchManager: Creating new blank prompt elements...');
        // Create blank row at the top of the branches list
        const blankRow = document.createElement('div');
        blankRow.className = 'branch-row';
        blankRow.setAttribute('data-branch-id', 'blank');
        blankRow.setAttribute('data-collection', this.dataService.currentBranchesCollection);
        blankRow.innerHTML = `
            <div class="branch-col branch-col-rank">New</div>
            <div class="branch-col branch-col-title">${this.truncateTitle('New prompt — Blank')}</div>
            <div class="branch-col branch-col-owner">—</div>
        `;
        blankRow.onclick = (event) => {
            // Don't expand if clicking on the ranking column
            if (event.target.classList.contains('branch-col-rank')) {
                return;
            }
            this.expandBranch('blank');
        };
        
        const blankDetails = document.createElement('div');
        blankDetails.className = 'branch-details';
        blankDetails.setAttribute('data-branch-id', 'blank');
        blankDetails.innerHTML = `
            <div class="branch-details-inner">
                <div class="editor-host" id="editor-blank"></div>
                <div class="branch-toolbar">
                    <div class="branch-toolbar-left">
                        <div class="file-tabs" id="fileTabs-blank"></div>
                        <button class="login-btn" id="addFile-blank">Add file</button>
                    </div>
                    <div class="branch-toolbar-right">
                        <select id="modelSelect-blank">
                            <option value="Auto" selected>Auto</option>
                            <option value="claude-4-sonnet">claude-4-sonnet</option>
                            <option value="gpt-5">gpt-5</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                            <option value="claude-3.5-sonnet">claude-3.5-sonnet</option>
                            <option value="sonic">sonic</option>
                        </select>
                        <button class="btn-evaluate" id="runBtn-blank">Evaluate</button>
                    </div>
                </div>
            </div>
        `;
        
        // Insert at the beginning of the branches list
        container.insertBefore(blankDetails, container.firstChild);
        container.insertBefore(blankRow, container.firstChild);
        
        console.log('🔗 BranchManager: Binding toolbar handlers for blank prompt...');
        // Bind toolbar handlers for the blank prompt
        this.bindToolbarHandlers('blank');
        
        console.log('📖 BranchManager: Expanding blank prompt...');
        // Automatically expand the new blank prompt and scroll to it
        this.expandBranch('blank');
        this.scrollToBlankPrompt();
        
        console.log('✅ BranchManager: New prompt created successfully');
    }

    scrollToBlankPrompt() {
        const blankRow = document.querySelector('.branch-row[data-branch-id="blank"]');
        if (blankRow) {
            // Scroll to the blank prompt with smooth animation, but position it higher
            blankRow.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center', // Changed from 'start' to 'center' to position it higher
                inline: 'nearest'
            });
            
            // Additional offset to make it appear even higher
            setTimeout(() => {
                window.scrollBy({
                    top: -100, // Scroll up by 100px to position it higher
                    behavior: 'smooth'
                });
            }, 100);
            
            // Focus the editor after a short delay to ensure it's loaded
            setTimeout(() => {
                const editorHost = document.getElementById('editor-blank');
                if (editorHost) {
                    editorHost.focus();
                }
            }, 300);
        }
    }

    // Search and filtering
    filterBranches() {
        const container = document.getElementById('branchesContainer');
        if (!container) return;
        
        const allRows = container.querySelectorAll('.branch-row');
        const allDetails = container.querySelectorAll('.branch-details');
        
        if (!this.searchTerm) {
            // Show all rows when search is empty
            allRows.forEach(row => row.style.display = 'flex');
            allDetails.forEach(detail => detail.style.display = 'block');
            return;
        }
        
        allRows.forEach((row, index) => {
            const title = row.querySelector('.branch-col-title')?.textContent?.toLowerCase() || '';
            const owner = row.querySelector('.branch-col-owner')?.textContent?.toLowerCase() || '';
            const rank = row.querySelector('.branch-col-rank')?.textContent?.toLowerCase() || '';
            
            const matches = title.includes(this.searchTerm) || 
                           owner.includes(this.searchTerm) || 
                           rank.includes(this.searchTerm);
            
            if (matches) {
                row.style.display = 'flex';
                if (allDetails[index]) {
                    allDetails[index].style.display = 'block';
                }
            } else {
                row.style.display = 'none';
                if (allDetails[index]) {
                    allDetails[index].style.display = 'none';
                }
            }
        });
    }

    // Toolbar handlers
    bindToolbarHandlers(branchId) {
        const addBtn = document.getElementById(`addFile-${branchId}`);
        if (addBtn) {
            addBtn.onclick = () => {
                // Check if auth system is ready
                if (!window.authService) {
                    console.log('⏳ BranchManager: Auth service not ready for file operation, waiting...');
                    setTimeout(() => addBtn.click(), 500);
                    return;
                }
                
                // Check authentication for file operations
                if (!window.authService.isAuthenticated()) {
                    console.log('🔒 BranchManager: User not authenticated for file operation, showing auth modal...');
                    if (window.mainAuth) {
                        window.mainAuth.showAuthModal();
                    }
                    return;
                }
                this.fileManager.addFileToBranch(branchId);
            };
        }
        
        const runBtn = document.getElementById(`runBtn-${branchId}`);
        if (runBtn) {
            console.log(`🔗 BranchManager: Binding Evaluate button for branch ${branchId}`);
            runBtn.onclick = async () => {
                console.log(`🚀 BranchManager: Evaluate button clicked for branch ${branchId}`);
                
                // Check if auth system is ready
                if (!window.authService) {
                    console.log('⏳ BranchManager: Auth service not ready for evaluation, waiting...');
                    setTimeout(() => runBtn.click(), 500);
                    return;
                }
                
                // Check authentication for evaluation
                if (!window.authService.isAuthenticated()) {
                    console.log('🔒 BranchManager: User not authenticated for evaluation, showing auth modal...');
                    if (window.mainAuth) {
                        window.mainAuth.showAuthModal();
                    }
                    return;
                }
                
                const prompt = (this.editorManager.getEditorValue(branchId) || '').trim();
                const modelEl = document.getElementById(`modelSelect-${branchId}`);
                
                console.log(`📝 BranchManager: Prompt content: "${prompt}"`);
                console.log(`🎯 BranchManager: Model selection: ${modelEl ? modelEl.value : 'No model element'}`);
                
                if (!prompt) { 
                    console.log(`❌ BranchManager: No prompt content, showing message`);
                    this.sidebarManager.setSidebarSummary('Please enter a prompt.'); 
                    return; 
                }
                
                // For blank prompts, ask for a name first
                if (branchId === 'blank') {
                    console.log(`🎨 BranchManager: Blank prompt detected, showing name modal`);
                    this.modalManager.showNameModal((name) => {
                        console.log(`✅ BranchManager: Name provided: ${name}, creating evaluation request`);
                        // Continue with evaluation using the provided name
                        this.evaluationManager.createEvaluationRequest(prompt, modelEl, branchId, name);
                    });
                    return;
                }
                
                // For existing branches, get the branch title and proceed
                console.log(`🔄 BranchManager: Existing branch, getting title and creating evaluation request`);
                const branchData = this.dataService.getCachedPrompts().find(p => p.id === branchId);
                const branchTitle = branchData ? (branchData.title || branchData.name || '(untitled)') : '(untitled)';
                console.log(`📝 BranchManager: Branch title: ${branchTitle}`);
                await this.evaluationManager.createEvaluationRequest(prompt, modelEl, branchId, branchTitle);
            };
        }
    }

    // Sorting and rendering
    applySortAndRender() {
        const sorted = this.sortManager.sortPrompts(this.dataService.getCachedPrompts(), this.dataService);
        this.renderBranchesList(sorted);
    }

    // Update New Branch button state based on authentication
    updateNewBranchButtonState() {
        const newBranchBtn = document.querySelector('.btn-new-branch');
        if (!newBranchBtn) return;
        
        // Check if auth system is ready and user is authenticated
        if (window.authService && window.authService.isAuthenticated()) {
            // User is authenticated - normal state
            newBranchBtn.style.opacity = '1';
            newBranchBtn.style.cursor = 'pointer';
            newBranchBtn.title = 'Create a new branch';
        } else {
            // User is not authenticated - show subtle indication
            newBranchBtn.style.opacity = '0.7';
            newBranchBtn.style.cursor = 'pointer';
            newBranchBtn.title = 'Sign in to create a new branch';
        }
    }
    
    // Set up periodic monitoring of auth state for initialization
    setupAuthStateMonitoring() {
        // Check auth state every 500ms for the first 5 seconds
        let attempts = 0;
        const maxAttempts = 10;
        const interval = setInterval(() => {
            attempts++;
            this.updateNewBranchButtonState();
            
            if (attempts >= maxAttempts || (window.authService && window.authService.isAuthenticated !== undefined)) {
                clearInterval(interval);
            }
        }, 500);
    }
    
    // Refresh user ranks when leaderboard data changes
    refreshUserRanks() {
        console.log('🔄 BranchManager: Refreshing user ranks...');
        
        // Get all branch rows and update their owner displays with ranks
        const branchRows = document.querySelectorAll('.branch-row[data-branch-id]:not([data-branch-id="blank"])');
        
        branchRows.forEach(row => {
            const branchId = row.getAttribute('data-branch-id');
            const ownerCol = row.querySelector('.branch-col-owner');
            
            if (ownerCol && branchId) {
                // Get the current username from the display
                const currentUsername = ownerCol.textContent.trim();
                if (currentUsername && currentUsername !== '—') {
                    // Find the branch data to get the owner_id
                    const branchData = this.dataService.getCachedPrompts().find(p => p.id === branchId);
                    if (branchData) {
                        const formattedUsername = this.formatUsernameWithRank(currentUsername, branchData.owner_id);
                        ownerCol.innerHTML = formattedUsername;
                    }
                }
            }
        });
        
        console.log('✅ BranchManager: User ranks refreshed');
    }
    
    // Utility methods
    truncateTitle(title, maxLength = 45) {
        if (!title || title.length <= maxLength) return title;
        return title.substring(0, maxLength - 3) + '...';
    }

    getOwnerDisplayName(userData) {
        console.log('🔍 getOwnerDisplayName called with:', userData);
        
        if (!userData) {
            console.log('❌ No userData provided, returning "—"');
            return '—';
        }
        
        // Only return username, no fallbacks
        const username = userData.username || userData.displayName || userData.display_name;
        console.log('📝 Extracted username from userData:', {
            username: userData.username,
            displayName: userData.displayName,
            display_name: userData.display_name,
            finalUsername: username
        });
        
        // If we have a username and it's not an email, use it
        if (username && !username.includes('@')) {
            console.log('✅ Found valid username (not email):', username);
            return this.formatUsernameWithRank(username, userData.owner_id);
        }
        
        if (username && username.includes('@')) {
            console.log('⚠️ Username is an email, trying to get proper username from users collection');
        }
        
        // If username is an email, try to get proper username from users collection
        if (userData.owner_id && window.db) {
            console.log('🔍 Looking up user in users collection with owner_id:', userData.owner_id);
            console.log('🗄️ window.db available:', !!window.db);
            console.log('🗄️ window.db.collection available:', !!(window.db && window.db.collection));
            
            // Try to get username from users collection
            window.db.collection('users').doc(userData.owner_id).get()
                .then((doc) => {
                    console.log('📄 Users collection lookup result:', {
                        docExists: doc.exists,
                        docId: doc.id,
                        docData: doc.data()
                    });
                    
                    if (doc.exists) {
                        const userDoc = doc.data();
                        const properUsername = userDoc.username || userDoc.displayName || userDoc.display_name;
                        console.log('👤 User document data:', {
                            username: userDoc.username,
                            displayName: userDoc.displayName,
                            display_name: userDoc.display_name,
                            properUsername: properUsername
                        });
                        
                        if (properUsername && !properUsername.includes('@')) {
                            console.log('✅ Found proper username in users collection:', properUsername);
                            // Update the display in the UI with rank
                            const row = document.querySelector(`[data-branch-id="${userData.id}"] .branch-col-owner`);
                            console.log('🎯 Looking for DOM element:', `[data-branch-id="${userData.id}"] .branch-col-owner`);
                            console.log('🎯 Found DOM element:', !!row);
                            
                            if (row) {
                                const formattedUsername = this.formatUsernameWithRank(properUsername, userData.owner_id);
                                console.log('✏️ Updating DOM element from:', row.textContent, 'to:', formattedUsername);
                                row.innerHTML = formattedUsername;
                            } else {
                                console.log('❌ DOM element not found for branch:', userData.id);
                            }
                        } else {
                            console.log('⚠️ No proper username found in users collection or username is email');
                        }
                    } else {
                        console.log('❌ User document does not exist in users collection');
                    }
                })
                .catch((error) => {
                    console.error('❌ Error looking up user in users collection:', error);
                });
        } else {
            console.log('⚠️ Cannot lookup user - missing owner_id or window.db:', {
                hasOwnerId: !!userData.owner_id,
                hasWindowDb: !!window.db
            });
        }
        
        // No fallbacks - return dash if no proper username
        console.log('🏁 Returning "—" as no valid username found');
        return '—';
    }
    
    // Format username with rank display
    formatUsernameWithRank(username, userId) {
        if (!username || username === '—') return '—';
        
        // Try to get rank from leaderboard data
        const rank = this.getUserRank(username, userId);
        
        if (rank && rank <= 100) { // Only show top 100 ranks
            return `<span class="username-with-rank">
                <span class="username">${username}</span>
                <span class="user-rank" data-rank="${rank}">#${rank}</span>
            </span>`;
        }
        
        return username;
    }
    
    // Get user rank from leaderboard data
    getUserRank(username, userId) {
        try {
            // Try to get rank from leaderboard manager if available
            if (window.leaderboardManager && window.leaderboardManager.items && Array.isArray(window.leaderboardManager.items)) {
                const user = window.leaderboardManager.items.find(item => 
                    item.username === username || 
                    item.user_id === userId ||
                    item.display_name === username ||
                    item.email === username
                );
                
                if (user) {
                    // Find the rank by position in sorted array
                    const rank = window.leaderboardManager.items.findIndex(item => 
                        item.user_id === user.user_id
                    ) + 1;
                    return rank > 0 ? rank : null;
                }
            }
            
            // Fallback: try to get from users collection if we have userId
            if (userId && window.db) {
                // This would require a separate query, but for now we'll use the leaderboard data
                return null;
            }
            
            return null;
        } catch (error) {
            console.warn('Error getting user rank:', error);
            return null;
        }
    }

    // Initialization
    async initBranches() {
        let items = [];
        // Prefer 'prompts', fallback to 'branches'
        items = await this.dataService.fetchFromCollection('prompts');
        if (items.length) {
            this.dataService.currentBranchesCollection = 'prompts';
        } else {
            items = await this.dataService.fetchFromCollection('branches');
            this.dataService.currentBranchesCollection = 'branches';
        }
        this.dataService.setCachedPrompts(items);
        this.applySortAndRender();
        
        // Set up real-time updates for the prompts collection
        this.setupRealTimeUpdates();
    }
    
    // Set up real-time Firestore listeners for prompt updates
    setupRealTimeUpdates() {
        if (!window.db || !window.db.collection) {
            console.log('⚠️ BranchManager: Firebase not available, skipping real-time updates');
            return;
        }
        
        console.log('🔄 BranchManager: Setting up real-time updates for prompts collection');
        
        // Listen for changes in the prompts collection
        this.promptsListener = window.db.collection('prompts').onSnapshot((snapshot) => {
            console.log('📡 BranchManager: Prompts collection update received');
            
            snapshot.docChanges().forEach((change) => {
                const docData = change.doc.data();
                const docId = change.doc.id;
                
                console.log('📝 BranchManager: Document change:', {
                    type: change.type,
                    docId: docId,
                    data: docData
                });
                
                if (change.type === 'added') {
                    // New prompt added - add it to the list
                    console.log('➕ BranchManager: New prompt added:', docId);
                    this.handlePromptAdded(docId, docData);
                } else if (change.type === 'modified') {
                    // Existing prompt modified - update it in the list
                    console.log('✏️ BranchManager: Prompt modified:', docId);
                    this.handlePromptModified(docId, docData);
                } else if (change.type === 'removed') {
                    // Prompt removed - remove it from the list
                    console.log('🗑️ BranchManager: Prompt removed:', docId);
                    this.handlePromptRemoved(docId);
                }
            });

            // After applying changes, re-consolidate to only show current best per branch
            const consolidated = this.dataService.consolidateToCurrentBest(this.dataService.getCachedPrompts());
            this.dataService.setCachedPrompts(consolidated);
            this.applySortAndRender();
        }, (error) => {
            console.error('❌ BranchManager: Error in real-time updates:', error);
        });
    }
    
    // Handle new prompt added
    handlePromptAdded(docId, docData) {
        // Check if this prompt is already in our list
        const existingPrompt = this.dataService.getCachedPrompts().find(p => p.id === docId);
        if (existingPrompt) {
            console.log('⚠️ BranchManager: Prompt already exists in list, skipping add');
            return;
        }
        
        // Check if this is a new prompt that should replace the blank prompt
        const blankPrompt = this.dataService.getCachedPrompts().find(p => p.id === 'blank');
        if (blankPrompt && docData.parent_id === 'blank') {
            console.log('🔄 BranchManager: New prompt is replacing blank prompt, updating instead of adding');
            this.handlePromptModified(docId, docData);
            return;
        }
        
        // Add the new prompt to our cached list
        const newPrompt = { id: docId, ...docData };
        const currentPrompts = this.dataService.getCachedPrompts();
        currentPrompts.unshift(newPrompt); // Add to beginning
        this.dataService.setCachedPrompts(currentPrompts);
        
        // Re-render the list
        this.applySortAndRender();
        
        console.log('✅ BranchManager: New prompt added to list:', docId);
    }
    
    // Handle existing prompt modified
    handlePromptModified(docId, docData) {
        // Find the existing prompt in our cached list
        const currentPrompts = this.dataService.getCachedPrompts();
        const promptIndex = currentPrompts.findIndex(p => p.id === docId);
        
        if (promptIndex === -1) {
            console.log('⚠️ BranchManager: Modified prompt not found in list, skipping update');
            return;
        }
        
        // Check if this is a blank prompt being replaced with real data
        const isBlankReplacement = currentPrompts[promptIndex].id === 'blank' && docData.id !== 'blank';
        
        // Update the prompt data
        const updatedPrompt = { ...currentPrompts[promptIndex], ...docData };
        currentPrompts[promptIndex] = updatedPrompt;
        this.dataService.setCachedPrompts(currentPrompts);
        
        if (isBlankReplacement) {
            // If this is replacing a blank prompt, we need to update the DOM attributes
            console.log('🔄 BranchManager: Updating blank prompt with real data');
            this.updateBlankPromptToReal(docId, updatedPrompt);
        } else {
            // Update the specific row in the UI without full re-render
            this.updatePromptRow(docId, updatedPrompt);
        }
        
        console.log('✅ BranchManager: Prompt updated in list:', docId);
    }
    
    // Handle prompt removed
    handlePromptRemoved(docId) {
        // Remove the prompt from our cached list
        const currentPrompts = this.dataService.getCachedPrompts();
        const promptIndex = currentPrompts.findIndex(p => p.id === docId);
        
        if (promptIndex === -1) {
            console.log('⚠️ BranchManager: Removed prompt not found in list, skipping removal');
            return;
        }
        
        currentPrompts.splice(promptIndex, 1);
        this.dataService.setCachedPrompts(currentPrompts);
        
        // Remove the row from the UI
        this.removePromptRow(docId);
        
        console.log('✅ BranchManager: Prompt removed from list:', docId);
    }
    
    // Update blank prompt to real prompt (when backend creates the real document)
    updateBlankPromptToReal(docId, promptData) {
        const blankRow = document.querySelector(`[data-branch-id="blank"]`);
        const blankDetails = document.querySelector(`[data-branch-id="blank"].branch-details`);
        
        if (!blankRow || !blankDetails) {
            console.log('⚠️ BranchManager: Blank prompt elements not found for replacement');
            return;
        }
        
        // Check if the blank prompt is currently expanded
        const isCurrentlyExpanded = blankRow.classList.contains('active');
        console.log('🔍 BranchManager: Blank prompt expanded state:', isCurrentlyExpanded);
        
        // Update the data attributes to reflect the real prompt ID
        blankRow.setAttribute('data-branch-id', docId);
        blankDetails.setAttribute('data-branch-id', docId);
        
        // Update the title
        const titleCol = blankRow.querySelector('.branch-col-title');
        if (titleCol) {
            const title = promptData.title || promptData.name || (promptData.is_main ? 'Main' : '(untitled)');
            const truncatedTitle = this.truncateTitle(title);
            titleCol.textContent = truncatedTitle;
        }
        
        // Update the owner
        const ownerCol = blankRow.querySelector('.branch-col-owner');
        if (ownerCol) {
            const owner = this.getOwnerDisplayName(promptData);
            ownerCol.textContent = owner;
        }
        
        // Update the rank
        const rankCol = blankRow.querySelector('.branch-col-rank');
        if (rankCol) {
            const currentPrompts = this.dataService.getCachedPrompts();
            const promptIndex = currentPrompts.findIndex(p => p.id === docId);
            if (promptIndex !== -1) {
                const rankLabel = this.sortManager.getLeftCellText(promptData, promptIndex + 1, this.dataService);
                rankCol.textContent = rankLabel;
            }
        }
        
        // Update the rank label from "New" to actual rank
        if (rankCol) {
            rankCol.textContent = rankCol.textContent.replace('New', '');
        }
        
        // Preserve the expanded state - if it was open, keep it open
        if (isCurrentlyExpanded) {
            console.log('🔒 BranchManager: Preserving expanded state for transformed prompt');
            // The row should already have 'active' class, just ensure details are visible
            blankDetails.style.maxHeight = blankDetails.scrollHeight + 'px';
            
            // Re-bind toolbar handlers for the new prompt ID
            this.bindToolbarHandlers(docId);
            
            // Load files for the new prompt
            this.fileManager.loadFilesForBranch(docId).catch(() => {});
            
            // Try to load latest evaluation for the new prompt
            if (promptData) {
                this.evaluationManager.tryLoadLatestEvaluationForPrompt(promptData);
            }
            
            // Update the click handler to use the new prompt ID
            blankRow.onclick = (event) => {
                // Don't expand if clicking on the ranking column
                if (event.target.classList.contains('branch-col-rank')) {
                    return;
                }
                this.expandBranch(docId);
            };
        }
        
        console.log('✅ BranchManager: Blank prompt transformed to real prompt:', docId);
    }
    
    // Update a specific prompt row in the UI
    updatePromptRow(docId, promptData) {
        const row = document.querySelector(`[data-branch-id="${docId}"]`);
        if (!row) {
            console.log('⚠️ BranchManager: Row not found for update:', docId);
            return;
        }
        
        // Update the title
        const titleCol = row.querySelector('.branch-col-title');
        if (titleCol) {
            const title = promptData.title || promptData.name || (promptData.is_main ? 'Main' : '(untitled)');
            const truncatedTitle = this.truncateTitle(title);
            titleCol.textContent = truncatedTitle;
        }
        
        // Update the owner
        const ownerCol = row.querySelector('.branch-col-owner');
        if (ownerCol) {
            const owner = this.getOwnerDisplayName(promptData);
            ownerCol.textContent = owner;
        }
        
        // Update the rank if needed
        const rankCol = row.querySelector('.branch-col-rank');
        if (rankCol) {
            const currentPrompts = this.dataService.getCachedPrompts();
            const promptIndex = currentPrompts.findIndex(p => p.id === docId);
            if (promptIndex !== -1) {
                const rankLabel = this.sortManager.getLeftCellText(promptData, promptIndex + 1, this.dataService);
                rankCol.textContent = rankLabel;
            }
        }
        
        console.log('✅ BranchManager: Row updated for prompt:', docId);
    }
    
    // Remove a prompt row from the UI
    removePromptRow(docId) {
        const row = document.querySelector(`[data-branch-id="${docId}"]`);
        const details = document.querySelector(`[data-branch-id="${docId}"].branch-details`);
        
        if (row) row.remove();
        if (details) details.remove();
        
        console.log('✅ BranchManager: Row removed for prompt:', docId);
    }
    
    // Clean up real-time listeners
    cleanup() {
        if (this.promptsListener) {
            console.log('🧹 BranchManager: Cleaning up real-time listeners');
            this.promptsListener();
            this.promptsListener = null;
        }
    }

    // Public API for other modules
    getCachedPrompts() {
        return this.dataService.getCachedPrompts();
    }

    clearProjectsUI() {
        this.dataService.clearProjectsUI();
    }

    pickBestPrompt() {
        return this.dataService.pickBestPrompt();
    }
}

// Export for use in other modules
window.BranchManager = BranchManager;
