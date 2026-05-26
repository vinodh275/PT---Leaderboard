const SHEET_ID = "1L3hbl80Sx-fRLE99RQet62-58TXDbJInk-LQ9oAQxmY";

const OWNERSHIP_CONFIG = [
  { key: "1p-elite", label: "1P Elite", gid: "1150708071" },
  { key: "2p-elite", label: "2P Elite", gid: "1162074438" },
  { key: "golds-1p", label: "Gold's 1P", gid: "1494914050" },
];

const CONTEST_HEADERS = [
  "cltId",
  "trainerId",
  "trainerName",
  "designation",
  "tenureCategory",
  "city",
  "csid",
  "centerName",
  "ownership",
  "target",
  "achTillMay23",
  "contestRevenue",
  "achTillMay23Pct",
  "segment",
  "overallAchPct",
  "payout",
];

const state = {
  activeOwnership: OWNERSHIP_CONFIG[0].key,
  city: "",
  designation: "",
  search: "",
  datasets: {},
  lastLoadedAt: null,
};

const tabsEl = document.getElementById("ownership-tabs");
const cityFilterEl = document.getElementById("city-filter");
const designationFilterEl = document.getElementById("designation-filter");
const searchFilterEl = document.getElementById("search-filter");
const insightsEl = document.getElementById("insights");
const leaderboardBodyEl = document.getElementById("leaderboard-body");
const lastUpdatedEl = document.getElementById("last-updated");
const rowSummaryEl = document.getElementById("row-summary");
const emptyStateEl = document.getElementById("empty-state");
const refreshButtonEl = document.getElementById("refresh-button");

bootstrap();

function bootstrap() {
  renderTabs();
  wireEvents();
  loadAllSheets();
}

function wireEvents() {
  cityFilterEl.addEventListener("change", () => {
    state.city = cityFilterEl.value;
    renderLeaderboard();
  });

  designationFilterEl.addEventListener("change", () => {
    state.designation = designationFilterEl.value;
    renderLeaderboard();
  });

  searchFilterEl.addEventListener("input", () => {
    state.search = searchFilterEl.value.trim().toLowerCase();
    renderLeaderboard();
  });

  refreshButtonEl.addEventListener("click", loadAllSheets);
}

async function loadAllSheets() {
  refreshButtonEl.disabled = true;
  refreshButtonEl.textContent = "Refreshing...";
  lastUpdatedEl.textContent = "Refreshing sheet data...";

  try {
    const results = await Promise.all(
      OWNERSHIP_CONFIG.map(async (config) => ({
        key: config.key,
        rows: await fetchOwnershipRows(config),
      })),
    );

    state.datasets = results.reduce((accumulator, result) => {
      accumulator[result.key] = result.rows;
      return accumulator;
    }, {});
    state.lastLoadedAt = new Date();

    populateFilters();
    renderLeaderboard();
  } catch (error) {
    console.error(error);
    lastUpdatedEl.textContent = "Could not load sheet data. Check sharing access and try again.";
    rowSummaryEl.textContent = "No data loaded";
    insightsEl.innerHTML = "";
    leaderboardBodyEl.innerHTML = "";
  } finally {
    refreshButtonEl.disabled = false;
    refreshButtonEl.textContent = "Refresh data";
  }
}

async function fetchOwnershipRows(config) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${config.gid}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.label}: ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);
  const dataRows = rows.slice(3);

  return dataRows
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => mapRow(row, config.label))
    .filter((row) => row.trainerName);
}

function mapRow(row, fallbackOwnership) {
  const object = CONTEST_HEADERS.reduce((record, header, index) => {
    record[header] = (row[index] || "").trim();
    return record;
  }, {});

  const contestRevenue = parseMoney(object.contestRevenue);
  const payout = parseMoney(object.payout);
  const target = parseMoney(object.target);
  const achTillMay23 = parseMoney(object.achTillMay23);

  return {
    ...object,
    ownership: object.ownership || fallbackOwnership,
    trainerName: cleanName(object.trainerName),
    designation: object.designation || "-",
    city: object.city || "-",
    centerName: object.centerName || "-",
    target,
    achTillMay23,
    contestRevenue,
    payout,
    overallAchPct: object.overallAchPct || "-",
    segment: normalizeSegment(object.segment),
    remark: buildRemark({
      payout,
      contestRevenue,
      overallAchPct: object.overallAchPct || "-",
      target,
    }),
  };
}

function populateFilters() {
  const activeRows = getActiveRows();
  const cities = uniqueValues(activeRows.map((row) => row.city));
  const designations = uniqueValues(activeRows.map((row) => row.designation));

  syncSelectOptions(cityFilterEl, cities, "All cities", state.city);
  syncSelectOptions(designationFilterEl, designations, "All roles", state.designation);
}

function renderTabs() {
  const template = document.getElementById("tab-template");
  tabsEl.innerHTML = "";

  OWNERSHIP_CONFIG.forEach((ownership) => {
    const button = template.content.firstElementChild.cloneNode(true);
    button.textContent = ownership.label;
    button.classList.toggle("is-active", ownership.key === state.activeOwnership);
    button.addEventListener("click", () => {
      state.activeOwnership = ownership.key;
      state.city = "";
      state.designation = "";
      state.search = "";
      cityFilterEl.value = "";
      designationFilterEl.value = "";
      searchFilterEl.value = "";
      renderTabs();
      populateFilters();
      renderLeaderboard();
    });
    tabsEl.appendChild(button);
  });
}

