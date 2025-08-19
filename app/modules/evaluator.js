// Minimal evaluator module: init Firebase, Monaco diff, load prompts dropdown,
// evaluate -> create Firestore request, listen for result, render formatted summary

// Firebase config must be provided by config.js via window.__FIREBASE_CONFIG__
const firebaseConfig = (typeof window !== 'undefined') ? window.__FIREBASE_CONFIG__ : null;
if (!firebaseConfig) {
  throw new Error('[config] Missing window.__FIREBASE_CONFIG__. Ensure config.js is generated with Firebase credentials.');
}

let db = null;
let unsubscribe = null;
let cachedPrompts = [];
let originalFileIds = [];
let attachedFiles = [];
let promptIdToName = new Map();

let monacoReady = false;
let editorModel = null; // single editor model
let editor = null;      // single editor instance
let diffEditor = null;  // diff editor instance
let originalModel = null; // diff original
let modifiedModel = null; // diff modified
let isDiffMode = false;

function byId(id) { return document.getElementById(id); }

function initFirebase() {
  if (!window.firebase) return;
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
  } catch (e) {
    // ignore if already initialized
    db = firebase.firestore();
  }
}

function initMonaco() {
  if (!window.require) return;
  require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
  require(['vs/editor/editor.main'], function () {
    // start in single-editor (blank canvas) mode
    createSingleEditor('');
    monacoReady = true;
  });
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';
}

function disposeSingleEditor() {
  try { if (editor) { editor.dispose(); editor = null; } } catch {}
  try { if (editorModel) { editorModel.dispose(); editorModel = null; } } catch {}
}

function disposeDiffEditor() {
  try { if (diffEditor) { diffEditor.dispose(); diffEditor = null; } } catch {}
  try { if (originalModel) { originalModel.dispose(); originalModel = null; } } catch {}
  try { if (modifiedModel) { modifiedModel.dispose(); modifiedModel = null; } } catch {}
}

function createSingleEditor(initialValue) {
  const container = byId('diffContainer');
  if (!container || !window.monaco) return;
  disposeDiffEditor();
  editorModel = monaco.editor.createModel(initialValue || '', 'markdown');
  editor = monaco.editor.create(container, {
    model: editorModel,
    readOnly: false,
    wordWrap: 'on',
    theme: currentTheme(),
    automaticLayout: true,
    fontFamily: 'OffBit, monospace',
    fontWeight: 'bold',
    fontSize: 21,
    minimap: { enabled: false }
  });
  isDiffMode = false;
}

function createDiffEditor(originalText) {
  const container = byId('diffContainer');
  if (!container || !window.monaco) return;
  // Dispose any existing editors to avoid superposition
  disposeSingleEditor();
  disposeDiffEditor();
  // Clear container just in case
  try { container.innerHTML = ''; } catch {}
  
  originalModel = monaco.editor.createModel(originalText || '', 'markdown');
  modifiedModel = monaco.editor.createModel(originalText || '', 'markdown');
  diffEditor = monaco.editor.createDiffEditor(container, {
    renderSideBySide: false,
    readOnly: false,
    wordWrap: 'on',
    theme: currentTheme(),
    automaticLayout: true,
    fontFamily: 'OffBit, monospace',
    fontWeight: 'bold',
    fontSize: 21,
    minimap: { enabled: false }
  });
  diffEditor.setModel({ original: originalModel, modified: modifiedModel });
  isDiffMode = true;
}

function getCurrentEditorValue() {
  if (!monacoReady) return '';
  if (isDiffMode && modifiedModel) return modifiedModel.getValue();
  if (editorModel) return editorModel.getValue();
  return '';
}

function labelForPrompt(p) {
  const score = (p.latest_evaluation && typeof p.latest_evaluation.score_total !== 'undefined') ? p.latest_evaluation.score_total : 'N/A';
  const tag = p.is_main ? '[MAIN]' : '[BRANCH]';
  return `${tag} ${p.name || '(unnamed)'} — score: ${score}`;
}

