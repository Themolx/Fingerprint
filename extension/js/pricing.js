/**
 * CPM Price Calculator — estimates the user's advertising value
 * Based on real programmatic advertising CPM ranges
 */

const PricingEngine = (() => {

  // Base CPM rates by market tier (in USD)
  const MARKET_CPMS = {
    'Tier 1': { min: 3.50, max: 12.00 },  // US, UK, Germany, Japan, etc.
    'Tier 2': { min: 1.50, max: 5.00 },   // Spain, Italy, Czech Republic, etc.
    'Tier 3': { min: 0.50, max: 2.50 },   // Romania, Brazil, India, etc.
    'Tier 4': { min: 0.10, max: 1.00 },   // Developing markets
  };

  // Device tier multipliers
  const DEVICE_MULTIPLIERS = {
    'Premium': 1.6,
    'Mid-range': 1.0,
    'Budget': 0.6,
  };

  // Platform multipliers (desktop generally more valuable)
  const PLATFORM_MULTIPLIERS = {
    'Desktop': 1.2,
    'Tablet': 1.0,
    'Phone': 0.8,
  };

  function calculateCPM(profile) {
    const marketTier = profile.location.market || 'Tier 3';
    const base = MARKET_CPMS[marketTier] || MARKET_CPMS['Tier 3'];

    // Start with midpoint of range
    let cpm = (base.min + base.max) / 2;

    // Device tier adjustment
    const deviceMult = DEVICE_MULTIPLIERS[profile.device.deviceTier] || 1.0;
    cpm *= deviceMult;

    // Platform adjustment
    const platformMult = PLATFORM_MULTIPLIERS[profile.device.deviceType] || 1.0;
    cpm *= platformMult;

    // Tech literacy penalty — tech-savvy users are harder to convert
    if (profile.techLiteracy.score >= 70) {
      cpm *= 0.85; // Ad blockers, less likely to click
    }

    // Income bracket boost
    if (profile.income.bracket.includes('High') || profile.income.bracket.includes('Upper')) {
      cpm *= 1.3;
    } else if (profile.income.bracket.includes('Lower')) {
      cpm *= 0.7;
    }

    // Connection quality
    // Good connection = can serve richer ads = more valuable
    if (profile.device.parsed?.mobile && profile.location?.connectionType === '4g') {
      cpm *= 1.1;
    }

    // Clamp to market range
    cpm = Math.max(base.min * 0.5, Math.min(base.max * 2, cpm));

    return Math.round(cpm * 100) / 100;
  }

  function getBreakdown(profile) {
    const marketTier = profile.location.market || 'Tier 3';
    const base = MARKET_CPMS[marketTier] || MARKET_CPMS['Tier 3'];
    const baseCPM = (base.min + base.max) / 2;
    const finalCPM = calculateCPM(profile);

    const factors = [
      {
        label: 'Geographic Market',
        value: `${profile.location.region} (${marketTier})`,
        effect: `Base: $${baseCPM.toFixed(2)}`,
      },
      {
        label: 'Device Tier',
        value: `${profile.device.deviceGuess} (${profile.device.deviceTier})`,
        effect: `×${DEVICE_MULTIPLIERS[profile.device.deviceTier] || 1.0}`,
      },
      {
        label: 'Platform',
        value: profile.device.deviceType,
        effect: `×${PLATFORM_MULTIPLIERS[profile.device.deviceType] || 1.0}`,
      },
      {
        label: 'Tech Literacy',
        value: `${profile.techLiteracy.level} (${profile.techLiteracy.score}/100)`,
        effect: profile.techLiteracy.score >= 70 ? '×0.85 (ad-resistant)' : '×1.0',
      },
      {
        label: 'Income Estimate',
        value: profile.income.bracket,
        effect: profile.income.bracket.includes('High') || profile.income.bracket.includes('Upper') ? '×1.3' : (profile.income.bracket.includes('Lower') ? '×0.7' : '×1.0'),
      },
    ];

    return {
      cpm: finalCPM,
      annualValue: Math.round(finalCPM * 30 * 100) / 100, // ~30k impressions/year per avg user
      factors,
    };
  }

  return { calculateCPM, getBreakdown };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PricingEngine;
}
