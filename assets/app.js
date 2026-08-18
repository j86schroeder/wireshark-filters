"use strict";

const BUILT_INS = Array.isArray(window.WIRESHARK_FILTERS) ? window.WIRESHARK_FILTERS : [];
const CUSTOM_KEY = "wireshark-filters:custom";
const FAVORITES_KEY = "wireshark-filters:favorites";
const COLUMN_ORDER_KEY = "wireshark-filters:column-order";

const COLUMN_DEFS = {
  favorite: {
    key: "favorite",
    label: "",
    sortable: false,
    filterable: false,
    className: "star-col",
    render: (item) => {
      const favorite = state.favorites.has(keyOf(item));
      return `<button class="star-btn ${favorite ? "active" : ""}" data-favorite="${encodeURIComponent(keyOf(item))}" title="Favorite" aria-label="Favorite ${escapeHtml(item.title)}">${favorite ? "★" : "☆"}</button>`;
    }
  },
  code: {
    key: "code",
    label: "FILTER",
    sortable: true,
    filterable: true,
    placeholder: "Filter syntax",
    className: "col-code",
    render: (item) => `<span class="filter-code">${escapeHtml(item.code)}</span>`
  },
  description: {
    key: "description",
    label: "DESCRIPTION",
    sortable: true,
    filterable: true,
    placeholder: "Description",
    className: "col-description",
    render: (item) => {
      const description = item.note ? `${item.description} ${item.note}` : item.description;
      const custom = item.custom ? `<span class="custom-row-badge">local</span>` : "";
      return `<span class="description">${escapeHtml(description)}</span>${custom}`;
    }
  },
  category: {
    key: "category",
    label: "CATEGORY",
    sortable: true,
    filterable: true,
    placeholder: "Category",
    className: "col-category",
    render: (item) => `<span class="category">${escapeHtml(item.category)}</span>`
  },
  mode: {
    key: "mode",
    label: "TYPE",
    sortable: true,
    filterable: true,
    placeholder: "Type",
    className: "col-mode",
    render: (item) => `<span class="mode-pill ${escapeHtml(item.mode)}">${escapeHtml(item.mode === "recipes" ? "recipe" : item.mode)}</span>`
  },
  copy: {
    key: "copy",
    label: "COPY",
    sortable: false,
    filterable: false,
    className: "copy-col",
    render: (item) => `<button class="copy-btn" data-copy="${encodeURIComponent(item.code)}">Copy</button>`
  }
};

const DEFAULT_COLUMN_ORDER = ["favorite", "code", "description", "category", "mode", "copy"];

const state = {
  search: "",
  mode: "all",
  category: "all",
  favoritesOnly: false,
  favorites: new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")),
  custom: JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"),
  columnFilters: { code: "", description: "", category: "", mode: "" },
  columnFiltersVisible: false,
  arrangeColumns: false,
  columnOrder: loadColumnOrder(),
  sortKey: "category",
  sortDir: "asc",
  page: 0,
  pageSize: 50
};

let draggedColumn = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadColumnOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY) || "null");
    if (
      Array.isArray(saved) &&
      saved.length === DEFAULT_COLUMN_ORDER.length &&
      DEFAULT_COLUMN_ORDER.every((key) => saved.includes(key))
    ) return saved;
  } catch {}
  return [...DEFAULT_COLUMN_ORDER];
}