async function renderPromptsDropdown(prompts) {
  const elStartFrom = byId('startFrom');
  if (!elStartFrom) return;
  elStartFrom.innerHTML = '';
  const optBlank = document.createElement('option');
  optBlank.value = '';
  optBlank.textContent = 'Blank (start new)';
  elStartFrom.appendChild(optBlank);
  cachedPrompts = prompts.slice();
  cachedPrompts.sort((a, b) => (b.is_main === true) - (a.is_main === true));
  promptIdToName.clear();
  for (const p of cachedPrompts) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = labelForPrompt(p);
    elStartFrom.appendChild(opt);
    promptIdToName.set(p.id, p.name || (p.is_main ? 'Main' : '(unnamed)'));
  }
  // no previous evaluation display
}

async function loadPrompts() {
  const elStartFrom = byId('startFrom');
  if (!db || !elStartFrom) return;
  elStartFrom.innerHTML = '';
  const optBlank = document.createElement('option');
  optBlank.value = '';
  optBlank.textContent = 'Blank (start new)';
  elStartFrom.appendChild(optBlank);
  try {
    const snap = await db.collection('prompts').get();
    const prompts = [];
    snap.forEach(doc => { const data = doc.data() || {}; prompts.push({ id: doc.id, ...data }); });
    renderPromptsDropdown(prompts);
  } catch (e) { /* noop */ }
}

function renderPrevEvalForPrompt(p) {
  const elPrevEval = byId('prevEval');
  if (!elPrevEval) return;
  const ev = p && p.latest_evaluation ? p.latest_evaluation : null;
  if (!ev) { elPrevEval.textContent = ''; return; }
  const total = typeof ev.score_total !== 'undefined' ? ev.score_total : 'N/A';
  const a = typeof ev.accuracy !== 'undefined' ? ev.accuracy : 'N/A';
  const r = typeof ev.reliability !== 'undefined' ? ev.reliability : 'N/A';
  const c = typeof ev.complexity !== 'undefined' ? ev.complexity : 'N/A';
  elPrevEval.textContent = `Previous evaluation — Total: ${total} · A:${a} R:${r} C:${c}`;
}

function renderFiles() {
  const elFileTabs = byId('fileTabs');
  if (!elFileTabs) return;
  elFileTabs.innerHTML = '';
  if (!attachedFiles.length) {
    const span = document.createElement('span');
    span.textContent = 'No files';
    elFileTabs.appendChild(span);
    return;
  }
  attachedFiles.forEach((f, idx) => {
    const tab = document.createElement('div');
    tab.style.display = 'flex';
    tab.style.alignItems = 'center';
    tab.style.gap = '6px';
    tab.style.padding = '6px 10px';
    tab.style.border = '1px solid var(--color-text)';
    tab.style.cursor = 'pointer';
    const name = document.createElement('span');
    name.textContent = f.filename || 'untitled.txt';
    const del = document.createElement('span');
    del.textContent = '×';
    del.style.cursor = 'pointer';
    del.onclick = (ev) => { ev.stopPropagation(); attachedFiles.splice(idx, 1); renderFiles(); };
    tab.appendChild(name);
    tab.appendChild(del);
    tab.onclick = () => openFileModal(idx);
    elFileTabs.appendChild(tab);
  });
}

// Simple modal with Monaco for file editing/creation
let modal, modalEditor, editingIndex = -1, modalFilenameInput;

