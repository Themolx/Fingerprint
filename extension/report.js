/**
 * Full Report Page — combines fingerprint analysis (Part 1) with extension data (Part 2)
 */

const Report = (() => {

  const loadingMessages = [
    'Initializing fingerprint engine...',
    'Reading browser configuration...',
    'Scanning hardware capabilities...',
    'Detecting installed fonts...',
    'Generating canvas fingerprint...',
    'Querying WebGL renderer...',
    'Computing audio fingerprint...',
    'Requesting cookie data...',
    'Analyzing browsing history...',
    'Detecting tracker networks...',
    'Mapping interest profile...',
    'Identifying activity patterns...',
    'Estimating sleep schedule...',
    'Calculating your market value...',
    'Assembling complete dossier...',
  ];

  function showLoadingLog() {
    const logEl = document.getElementById('loading-log');
    if (!logEl) return;
    loadingMessages.forEach((msg, i) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.textContent = `> ${msg}`;
        logEl.appendChild(line);
      }, i * 180);
    });
  }

  async function init() {
    showLoadingLog();
    FingerprintEngine.init();

    try {
      // Helper: sendMessage with timeout so it never hangs
      function sendMessageWithTimeout(msg, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve({ cookies: {}, history: {}, bookmarks: {} }), timeoutMs);
          chrome.runtime.sendMessage(msg, (response) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              console.warn('sendMessage error:', chrome.runtime.lastError.message);
              resolve({ cookies: {}, history: {}, bookmarks: {} });
            } else {
              resolve(response || { cookies: {}, history: {}, bookmarks: {} });
            }
          });
        });
      }

      // Collect fingerprint data and extension data in parallel
      const [fingerprintData, extensionData] = await Promise.all([
        FingerprintEngine.collectAll(),
        sendMessageWithTimeout({ action: 'getFullReport' }),
      ]);

      // Run inference
      const profile = InferenceEngine.generateFullProfile(fingerprintData);
      const entropy = EntropyEngine.calculateEntropy(fingerprintData);
      const uniqueness = EntropyEngine.calculateUniqueness(entropy.totalBits);
      const pricing = PricingEngine.getBreakdown(profile);

      // Wait for loading animation to finish
      const totalLoadingTime = loadingMessages.length * 180 + 600;
      await new Promise(r => setTimeout(r, totalLoadingTime));

      // Hide loading
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => loadingScreen.remove(), 600);
      }

      render(fingerprintData, profile, entropy, uniqueness, pricing, extensionData);
    } catch (err) {
      console.error('Report init failed:', err);
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => loadingScreen.remove(), 600);
      }
      const app = document.getElementById('app');
      app.innerHTML = `<div style="color: #ffffff; padding: 2rem; font-family: monospace; text-align: center;">
        <p>Error generating report: ${err.message}</p>
        <p style="color: var(--text-muted); margin-top: 1rem;">Check the console for details.</p>
      </div>`;
    }
  }

  function render(fpData, profile, entropy, uniqueness, pricing, extData) {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const scanline = document.createElement('div');
    scanline.className = 'scanline-overlay';
    document.body.appendChild(scanline);

    const container = document.createElement('div');
    container.className = 'report-container';

    // Privacy notice
    const notice = UIComponents.createPrivacyNotice();
    container.appendChild(notice);

    // Header
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
      <div class="header__subtitle">COMPLETE SURVEILLANCE REPORT</div>
      <h1 class="header__title">You, For Sale</h1>
    `;
    container.appendChild(header);

    // Price tag
    container.appendChild(UIComponents.createPriceTag(pricing.cpm));

    // Product card
    const visitorId = fpData.advanced?.visitorId || hashSimple(JSON.stringify(fpData.basic));
    container.appendChild(UIComponents.createProductCard(profile, visitorId, uniqueness.percent));

    container.appendChild(divider());

    // === EXTENSION DATA: Cookies ===
    const cookies = extData.cookies || {};
    if (!cookies.error) {
      const cookieSection = section('Cookie Tracker Analysis');

      // Summary cards
      const summaryGrid = document.createElement('div');
      summaryGrid.className = 'summary-grid';
      summaryGrid.innerHTML = `
        <div class="summary-card">
          <div class="summary-card__value">${cookies.total || 0}</div>
          <div class="summary-card__label">Total Cookies</div>
        </div>
        <div class="summary-card summary-card--red">
          <div class="summary-card__value">${cookies.trackerCount || 0}</div>
          <div class="summary-card__label">Tracker Cookies</div>
        </div>
        <div class="summary-card summary-card--blue">
          <div class="summary-card__value">${cookies.uniqueDomains || 0}</div>
          <div class="summary-card__label">Unique Domains</div>
        </div>
        <div class="summary-card summary-card--purple">
          <div class="summary-card__value">${cookies.trackerPercentage || 0}%</div>
          <div class="summary-card__label">Tracking Rate</div>
        </div>
      `;
      cookieSection.appendChild(summaryGrid);

      // Category breakdown
      if (cookies.byCategory) {
        const catGrid = document.createElement('div');
        catGrid.className = 'category-grid';
        const catColors = {
          advertising: '#ffffff',
          analytics: '#cccccc',
          social: '#ffffff',
          data_brokers: '#cccccc',
          fingerprinting: '#ffffff',
          consent_management: '#aaaaaa',
          unknown: '#666666',
        };
        for (const [cat, count] of Object.entries(cookies.byCategory)) {
          if (count === 0) continue;
          const card = document.createElement('div');
          card.className = 'category-card';
          card.innerHTML = `
            <div class="category-card__count" style="color: ${catColors[cat] || 'var(--text-primary)'}">${count}</div>
            <div class="category-card__label">${cat.replace(/_/g, ' ')}</div>
          `;
          catGrid.appendChild(card);
        }
        cookieSection.appendChild(catGrid);
      }

      // Cookie lifetime breakdown
      if (cookies.lifetimes) {
        const lt = cookies.lifetimes;
        const lifetimeInfo = document.createElement('div');
        lifetimeInfo.className = 'pattern-summary';
        lifetimeInfo.innerHTML = `
          <div class="pattern-summary__line">${lt.session} session cookies (deleted when you close the browser)</div>
          <div class="pattern-summary__line">${lt.shortLived} short-lived cookies (expire within 24 hours)</div>
          <div class="pattern-summary__line">${lt.persistent} persistent cookies (last days to months)</div>
          <div class="pattern-summary__line">${lt.zombie} "zombie" cookies (expire over a year from now)</div>
        `;
        cookieSection.appendChild(lifetimeInfo);
      }

      // Top trackers
      if (cookies.topTrackers && cookies.topTrackers.length > 0) {
        const trackerTitle = document.createElement('div');
        trackerTitle.className = 'info-text';
        trackerTitle.style.marginTop = '1rem';
        trackerTitle.style.marginBottom = '0.5rem';
        trackerTitle.style.fontWeight = '600';
        trackerTitle.textContent = 'Top Trackers Following You';
        cookieSection.appendChild(trackerTitle);

        const trackerList = document.createElement('div');
        trackerList.className = 'tracker-list';
        for (const tracker of cookies.topTrackers.slice(0, 15)) {
          const item = document.createElement('div');
          item.className = 'tracker-item';
          item.innerHTML = `
            <div class="tracker-item__domain">${tracker.domain}</div>
            <div class="tracker-item__category tracker-item__category--${tracker.category}">${tracker.category.replace(/_/g, ' ')}</div>
            <div class="tracker-item__count">${tracker.count} cookies</div>
          `;
          trackerList.appendChild(item);
        }
        cookieSection.appendChild(trackerList);
      }

      // Summary text
      if (cookies.summary && cookies.summary.length > 0) {
        const summaryText = document.createElement('div');
        summaryText.className = 'pattern-summary';
        summaryText.innerHTML = cookies.summary.map(line =>
          `<div class="pattern-summary__line">${line}</div>`
        ).join('');
        cookieSection.appendChild(summaryText);
      }

      container.appendChild(cookieSection);
      container.appendChild(divider());
    }

    // === EXTENSION DATA: History ===
    const history = extData.history || {};
    if (!history.error && history.totalItems > 0) {
      // Interest Profile
      const interestSection = section('Your Interest Profile (from browsing history)');
      const interestInfo = document.createElement('div');
      interestInfo.className = 'info-text info-text--muted';
      interestInfo.textContent = `Based on ${history.totalItems.toLocaleString()} history entries across ${history.uniqueDomains} domains in the last 30 days.`;
      interestSection.appendChild(interestInfo);

      if (history.interests && history.interests.length > 0) {
        PatternViz.createInterestChart(history.interests, interestSection);
      }

      if (history.topCategories && history.topCategories.length > 0) {
        const catTitle = document.createElement('div');
        catTitle.className = 'info-text';
        catTitle.style.marginTop = '1.5rem';
        catTitle.style.fontWeight = '600';
        catTitle.textContent = 'Detailed Category Breakdown';
        interestSection.appendChild(catTitle);
        PatternViz.createInterestChart(history.topCategories, interestSection);
      }

      container.appendChild(interestSection);
      container.appendChild(divider());

      // Activity Patterns
      const patternSection = section('Your Daily Routine (inferred from browsing patterns)');

      if (history.patterns) {
        PatternViz.createTimeline(history.patterns, patternSection);

        if (history.patterns.summary) {
          const summaryEl = document.createElement('div');
          summaryEl.className = 'pattern-summary';
          summaryEl.innerHTML = history.patterns.summary.map(line =>
            `<div class="pattern-summary__line">${line}</div>`
          ).join('');
          patternSection.appendChild(summaryEl);
        }
      }

      if (history.heatmap) {
        const heatmapTitle = document.createElement('div');
        heatmapTitle.className = 'info-text';
        heatmapTitle.style.marginTop = '1.5rem';
        heatmapTitle.style.fontWeight = '600';
        heatmapTitle.textContent = 'Activity Heatmap (hour × day of week)';
        patternSection.appendChild(heatmapTitle);
        PatternViz.createHeatmap(history.heatmap, patternSection);
      }

      container.appendChild(patternSection);
      container.appendChild(divider());

      // Top Domains
      if (history.topDomains && history.topDomains.length > 0) {
        const domainsSection = section('Most Visited Domains');
        const domainList = document.createElement('div');
        domainList.className = 'tracker-list';
        for (const domain of history.topDomains.slice(0, 20)) {
          const category = categorizeUrl('https://' + domain.domain) || 'Uncategorized';
          const item = document.createElement('div');
          item.className = 'tracker-item';
          item.innerHTML = `
            <div class="tracker-item__domain">${domain.domain}</div>
            <div class="tracker-item__category" style="background: rgba(255, 255, 255, 0.1); color: #aaaaaa;">${category}</div>
            <div class="tracker-item__count">${domain.visits} visits</div>
          `;
          domainList.appendChild(item);
        }
        domainsSection.appendChild(domainList);
        container.appendChild(domainsSection);
        container.appendChild(divider());
      }
    }

    // === FINGERPRINT: Inferences ===
    const inferenceSection = section('What Any Website Knows About You');
    const inferenceGrid = document.createElement('div');
    inferenceGrid.className = 'inference-grid';
    profile.inferences.forEach(inf => {
      inferenceGrid.appendChild(UIComponents.createInferenceCard(inf));
    });
    inferenceSection.appendChild(inferenceGrid);
    container.appendChild(inferenceSection);
    container.appendChild(divider());

    // === FINGERPRINT: Entropy ===
    const entropySection = section('Fingerprint Uniqueness');
    const summary = document.createElement('div');
    summary.className = 'entropy-summary';
    summary.innerHTML = `
      <div class="entropy-summary__label">TOTAL ENTROPY</div>
      <div class="entropy-summary__total">${entropy.totalBits.toFixed(1)} bits</div>
      <div class="entropy-summary__description">${uniqueness.description}</div>
    `;
    entropySection.appendChild(summary);

    const entropyGrid = document.createElement('div');
    entropyGrid.className = 'entropy-grid';
    const maxBits = Math.max(...entropy.contributions.map(c => c.bits), 1);
    entropy.contributions.filter(c => c.present).forEach(c => {
      entropyGrid.appendChild(UIComponents.createEntropyBar(c.label, c.bits, maxBits));
    });
    entropySection.appendChild(entropyGrid);
    container.appendChild(entropySection);
    container.appendChild(divider());

    // === PRICING ===
    const pricingSection = section('Your Price Tag Breakdown');
    const breakdown = document.createElement('div');
    breakdown.className = 'pricing-breakdown';
    pricing.factors.forEach(f => {
      const row = document.createElement('div');
      row.className = 'pricing-factor';
      row.innerHTML = `
        <div class="pricing-factor__label">${f.label}</div>
        <div class="pricing-factor__value">${f.value}</div>
        <div class="pricing-factor__effect">${f.effect}</div>
      `;
      breakdown.appendChild(row);
    });
    pricingSection.appendChild(breakdown);
    container.appendChild(pricingSection);
    container.appendChild(divider());

    // Export
    const exportSection = document.createElement('div');
    exportSection.className = 'export-section';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn--primary';
    exportBtn.textContent = 'Download Complete Profile (JSON)';
    exportBtn.addEventListener('click', () => downloadFullReport(fpData, profile, pricing, entropy, extData));
    exportSection.appendChild(exportBtn);
    container.appendChild(exportSection);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `
      <div class="footer__text">
        This is an educational demonstration of surveillance capitalism.<br>
        No data leaves your device. All analysis runs locally.<br>
      </div>
    `;
    container.appendChild(footer);

    app.appendChild(container);

    // Animations
    const priceNumber = container.querySelector('.price-tag__number');
    if (priceNumber) UIComponents.animateCountUp(priceNumber, parseFloat(priceNumber.dataset.target));

    const cards = container.querySelectorAll('.inference-card');
    UIComponents.sequentialReveal(Array.from(cards), 120);

    setTimeout(() => UIComponents.animateEntropyBars(container), cards.length * 120 + 400);
  }

  function section(title) {
    const el = document.createElement('div');
    el.className = 'report-section';
    el.innerHTML = `<div class="report-section__title">${title}</div>`;
    return el;
  }

  function divider() {
    const hr = document.createElement('hr');
    hr.className = 'report-divider';
    return hr;
  }

  function hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  function downloadFullReport(fpData, profile, pricing, entropy, extData) {
    const exportData = {
      generatedAt: new Date().toISOString(),
      fingerprint: fpData,
      profile: {
        device: profile.device,
        location: profile.location,
        profession: profile.profession,
        techLiteracy: profile.techLiteracy,
        income: profile.income,
      },
      pricing: { cpm: pricing.cpm, factors: pricing.factors },
      entropy: entropy,
      extension: {
        cookies: extData.cookies,
        history: {
          totalItems: extData.history?.totalItems,
          uniqueDomains: extData.history?.uniqueDomains,
          topDomains: extData.history?.topDomains,
          topCategories: extData.history?.topCategories,
          interests: extData.history?.interests,
          patterns: extData.history?.patterns,
        },
        bookmarks: { count: extData.bookmarks?.count },
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `you-for-sale-full-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  Report.init();
});
