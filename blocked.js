const params = new URLSearchParams(window.location.search);
const blockedUrl = params.get("url") || "Unknown";

document.getElementById("blocked-url").textContent = blockedUrl;