function ensureModal() {
  if (modal) return;
  modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.background = 'rgba(0,0,0,0.35)';
  modal.style.display = 'none';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';
  modal.innerHTML = '<div id="modalContent" style="background:var(--color-bg); color:var(--color-text); width: min(900px, 92vw); height: min(70vh, 560px); border:1px solid var(--color-text); padding: 12px; display:flex; flex-direction:column; gap:8px;"><div style="display:flex; justify-content:space-between; align-items:center; gap:8px;"><strong id="modalTitle">Edit file</strong><input id="modalFilename" placeholder="filename.ext" style="flex:1; padding:6px; border:1px solid var(--color-text); background:var(--color-bg); color:var(--color-text);"/><div><button id="modalClose" class="login-btn">Close</button></div></div><div id="modalEditor" style="flex:1; border:1px solid var(--color-text);"></div><div style="display:flex; justify-content:flex-end; gap:8px;"><button id="modalSave" class="login-btn">Save</button></div></div>';
  document.body.appendChild(modal);
  modalFilenameInput = modal.querySelector('#modalFilename');
  modal.querySelector('#modalClose').onclick = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
  modal.querySelector('#modalSave').onclick = () => {
    const value = modalEditor ? modalEditor.getValue() : '';
    const fname = (modalFilenameInput.value || '').trim() || 'untitled.txt';
    if (editingIndex >= 0) {
      attachedFiles[editingIndex].content = value;
      attachedFiles[editingIndex].filename = fname;
    } else {
      attachedFiles.push({ filename: fname, content: value, file_type: 'text' });
    }
    renderFiles();
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };
}

function openFileModal(idx) {
  ensureModal();
  editingIndex = (typeof idx === 'number') ? idx : -1;
  const f = editingIndex >= 0 ? attachedFiles[editingIndex] : { filename: '', content: '' };
  modal.querySelector('#modalTitle').textContent = editingIndex >= 0 ? `Edit: ${f.filename}` : 'Add file';
  modalFilenameInput.value = f.filename || '';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  require(['vs/editor/editor.main'], function () {
    if (modalEditor) { modalEditor.dispose(); modalEditor = null; }
    modalEditor = monaco.editor.create(modal.querySelector('#modalEditor'), { 
      value: f.content || '', 
      language: 'markdown', 
      automaticLayout: true, 
      wordWrap: 'on', 
      theme: currentTheme(),
      fontFamily: 'OffBit, monospace',
      fontWeight: 'bold',
      fontSize: 21,
      minimap: { enabled: false }
    });
  });
}

