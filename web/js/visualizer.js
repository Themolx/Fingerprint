/**
 * Visualizer — main orchestrator for the web fingerprint page
 * Collects data, runs inference, renders UI with sequential animations
 */

const Visualizer = (() => {
  let collectedData = null;
  let profile = null;
  let storedEntropy = null;
  let storedUniqueness = null;
  let storedPricing = null;

  const loadingMessages = [
    'Initializing fingerprint engine...',
    'Reading browser configuration...',
    'Scanning hardware capabilities...',
    'Detecting installed fonts...',
    'Generating canvas fingerprint...',
    'Querying WebGL renderer...',
    'Computing audio fingerprint...',
    'Analyzing network signals...',
    'Calculating entropy...',
    'Building your profile...',
    'Estimating your market value...',
    'Assembling dossier...',
  ];

  function showLoadingLog() {
    const logEl = document.getElementById('loading-log');
    if (!logEl) return;
    loadingMessages.forEach((msg, i) => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.style.animationDelay = '0s';
        line.textContent = `> ${msg}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
      }, i * 200);
    });
  }

  async function init() {
    showLoadingLog();
    FingerprintEngine.init();

    // Collect all data
    collectedData = await FingerprintEngine.collectAll();

    // Run inference
    profile = InferenceEngine.generateFullProfile(collectedData);

    // Calculate entropy
    storedEntropy = EntropyEngine.calculateEntropy(collectedData);
    storedUniqueness = EntropyEngine.calculateUniqueness(storedEntropy.totalBits);

    // Calculate pricing
    storedPricing = PricingEngine.getBreakdown(profile);

    const entropy = storedEntropy;
    const uniqueness = storedUniqueness;
    const pricing = storedPricing;

    // Small pause for loading feel
    await new Promise(r => setTimeout(r, 800));

    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 600);
    }

    // Render everything
    render(profile, entropy, uniqueness, pricing);
  }

  function render(profile, entropy, uniqueness, pricing) {
    const app = document.getElementById('app');
    app.innerHTML = '';

    // Scanline overlay
    const scanline = document.createElement('div');
    scanline.className = 'scanline-overlay';
    document.body.appendChild(scanline);

    const container = document.createElement('div');
    container.className = 'container';

    // Privacy notice
    container.appendChild(UIComponents.createPrivacyNotice());

    // Header
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
      <div class="header__subtitle">SURVEILLANCE CAPITALISM DEMO</div>
      <h1 class="header__title">You, For Sale</h1>
    `;
    container.appendChild(header);

    // Price tag
    const priceTag = UIComponents.createPriceTag(pricing.cpm);
    container.appendChild(priceTag);

    // Product card
    const visitorId = collectedData.advanced?.visitorId || hashSimple(JSON.stringify(collectedData.basic));
    const productCard = UIComponents.createProductCard(profile, visitorId, uniqueness.percent);
    container.appendChild(productCard);

    // Divider
    container.appendChild(createDivider());

    // Inferences section
    const inferenceSection = document.createElement('div');
    inferenceSection.className = 'section';
    inferenceSection.innerHTML = `<div class="section__title">What We Know — And How We Know It</div>`;
    const inferenceGrid = document.createElement('div');
    inferenceGrid.className = 'inference-grid';
    profile.inferences.forEach(inf => {
      inferenceGrid.appendChild(UIComponents.createInferenceCard(inf));
    });
    inferenceSection.appendChild(inferenceGrid);
    container.appendChild(inferenceSection);

    container.appendChild(createDivider());

    // Fingerprint entropy section
    const entropySection = document.createElement('div');
    entropySection.className = 'section';
    entropySection.innerHTML = `<div class="section__title">Fingerprint Breakdown — How Unique You Are</div>`;

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

    container.appendChild(createDivider());

    // Pricing breakdown
    const pricingSection = document.createElement('div');
    pricingSection.className = 'section';
    pricingSection.innerHTML = `<div class="section__title">Your Price Tag — How It's Calculated</div>`;
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

    container.appendChild(createDivider());

    // Raw data section
    const rawSection = document.createElement('div');
    rawSection.className = 'section';
    rawSection.innerHTML = `<div class="section__title">Raw Fingerprint Data — Everything Collected</div>`;
    const rawGrid = document.createElement('div');
    rawGrid.className = 'raw-data-grid';

    const rawItems = [
      { label: 'User Agent', value: collectedData.basic?.userAgent || 'N/A' },
      { label: 'Platform', value: collectedData.basic?.platform || 'N/A' },
      { label: 'Language', value: collectedData.basic?.language || 'N/A' },
      { label: 'Languages', value: (collectedData.basic?.languages || []).join(', ') },
      { label: 'Timezone', value: collectedData.basic?.timezone || 'N/A' },
      { label: 'Screen', value: `${collectedData.basic?.screenWidth}×${collectedData.basic?.screenHeight}` },
      { label: 'Color Depth', value: `${collectedData.basic?.colorDepth}-bit` },
      { label: 'Pixel Ratio', value: `${collectedData.basic?.devicePixelRatio}x` },
      { label: 'CPU Cores', value: `${collectedData.basic?.hardwareConcurrency || 'N/A'}` },
      { label: 'Device Memory', value: collectedData.basic?.deviceMemory ? `${collectedData.basic.deviceMemory} GB` : 'N/A' },
      { label: 'Connection', value: collectedData.basic?.connectionType || 'N/A' },
      { label: 'Downlink', value: collectedData.basic?.connectionDownlink ? `${collectedData.basic.connectionDownlink} Mbps` : 'N/A' },
      { label: 'Cookies Enabled', value: collectedData.basic?.cookieEnabled ? 'Yes' : 'No' },
      { label: 'Do Not Track', value: collectedData.basic?.doNotTrack || 'Not set' },
      { label: 'Touch Points', value: `${collectedData.basic?.maxTouchPoints || 0}` },
      { label: 'WebDriver', value: collectedData.basic?.webdriver ? 'Yes (automated)' : 'No' },
      { label: 'GPU Vendor', value: collectedData.webgl?.vendor || 'N/A' },
      { label: 'GPU Renderer', value: collectedData.webgl?.renderer || 'N/A' },
      { label: 'WebGL Version', value: collectedData.webgl?.version || 'N/A' },
      { label: 'Max Texture Size', value: collectedData.webgl?.maxTextureSize?.toString() || 'N/A' },
      { label: 'Canvas Hash', value: collectedData.canvas ? collectedData.canvas.substring(0, 40) + '...' : 'Blocked' },
      { label: 'Audio Hash', value: collectedData.audio || 'N/A' },
      { label: 'Fonts Detected', value: `${(collectedData.fonts || []).length} fonts` },
      { label: 'Plugins', value: `${(collectedData.plugins || []).length} plugins` },
      { label: 'Media Devices', value: collectedData.mediaDevices ? `${collectedData.mediaDevices.audioinput}in / ${collectedData.mediaDevices.audiooutput}out / ${collectedData.mediaDevices.videoinput}cam` : 'N/A' },
      { label: 'Battery', value: collectedData.battery ? `${Math.round(collectedData.battery.level * 100)}% ${collectedData.battery.charging ? '(charging)' : ''}` : 'N/A' },
    ];

    if (collectedData.advanced?.visitorId) {
      rawItems.unshift({ label: 'Visitor ID', value: collectedData.advanced.visitorId });
    }

    rawItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'raw-data-item';
      el.innerHTML = `
        <div class="raw-data-item__label">${item.label}</div>
        <div class="raw-data-item__value">${item.value}</div>
      `;
      rawGrid.appendChild(el);
    });
    rawSection.appendChild(rawGrid);
    container.appendChild(rawSection);

    container.appendChild(createDivider());

    // Fonts detail
    if ((collectedData.fonts || []).length > 0) {
      const fontsSection = document.createElement('div');
      fontsSection.className = 'section';
      fontsSection.innerHTML = `<div class="section__title">Detected Fonts (${collectedData.fonts.length})</div>`;
      const fontsList = document.createElement('div');
      fontsList.className = 'raw-data-item';
      fontsList.style.gridColumn = '1 / -1';
      fontsList.innerHTML = `
        <div class="raw-data-item__value" style="font-size: 0.7rem; line-height: 1.8;">
          ${collectedData.fonts.map(f => `<span style="margin-right: 1rem; white-space: nowrap;">${f}</span>`).join('')}
        </div>
      `;
      fontsSection.appendChild(fontsList);
      container.appendChild(fontsSection);
      container.appendChild(createDivider());
    }

    // Extension CTA
    const extensionCTA = document.createElement('div');
    extensionCTA.className = 'extension-cta';
    extensionCTA.id = 'extension-cta';
    extensionCTA.innerHTML = `
      <div class="extension-cta__title">Want to see even more?</div>
      <div class="extension-cta__text">Install the "You, For Sale" Chrome extension to analyze your cookies, browsing history, and daily patterns.</div>
      <div class="extension-cta__note">The extension adds: cookie tracker analysis, interest profiling from history, activity heatmaps, and sleep pattern detection.</div>
    `;
    container.appendChild(extensionCTA);

    // Export buttons
    const exportSection = document.createElement('div');
    exportSection.className = 'export-section';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn--primary';
    exportBtn.textContent = 'Download Your Profile (JSON)';
    exportBtn.addEventListener('click', () => downloadProfile(pricing));
    exportSection.appendChild(exportBtn);

    const videoBtn = document.createElement('button');
    videoBtn.className = 'btn btn--primary';
    videoBtn.style.marginLeft = '1rem';
    videoBtn.textContent = 'Export Video (WebM)';
    videoBtn.addEventListener('click', () => exportVideo());
    exportSection.appendChild(videoBtn);

    container.appendChild(exportSection);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `
      <div class="footer__text">
        This is an educational demonstration of browser fingerprinting.<br>
        No data leaves your device. All analysis runs locally in your browser.<br>
        <a class="footer__link" href="https://github.com/nickcampbell18/you-for-sale" target="_blank">Source Code</a>
      </div>
    `;
    container.appendChild(footer);

    app.appendChild(container);

    // Trigger animations
    runAnimations(container, pricing);
  }

  function runAnimations(container, pricing) {
    // Animate price count-up
    const priceNumber = container.querySelector('.price-tag__number');
    if (priceNumber) {
      UIComponents.animateCountUp(priceNumber, parseFloat(priceNumber.dataset.target));
    }

    // Sequential reveal of inference cards
    const cards = container.querySelectorAll('.inference-card');
    UIComponents.sequentialReveal(Array.from(cards), 150);

    // Animate entropy bars
    setTimeout(() => {
      UIComponents.animateEntropyBars(container);
    }, cards.length * 150 + 500);

    // Reveal other sections
    const sections = container.querySelectorAll('.section');
    sections.forEach((section, i) => {
      UIComponents.animateReveal(section, 200 + i * 100);
    });
  }

  function createDivider() {
    const hr = document.createElement('hr');
    hr.className = 'section__divider';
    return hr;
  }

  function hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  function downloadProfile(pricing) {
    const exportData = {
      generatedAt: new Date().toISOString(),
      fingerprint: collectedData,
      profile: {
        device: profile.device,
        location: profile.location,
        profession: profile.profession,
        techLiteracy: profile.techLiteracy,
        income: profile.income,
      },
      pricing: {
        cpm: pricing.cpm,
        annualEstimate: pricing.annualValue,
        factors: pricing.factors,
      },
      entropy: EntropyEngine.calculateEntropy(collectedData),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `you-for-sale-profile-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportVideo() {
    if (!collectedData || !profile || !storedEntropy || !storedUniqueness || !storedPricing) return;
    const vid = collectedData.advanced?.visitorId || hashSimple(JSON.stringify(collectedData.basic));
    const blob = await VideoRenderer.render(collectedData, profile, storedEntropy, storedUniqueness, storedPricing, vid);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `you-for-sale-${new Date().toISOString().split('T')[0]}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  Visualizer.init();
});
