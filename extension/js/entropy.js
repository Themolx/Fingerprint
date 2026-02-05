/**
 * Entropy & Uniqueness Calculator
 * Estimates fingerprint uniqueness based on Shannon entropy
 * References: EFF Panopticlick research — 18+ bits = likely unique among 286,777+ browsers
 */

const EntropyEngine = (() => {

  // Estimated bits of entropy per signal (based on research data)
  const ENTROPY_ESTIMATES = {
    userAgent: { bits: 10.0, label: 'User Agent', description: 'Browser + OS version string' },
    language: { bits: 3.8, label: 'Language', description: 'Primary language setting' },
    languages: { bits: 4.5, label: 'Language List', description: 'All configured languages' },
    timezone: { bits: 3.0, label: 'Timezone', description: 'System timezone' },
    screenResolution: { bits: 4.8, label: 'Screen Resolution', description: 'Display dimensions + pixel ratio' },
    colorDepth: { bits: 1.5, label: 'Color Depth', description: 'Display color depth' },
    hardwareConcurrency: { bits: 2.5, label: 'CPU Cores', description: 'Number of logical processors' },
    deviceMemory: { bits: 2.0, label: 'Device Memory', description: 'Available RAM' },
    platform: { bits: 3.0, label: 'Platform', description: 'OS platform string' },
    doNotTrack: { bits: 1.0, label: 'Do Not Track', description: 'DNT header setting' },
    cookieEnabled: { bits: 0.5, label: 'Cookies', description: 'Cookie support' },
    webglRenderer: { bits: 7.5, label: 'WebGL Renderer', description: 'GPU model (most identifying single signal)' },
    webglVendor: { bits: 3.0, label: 'WebGL Vendor', description: 'GPU vendor' },
    canvasHash: { bits: 6.0, label: 'Canvas Fingerprint', description: 'Canvas rendering differences' },
    audioFingerprint: { bits: 5.5, label: 'Audio Fingerprint', description: 'Audio processing differences' },
    fonts: { bits: 6.5, label: 'Installed Fonts', description: 'Available system fonts' },
    plugins: { bits: 4.0, label: 'Plugins', description: 'Browser plugins' },
    touchSupport: { bits: 1.5, label: 'Touch Support', description: 'Touch capabilities' },
    connection: { bits: 2.0, label: 'Connection', description: 'Network type and speed' },
    devicePixelRatio: { bits: 2.5, label: 'Pixel Ratio', description: 'Display scaling factor' },
  };

  function calculateEntropy(fingerprintData) {
    const contributions = [];
    let totalBits = 0;

    // Check which signals are present and contribute entropy
    const checks = {
      userAgent: !!fingerprintData.basic?.userAgent,
      language: !!fingerprintData.basic?.language,
      languages: (fingerprintData.basic?.languages || []).length > 1,
      timezone: !!fingerprintData.basic?.timezone,
      screenResolution: !!fingerprintData.basic?.screenWidth,
      colorDepth: !!fingerprintData.basic?.colorDepth,
      hardwareConcurrency: !!fingerprintData.basic?.hardwareConcurrency,
      deviceMemory: !!fingerprintData.basic?.deviceMemory,
      platform: !!fingerprintData.basic?.platform,
      doNotTrack: fingerprintData.basic?.doNotTrack !== null && fingerprintData.basic?.doNotTrack !== undefined,
      cookieEnabled: true,
      webglRenderer: !!fingerprintData.webgl?.renderer,
      webglVendor: !!fingerprintData.webgl?.vendor,
      canvasHash: !!fingerprintData.canvas,
      audioFingerprint: !!fingerprintData.audio,
      fonts: (fingerprintData.fonts || []).length > 0,
      plugins: (fingerprintData.plugins || []).length > 0,
      touchSupport: fingerprintData.basic?.maxTouchPoints !== undefined,
      connection: !!fingerprintData.basic?.connectionType,
      devicePixelRatio: !!fingerprintData.basic?.devicePixelRatio,
    };

    for (const [key, present] of Object.entries(checks)) {
      const estimate = ENTROPY_ESTIMATES[key];
      if (!estimate) continue;

      const bits = present ? estimate.bits : 0;
      contributions.push({
        signal: key,
        label: estimate.label,
        description: estimate.description,
        bits,
        present,
      });
      totalBits += bits;
    }

    // Sort by bits descending
    contributions.sort((a, b) => b.bits - a.bits);

    return { totalBits, contributions };
  }

  function calculateUniqueness(totalBits) {
    // 2^bits = number of distinct combinations
    const combinations = Math.pow(2, totalBits);

    // EFF research: with ~18+ bits, you're unique among ~286,777 browsers
    // With modern fingerprinting getting 30-40+ bits, you're unique among billions
    let uniquenessPercent;
    if (totalBits >= 33) {
      uniquenessPercent = 99.99;
    } else if (totalBits >= 25) {
      uniquenessPercent = 99.9;
    } else if (totalBits >= 20) {
      uniquenessPercent = 99.5;
    } else if (totalBits >= 18) {
      uniquenessPercent = 99.0;
    } else if (totalBits >= 15) {
      uniquenessPercent = 95.0;
    } else if (totalBits >= 10) {
      uniquenessPercent = 80.0;
    } else {
      uniquenessPercent = 50.0;
    }

    let populationSize;
    if (combinations > 1e9) populationSize = `${(combinations / 1e9).toFixed(1)} billion`;
    else if (combinations > 1e6) populationSize = `${(combinations / 1e6).toFixed(1)} million`;
    else if (combinations > 1e3) populationSize = `${(combinations / 1e3).toFixed(0)} thousand`;
    else populationSize = combinations.toFixed(0);

    return {
      percent: uniquenessPercent,
      combinations,
      populationSize,
      description: totalBits >= 18
        ? `Your fingerprint is likely unique among ${populationSize} browsers. You can be tracked without cookies.`
        : `Your fingerprint has moderate uniqueness. Combined with other signals, you may still be identifiable.`,
    };
  }

  return { calculateEntropy, calculateUniqueness, ENTROPY_ESTIMATES };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EntropyEngine;
}