function setupEvents() {
  const elStartFrom = byId('startFrom');
  const elAddFile = byId('addFileBtn');
  const elRun = byId('runBtn');
  const elResult = byId('evalSummary');
  const elModel = byId('modelSelect');

  if (elStartFrom) {
    elStartFrom.addEventListener('change', () => {
      const id = elStartFrom.value;
      if (!id) {
        if (monacoReady) { 
          disposeDiffEditor();
          const container = byId('diffContainer');
          try { if (container) container.innerHTML = ''; } catch {}
          createSingleEditor(''); 
        }
        attachedFiles = [];
        originalFileIds = [];
        renderFiles();
        setSidebarSummary('', null);
        collapseSidebar();
        return;
      }
      const match = cachedPrompts.find(p => p.id === id);
      if (match) {
        if (monacoReady) { createDiffEditor(match.content || ''); }
        // load files
        db.collection('prompt_files').where('prompt_id', '==', match.id).get().then(snap => {
          attachedFiles = [];
          originalFileIds = [];
          snap.forEach(doc => {
            const d = doc.data() || {};
            attachedFiles.push({ _id: doc.id, filename: d.filename || 'untitled.txt', content: d.content || '', file_type: d.file_type || 'text' });
            originalFileIds.push(doc.id);
          });
          renderFiles();
        });
        // load latest evaluation into sidebar
        tryLoadLatestEvaluationForPrompt(match);
      }
    });
  }

  if (elAddFile) {
    elAddFile.addEventListener('click', () => {
      if (attachedFiles.length >= 3) { if (elResult) elResult.textContent = 'Max 3 files per prompt.'; return; }
      openFileModal(-1);
    });
  }

  if (elRun) {
    elRun.addEventListener('click', async () => {
      const prompt = (getCurrentEditorValue() || '').trim();
      if (!prompt) { 
        if (elResult) { elResult.textContent = 'Please enter a prompt.'; elResult.classList.add('eval-status'); }
        return; 
      }
      try {
        // Reflect processing state in sidebar-bottom and hide copy button
        if (elResult) { elResult.textContent = 'Creating request...'; elResult.classList.add('eval-status'); }
        
        // Show chevron when starting evaluation
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
          sidebarToggle.style.display = 'inline-block';
        }
        
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        const selectedId = elStartFrom ? (elStartFrom.value || null) : null;
        let branchName = null;
        if (!selectedId) {
          branchName = await askBranchName();
          if (!branchName) { 
            if (elResult) { elResult.textContent = 'Name cancelled.'; elResult.classList.add('eval-status'); }
            return; 
          }
        } else {
          const parentName = promptIdToName.get(selectedId) || 'Main';
          const ts = new Date().toISOString().slice(0,10).replaceAll('-', '');
          branchName = `Branch of ${parentName} - ${ts}`;
        }

        const payload = { prompt, status: 'pending', created_at: new Date().toISOString() };
        if (selectedId) payload.source_prompt_id = selectedId;
        if (branchName) payload.branch_name = branchName;
        payload.selected_model = elModel ? (elModel.value || 'Auto Model') : 'Auto Model';
        const newFiles = attachedFiles.filter(f => !f._id).map(f => ({ filename: f.filename, content: f.content, file_type: f.file_type || 'text' }));
        payload.new_files = newFiles;
        if (selectedId) {
          const keptIds = attachedFiles.map(f => f._id).filter(Boolean);
          const exclude = originalFileIds.filter(id => !keptIds.includes(id));
          payload.exclude_file_ids = exclude;
        }

        const docRef = await db.collection('evaluation_requests').add(payload);
        if (elResult) { elResult.textContent = 'Queued. Processing...'; elResult.classList.add('eval-status'); }

        const elSummary = byId('evalSummary');
        unsubscribe = docRef.onSnapshot((snap) => {
          if (!snap.exists) return;
          const data = snap.data() || {};
          const st = data.status || 'unknown';
          if (st === 'processing') {
            if (elResult) { elResult.textContent = 'Processing...'; elResult.classList.add('eval-status'); }
            
          } else if (st === 'done') {
            const result = data.result || {};
            const summary = formatSummary(result);
            if (elSummary) {
              elSummary.innerHTML = summary.html;
              elSummary.classList.remove('eval-status');
              elSummary.setAttribute('data-json', JSON.stringify(result, null, 2));
            }
            
            // Keep chevron visible when there's a result
            const sidebarToggle = document.getElementById('sidebar-toggle');
            if (sidebarToggle) {
              sidebarToggle.style.display = 'inline-block';
            }
          } else if (st === 'error') {
            if (elSummary) { elSummary.textContent = data.error || '(unknown error)'; elSummary.classList.add('eval-status'); }
            
            // Hide chevron on error since there's no useful content
            const sidebarToggle = document.getElementById('sidebar-toggle');
            if (sidebarToggle) {
              sidebarToggle.style.display = 'none';
            }
          }
        });
      } catch (e) {
        if (elResult) { elResult.textContent = 'Error creating request'; elResult.classList.add('eval-status'); }
      }
    });
  }
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

