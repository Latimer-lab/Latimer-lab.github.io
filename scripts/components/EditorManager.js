// EditorManager.js - Handles Monaco editor operations and management

class EditorManager {
    constructor() {
        this.monacoReadyPromise = null;
        this.editorByBranchId = new Map();
        this.dataService = null;
    }

    setDataService(dataService) {
        this.dataService = dataService;
    }

    // Monaco loading
    loadMonaco() {
        console.log('🎨 EditorManager: Loading Monaco editor...');
        
        if (window.monaco) {
            console.log('✅ EditorManager: Monaco already loaded');
            return Promise.resolve(window.monaco);
        }
        
        if (this.monacoReadyPromise) {
            console.log('⏳ EditorManager: Monaco loading already in progress');
            return this.monacoReadyPromise;
        }
        
        console.log('🚀 EditorManager: Starting Monaco load...');
        
        this.monacoReadyPromise = new Promise((resolve, reject) => {
            function configureAndLoad() {
                console.log('⚙️ EditorManager: Configuring Monaco loader...');
                try {
                    window.require.config({ 
                        paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } 
                    });
                    window.require(['vs/editor/editor.main'], () => {
                        console.log('✅ EditorManager: Monaco loaded successfully');
                        resolve(window.monaco);
                    });
                } catch (err) {
                    console.error('❌ EditorManager: Error configuring Monaco:', err);
                    reject(err);
                }
            }
            
            if (typeof window.require === 'undefined') {
                console.log('📥 EditorManager: Loading Monaco loader script...');
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
                script.onload = configureAndLoad;
                script.onerror = (err) => {
                    console.error('❌ EditorManager: Failed to load Monaco loader script:', err);
                    reject(err);
                };
                document.head.appendChild(script);
            } else {
                configureAndLoad();
            }
        });
        