function allItems() {
  return [...BUILT_INS, ...state.custom];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function keyOf(item) {
  return `${item.mode}|${item.category}|${item.title}|${item.code}`;
}

function categoryOptions() {
  return [...new Set(allItems().map((item) => item.category))].sort((a, b) => a.localeCompare(b));
}

function searchableText(item) {
  return [
    item.code,
    item.title,
    item.description,
    item.category,
    item.mode,
    ...(item.tags || [])
  ].join(" ").toLowerCase();
}

function filteredItems() {
  const terms = state.search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return allItems().filter((item) => {
    if (state.mode !== "all" && item.mode !== state.mode) return false;
    if (state.category !== "all" && item.category !== state.category) return false;
    if (state.favoritesOnly && !state.favorites.has(keyOf(item))) return false;

    const haystack = searchableText(item);
    if (terms.length && !terms.every((term) => haystack.includes(term))) return false;

    for (const [column, raw] of Object.entries(state.columnFilters)) {
      const value = raw.trim().toLowerCase();
      if (!value) continue;
      const cell = String(item[column] || "").toLowerCase();
      if (!cell.includes(value)) return false;
    }

    return true;
  });
}

function sortedItems(items) {
  const copy = [...items];
  copy.sort((a, b) => {
    const av = String(a[state.sortKey] || "").toLowerCase();
    const bv = String(b[state.sortKey] || "").toLowerCase();
    const compare = av.localeCompare(bv, undefined, { numeric: true });
    return state.sortDir === "asc" ? compare : -compare;
  });
  return copy;
}

function renderHead() {
  const headerCells = state.columnOrder.map((key) => {
    const col = COLUMN_DEFS[key];
    const sortableAttrs = col.sortable ? `data-sort="${key}"` : "";
    const indicator = col.sortable ? `<span class="sort-indicator"></span>` : "";
    const draggable = state.arrangeColumns ? `draggable="true" data-column-key="${key}"` : "";
    const dragHandle = state.arrangeColumns ? `<span class="drag-handle">⋮⋮</span>` : "";
    const classNames = [col.className || "", state.arrangeColumns ? "draggable" : ""].filter(Boolean).join(" ");
    return `<th class="${classNames}" ${sortableAttrs} ${draggable}>${dragHandle}${escapeHtml(col.label)} ${indicator}</th>`;
  }).join("");

  const filterCells = state.columnOrder.map((key) => {
    const col = COLUMN_DEFS[key];
    if (!col.filterable) return "<th></th>";
    return `<th><input data-column="${key}" value="${escapeHtml(state.columnFilters[key] || "")}" placeholder="${escapeHtml(col.placeholder || col.label)}"></th>`;
  }).join("");

  $("#tableHead").innerHTML = `
    <tr class="header-row ${state.arrangeColumns ? "arrange-mode" : ""}">${headerCells}</tr>
    ${state.columnFiltersVisible ? `<tr class="column-filter-row">${filterCells}</tr>` : ""}
  `;

  bindHeaderActions();
  renderSortIndicators();
}

function bindHeaderActions() {
  $$("th[data-sort]").forEach((th) => {
    th.addEventListener("click", (event) => {
      if (state.arrangeColumns) return;
      const key = th.dataset.sort;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      state.page = 0;
      render();
    });
  });

  $$(".column-filter-row input").forEach((input) => {
    input.addEventListener("input", () => {
      state.columnFilters[input.dataset.column] = input.value;
      state.page = 0;
      renderBodyOnly();
    });
  });

  if (!state.arrangeColumns) return;

  $$(".header-row th[data-column-key]").forEach((th) => {
    th.addEventListener("dragstart", (event) => {
      draggedColumn = th.dataset.columnKey;
      th.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedColumn);
    });

    th.addEventListener("dragend", () => {
      draggedColumn = null;
      $$(".header-row th").forEach((cell) => cell.classList.remove("dragging", "drop-target"));
    });

    th.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!draggedColumn || draggedColumn === th.dataset.columnKey) return;
      th.classList.add("drop-target");
      event.dataTransfer.dropEffect = "move";
    });

    th.addEventListener("dragleave", () => {
      th.classList.remove("drop-target");
    });

    th.addEventListener("drop", (event) => {
      event.preventDefault();
      const target = th.dataset.columnKey;
      th.classList.remove("drop-target");
      if (!draggedColumn || draggedColumn === target) return;

      const order = [...state.columnOrder];
      const from = order.indexOf(draggedColumn);
      const to = order.indexOf(target);
      order.splice(from, 1);
      order.splice(to, 0, draggedColumn);

      state.columnOrder = order;
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
      render();
    });
  });
}

function rowHtml(item) {
  const cells = state.columnOrder.map((key) => {
    const col = COLUMN_DEFS[key];
    return `<td class="${col.className || ""}">${col.render(item)}</td>`;
  }).join("");

  return `<tr>${cells}</tr>`;
}

function renderCategoryFilter() {
  const current = state.category;
  $("#categoryFilter").innerHTML =
    `<option value="all">All categories</option>` +
    categoryOptions().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  $("#categoryFilter").value = categoryOptions().includes(current) || current === "all" ? current : "all";
}

function renderSortIndicators() {
  $$("th[data-sort]").forEach((th) => {
    const indicator = th.querySelector(".sort-indicator");
    if (!indicator) return;
    indicator.textContent = th.dataset.sort === state.sortKey
      ? (state.sortDir === "asc" ? "▲" : "▼")
      : "";
  });
}

function renderBodyOnly() {
  const filtered = sortedItems(filteredItems());
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));

  if (state.page >= totalPages) state.page = totalPages - 1;
  if (state.page < 0) state.page = 0;

  const start = state.page * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  $("#tableBody").innerHTML = pageItems.map(rowHtml).join("");
  $("#emptyState").hidden = filtered.length !== 0;
  $("#filterTable").hidden = filtered.length === 0;

  const from = filtered.length ? start + 1 : 0;
  const to = Math.min(start + state.pageSize, filtered.length);
  $("#statusText").textContent = `${from}–${to} of ${filtered.length} rows`;
  $("#pageText").textContent = `${state.page + 1} / ${totalPages}`;
  $("#prevPage").disabled = state.page === 0;
  $("#nextPage").disabled = state.page >= totalPages - 1;

  $("#favoritesBtn").classList.toggle("active", state.favoritesOnly);
  $("#favoritesBtn").textContent = state.favoritesOnly ? "★ Favorites only" : "☆ Favorites";

  bindRowActions();
}