function formatSummary(result) {
  // Richer formatted summary from evaluator result (HTML for styled sections)
  const total = safe(result, ['score_total'], 'N/A');
  const acc = safe(result, ['accuracy'], 'N/A');
  const rel = safe(result, ['reliability'], 'N/A');
  const cmp = safe(result, ['complexity'], 'N/A');
  const tokens = safe(result, ['usage', 'total_tokens'], 'N/A');
  const latencyMs = safe(result, ['latency_ms'], 'N/A');
  const model = safe(result, ['model'], 'AutoModel');
  const id = safe(result, ['request_id'], '-');
  const rationaleAcc = safe(result, ['rationales', 'accuracy'], safe(result, ['rationale_accuracy'], ''));
  const rationaleRel = safe(result, ['rationales', 'reliability'], safe(result, ['rationale_reliability'], ''));
  const rationaleCmp = safe(result, ['rationales', 'complexity'], safe(result, ['rationale_complexity'], ''));
  const weaknesses = safe(result, ['weaknesses'], '');
  const suggestions = safe(result, ['suggestions'], '');
  let html = '';
  html += `<div class="headline">Total: ${escapeHtml(total)}</div>`;
  // Sections in requested order: Accuracy, Complexity, Reliability
  html += `<div class="metric">Accuracy — (${escapeHtml(acc)})</div>`;
  if (rationaleAcc) html += `<div class="block">${escapeHtml(rationaleAcc)}</div>`;
  html += `<div class="metric">Complexity — (${escapeHtml(cmp)})</div>`;
  if (rationaleCmp) html += `<div class="block">${escapeHtml(rationaleCmp)}</div>`;
  html += `<div class="metric">Reliability — (${escapeHtml(rel)})</div>`;
  if (rationaleRel) html += `<div class="block">${escapeHtml(rationaleRel)}</div>`;
  if (weaknesses) html += `<div class="metric">Weaknesses</div><div class="block">${escapeHtml(weaknesses)}</div>`;
  if (suggestions) html += `<div class="metric">Suggestions</div><div class="block">${escapeHtml(suggestions)}</div>`;
  // Footer meta kept minimal or removed per request; omit tokens/latency/request line
  return { html };
}

function safe(obj, path, fallback) {
  try {
    return path.reduce((o, k) => (o || {})[k], obj) ?? fallback;
  } catch { return fallback; }
}

function livePrompts() {
  if (!db) return;
  db.collection('prompts').onSnapshot((snap) => {
    const prompts = [];
    snap.forEach(doc => { const data = doc.data() || {}; prompts.push({ id: doc.id, ...data }); });
    renderPromptsDropdown(prompts);
  });
}

function init() {
  initFirebase();
  initMonaco();
  loadPrompts();
  setupEvents();
  livePrompts();
  
  // Hide chevron initially since sidebar is empty
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.style.display = 'none';
  }
  
  // Listen for theme changes to update Monaco editors
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        updateMonacoThemes();
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
}

function updateMonacoThemes() {
  const newTheme = currentTheme();
  if (editor) {
    monaco.editor.setTheme(newTheme);
  }
  if (diffEditor) {
    monaco.editor.setTheme(newTheme);
  }
  if (modalEditor) {
    monaco.editor.setTheme(newTheme);
  }
}

function setSidebarSummary(text, jsonString) {
  const elSummary = byId('evalSummary');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (elSummary) {
    elSummary.textContent = text || '';
    if (jsonString) {
      elSummary.setAttribute('data-json', jsonString);
    } else {
      elSummary.removeAttribute('data-json');
    }
  }
  if (sidebarToggle) {
    sidebarToggle.style.display = text ? 'inline-block' : 'none';
  }
}

function collapseSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.remove('sidebar--expanded');
  }
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.textContent = '▲';
    sidebarToggle.setAttribute('aria-expanded', 'false');
  }
}

function displayEvaluationInSidebar(evaluationLike) {
  console.log('📱 displayEvaluationInSidebar called with:', evaluationLike);
  if (!evaluationLike) { 
    console.log('❌ No evaluation data, clearing sidebar');
    setSidebarSummary('', null); 
    return; 
  }
  const summary = formatSummary(evaluationLike);
  console.log('📋 Formatted summary:', summary);
  const elSummary = byId('evalSummary');
  if (elSummary) {
    elSummary.innerHTML = summary.html;
    elSummary.classList.remove('eval-status');
    elSummary.setAttribute('data-json', JSON.stringify(evaluationLike, null, 2));
    console.log('✅ Sidebar updated with evaluation data');
  }
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) sidebarToggle.style.display = 'inline-block';
}