        return this.monacoReadyPromise;
    }

    // Editor management
    async ensureEditorForBranch(branchId) {
        console.log(`🎨 EditorManager: Ensuring editor for branch ${branchId}`);
        
        const existing = this.editorByBranchId.get(branchId);
        const host = document.getElementById(`editor-${branchId}`);
        
        if (!host) {
            console.warn(`❌ EditorManager: No host element found for branch ${branchId}`);
            return;
        }
        
        if (existing) {
            console.log(`✅ EditorManager: Editor already exists for branch ${branchId}, updating layout`);
            if (existing.layout) {
                existing.layout();
            }
            return;
        }
        
        console.log(`🚀 EditorManager: Loading Monaco and content for branch ${branchId}`);
        
        let monaco, content = '';
        
        // For blank prompts, don't fetch content from database
        if (branchId === 'blank') {
            console.log(`🎯 EditorManager: Blank prompt detected, skipping content fetch`);
            try {
                monaco = await this.loadMonaco();
                console.log(`✅ EditorManager: Monaco loaded for blank prompt`);
            } catch (err) {
                console.error(`❌ EditorManager: Failed to load Monaco for blank prompt:`, err);
                return;
            }
        } else {
            // For existing branches, fetch content
            try {
                [monaco, content] = await Promise.all([
                    this.loadMonaco(),
                    this.fetchBranchContent(branchId)
                ]);
                console.log(`✅ EditorManager: Monaco loaded, content fetched for branch ${branchId}`);
            } catch (err) {
                console.error(`❌ EditorManager: Failed to load Monaco or content for branch ${branchId}:`, err);
                return;
            }
        }
        
        // Check if this is a blank prompt or existing branch
        const isBlankPrompt = branchId === 'blank' || !content || content.trim() === '';
        
        if (isBlankPrompt) {
            // Single editor for blank prompts
            console.log(`🎨 EditorManager: Creating single editor for blank prompt`);
            const editor = monaco.editor.create(host, {
                value: content || '',
                language: 'markdown',
                automaticLayout: true,
                minimap: { enabled: false },
                readOnly: false,
                theme: window.themeManager && window.themeManager.isDark ? 'vs-dark' : 'vs',
                wordWrap: 'on'
            });
            this.editorByBranchId.set(branchId, editor);
            console.log(`✅ EditorManager: Single editor created successfully for branch ${branchId}`);
        } else {
            // Diff editor for existing branches (inline, not side-by-side)
            console.log(`🎨 EditorManager: Creating diff editor for existing branch`);
            const diffEditor = monaco.editor.createDiffEditor(host, {
                automaticLayout: true,
                minimap: { enabled: false },
                readOnly: false,
                theme: window.themeManager && window.themeManager.isDark ? 'vs-dark' : 'vs',
                wordWrap: 'on',
                renderSideBySide: false, // Inline diff view
                ignoreTrimWhitespace: false
            });
            
            const originalModel = monaco.editor.createModel(content, 'markdown');
            const modifiedModel = monaco.editor.createModel(content, 'markdown');
            
            diffEditor.setModel({
                original: originalModel,
                modified: modifiedModel
            });
            
            // Store both the diff editor and a reference to get the modified content
            this.editorByBranchId.set(branchId, {
                isDiffEditor: true,
                editor: diffEditor,
                getValue: () => modifiedModel.getValue(),
                layout: () => diffEditor.layout()
            });
            console.log(`✅ EditorManager: Diff editor created successfully for branch ${branchId}`);
        }
    }

    // Content fetching
    async fetchBranchContent(branchId) {
        // Never fetch content for blank prompts
        if (branchId === 'blank') {
            console.log('🎯 EditorManager: Skipping content fetch for blank prompt');
            return '';
        }
        
        if (!this.dataService) return '';
        return await this.dataService.fetchBranchContent(branchId);
    }

    // Editor value extraction
    getEditorValue(branchId) {
        const ed = this.editorByBranchId.get(branchId);
        try { 
            if (!ed) return '';
            // Handle diff editor wrapper
            if (ed.isDiffEditor && ed.getValue) {
                return ed.getValue() || '';
            }
            // Handle regular editor
            return ed.getValue ? (ed.getValue() || '') : '';
        } catch { 
            return ''; 
        }
    }

    // Editor disposal
    disposeEditor(branchId) {
        const editor = this.editorByBranchId.get(branchId);
        if (editor) {
            try {
                if (editor.isDiffEditor && editor.editor) {
                    editor.editor.dispose();
                } else if (editor.dispose) {
                    editor.dispose();
                }
            } catch (e) {
                console.warn('Error disposing editor:', e);
            }
            this.editorByBranchId.delete(branchId);
        }
    }

    // Editor layout updates
    layoutEditor(branchId) {
        const editor = this.editorByBranchId.get(branchId);
        if (editor && editor.layout) {
            editor.layout();
        }
    }

    // Theme updates
    updateEditorTheme(isDark) {
        const theme = isDark ? 'vs-dark' : 'vs';
        this.editorByBranchId.forEach(editor => {
            try {
                if (editor.isDiffEditor && editor.editor) {
                    editor.editor.updateOptions({ theme });
                } else if (editor.updateOptions) {
                    editor.updateOptions({ theme });
                }
            } catch (e) {
                console.warn('Error updating editor theme:', e);
            }
        });
    }

    // Utility methods
    hasEditor(branchId) {
        return this.editorByBranchId.has(branchId);
    }

    getEditor(branchId) {
        return this.editorByBranchId.get(branchId);
    }

    getAllEditorIds() {
        return Array.from(this.editorByBranchId.keys());
    }

    // Cleanup
    disposeAllEditors() {
        this.editorByBranchId.forEach((editor, branchId) => {
            this.disposeEditor(branchId);
        });
    }
    
    // Force update all editor themes (called by theme manager)
    forceUpdateAllThemes() {
        const theme = this.getCurrentTheme();
        console.log(`🎨 EditorManager: Force updating all editor themes to: ${theme}`);
        this.editorByBranchId.forEach((editor, branchId) => {
            try {
                if (editor.isDiffEditor && editor.editor) {
                    console.log(`🎨 EditorManager: Force updating diff editor theme for branch ${branchId}`);
                    editor.editor.updateOptions({ theme });
                } else if (editor.updateOptions) {
                    console.log(`🎨 EditorManager: Force updating regular editor theme for branch ${branchId}`);
                    editor.updateOptions({ theme });
                }
            } catch (e) {
                console.warn(`⚠️ EditorManager: Error force updating editor theme for branch ${branchId}:`, e);
            }
        });
    }
    
    // Get current theme
    getCurrentTheme() {
        if (window.themeManager) {
            return window.themeManager.isDark ? 'vs-dark' : 'vs';
        }
        // Fallback: check if dark theme is applied to document
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return isDark ? 'vs-dark' : 'vs';
    }
}

// Export for use in other modules
window.EditorManager = EditorManager;