function render() {
  renderHead();
  renderBodyOnly();

  $("#columnsBtn").classList.toggle("active", state.arrangeColumns);
  $("#columnsBtn").textContent = state.arrangeColumns ? "✓ Arrange columns" : "↔ Arrange columns";
  $("#columnFiltersBtn").classList.toggle("active", state.columnFiltersVisible);
  $("#entryCount").textContent = allItems().length;
}

function bindRowActions() {
  $$(".copy-btn").forEach((button) => {
    button.addEventListener("click", () => copyText(decodeURIComponent(button.dataset.copy)));
  });

  $$(".star-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const key = decodeURIComponent(button.dataset.favorite);
      if (state.favorites.has(key)) state.favorites.delete(key);
      else state.favorites.add(key);

      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
      renderBodyOnly();
    });
  });
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    toast("Copied");
  } catch {
    toast("Copy failed");
  }
}

let toastTimer;
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 1000);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = sortedItems(filteredItems());
  const visibleDataColumns = state.columnOrder.filter((key) => !["favorite", "copy"].includes(key));
  const header = visibleDataColumns.map((key) => COLUMN_DEFS[key].label || key);

  const lines = rows.map((item) => visibleDataColumns.map((key) => {
    if (key === "description") return csvEscape(item.description + (item.note ? ` ${item.note}` : ""));
    return csvEscape(item[key]);
  }).join(","));

  const blob = new Blob([[header.map(csvEscape).join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wireshark-filters.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openAddRowModal() {
  $("#addRowModal").hidden = false;
  setTimeout(() => $("#newTitle").focus(), 30);
}

function closeAddRowModal() {
  $("#addRowModal").hidden = true;
}

function addCustomRow(event) {
  event.preventDefault();

  const item = {
    mode: $("#newMode").value,
    category: $("#newCategory").value.trim() || "Custom",
    title: $("#newTitle").value.trim(),
    code: $("#newCode").value.trim(),
    description: $("#newDescription").value.trim(),
    tags: $("#newTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    custom: true
  };

  if (!item.title || !item.code || !item.description) {
    toast("Complete required fields");
    return;
  }

  state.custom.push(item);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(state.custom));

  $("#addRowForm").reset();
  $("#newCategory").value = "Custom";
  closeAddRowModal();

  renderCategoryFilter();
  render();
  toast("Row added");
}

$("#search").addEventListener("input", (event) => {
  state.search = event.target.value;
  state.page = 0;
  renderBodyOnly();
});

$("#modeFilter").addEventListener("change", (event) => {
  state.mode = event.target.value;
  state.page = 0;
  renderBodyOnly();
});

$("#categoryFilter").addEventListener("change", (event) => {
  state.category = event.target.value;
  state.page = 0;
  renderBodyOnly();
});

$("#favoritesBtn").addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  state.page = 0;
  renderBodyOnly();
});

$("#columnsBtn").addEventListener("click", () => {
  state.arrangeColumns = !state.arrangeColumns;
  render();
});

$("#columnFiltersBtn").addEventListener("click", () => {
  state.columnFiltersVisible = !state.columnFiltersVisible;
  renderHead();
  renderSortIndicators();
});

$("#pageSize").addEventListener("change", (event) => {
  state.pageSize = Number(event.target.value);
  state.page = 0;
  renderBodyOnly();
});

$("#prevPage").addEventListener("click", () => {
  state.page -= 1;
  renderBodyOnly();
});

$("#nextPage").addEventListener("click", () => {
  state.page += 1;
  renderBodyOnly();
});

$("#exportBtn").addEventListener("click", exportCsv);
$("#printBtn").addEventListener("click", () => window.print());

$("#addRowBtn").addEventListener("click", openAddRowModal);
$("#closeAddRow").addEventListener("click", closeAddRowModal);
$("#cancelAddRow").addEventListener("click", closeAddRowModal);
$("#addRowForm").addEventListener("submit", addCustomRow);
$("#addRowModal").addEventListener("click", (event) => {
  if (event.target === $("#addRowModal")) closeAddRowModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    $("#search").focus();
  }
  if (event.key === "Escape" && !$("#addRowModal").hidden) {
    closeAddRowModal();
  }
});

renderCategoryFilter();
render();