function hasRationales(obj) {
  if (!obj) return false;
  const rA = safe(obj, ['rationales','accuracy'], safe(obj, ['rationale_accuracy'], ''));
  const rR = safe(obj, ['rationales','reliability'], safe(obj, ['rationale_reliability'], ''));
  const rC = safe(obj, ['rationales','complexity'], safe(obj, ['rationale_complexity'], ''));
  const weak = safe(obj, ['weaknesses'], '');
  const sugg = safe(obj, ['suggestions'], '');
  const hasRich = Boolean((rA && rA.trim()) || (rR && rR.trim()) || (rC && rC.trim()) || (weak && weak.trim()) || (sugg && sugg.trim()));
  console.log('🔍 hasRationales check:', { 
    obj: obj ? 'exists' : 'null', 
    rA: rA ? 'exists' : 'missing', 
    rR: rR ? 'exists' : 'missing', 
    rC: rC ? 'exists' : 'missing', 
    weak: weak ? 'exists' : 'missing', 
    sugg: sugg ? 'exists' : 'missing',
    hasRich 
  });
  return hasRich;
}

function parseIso(dateStr) {
  try { return new Date(dateStr).getTime() || 0; } catch { return 0; }
}

function tryLoadLatestEvaluationForPrompt(prompt) {
  console.log('🔍 tryLoadLatestEvaluationForPrompt called with:', prompt);
  if (!prompt || !prompt.id) {
    console.log('❌ No prompt or prompt.id, clearing sidebar');
    setSidebarSummary('', null);
    return;
  }
  // Prefer detailed results from evaluation_requests → prompt_id first
  console.log('📊 Loading detailed results from evaluation_requests for prompt_id:', prompt.id);
  loadFromEvaluationRequestsPreferDetailed(prompt.id)
    .then((res) => {
      console.log('📋 Result from evaluation_requests:', res);
      if (res) {
        console.log('✅ Found detailed result, displaying in sidebar');
        displayEvaluationInSidebar(res);
      } else if (prompt.latest_evaluation && Object.keys(prompt.latest_evaluation).length > 0) {
        console.log('📊 Fallback: using prompt.latest_evaluation:', prompt.latest_evaluation);
        displayEvaluationInSidebar(prompt.latest_evaluation);
      } else {
        console.log('📊 Fallback: querying evaluations collection (no orderBy)');
        // Fallback: most recent evaluation doc (client-side sort)
        db.collection('evaluations')
          .where('prompt_id', '==', prompt.id)
          .limit(20)
          .get()
          .then((snap) => {
            if (!snap.empty) {
              const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              docs.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
              const latest = docs[0];
              console.log('📊 Chosen evaluations doc (client-sorted):', latest);
              displayEvaluationInSidebar(latest);
            } else {
              console.log('❌ No evaluations found, clearing sidebar');
              setSidebarSummary('', null);
            }
          })
          .catch((err) => {
            console.error('❌ Error querying evaluations:', err);
            setSidebarSummary('', null);
          });
      }
    })
    .catch((err) => {
      console.error('❌ Error in loadFromEvaluationRequestsPreferDetailed:', err);
      setSidebarSummary('', null);
    });
}

