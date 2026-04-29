const STORAGE_KEY = "blockedSites";

const form = document.getElementById("site-form");
const input = document.getElementById("site-input");
const redirectInput = document.getElementById("redirect-input");
const message = document.getElementById("message");
const blockedList = document.getElementById("blocked-list");

function normalizeRedirectUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeStoredEntry(value) {
  if (typeof value === "string") {
    return { host: value, enabled: true, redirectUrl: "" };
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.host === "string" &&
    typeof value.enabled === "boolean"
  ) {
    return {
      host: value.host,
      enabled: value.enabled,
      redirectUrl: normalizeRedirectUrl(value.redirectUrl) || ""
    };
  }

  return null;
}

async function getBlockedSites() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const list = result[STORAGE_KEY];
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map(normalizeStoredEntry).filter((value) => value !== null);
}

async function setBlockedSites(sites) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: sites });
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#b42318" : "#1b6f3f";
}

async function normalizeHostname(value) {
  const response = await chrome.runtime.sendMessage({
    type: "normalize-hostname",
    value
  });

  return response?.hostname || null;
}

function createListItem(entry, onToggle, onRemove, onRedirectChange) {
  const li = document.createElement("li");
  const siteMeta = document.createElement("div");
  siteMeta.className = "site-meta";

  const siteLabel = document.createElement("span");
  siteLabel.textContent = entry.host;
  siteLabel.className = "site-label";

  const statusLabel = document.createElement("span");
  statusLabel.className = "site-status";
  statusLabel.textContent = entry.enabled ? "Blocking ON" : "Blocking OFF";

  const redirectField = document.createElement("input");
  redirectField.type = "text";
  redirectField.className = "redirect-input";
  redirectField.placeholder = "Redirect URL (optional)";
  redirectField.value = entry.redirectUrl;
  redirectField.addEventListener("change", () =>
    onRedirectChange(entry.host, redirectField.value)
  );

  siteMeta.append(siteLabel, statusLabel, redirectField);

  const actions = document.createElement("div");
  actions.className = "site-actions";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "toggle";
  toggleButton.textContent = entry.enabled ? "Turn OFF" : "Turn ON";
  toggleButton.addEventListener("click", () => onToggle(entry.host));

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => onRemove(entry.host));

  actions.append(toggleButton, removeButton);
  li.append(siteMeta, actions);
  return li;
}

async function renderSites() {
  const sites = await getBlockedSites();
  blockedList.innerHTML = "";

  if (sites.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No blocked websites yet.";
    blockedList.appendChild(li);
    return;
  }

  const sorted = [...sites].sort((a, b) => a.host.localeCompare(b.host));
  sorted.forEach((entry) => {
    const item = createListItem(entry, toggleSite, removeSite, updateRedirect);
    blockedList.appendChild(item);
  });
}

async function addSite(event) {
  event.preventDefault();

  const normalized = await normalizeHostname(input.value);
  if (!normalized) {
    showMessage("Please enter a valid website.", true);
    return;
  }

  const redirectUrl = normalizeRedirectUrl(redirectInput.value);
  if (redirectUrl === null) {
    showMessage("Please enter a valid redirect URL or leave it empty.", true);
    return;
  }

  const sites = await getBlockedSites();
  if (sites.some((entry) => entry.host === normalized)) {
    showMessage("This website is already blocked.", true);
    return;
  }

  const updated = [...sites, { host: normalized, enabled: true, redirectUrl }];
  await setBlockedSites(updated);
  input.value = "";
  redirectInput.value = "";
  showMessage(`${normalized} added to blocked websites.`);
  await renderSites();
}

async function removeSite(site) {
  const sites = await getBlockedSites();
  const updated = sites.filter((entry) => entry.host !== site);
  await setBlockedSites(updated);
  showMessage(`${site} removed.`);
  await renderSites();
}

async function toggleSite(site) {
  const sites = await getBlockedSites();
  const updated = sites.map((entry) => {
    if (entry.host !== site) {
      return entry;
    }

    return { ...entry, enabled: !entry.enabled };
  });

  await setBlockedSites(updated);
  const changed = updated.find((entry) => entry.host === site);
  showMessage(
    changed?.enabled ? `${site} blocking enabled.` : `${site} blocking disabled.`
  );
  await renderSites();
}

async function updateRedirect(site, value) {
  const redirectUrl = normalizeRedirectUrl(value);
  if (redirectUrl === null) {
    showMessage("Please enter a valid redirect URL or leave it empty.", true);
    return;
  }

  const sites = await getBlockedSites();
  const updated = sites.map((entry) => {
    if (entry.host !== site) {
      return entry;
    }

    return { ...entry, redirectUrl };
  });

  await setBlockedSites(updated);
  showMessage(
    redirectUrl
      ? `${site} will redirect to ${redirectUrl}.`
      : `${site} will show the block page.`
  );
  await renderSites();
}

form.addEventListener("submit", addSite);
renderSites();
