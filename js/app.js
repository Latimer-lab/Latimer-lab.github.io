(function () {
  "use strict";

  const { segments, apps } = DATA;

  const TABLE_COLUMNS = [
    { key: "name", label: "App", locked: true, defaultVisible: true, sortable: false },
    {
      key: "rating",
      label: "Rating",
      sort: "rating",
      defaultVisible: true,
      hint: "Average App Store rating (1–5 stars).",
    },
    {
      key: "review_count",
      label: "Reviews",
      sort: "review_count",
      defaultVisible: true,
      hint: "Total number of App Store ratings worldwide.",
    },
    {
      key: "revenue_last_month_usd",
      label: "Revenue / mo",
      sort: "revenue_last_month_usd",
      defaultVisible: true,
      hint: "Estimated worldwide revenue last month (Sensor Tower). Blank if not scraped yet.",
    },
    {
      key: "downloads_last_month",
      label: "Downloads / mo",
      sort: "downloads_last_month",
      defaultVisible: true,
      hint: "Estimated worldwide downloads last month (Sensor Tower).",
    },
    {
      key: "last_updated",
      label: "Last update",
      sort: "last_updated",
      defaultVisible: true,
      hint: "Time since the last App Store update.",
    },
    {
      key: "social_reliance",
      label: "Social",
      sort: "social_reliance",
      defaultVisible: false,
      hint: "How much the product depends on other users. None = solo utility · Optional = social is a bonus · Core = useless without others.",
    },
    {
      key: "ai_intensity",
      label: "AI",
      sort: "ai_intensity",
      defaultVisible: false,
      hint: "How central AI is to the product (not marketing). None · Assistive · Core · AI-native.",
    },
    {
      key: "technical_complexity",
      label: "Complexity",
      sort: "technical_complexity",
      defaultVisible: false,
      hint: "Estimated build/ops complexity. Low = local CRUD · Medium = sync/subscriptions · High = real-time or heavy backend.",
    },
    {
      key: "days_since_update",
      label: "Days since update",
      sort: "days_since_update",
      defaultVisible: false,
      hint: "Calendar days since the last App Store update.",
    },
    {
      key: "update_pace",
      label: "Update pace",
      sort: "update_rate_days",
      defaultVisible: true,
      hint: "How often the app ships updates. Based on release history when available.",
    },
    {
      key: "genre",
      label: "Genre",
      sort: "genre",
      defaultVisible: false,
      hint: "Primary App Store category.",
    },
    {
      key: "has_iap",
      label: "IAP",
      sort: "has_iap",
      defaultVisible: false,
      hint: "Whether the app offers in-app purchases.",
    },
  ];

  const SOCIAL_LABELS = { none: "None", optional: "Optional", core: "Core" };
  const AI_LABELS = { none: "None", assistive: "Assistive", core: "Core", ai_native: "AI-native" };
  const COMPLEXITY_LABELS = { low: "Low", medium: "Medium", high: "High" };

  const ENUM_ORDER = {
    social_reliance: { none: 0, optional: 1, core: 2 },
    ai_intensity: { none: 0, assistive: 1, core: 2, ai_native: 3 },
    technical_complexity: { low: 0, medium: 1, high: 2 },
  };

  const MOCK_ROOT_ITEMS = [
    { id: "__for_you", name: "For you", mock: true },
    { id: "__collections", name: "Collections", mock: true },
  ];

  const state = {
    path: [],
    panelOpen: false,
    panelId: null,
    sortKey: "review_count",
    sortDir: "desc",
    columnVisible: loadColumnVisibility(),
    colPickerOpen: false,
  };

  const els = {
    columnViewport: document.getElementById("column-viewport"),
    columnTrack: document.getElementById("column-track"),
    overlay: document.getElementById("overlay"),
    panel: document.getElementById("panel"),
    panelResize: document.getElementById("panel-resize"),
    panelBreadcrumb: document.getElementById("panel-breadcrumb"),
    panelTitle: document.getElementById("panel-title"),
    panelStats: document.getElementById("panel-stats"),
    panelTbody: document.getElementById("panel-tbody"),
    panelClose: document.getElementById("panel-close"),
    panelTable: document.getElementById("panel-table"),
    panelTheadRow: document.getElementById("panel-thead-row"),
  };

  init();

  function loadColumnVisibility() {
    try {
      const saved = JSON.parse(localStorage.getItem("table-columns") || "null");
      if (saved && typeof saved === "object") return saved;
    } catch (_) {
      /* ignore */
    }
    return Object.fromEntries(
      TABLE_COLUMNS.map((c) => [c.key, c.defaultVisible !== false])
    );
  }

  function saveColumnVisibility() {
    localStorage.setItem("table-columns", JSON.stringify(state.columnVisible));
  }

  function isColumnVisible(key) {
    return state.columnVisible[key] !== false;
  }

  function init() {
    initPanelResize();
    renderTableHeader();

    els.panelClose.addEventListener("click", closePanel);
    els.overlay.addEventListener("click", closePanel);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (state.colPickerOpen) {
          closeColPicker();
        } else {
          closePanel();
        }
      }
    });

    els.panelTheadRow.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (!th) return;
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir =
          key === "genre" ? "asc" : "desc";
      }
      if (state.panelOpen) renderPanel();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".col-picker-wrap")) closeColPicker();
    });

    const searchForm = document.getElementById("search-form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
      });
    }

    renderColumns();
  }

  function renderDataColumnHeaders() {
    const cols = TABLE_COLUMNS.filter((c) => isColumnVisible(c.key))
      .map((col) => {
        const hint = col.hint
          ? `<span class="col-hint" role="tooltip">${escapeHtml(col.hint)}</span>`
          : "";
        const sortAttr = col.sortable === false ? "" : ` data-sort="${col.sort}"`;
        const thClass = `${col.hint ? "col-has-hint" : ""}${col.sortable === false ? " col-no-sort" : ""}`;
        return `<th class="${thClass}" data-col="${col.key}"${sortAttr}><span class="col-label">${col.label}</span>${hint}</th>`;
      })
      .join("");

    els.panelTheadRow.innerHTML = `
      ${cols}
      <th class="col-picker-head">
        <div class="col-picker-wrap${state.colPickerOpen ? " open" : ""}">
          <button type="button" class="col-picker-btn" title="Show / hide columns" aria-label="Show / hide columns">
            <span class="col-picker-chevron">▾</span>
          </button>
          <div class="col-picker-menu${state.colPickerOpen ? "" : " hidden"}">
            <div class="col-picker-title">Visible columns</div>
            ${TABLE_COLUMNS.filter((c) => !c.locked)
              .map(
                (col) => `
              <label class="col-picker-item">
                <input type="checkbox" data-col-key="${col.key}" ${isColumnVisible(col.key) ? "checked" : ""} />
                ${col.label}
              </label>
            `
              )
              .join("")}
          </div>
        </div>
      </th>
    `;

    els.panelTheadRow.querySelectorAll("th[data-sort]").forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.dataset.sort === state.sortKey) {
        th.classList.add(state.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
      }
    });

    bindColPicker();
  }

  function bindColPicker() {
    const wrap = els.panelTheadRow.querySelector(".col-picker-wrap");
    if (!wrap) return;

    const btn = wrap.querySelector(".col-picker-btn");
    const menu = wrap.querySelector(".col-picker-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.colPickerOpen = !state.colPickerOpen;
      menu.classList.toggle("hidden", !state.colPickerOpen);
      wrap.classList.toggle("open", state.colPickerOpen);
    });

    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    menu.querySelectorAll("input[data-col-key]").forEach((input) => {
      input.addEventListener("change", (e) => {
        e.stopPropagation();
        state.columnVisible[input.dataset.colKey] = input.checked;
        saveColumnVisibility();
        state.colPickerOpen = true;
        renderDataColumnHeaders();
        if (state.panelOpen) renderPanelBody();
      });
    });
  }

  function renderTableHeader() {
    renderDataColumnHeaders();
  }

  function closeColPicker() {
    state.colPickerOpen = false;
    const wrap = els.panelTheadRow.querySelector(".col-picker-wrap");
    const menu = wrap?.querySelector(".col-picker-menu");
    if (menu) menu.classList.add("hidden");
    if (wrap) wrap.classList.remove("open");
  }

  function initPanelResize() {
    const saved = localStorage.getItem("panel-width");
    if (saved) {
      document.documentElement.style.setProperty("--panel-width", saved);
    }

    let startX = 0;
    let startW = 0;

    els.panelResize.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = els.panel.offsetWidth;
      document.body.classList.add("panel-resizing");

      function onMove(ev) {
        const max = window.innerWidth * 0.92;
        const min = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue("--panel-min-width"),
          10
        );
        const next = Math.min(max, Math.max(min, startW + (startX - ev.clientX)));
        document.documentElement.style.setProperty("--panel-width", `${next}px`);
      }

      function onUp() {
        document.body.classList.remove("panel-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        localStorage.setItem(
          "panel-width",
          getComputedStyle(document.documentElement).getPropertyValue("--panel-width").trim()
        );
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function renderColumns() {
    const columns = buildColumnData();

    els.columnTrack.innerHTML = columns
      .map(
        (col, depth) => `
        <div class="column" data-depth="${depth}">
          <ul class="column-list">
            ${col.nodes
              .map((node) => {
                const isMock = node.mock === true;
                const children = isMock ? [] : segments.filter((n) => n.parent_id === node.id);
                const hasChildren = children.length > 0;
                const selected = !isMock && col.selectedId === node.id;

                return `
                  <li class="column-row${selected ? " selected" : ""}${hasChildren ? " has-children" : ""}${isMock ? " mock-item" : ""}" data-id="${node.id}"${isMock ? ' data-mock="true"' : ""}>
                    <button class="row-nav" data-action="${isMock ? "mock" : "drill"}" title="${hasChildren ? "Open inside" : "View apps"}">${node.name}</button>
                    ${hasChildren ? '<button type="button" class="row-chevron" data-action="drill" aria-label="Open inside">›</button>' : isMock ? '<span class="row-chevron row-chevron-static" aria-hidden="true">›</span>' : ""}
                    ${!isMock ? '<button type="button" class="row-panel" data-action="panel" title="View apps">↗</button>' : ""}
                  </li>
                `;
              })
              .join("")}
          </ul>
        </div>
      `
      )
      .join("");

    bindColumnEvents();
    scrollToActiveColumn();
  }

  function buildColumnData() {
    const columns = [];
    const roots = segments.filter((n) => !n.parent_id);

    columns.push({
      nodes: [...MOCK_ROOT_ITEMS, ...roots],
      selectedId: state.path[0] ?? null,
    });

    for (let i = 0; i < state.path.length; i++) {
      const parentId = state.path[i];
      const children = segments.filter((n) => n.parent_id === parentId);
      if (children.length === 0) break;

      columns.push({
        nodes: children,
        selectedId: state.path[i + 1] ?? null,
      });
    }

    return columns;
  }

  function bindColumnEvents() {
    els.columnTrack.querySelectorAll(".column-row").forEach((row) => {
      const id = row.dataset.id;
      const isMock = row.dataset.mock === "true";

      row.querySelectorAll('[data-action="drill"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          drillInto(id);
        });
      });

      const panelBtn = row.querySelector('[data-action="panel"]');
      if (panelBtn) {
        panelBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openPanel(id);
        });
      }

      if (!isMock) {
        row.addEventListener("dblclick", (e) => {
          e.preventDefault();
          openPanel(id);
        });
      }
    });
  }

  function drillInto(id) {
    if (id.startsWith("__")) return;
    const node = segments.find((n) => n.id === id);
    if (!node) return;

    state.path = getPathToNode(id);
    const children = segments.filter((n) => n.parent_id === id);

    if (children.length === 0) {
      openPanel(id);
      return;
    }

    closePanel();
    renderColumns();
  }

  function getPathToNode(id) {
    const chain = [];
    let node = segments.find((n) => n.id === id);
    while (node) {
      chain.unshift(node.id);
      node = node.parent_id ? segments.find((n) => n.id === node.parent_id) : null;
    }
    return chain;
  }

  function scrollToActiveColumn() {
    requestAnimationFrame(() => {
      const cols = els.columnTrack.querySelectorAll(".column");
      if (!cols.length) return;
      const last = cols[cols.length - 1];
      const vp = els.columnViewport;
      const target = last.offsetLeft + last.offsetWidth - vp.clientWidth + 24;
      vp.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    });
  }

  function openPanel(id) {
    state.panelOpen = true;
    state.panelId = id;
    els.overlay.classList.remove("hidden");
    els.panel.classList.remove("hidden");
    renderPanel();
  }

  function closePanel() {
    state.panelOpen = false;
    closeColPicker();
    els.overlay.classList.add("hidden");
    els.panel.classList.add("hidden");
  }

  function renderPanel() {
    const node = segments.find((n) => n.id === state.panelId);
    if (!node) return;

    const panelApps = getSegmentApps(state.panelId);
    const stats = computeStats(panelApps);

    els.panelBreadcrumb.textContent = buildBreadcrumb(node);
    els.panelTitle.textContent = node.name;

    els.panelStats.innerHTML = `
      <div class="stat">
        <span class="stat-value">${stats.count}</span>
        <span class="stat-label">Apps</span>
      </div>
      <div class="stat">
        <span class="stat-value">${stats.avgRating.toFixed(1)}</span>
        <span class="stat-label">Avg rating</span>
      </div>
      <div class="stat">
        <span class="stat-value">${formatReviewCount(stats.totalReviews)}</span>
        <span class="stat-label">Total reviews</span>
      </div>
      <div class="stat">
        <span class="stat-value">${stats.avgRevenue}</span>
        <span class="stat-label">Avg revenue / mo</span>
      </div>
      <div class="stat">
        <span class="stat-value ${stats.stalePercent >= 40 ? "bad" : stats.stalePercent >= 20 ? "warn" : ""}">${stats.stalePercent}%</span>
        <span class="stat-label">Stale apps</span>
      </div>
      <div class="stat">
        <span class="stat-value">${stats.avgUpdateLabel}</span>
        <span class="stat-label">Avg last update</span>
      </div>
      <div class="stat">
        <span class="stat-value">${stats.avgUpdatePace}</span>
        <span class="stat-label">Avg update pace</span>
      </div>
    `;

    renderTableHeader();
    renderPanelBody();
  }

  function renderPanelBody() {
    const panelApps = getSegmentApps(state.panelId);
    const sorted = sortApps(panelApps, state.sortKey, state.sortDir);

    els.panelTbody.innerHTML = sorted.map((app) => renderAppRow(app)).join("");
  }

  function renderAppRow(app) {
    const cells = TABLE_COLUMNS.filter((c) => isColumnVisible(c.key))
      .map((col) => `<td data-col="${col.key}">${renderCell(col.key, app)}</td>`)
      .join("");

    return `<tr>${cells}</tr>`;
  }

  function renderAppDetailCard(app) {
    const history = uniqueReleaseHistory(app.update_history || []);
    const recentHistory = history
      .slice(0, 5)
      .map((h) => `<li>${escapeHtml(h.date)}${h.version ? ` · v${escapeHtml(h.version)}` : ""}</li>`)
      .join("");

    const rows = [
      ["Developer", app.developer || null],
      ["Version", app.version ? `v${escapeHtml(app.version)}` : null],
      ["Launched", app.release_date ? formatShortDate(app.release_date) : null],
      ["Updated", app.last_updated ? formatShortDate(app.last_updated) : null],
      ["Store", app.store_country || null],
      ["Genre", app.genre || null],
      ["IAP", app.has_iap == null ? null : app.has_iap ? "Yes" : "No"],
    ]
      .filter(([, value]) => value)
      .map(
        ([label, value]) =>
          `<div class="app-detail-row"><span class="app-detail-k">${label}</span><span class="app-detail-v">${value}</span></div>`
      )
      .join("");

    return `
      <div class="app-detail-card">
        ${rows}
        ${
          recentHistory
            ? `<div class="app-detail-history"><div class="app-detail-k">Recent releases</div><ul>${recentHistory}</ul></div>`
            : ""
        }
      </div>`;
  }

  function uniqueReleaseHistory(history) {
    const seen = new Set();
    return history
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((h) => {
        const key = `${h.date}|${h.version || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return Boolean(h.date);
      });
  }

  function renderCell(key, app) {
    const updateClass = getUpdateCellClass(app.last_updated);
    const ratingClass = app.rating < 3.5 ? "cell-bad" : "";

    switch (key) {
      case "name": {
        const iconHtml = app.icon_url
          ? `<img class="app-icon" src="${escapeAttr(app.icon_url)}" alt="" loading="lazy" />`
          : `<div class="app-icon-fallback">${app.name.charAt(0).toUpperCase()}</div>`;
        return `
          <div class="app-cell-wrap">
            <a class="app-cell-link" href="${escapeAttr(app.store_url)}" target="_blank" rel="noopener">
              <div class="app-cell">
                ${iconHtml}
                <div class="app-name">${escapeHtml(app.name)}</div>
              </div>
            </a>
            ${renderAppDetailCard(app)}
          </div>`;
      }
      case "rating":
        return `<span class="${ratingClass}">${app.rating.toFixed(1)}</span>`;
      case "review_count":
        return formatReviewCount(app.review_count);
      case "revenue_last_month_usd":
        return formatRevenue(app.revenue_last_month_usd);
      case "downloads_last_month":
        return formatDownloads(app.downloads_last_month);
      case "last_updated":
        return `<span class="update-compact ${updateClass}">${formatCompactUpdate(app)}</span>`;
      case "days_since_update":
        return app.days_since_update != null
          ? `${app.days_since_update}d`
          : `<span class="cell-muted">—</span>`;
      case "update_pace":
        return renderPaceBadge(app);
      case "genre":
        return app.genre ? escapeHtml(app.genre) : `<span class="cell-muted">—</span>`;
      case "has_iap":
        if (app.has_iap == null) return `<span class="cell-muted">—</span>`;
        return app.has_iap
          ? `<span class="iap-badge yes">Yes</span>`
          : `<span class="iap-badge no">No</span>`;
      case "social_reliance":
        return renderTagBadge(app.social_reliance, SOCIAL_LABELS, "social");
      case "ai_intensity":
        return renderTagBadge(app.ai_intensity, AI_LABELS, "ai");
      case "technical_complexity":
        return renderTagBadge(app.technical_complexity, COMPLEXITY_LABELS, "complexity");
      default:
        return "";
    }
  }

  function getDescendantSegmentIds(segmentId) {
    const ids = [segmentId];
    const queue = [segmentId];
    while (queue.length) {
      const current = queue.shift();
      segments
        .filter((s) => s.parent_id === current)
        .forEach((s) => {
          ids.push(s.id);
          queue.push(s.id);
        });
    }
    return ids;
  }

  function getSegmentApps(segmentId) {
    const ids = new Set(getDescendantSegmentIds(segmentId));
    return apps.filter((a) => ids.has(a.segment_id));
  }

  function buildBreadcrumb(node) {
    const parts = [];
    let current = node;
    while (current) {
      parts.unshift(current.name);
      current = current.parent_id ? segments.find((n) => n.id === current.parent_id) : null;
    }
    return parts.join(" › ");
  }

  function computeStats(appList) {
    if (!appList.length) {
      return {
        count: 0,
        avgRating: 0,
        totalReviews: 0,
        stalePercent: 0,
        avgUpdateLabel: "—",
        avgUpdatePace: "—",
        avgRevenue: "—",
      };
    }

    const totalReviews = appList.reduce((s, a) => s + a.review_count, 0);
    const avgRating = appList.reduce((s, a) => s + a.rating, 0) / appList.length;
    const staleCount = appList.filter((a) => monthsSince(a.last_updated) > 12).length;
    const stalePercent = Math.round((staleCount / appList.length) * 100);

    const avgMonths =
      appList.reduce((s, a) => s + monthsSince(a.last_updated), 0) / appList.length;
    const avgUpdateLabel =
      avgMonths < 1
        ? "< 1 mo ago"
        : avgMonths < 12
          ? `${Math.round(avgMonths)} mo ago`
          : `${(avgMonths / 12).toFixed(1)}y ago`;

    const paceValues = appList.map((a) => a.update_rate_days ?? a.days_since_update).filter((d) => d != null);
    const avgUpdatePace =
      paceValues.length > 0
        ? `~${Math.round(paceValues.reduce((s, d) => s + d, 0) / paceValues.length)}d`
        : "—";

    const revApps = appList.filter((a) => a.revenue_last_month_usd != null);
    const avgRevenue =
      revApps.length > 0
        ? formatRevenue(revApps.reduce((s, a) => s + a.revenue_last_month_usd, 0) / revApps.length)
        : "—";

    return {
      count: appList.length,
      avgRating,
      totalReviews,
      stalePercent,
      avgUpdateLabel,
      avgUpdatePace,
      avgRevenue,
    };
  }

  function enumRank(key, value, dir) {
    const order = ENUM_ORDER[key];
    if (!order || value == null) return dir === "asc" ? Infinity : -Infinity;
    return order[value] ?? (dir === "asc" ? Infinity : -Infinity);
  }

  function renderTagBadge(value, labels, kind) {
    if (!value) return `<span class="cell-muted">—</span>`;
    const label = labels[value] || value;
    return `<span class="tag-badge tag-${kind} tag-${value.replace(/_/g, "-")}">${escapeHtml(label)}</span>`;
  }

  function sortApps(list, key, dir) {
    return [...list].sort((a, b) => {
      let va, vb;
      if (key === "last_updated" || key === "release_date") {
        va = a[key] ? new Date(a[key]).getTime() : dir === "asc" ? Infinity : -Infinity;
        vb = b[key] ? new Date(b[key]).getTime() : dir === "asc" ? Infinity : -Infinity;
      } else if (key === "update_rate_days") {
        va = a.update_rate_days ?? a.days_since_update ?? (dir === "asc" ? Infinity : -Infinity);
        vb = b.update_rate_days ?? b.days_since_update ?? (dir === "asc" ? Infinity : -Infinity);
      } else if (key === "revenue_last_month_usd" || key === "downloads_last_month" || key === "days_since_update") {
        va = a[key] ?? (dir === "asc" ? Infinity : -Infinity);
        vb = b[key] ?? (dir === "asc" ? Infinity : -Infinity);
      } else if (key === "has_iap") {
        va = a.has_iap == null ? -1 : a.has_iap ? 1 : 0;
        vb = b.has_iap == null ? -1 : b.has_iap ? 1 : 0;
      } else if (key === "social_reliance" || key === "ai_intensity" || key === "technical_complexity") {
        va = enumRank(key, a[key], dir);
        vb = enumRank(key, b[key], dir);
      } else {
        va = a[key];
        vb = b[key];
      }
      if (typeof va === "string") {
        return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === "asc" ? va - vb : vb - va;
    });
  }

  function monthsSince(dateStr) {
    const then = new Date(dateStr);
    const now = new Date("2026-06-27");
    return (now - then) / (1000 * 60 * 60 * 24 * 30.44);
  }

  function getUpdateCellClass(dateStr) {
    const months = monthsSince(dateStr);
    if (months > 12) return "cell-bad";
    if (months > 6) return "cell-warn";
    return "";
  }

  function formatCompactUpdate(app) {
    const days = app.days_since_update;
    if (days == null) return "—";
    if (days < 14) return `${days}d`;
    const months = monthsSince(app.last_updated);
    if (months < 12) return `${Math.round(months)}mo`;
    const years = months / 12;
    return years >= 2 ? `${Math.round(years)}y` : `${years.toFixed(1)}y`;
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function formatRelativeDate(dateStr) {
    const months = monthsSince(dateStr);
    if (months < 1) return "< 1 mo ago";
    if (months < 12) return `${Math.round(months)} mo ago`;
    const years = months / 12;
    return years >= 2 ? `${Math.round(years)}y ago` : `${years.toFixed(1)}y ago`;
  }

  function formatReviewCount(n) {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  }

  function formatRevenue(usd) {
    if (usd == null) return `<span class="cell-muted">—</span>`;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
    if (usd >= 1_000) return `$${Math.round(usd / 1_000)}k`;
    return `$${Math.round(usd)}`;
  }

  function formatDownloads(n) {
    if (n == null) return `<span class="cell-muted">—</span>`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
  }

  function renderPaceBadge(app) {
    const rate = app.update_rate_days;
    const since = app.days_since_update;
    let label, level;

    if (rate != null) {
      if (rate <= 14) {
        label = `Every ${rate}d`;
        level = "good";
      } else if (rate <= 30) {
        label = `~${rate}d avg`;
        level = "good";
      } else if (rate <= 90) {
        label = `~${rate}d avg`;
        level = "warn";
      } else {
        label = `~${rate}d avg`;
        level = "bad";
      }
    } else if (since != null) {
      if (since <= 45) {
        label = "Active";
        level = "good";
      } else if (since <= 180) {
        label = `${since}d ago`;
        level = "warn";
      } else {
        label = "Stale";
        level = "bad";
      }
    } else {
      return `<span class="pace-badge unknown">—</span>`;
    }

    return `<span class="pace-badge pace-${level}" title="${escapeAttr(label)}">${escapeHtml(label)}</span>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  window.addEventListener("resize", scrollToActiveColumn);
})();
