// Panel interactions and branches rendering copied from REBUILD/app.js but decoupled from Firebase

document.addEventListener('DOMContentLoaded', () => {
    const panels = Array.from(document.querySelectorAll('.panel'));
    let currentBranchesCollection = 'prompts';
    let monacoReadyPromise = null;
    window.editorByBranchId = new Map();
    let cachedPrompts = [];
    const filesByBranch = new Map();
    const originalFileIdsByBranch = new Map();
    let modal = null;
    window.modalEditor = null;
    let modalFilenameInput = null;
    let currentBranchForModal = null, editingIndex = -1;
    let nameModal = null, nameInput = null;

    function renderBranchesList(prompts) {
        const container = document.getElementById('branchesContainer');
        if (!container) return;
        container.innerHTML = '';



        // If prompts provided, add them
        if (Array.isArray(prompts)) {
            cachedPrompts = prompts.slice();
            let index = 0;
            for (const p of prompts) {
                const row = document.createElement('div');
                row.className = 'branch-row';
                row.setAttribute('data-branch-id', p.id ?? 'unknown');
                row.setAttribute('data-collection', currentBranchesCollection);

                const rankLabel = `#${++index}`;
                const title = p.title || p.name || (p.is_main ? 'Main' : '(untitled)');
                const author = p.author || p.username || p.owner || '—';

                row.innerHTML = `<div class="branch-col branch-col-rank">${rankLabel}</div><div class=\"branch-col branch-col-title\">${title}</div><div class=\"branch-col branch-col-author\">${author}</div>`;
                row.onclick = () => expandBranch(p.id ?? 'unknown');
                container.appendChild(row);
                const details = document.createElement('div');
                details.className = 'branch-details';
                details.setAttribute('data-branch-id', p.id ?? 'unknown');
                details.innerHTML = `<div class="branch-details-inner"><div class="editor-host" id="editor-${p.id}"></div><div class="branch-toolbar"><div class="branch-toolbar-left"><div class="file-tabs" id="fileTabs-${p.id}"></div><button class="login-btn" id="addFile-${p.id}">Add file</button></div><div class="branch-toolbar-right"><select id="modelSelect-${p.id}"><option value="Auto" selected>Auto</option><option value="claude-4-sonnet">claude-4-sonnet</option><option value="gpt-5">gpt-5</option><option value="gemini-2.5-pro">gemini-2.5-pro</option><option value="gemini-2.5-flash">gemini-2.5-flash</option><option value="claude-3.5-sonnet">claude-3.5-sonnet</option><option value="sonic">sonic</option></select><button class="btn-evaluate" id="runBtn-${p.id}">Evaluate</button></div></div></div>`;
                container.appendChild(details);
            }
        }
    }

    function expandBranch(id) {
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
                // Lazy init editor after expand
                ensureEditorForBranch(id).catch(() => {});
                // Load and display latest evaluation in the sidebar
                const prompt = cachedPrompts.find(p => p.id === id);
                if (prompt) {
                    tryLoadLatestEvaluationForPrompt(prompt);
                } else {
                    setSidebarSummary('');
                }
                // Bind toolbar handlers + load files
                bindToolbarHandlers(id);
                loadFilesForBranch(id).catch(() => {});
            }
        } else {
            // Branch was closed, clear the sidebar evaluation
        setSidebarSummary('');
        }
    }

    function createNewPrompt() {
        const container = document.getElementById('branchesContainer');
        if (!container) return;
        
        // Check if blank row already exists
        const existingBlank = container.querySelector('[data-branch-id="blank"]');
        if (existingBlank) {
            // If it exists, just expand it
            expandBranch('blank');
            return;
        }
        
        // Create blank row at the top of the branches list
        const blankRow = document.createElement('div');
        blankRow.className = 'branch-row';
        blankRow.setAttribute('data-branch-id', 'blank');
        blankRow.setAttribute('data-collection', currentBranchesCollection);
        blankRow.innerHTML = `<div class="branch-col branch-col-rank">New</div><div class="branch-col branch-col-title">New prompt — Blank</div><div class="branch-col branch-col-author">—</div>`;
        blankRow.onclick = () => expandBranch('blank');
        
        const blankDetails = document.createElement('div');
        blankDetails.className = 'branch-details';
        blankDetails.setAttribute('data-branch-id', 'blank');
        blankDetails.innerHTML = `<div class="branch-details-inner"><div class="editor-host" id="editor-blank"></div><div class="branch-toolbar"><div class="branch-toolbar-left"><div class="file-tabs" id="fileTabs-blank"></div><button class="login-btn" id="addFile-blank">Add file</button></div><div class="branch-toolbar-right"><select id="modelSelect-blank"><option value="Auto" selected>Auto</option><option value="claude-4-sonnet">claude-4-sonnet</option><option value="gpt-5">gpt-5</option><option value="gemini-2.5-pro">gemini-2.5-pro</option><option value="gemini-2.5-flash">gemini-2.5-flash</option><option value="claude-3.5-sonnet">claude-3.5-sonnet</option><option value="sonic">sonic</option></select><button class="btn-evaluate" id="runBtn-blank">Evaluate</button></div></div></div>`;
        
        // Insert at the beginning of the branches list
        container.insertBefore(blankDetails, container.firstChild);
        container.insertBefore(blankRow, container.firstChild);
        
        // Automatically expand the new blank prompt
        expandBranch('blank');
    }

    function filterBranches(searchTerm) {
        const container = document.getElementById('branchesContainer');
        if (!container) return;
        
        const allRows = container.querySelectorAll('.branch-row');
        const allDetails = container.querySelectorAll('.branch-details');
        
        if (!searchTerm) {
            // Show all rows when search is empty
            allRows.forEach(row => row.style.display = 'flex');
            allDetails.forEach(detail => detail.style.display = 'block');
            return;
        }
        
        allRows.forEach((row, index) => {
            const title = row.querySelector('.branch-col-title')?.textContent?.toLowerCase() || '';
            const author = row.querySelector('.branch-col-author')?.textContent?.toLowerCase() || '';
            const rank = row.querySelector('.branch-col-rank')?.textContent?.toLowerCase() || '';
            
            const matches = title.includes(searchTerm) || 
                           author.includes(searchTerm) || 
                           rank.includes(searchTerm);
            
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

    function expandPanel(target) {
        panels.forEach(panel => panel.classList.remove('expanded'));
        target.classList.add('expanded');
    }

    function getEditorValue(branchId) {
        const ed = window.editorByBranchId.get(branchId);
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

    function ensureModal() {
        if (modal) return;
        modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0,0,0,0.35)';
        modal.style.display = 'none';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000';
        modal.innerHTML = `<div style="background:var(--color-bg); color:var(--color-text); width:min(900px,92vw); height:min(70vh,560px); border:1px solid var(--color-text); padding:12px; display:flex; flex-direction:column; gap:8px;"><div style="display:flex; justify-content:space-between; align-items:center; gap:8px;"><strong id="modalTitle">Edit file</strong><input id="modalFilename" placeholder="filename.ext" style="flex:1; padding:6px; border:1px solid var(--color-text); background:var(--color-bg); color:var(--color-text);"/><div><button id="modalClose" class="login-btn">Close</button></div></div><div id="modalEditor" style="flex:1; border:1px solid var(--color-text);"></div><div style="display:flex; justify-content:flex-end; gap:8px;"><button id="modalSave" class="login-btn">Save</button></div></div>`;
        document.body.appendChild(modal);
        modalFilenameInput = modal.querySelector('#modalFilename');
        modal.querySelector('#modalClose').onclick = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
        modal.querySelector('#modalSave').onclick = () => {
            const value = window.modalEditor ? window.modalEditor.getValue() : '';
            const fname = (modalFilenameInput.value || '').trim() || 'untitled.txt';
            const files = filesByBranch.get(currentBranchForModal) || [];
            if (editingIndex >= 0) {
                files[editingIndex].content = value;
                files[editingIndex].filename = fname;
            } else {
                files.push({ filename: fname, content: value, file_type: 'text' });
            }
            filesByBranch.set(currentBranchForModal, files);
            renderFiles(currentBranchForModal);
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };
    }

    function ensureNameModal() {
        if (nameModal) return;
        nameModal = document.createElement('div');
        nameModal.className = 'name-modal-overlay';
        nameModal.style.position = 'fixed';
        nameModal.style.inset = '0';
        nameModal.style.background = 'rgba(0, 0, 0, 0.35)';
        nameModal.style.display = 'none';
        nameModal.style.alignItems = 'center';
        nameModal.style.justifyContent = 'center';
        nameModal.style.zIndex = '10001';
        
        nameModal.innerHTML = `
            <div class="name-modal-content">
                <div class="name-modal-header">
                    <h3>Name Your New Prompt</h3>
                </div>
                <div class="name-modal-body">
                    <input type="text" id="promptNameInput" placeholder="Enter prompt name..." class="name-modal-input" />
                </div>
                <div class="name-modal-footer">
                    <button id="nameModalCancel" class="login-btn">Cancel</button>
                    <button id="nameModalSave" class="btn-evaluate">Submit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(nameModal);
        nameInput = nameModal.querySelector('#promptNameInput');
        
        // Close on outside click
        nameModal.addEventListener('click', (e) => {
            if (e.target === nameModal) {
                closeNameModal();
            }
        });
        
        // Keyboard shortcuts
        nameInput.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key === 'Enter') {
                e.preventDefault();
                savePromptName();
            } else if (e.key === 'Escape') {
                closeNameModal();
            }
        });
        
        // Button handlers
        nameModal.querySelector('#nameModalSave').onclick = savePromptName;
        nameModal.querySelector('#nameModalCancel').onclick = closeNameModal;
    }

    function showNameModal() {
        ensureNameModal();
        nameModal.style.display = 'flex';
        nameInput.value = '';
        nameInput.focus();
        document.body.style.overflow = 'hidden';
    }

    function closeNameModal() {
        if (nameModal) {
            nameModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    function savePromptName() {
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.focus();
            return;
        }
        closeNameModal();
        // Continue with evaluation using the name
        continueEvaluationWithName(name);
    }

    async function createEvaluationRequest(prompt, modelEl, branchId) {
        try {
            setSidebarSummary('Creating request...');
            const files = filesByBranch.get(branchId) || [];
            const originalIds = originalFileIdsByBranch.get(branchId) || [];
            const keptIds = files.map(f => f._id).filter(Boolean);
            const exclude = originalIds.filter(id => !keptIds.includes(id));
            const newFiles = files.filter(f => !f._id).map(f => ({ filename: f.filename, content: f.content, file_type: f.file_type || 'text' }));
            const payload = {
                prompt,
                status: 'pending',
                created_at: new Date().toISOString(),
                selected_model: modelEl ? (modelEl.value || 'Auto Model') : 'Auto Model',
                prompt_id: branchId,
                source_prompt_id: branchId,
                new_files: newFiles,
                exclude_file_ids: exclude
            };
            if (!window.db || !window.db.collection) { setSidebarSummary('Database not available.'); return; }
            const ref = await window.db.collection('evaluation_requests').add(payload);
            setSidebarSummary('Queued. Processing...');
            const docRef = window.db.collection('evaluation_requests').doc(ref.id);
            docRef.onSnapshot((snap) => {
                if (!snap.exists) return;
                const data = snap.data() || {};
                const st = data.status || 'unknown';
                if (st === 'processing') {
                    setSidebarSummary('Processing...');
                } else if (st === 'done') {
                    const result = data.result || {};
                    displayEvaluationInSidebar(result);
                } else if (st === 'error') {
                    setSidebarSummary(data.error || '(unknown error)');
                }
            });
        } catch (e) {
            setSidebarSummary('Error creating request');
        }
    }

    function continueEvaluationWithName(name) {
        if (!window.pendingEvaluation) return;
        
        const { prompt, model, branchId } = window.pendingEvaluation;
        delete window.pendingEvaluation;
        
        // Create a mock modelEl for the createEvaluationRequest function
        const mockModelEl = { value: model };
        
        // Continue with evaluation using the provided name
        createEvaluationRequest(prompt, mockModelEl, branchId);
    }

    function openFileModal(branchId, idx) {
        ensureModal();
        currentBranchForModal = branchId;
        editingIndex = (typeof idx === 'number') ? idx : -1;
        const files = filesByBranch.get(branchId) || [];
        const f = editingIndex >= 0 ? files[editingIndex] : { filename: '', content: '' };
        modal.querySelector('#modalTitle').textContent = editingIndex >= 0 ? `Edit: ${f.filename || 'untitled.txt'}` : 'Add file';
        modalFilenameInput.value = f.filename || '';
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loadMonaco().then(() => {
            if (window.modalEditor) { try { window.modalEditor.dispose(); } catch {} window.modalEditor = null; }
            window.modalEditor = window.monaco.editor.create(modal.querySelector('#modalEditor'), {
                value: f.content || '',
                language: 'markdown',
                automaticLayout: true,
                wordWrap: 'on',
                theme: window.themeManager && window.themeManager.isDark ? 'vs-dark' : 'vs',
                fontFamily: 'OffBit, monospace',
                fontWeight: 'bold',
                fontSize: 21,
                minimap: { enabled: false }
            });
        }).catch(() => {});
    }

    function renderFiles(branchId) {
        const container = document.getElementById(`fileTabs-${branchId}`);
        if (!container) return;
        container.innerHTML = '';
        const files = filesByBranch.get(branchId) || [];
        if (!files.length) {
            const empty = document.createElement('span');
            empty.textContent = 'No files';
            empty.style.color = 'var(--color-text-muted)';
            empty.style.fontStyle = 'italic';
            container.appendChild(empty);
            return;
        }
        files.forEach((f, idx) => {
            const tab = document.createElement('div');
            tab.className = 'file-tab';
            tab.style.display = 'flex';
            tab.style.alignItems = 'center';
            tab.style.gap = '6px';
            const name = document.createElement('span');
            name.textContent = f.filename || 'untitled.txt';
            const del = document.createElement('span');
            del.textContent = '×';
            del.style.cursor = 'pointer';
            del.onclick = (ev) => { ev.stopPropagation(); files.splice(idx, 1); filesByBranch.set(branchId, files); renderFiles(branchId); };
            tab.appendChild(name);
            tab.appendChild(del);
            tab.onclick = () => openFileModal(branchId, idx);
            container.appendChild(tab);
        });
    }

    async function loadFilesForBranch(branchId) {
        try {
            if (!window.db || !window.db.collection) {
                filesByBranch.set(branchId, []);
                originalFileIdsByBranch.set(branchId, []);
                renderFiles(branchId);
                return;
            }
            const snap = await window.db.collection('prompt_files').where('prompt_id', '==', branchId).get();
            const files = [];
            const originalIds = [];
            snap.forEach(doc => {
                const d = doc.data() || {};
                files.push({ _id: doc.id, filename: d.filename || 'untitled.txt', content: d.content || '', file_type: d.file_type || 'text' });
                originalIds.push(doc.id);
            });
            filesByBranch.set(branchId, files);
            originalFileIdsByBranch.set(branchId, originalIds);
            renderFiles(branchId);
        } catch (e) {
            filesByBranch.set(branchId, []);
            originalFileIdsByBranch.set(branchId, []);
            renderFiles(branchId);
        }
    }

    function bindToolbarHandlers(branchId) {
        const addBtn = document.getElementById(`addFile-${branchId}`);
        if (addBtn) {
            addBtn.onclick = () => {
                const files = filesByBranch.get(branchId) || [];
                if (files.length >= 3) { setSidebarSummary('Max 3 files per prompt.'); return; }
                openFileModal(branchId, -1);
            };
        }
        const runBtn = document.getElementById(`runBtn-${branchId}`);
        if (runBtn) {
            runBtn.onclick = async () => {
                const prompt = (getEditorValue(branchId) || '').trim();
                const modelEl = document.getElementById(`modelSelect-${branchId}`);
                if (!prompt) { setSidebarSummary('Please enter a prompt.'); return; }
                
                // For blank prompts, ask for a name first
                if (branchId === 'blank') {
                    showNameModal();
                    // Store the evaluation data to continue later
                    window.pendingEvaluation = {
                        prompt,
                        model: modelEl ? (modelEl.value || 'Auto Model') : 'Auto Model',
                        branchId
                    };
                    return;
                }
                
                // For existing branches, proceed directly
                await createEvaluationRequest(prompt, modelEl, branchId);
            };
        }
    }

    // ===== Simple Evaluation Rendering System =====
    function setSidebarSummary(html) {
        const el = document.getElementById('evalSummary');
        if (!el) return;
        if (!html) {
            el.innerHTML = '';
            return;
        }
        el.innerHTML = html;
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safe(obj, path, fallback) {
        try { return path.reduce((o, k) => (o || {})[k], obj) ?? fallback; } catch { return fallback; }
    }

    function formatSummary(result) {
        const total = safe(result, ['score_total'], 'N/A');
        const acc = safe(result, ['accuracy'], 'N/A');
        const rel = safe(result, ['reliability'], 'N/A');
        const cmp = safe(result, ['complexity'], 'N/A');
        const rationaleAcc = safe(result, ['rationales','accuracy'], safe(result, ['rationale_accuracy'], ''));
        const rationaleRel = safe(result, ['rationales','reliability'], safe(result, ['rationale_reliability'], ''));
        const rationaleCmp = safe(result, ['rationales','complexity'], safe(result, ['rationale_complexity'], ''));
        const weaknesses = safe(result, ['weaknesses'], '');
        const suggestions = safe(result, ['suggestions'], '');
        let html = '';
        html += `<div class=\"headline\">Total: ${escapeHtml(total)}</div>`;
        html += `<div class=\"metric\">Accuracy — (${escapeHtml(acc)})</div>`;
        if (rationaleAcc) html += `<div class=\"block\">${escapeHtml(rationaleAcc)}</div>`;
        html += `<div class=\"metric\">Complexity — (${escapeHtml(cmp)})</div>`;
        if (rationaleCmp) html += `<div class=\"block\">${escapeHtml(rationaleCmp)}</div>`;
        html += `<div class=\"metric\">Reliability — (${escapeHtml(rel)})</div>`;
        if (rationaleRel) html += `<div class=\"block\">${escapeHtml(rationaleRel)}</div>`;
        if (weaknesses) html += `<div class=\"metric\">Weaknesses</div><div class=\"block\">${escapeHtml(weaknesses)}</div>`;
        if (suggestions) html += `<div class=\"metric\">Suggestions</div><div class=\"block\">${escapeHtml(suggestions)}</div>`;
        return { html };
    }

    function displayEvaluationInSidebar(evaluationLike) {
        if (!evaluationLike) { setSidebarSummary(''); return; }
        const summary = formatSummary(evaluationLike);
        setSidebarSummary(summary.html);
    }

    function hasRationales(obj) {
        if (!obj) return false;
        const rA = safe(obj, ['rationales','accuracy'], safe(obj, ['rationale_accuracy'], ''));
        const rR = safe(obj, ['rationales','reliability'], safe(obj, ['rationale_reliability'], ''));
        const rC = safe(obj, ['rationales','complexity'], safe(obj, ['rationale_complexity'], ''));
        const weak = safe(obj, ['weaknesses'], '');
        const sugg = safe(obj, ['suggestions'], '');
        return Boolean((rA && rA.trim()) || (rR && rR.trim()) || (rC && rC.trim()) || (weak && weak.trim()) || (sugg && sugg.trim()));
    }

    function parseIso(dateStr) {
        try { return new Date(dateStr).getTime() || 0; } catch { return 0; }
    }

    function loadFromEvaluationRequestsPreferDetailed(promptId) {
        return new Promise((resolve) => {
            if (!window.db || !promptId) return resolve(null);
            try {
                const reqs = window.db.collection('evaluation_requests')
                    .where('prompt_id', '==', promptId)
                    .limit(20);
                reqs.get().then((snap) => {
                    const candidates = [];
                    snap.forEach((d) => {
                        const data = d.data() || {};
                        if ((data.status || '') === 'done' && data.result) {
                            candidates.push({ created_at: data.created_at, result: data.result });
                        }
                    });
                    candidates.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
                    const results = candidates.map(c => c.result);
                    const rich = results.find(hasRationales) || results[0] || null;
                    if (rich) return resolve(rich);
                    const reqs2 = window.db.collection('evaluation_requests')
                        .where('source_prompt_id', '==', promptId)
                        .limit(20);
                    reqs2.get().then((snap2) => {
                        const candidates2 = [];
                        snap2.forEach((d) => {
                            const data = d.data() || {};
                            if ((data.status || '') === 'done' && data.result) {
                                candidates2.push({ created_at: data.created_at, result: data.result });
                            }
                        });
                        candidates2.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
                        const results2 = candidates2.map(c => c.result);
                        const rich2 = results2.find(hasRationales) || results2[0] || null;
                        resolve(rich2);
                    }).catch(() => resolve(null));
                }).catch(() => resolve(null));
            } catch (_) { resolve(null); }
        });
    }

    function tryLoadLatestEvaluationForPrompt(prompt) {
        if (!prompt || !prompt.id) { setSidebarSummary(''); return; }
        loadFromEvaluationRequestsPreferDetailed(prompt.id)
            .then((res) => {
                if (res) {
                    displayEvaluationInSidebar(res);
                } else if (prompt.latest_evaluation && Object.keys(prompt.latest_evaluation).length > 0) {
                    displayEvaluationInSidebar(prompt.latest_evaluation);
                } else if (window.db) {
                    // Fallback to evaluations collection (client-side sort)
                    window.db.collection('evaluations')
                        .where('prompt_id', '==', prompt.id)
                        .limit(20)
                        .get()
                        .then((snap) => {
                            if (!snap.empty) {
                                const docs = [];
                                snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
                                docs.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
                                const latest = docs[0];
                                displayEvaluationInSidebar(latest);
                            } else {
                                setSidebarSummary('');
                            }
                        })
                        .catch(() => setSidebarSummary(''));
                } else {
                    setSidebarSummary('');
                }
            })
            .catch(() => setSidebarSummary(''));
    }

    // Initialize from hash
    const initial = window.location.hash?.replace('#', '');
    if (initial) {
        const found = document.querySelector(`.panel[data-panel=\"${initial}\"]`);
        if (found) expandPanel(found);
    }

    // Bind the existing "+ New Branch" button
    const newBranchBtn = document.querySelector('.btn-new-branch');
    if (newBranchBtn) {
        newBranchBtn.onclick = () => createNewPrompt();
    }

    // Bind the search input
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterBranches(searchTerm);
        });
    }

    // Bind panel tab clicks
    panels.forEach(panel => {
        const tab = panel.querySelector('.panel-tab');
        if (tab) {
            tab.onclick = () => expandPanel(panel);
        }
    });

    // Try to load from Firestore if available; otherwise render empty
    async function fetchFromCollection(name) {
        try {
            if (!window.db || !window.db.collection) return [];
            const snapshot = await window.db.collection(name).get();
            const items = [];
            snapshot.forEach(doc => {
                const data = doc.data() || {};
                items.push({ id: doc.id, ...data });
            });
            return items;
        } catch (err) {
            console.warn(`Failed to fetch collection ${name}:`, err);
            return [];
        }
    }

    async function fetchBranchContent(branchId) {
        if (!window.db || !window.db.collection) return '';
        try {
            const docRef = await window.db.collection(currentBranchesCollection).doc(branchId).get();
            const data = docRef.exists ? (docRef.data() || {}) : {};
            // Heuristic: prefer 'content'/'body'/'text'; fallback to pretty JSON
            const candidate = data.content || data.body || data.text || '';
            if (typeof candidate === 'string') return candidate;
            return JSON.stringify(data, null, 2);
        } catch (e) {
            console.warn('Failed to fetch branch content', branchId, e);
            return '';
        }
    }

    function loadMonaco() {
        if (window.monaco) return Promise.resolve(window.monaco);
        if (monacoReadyPromise) return monacoReadyPromise;
        monacoReadyPromise = new Promise(resolve => {
            function configureAndLoad() {
                window.require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
                window.require(['vs/editor/editor.main'], () => resolve(window.monaco));
            }
            if (typeof window.require === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
                script.onload = configureAndLoad;
                document.head.appendChild(script);
            } else {
                configureAndLoad();
            }
        });
        return monacoReadyPromise;
    }

    async function ensureEditorForBranch(branchId) {
        const existing = window.editorByBranchId.get(branchId);
        const host = document.getElementById(`editor-${branchId}`);
        if (!host) return;
        if (existing) {
            existing.layout();
            return;
        }
        const [monaco, content] = await Promise.all([
            loadMonaco(),
            fetchBranchContent(branchId)
        ]);
        
        // Check if this is a blank prompt or existing branch
        const isBlankPrompt = branchId === 'blank' || !content || content.trim() === '';
        
        if (isBlankPrompt) {
            // Single editor for blank prompts
        const editor = monaco.editor.create(host, {
            value: content || '',
            language: 'markdown',
            automaticLayout: true,
            minimap: { enabled: false },
            readOnly: false,
            theme: window.themeManager && window.themeManager.isDark ? 'vs-dark' : 'vs',
            wordWrap: 'on'
        });
        window.editorByBranchId.set(branchId, editor);
                        } else {
            // Diff editor for existing branches (inline, not side-by-side)
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
            window.editorByBranchId.set(branchId, {
                isDiffEditor: true,
                editor: diffEditor,
                getValue: () => modifiedModel.getValue(),
                layout: () => diffEditor.layout()
            });
        }
    }

    async function initBranches() {
        let items = [];
        // Prefer 'prompts', fallback to 'branches'
        items = await fetchFromCollection('prompts');
        if (items.length) {
            currentBranchesCollection = 'prompts';
        } else {
            items = await fetchFromCollection('branches');
            currentBranchesCollection = 'branches';
        }
        renderBranchesList(items);
    }

    // Initialize immediately, and again once Firebase is ready (compat script dispatches this)
    initBranches().catch(() => {});
    window.addEventListener('firebase-ready', () => { initBranches().catch(() => {}); });
});


