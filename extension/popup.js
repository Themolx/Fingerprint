/**
 * Popup Script — quick summary view when clicking the extension icon
 */

async function initPopup() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');

  try {
    // Request data from background
    const report = await chrome.runtime.sendMessage({ action: 'getFullReport' });

    loading.style.display = 'none';
    content.style.display = 'block';

    renderPopup(report, content);
  } catch (e) {
    loading.innerHTML = `<div class="popup__loading-text">Error: ${e.message}</div>`;
  }
}

function renderPopup(report, container) {
  const cookies = report.cookies || {};
  const history = report.history || {};

  // Header
  const header = document.createElement('div');
  header.className = 'popup__header';
  header.innerHTML = `
    <div class="popup__subtitle">SURVEILLANCE REPORT</div>
    <div class="popup__title">You, For Sale</div>
  `;
  container.appendChild(header);

  // Stats grid
  const stats = document.createElement('div');
  stats.className = 'popup__stat-grid';
  stats.innerHTML = `
    <div class="popup__stat">
      <div class="popup__stat-value">${cookies.total || 0}</div>
      <div class="popup__stat-label">Total Cookies</div>
    </div>
    <div class="popup__stat">
      <div class="popup__stat-value">${cookies.trackerCount || 0}</div>
      <div class="popup__stat-label">Tracker Cookies</div>
    </div>
    <div class="popup__stat">
      <div class="popup__stat-value">${history.uniqueDomains || 0}</div>
      <div class="popup__stat-label">Sites Visited (30d)</div>
    </div>
    <div class="popup__stat">
      <div class="popup__stat-value">${cookies.trackerPercentage || 0}%</div>
      <div class="popup__stat-label">Tracking Rate</div>
    </div>
  `;
  container.appendChild(stats);

  // Top interests
  if (history.interests && history.interests.length > 0) {
    const interests = document.createElement('div');
    interests.className = 'popup__interests';
    interests.innerHTML = `<div class="popup__interests-title">Inferred Interests</div>`;
    const tags = history.interests.slice(0, 8).map(i =>
      `<span class="popup__interest-tag">${i.interest}</span>`
    ).join('');
    interests.innerHTML += tags;
    container.appendChild(interests);
  }

  // Top trackers
  if (cookies.topTrackers && cookies.topTrackers.length > 0) {
    const trackers = document.createElement('div');
    trackers.className = 'popup__interests';
    trackers.innerHTML = `<div class="popup__interests-title">Top Trackers Following You</div>`;
    const tags = cookies.topTrackers.slice(0, 5).map(t =>
      `<span class="popup__interest-tag">${t.domain} (${t.count})</span>`
    ).join('');
    trackers.innerHTML += tags;
    container.appendChild(trackers);
  }

  // Open full report button
  const btn = document.createElement('button');
  btn.className = 'popup__btn';
  btn.textContent = 'Open Full Report';
  btn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
  });
  container.appendChild(btn);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'popup__footer';
  footer.innerHTML = `<div class="popup__footer-text">All data stays on your device</div>`;
  container.appendChild(footer);
}

document.addEventListener('DOMContentLoaded', initPopup);