function renderLeaderboard() {
  renderTabs();

  const activeRows = getActiveRows();
  const filteredRows = applyFilters(activeRows);
  const rankedRows = filteredRows
    .slice()
    .sort((left, right) => right.contestRevenue - left.contestRevenue || left.trainerName.localeCompare(right.trainerName))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const activeOwnershipLabel = OWNERSHIP_CONFIG.find((item) => item.key === state.activeOwnership)?.label || "";

  updateHeaderSummary(activeOwnershipLabel, activeRows.length, rankedRows.length);
  renderInsights(activeRows, filteredRows, rankedRows);
  renderTable(rankedRows);

  emptyStateEl.classList.toggle("hidden", rankedRows.length !== 0);
}

function renderInsights(activeRows, filteredRows, rankedRows) {
  const totalContestRevenue = filteredRows.reduce((sum, row) => sum + row.contestRevenue, 0);
  const totalPayout = filteredRows.reduce((sum, row) => sum + row.payout, 0);
  const highestRevenue = rankedRows[0]?.contestRevenue || 0;
  const activeCities = uniqueValues(filteredRows.map((row) => row.city)).length;
  const noPayoutCount = filteredRows.filter((row) => row.payout === 0).length;

  const cards = [
    { label: "Rows In Ownership", value: formatCount(activeRows.length) },
    { label: "Rows After Filter", value: formatCount(filteredRows.length) },
    { label: "Highest Contest Revenue", value: formatCurrency(highestRevenue) },
    { label: "Visible Payout Total", value: formatCurrency(totalPayout) },
    { label: "Visible Contest Revenue", value: formatCurrency(totalContestRevenue) },
    { label: "No Payout Rows", value: formatCount(noPayoutCount) },
    { label: "Cities In View", value: formatCount(activeCities) },
  ];

  insightsEl.innerHTML = cards
    .map(
      (card) => `
        <article class="insight-card">
          <div class="insight-card__label">${card.label}</div>
          <div class="insight-card__value">${card.value}</div>
        </article>
      `,
    )
    .join("");
}

function renderTable(rows) {
  if (!rows.length) {
    leaderboardBodyEl.innerHTML = "";
    return;
  }

  leaderboardBodyEl.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td class="name-cell">
            <strong>${escapeHtml(row.trainerName)}</strong>
            <small>${escapeHtml(row.segment)}</small>
          </td>
          <td>${escapeHtml(row.designation)}</td>
          <td>${escapeHtml(row.city)}</td>
          <td class="muted-cell">${escapeHtml(row.centerName)}</td>
          <td class="money">${formatCurrency(row.contestRevenue)}</td>
          <td class="money ${row.payout === 0 ? "payout--zero" : ""}">${formatCurrency(row.payout)}</td>
          <td>${escapeHtml(row.overallAchPct)}</td>
          <td class="remark-cell">${escapeHtml(row.remark)}</td>
        </tr>
      `,
    )
    .join("");
}

function getActiveRows() {
  return state.datasets[state.activeOwnership] || [];
}

function applyFilters(rows) {
  return rows.filter((row) => {
    const matchesCity = !state.city || row.city === state.city;
    const matchesDesignation = !state.designation || row.designation === state.designation;
    const haystack = `${row.trainerName} ${row.centerName} ${row.city}`.toLowerCase();
    const matchesSearch = !state.search || haystack.includes(state.search);

    return matchesCity && matchesDesignation && matchesSearch;
  });
}

function updateHeaderSummary(ownershipLabel, activeCount, visibleCount) {
  if (state.lastLoadedAt) {
    lastUpdatedEl.textContent = `Last synced ${state.lastLoadedAt.toLocaleString()}`;
  }

  rowSummaryEl.textContent = `${ownershipLabel} • ${visibleCount} visible of ${activeCount} total rows`;
}

function syncSelectOptions(selectElement, values, placeholder, selectedValue) {
  const options = [`<option value="">${placeholder}</option>`]
    .concat(values.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`))
    .join("");

  selectElement.innerHTML = options;
  selectElement.value = values.includes(selectedValue) ? selectedValue : "";
}

function parseCsv(csvText) {
  const rows = [];
  let currentCell = "";
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

function parseMoney(value) {
  if (!value) {
    return 0;
  }

  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSegment(value) {
  const normalized = (value || "").trim();
  if (!normalized || normalized === "0") {
    return "No prior segment";
  }
  return normalized;
}

function buildRemark({ payout, contestRevenue, overallAchPct, target }) {
  if (payout > 0) {
    return "Payout earned as per source sheet.";
  }

  if (target === 0 || overallAchPct === "#DIV/0!") {
    return "Target or achievement data is invalid in the source sheet. Please review manually.";
  }

  if (contestRevenue === 0) {
    return "No contest revenue recorded for May 24 to May 31.";
  }

  if (contestRevenue < 30000) {
    return "Contest revenue is below the payout threshold of ₹30,000.";
  }

  return "No payout is marked in the source sheet even though contest revenue exists. Please review your payout rule/manual override.";
}

function cleanName(value) {
  return (value || "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function formatCurrency(value) {
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
