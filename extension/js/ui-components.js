/**
 * Shared UI Components — reusable DOM builders and animation helpers
 */

const UIComponents = (() => {

  function createElement(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content) el.textContent = content;
    return el;
  }

  function createDataRow(label, value, detail) {
    const row = createElement('div', 'data-row');
    row.innerHTML = `
      <div class="data-row__label">${label}</div>
      <div class="data-row__value">${value}</div>
      ${detail ? `<div class="data-row__detail">${detail}</div>` : ''}
    `;
    return row;
  }

  function createInferenceCard(inference) {
    const card = createElement('div', 'inference-card');
    card.innerHTML = `
      <div class="inference-card__header">
        <span class="inference-card__icon">${inference.icon || ''}</span>
        <span class="inference-card__category">${inference.category}</span>
      </div>
      <div class="inference-card__body">
        <div class="inference-card__raw">
          <span class="inference-card__label">RAW DATA</span>
          <span class="inference-card__raw-value">${inference.raw}</span>
        </div>
        <div class="inference-card__arrow">→</div>
        <div class="inference-card__inferred">
          <span class="inference-card__label">WHAT THEY KNOW</span>
          <span class="inference-card__inferred-value">${inference.inference}</span>
        </div>
      </div>
      <div class="inference-card__usage">
        <span class="inference-card__label">HOW IT'S USED</span>
        <span class="inference-card__usage-text">${inference.usage}</span>
      </div>
    `;
    return card;
  }

  function createEntropyBar(label, bits, maxBits) {
    const pct = Math.min(100, (bits / maxBits) * 100);
    const bar = createElement('div', 'entropy-bar');
    bar.innerHTML = `
      <div class="entropy-bar__label">${label}</div>
      <div class="entropy-bar__track">
        <div class="entropy-bar__fill" style="width: 0%" data-target-width="${pct}%"></div>
      </div>
      <div class="entropy-bar__bits">${bits.toFixed(1)} bits</div>
    `;
    return bar;
  }

  function createPriceTag(cpm) {
    const el = createElement('div', 'price-tag');
    el.innerHTML = `
      <div class="price-tag__label">YOUR PRICE TAG</div>
      <div class="price-tag__amount">$<span class="price-tag__number" data-target="${cpm.toFixed(2)}">0.00</span> <span class="price-tag__unit">CPM</span></div>
      <div class="price-tag__explanation">Your attention is worth approximately $${cpm.toFixed(2)} per 1,000 ad impressions</div>
    `;
    return el;
  }

  function createProductCard(profile, visitorId, uniqueness) {
    const card = createElement('div', 'product-card');
    card.innerHTML = `
      <div class="product-card__avatar">
        <svg viewBox="0 0 100 120" class="product-card__silhouette">
          <circle cx="50" cy="35" r="25" fill="currentColor" opacity="0.3"/>
          <ellipse cx="50" cy="95" rx="35" ry="28" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>
      <div class="product-card__info">
        <div class="product-card__id">PRODUCT #${(visitorId || 'unknown').substring(0, 8)}</div>
        <div class="product-card__field"><span>Category:</span> ${profile.profession.primary}</div>
        <div class="product-card__field"><span>Market:</span> ${profile.location.region}</div>
        <div class="product-card__field"><span>Device Tier:</span> ${profile.device.deviceTier}</div>
        <div class="product-card__field"><span>Uniqueness:</span> ${uniqueness}%</div>
      </div>
    `;
    return card;
  }

  function createPrivacyNotice() {
    const notice = createElement('div', 'privacy-notice');
    notice.innerHTML = `
      <div class="privacy-notice__icon"></div>
      <div class="privacy-notice__text">
        <strong>All data stays on your device.</strong> Nothing is sent to any server.
        This tool uses the same techniques real trackers use — but only to show you what they see.
      </div>
    `;
    return notice;
  }

  // Animation helpers
  function animateCountUp(element, target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      element.textContent = current.toFixed(2);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function animateReveal(element, delay = 0) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    setTimeout(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, delay);
  }

  function animateEntropyBars(container) {
    const fills = container.querySelectorAll('.entropy-bar__fill');
    fills.forEach((fill, i) => {
      setTimeout(() => {
        fill.style.transition = 'width 0.8s ease';
        fill.style.width = fill.dataset.targetWidth;
      }, i * 100);
    });
  }

  function sequentialReveal(elements, baseDelay = 300) {
    elements.forEach((el, i) => {
      animateReveal(el, baseDelay * (i + 1));
    });
  }

  return {
    createElement,
    createDataRow,
    createInferenceCard,
    createEntropyBar,
    createPriceTag,
    createProductCard,
    createPrivacyNotice,
    animateCountUp,
    animateReveal,
    animateEntropyBars,
    sequentialReveal,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
}