function loadFromEvaluationRequestsPreferDetailed(promptId) {
  console.log('🔍 loadFromEvaluationRequestsPreferDetailed called for promptId:', promptId);
  return new Promise((resolve) => {
    if (!db || !promptId) {
      console.log('❌ No db or promptId, resolving null');
      return resolve(null);
    }
    // First: by prompt_id (no orderBy to avoid composite index)
    console.log('📊 Querying evaluation_requests by prompt_id (client filter/sort):', promptId);
    db.collection('evaluation_requests')
      .where('prompt_id', '==', promptId)
      .limit(20)
      .get()
      .then((snap) => {
        console.log('📊 Found evaluation_requests by prompt_id:', snap.size, 'documents');
        const candidates = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          if ((data.status || '') === 'done' && data.result) {
            candidates.push({ created_at: data.created_at, result: data.result });
          }
        });
        // Client-side sort by created_at desc
        candidates.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
        const results = candidates.map(c => c.result);
        console.log('📋 Candidates with results (after filter/sort):', results.length);
        const rich = results.find(hasRationales) || results[0] || null;
        console.log('🎯 Selected result (rich first):', rich);
        if (rich) return resolve(rich);
        
        // Second: by source_prompt_id (no orderBy to avoid composite index)
        console.log('📊 Querying evaluation_requests by source_prompt_id (client filter/sort):', promptId);
        db.collection('evaluation_requests')
          .where('source_prompt_id', '==', promptId)
          .limit(20)
          .get()
          .then((snap2) => {
            console.log('📊 Found evaluation_requests by source_prompt_id:', snap2.size, 'documents');
            const candidates2 = [];
            snap2.forEach((d) => {
              const data = d.data() || {};
              if ((data.status || '') === 'done' && data.result) {
                candidates2.push({ created_at: data.created_at, result: data.result });
              }
            });
            candidates2.sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at));
            const results2 = candidates2.map(c => c.result);
            console.log('📋 Source candidates with results (after filter/sort):', results2.length);
            const rich2 = results2.find(hasRationales) || results2[0] || null;
            console.log('🎯 Final selected result:', rich2);
            resolve(rich2);
          })
          .catch((err) => {
            console.error('❌ Error querying by source_prompt_id:', err);
            resolve(null);
          });
      })
      .catch((err) => {
        console.error('❌ Error querying by prompt_id:', err);
        resolve(null);
      });
  });
}

// ---- Simple Name Input Modal (replaces native prompt) ----
let nameModal = null;
let nameInput = null;
let nameError = null;

function ensureNameModal() {
  if (nameModal) return;
  nameModal = document.createElement('div');
  nameModal.style.position = 'fixed';
  nameModal.style.inset = '0';
  nameModal.style.background = 'rgba(0,0,0,0.35)';
  nameModal.style.display = 'none';
  nameModal.style.alignItems = 'center';
  nameModal.style.justifyContent = 'center';
  nameModal.style.zIndex = '10000';
  nameModal.innerHTML = `
    <div style="background:var(--color-bg); color:var(--color-text); width:min(520px,92vw); border:1px solid var(--color-text); box-shadow:2px 2px 0 0 var(--color-text); padding:16px; display:flex; flex-direction:column; gap:10px;">
      <div style="font-weight:700;">Name this new prompt (≤ 20 chars)</div>
      <input id="branchNameInput" maxlength="20" placeholder="e.g., homepage-v1" style="padding:10px; border:1px solid var(--color-text); background:var(--color-bg); color:var(--color-text); font-family:var(--font-family-base); font-weight:700;" />
      <div id="branchNameError" style="color:var(--color-primary); min-height:18px; font-size:12px;"></div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="branchNameCancel" class="login-btn">Cancel</button>
        <button id="branchNameOk" class="login-btn">OK</button>
      </div>
    </div>`;
  document.body.appendChild(nameModal);
  nameInput = nameModal.querySelector('#branchNameInput');
  nameError = nameModal.querySelector('#branchNameError');
}

function askBranchName() {
  ensureNameModal();
  return new Promise((resolve) => {
    nameError.textContent = '';
    nameInput.value = '';
    nameModal.style.display = 'flex';
    nameInput.focus();

    const cleanup = () => {
      nameModal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      nameInput.removeEventListener('keydown', onKey);
    };

    const onOk = () => {
      const v = (nameInput.value || '').trim();
      if (!v || v.length > 20) {
        nameError.textContent = 'Required, ≤ 20 chars.';
        return;
      }
      cleanup();
      resolve(v);
    };
    const onCancel = () => { cleanup(); resolve(null); };
    const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };

    const okBtn = nameModal.querySelector('#branchNameOk');
    const cancelBtn = nameModal.querySelector('#branchNameCancel');
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    nameInput.addEventListener('keydown', onKey);
  });
}

document.addEventListener('DOMContentLoaded', init);


