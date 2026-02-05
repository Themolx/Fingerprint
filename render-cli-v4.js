#!/usr/bin/env node
/**
 * render-cli-v4.js — Fingerprint dossier renderer
 * Consistent 3rd-person robot voice, data-conditional blocks, scared timing, custom sonification
 *
 * Usage:  node render-cli-v4.js <input.json> [output.mp4]
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');
const { spawn, execSync } = require('child_process');

const InferenceEngine = require('./shared/inference-engine');
const EntropyEngine = require('./web/js/entropy');
const PricingEngine = require('./web/js/pricing');

// ---- Register Neue Montreal ----
const fontDir = '/Users/martintomek/Library/Fonts';
registerFont(path.join(fontDir, 'NeueMontreal-Bold.otf'), { family: 'Neue Montreal', weight: 'bold' });
registerFont(path.join(fontDir, 'NeueMontreal-Regular.otf'), { family: 'Neue Montreal', weight: 'normal' });

// ---- Constants ----
const W = 1920;
const H = 1080;
const FPS = 30;
const MARGIN_L = 80;

// ---- Seeded RNG for deterministic jitter ----
let _seed = 42;
function srand(s) { _seed = s; }
function rng() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }

// ---- Helpers ----
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

// ---- Scared timing algorithm ----
function scaredTiming(index, total, lineCount, importance) {
  const progress = index / Math.max(total, 1);
  let curve;
  if (progress < 0.15) curve = 1.3;
  else if (progress < 0.5) curve = 0.75;
  else if (progress < 0.75) curve = 0.6;
  else curve = 1.1 + (progress - 0.75) * 4;

  const base = 0.3 + lineCount * 0.22;
  const impMult = importance === 'flash' ? 0.35 : importance === 'linger' ? 2.2 : 1.0;
  const jitter = 0.75 + rng() * 0.5;

  return Math.max(0.25, base * curve * impMult * jitter);
}

// ---- Build data-conditional monolog ----
function buildMonolog(fpData, profile, entropy, uniqueness, pricing) {
  const d = fpData.basic || {};
  const adv = fpData.advanced || {};
  const ext = fpData.extension || {};
  const gpu = adv.components?.webGlBasics?.value?.rendererUnmasked || fpData.webgl?.renderer || '';
  const fonts = fpData.fonts || adv.components?.fonts?.value || [];
  const battery = fpData.battery || {};
  const media = fpData.mediaDevices || {};
  const cookies = ext.cookies || null;

  const dev = profile.device;
  const loc = profile.location;
  const inc = profile.income;
  const tech = profile.techLiteracy;
  const prof = profile.profession;

  const chipMatch = gpu.match(/Apple (M\d+\s*\w*)/i);
  const chip = chipMatch ? chipMatch[1] : '';
  const nvidiaMatch = gpu.match(/((?:RTX|GTX)\s*\d+\s*\w*)/i);
  const nvidia = nvidiaMatch ? nvidiaMatch[1] : '';
  const amdMatch = gpu.match(/(Radeon\s*(?:RX)?\s*\d+\s*\w*)/i);
  const amd = amdMatch ? amdMatch[1] : '';

  const collectedAt = fpData.collectedAt || fpData.generatedAt || '';
  let localHour = null;
  if (collectedAt && d.timezoneOffset !== undefined) {
    const utc = new Date(collectedAt);
    const local = new Date(utc.getTime() - d.timezoneOffset * 60000);
    localHour = local.getUTCHours();
  }

  const designFonts = fonts.filter(f => ['Futura','Avenir','Avenir Next','Gill Sans','Helvetica Neue','Open Sans','Proxima Nova','Baskerville','Didot','Optima'].includes(f));
  const devFonts = fonts.filter(f => ['Menlo','Monaco','Consolas','Fira Code','Source Code Pro','SF Mono','Courier New','Ubuntu Mono','DejaVu Sans Mono'].includes(f));
  const adobeFonts = fonts.filter(f => ['Myriad Pro','Minion Pro','Adobe Garamond','Kozuka Gothic','Adobe Caslon'].includes(f));

  const isMobile = dev.parsed.mobile === true;
  const isApple = dev.parsed.os === 'macOS' || dev.parsed.os === 'iOS';
  const isLinux = dev.parsed.os === 'Linux';
  const isWindows = dev.parsed.os === 'Windows';
  const isChromeOS = d.platform?.includes('CrOS');
  const isPremium = dev.deviceTier === 'Premium';
  const isBudget = dev.deviceTier === 'Budget' || dev.deviceTier === 'Low';
  const hasHighMemory = (d.deviceMemory || 0) >= 8;
  const hasHighCores = (d.hardwareConcurrency || 0) >= 8;
  const hasRetina = (d.devicePixelRatio || 1) >= 2;
  const hasWideColor = d.colorDepth >= 30;
  const hasWebcam = (media.videoinput || 0) > 0;
  const hasMic = (media.audioinput || 0) > 0;
  const hasDNT = d.doNotTrack === '1' || d.doNotTrack === 1;
  const hasCookies = d.cookieEnabled !== false;
  const isFirefox = dev.parsed.browser === 'Firefox';
  const isSafari = dev.parsed.browser === 'Safari';
  const isBrave = (d.userAgent || '').includes('Brave');
  const isChrome = dev.parsed.browser === 'Chrome' && !isBrave;

  // All blocks: { lines: string[], importance: 'normal'|'flash'|'linger' }
  const raw = [];
  function add(lines, importance) {
    raw.push({ lines: lines.filter(Boolean), importance: importance || 'normal' });
  }

  // ============================================================
  // 1. OPENING
  // ============================================================
  add(['scanning.'], 'normal');

  // ============================================================
  // 2. DEVICE DETECTION (fully conditional)
  // ============================================================
  if (isApple && chip) {
    add([dev.parsed.os.toLowerCase() + ' ' + dev.parsed.osVersion + '.', chip.toLowerCase() + '.', 'apple silicon.'], 'normal');
    add(['premium hardware.'], 'flash');
  } else if (isApple && !chip) {
    add([dev.parsed.os.toLowerCase() + ' ' + dev.parsed.osVersion + '.', 'apple. intel era.'], 'normal');
    add(['aging hardware. still premium brand.'], 'flash');
  } else if (isWindows && nvidia) {
    add(['windows ' + dev.parsed.osVersion + '.', nvidia.toLowerCase() + '.'], 'normal');
    if (nvidia.match(/RTX\s*(30|40|50)/i)) {
      add(['gaming rig. or workstation.', 'either way: disposable income.'], 'normal');
    } else {
      add(['mid-range GPU.', 'practical. budget-conscious.'], 'normal');
    }
  } else if (isWindows && amd) {
    add(['windows ' + dev.parsed.osVersion + '.', amd.toLowerCase() + '.'], 'normal');
    add(['AMD build. value-oriented.'], 'flash');
  } else if (isWindows) {
    add(['windows ' + dev.parsed.osVersion + '.'], 'normal');
    if (hasHighMemory && hasHighCores) {
      add(['powerful machine. workstation class.'], 'normal');
    } else if (!hasHighMemory) {
      add(['standard hardware.', (d.deviceMemory || '?') + 'GB RAM.', 'consumer tier.'], 'normal');
    }
  } else if (isLinux) {
    add(['linux.'], 'normal');
    add(['technical subject.', 'privacy-conscious? or just stubborn.'], 'normal');
  } else if (isChromeOS) {
    add(['chromebook.'], 'normal');
    add(['cloud-dependent. budget hardware.', 'student? or minimalist.'], 'normal');
  } else if (dev.parsed.os === 'iOS') {
    add(['iOS ' + dev.parsed.osVersion + '.', 'apple ecosystem.'], 'normal');
    add(['high-value mobile target.'], 'flash');
  } else if (dev.parsed.os === 'Android') {
    if (hasHighMemory) {
      add(['android. ' + (d.deviceMemory || '?') + 'GB RAM.', 'flagship device.'], 'normal');
    } else {
      add(['android. ' + (d.deviceMemory || '?') + 'GB RAM.', 'budget device.', 'emerging market?'], 'normal');
    }
  } else {
    add([dev.parsed.os.toLowerCase() + ' ' + dev.parsed.osVersion + '.'], 'normal');
  }

  // ============================================================
  // 3. FORM FACTOR (only if deducible)
  // ============================================================
  if (!isMobile && hasWebcam && hasMic && (d.maxTouchPoints || 0) === 0) {
    if (isApple) add(['webcam. microphone. no touch.', '=laptop. probably macbook.'], 'normal');
    else add(['webcam. microphone. no touch.', '=laptop.'], 'normal');
  } else if (!isMobile && !hasWebcam && hasMic) {
    add(['no webcam. external mic.', 'desktop workstation.'], 'normal');
  } else if (isMobile) {
    if ((d.maxTouchPoints || 0) > 3) add(['multi-touch. ' + d.maxTouchPoints + ' contact points.', 'mobile device.'], 'normal');
    else add(['mobile device.'], 'flash');
  }

  // ============================================================
  // 4. TECH LITERACY (based on actual score, never hardcoded)
  // ============================================================
  const techScore = tech.score || 50;
  if (techScore >= 80) {
    add(['tech literacy: ' + techScore + '/100.', 'expert level.'], 'normal');
    add(['knows shortcuts. skips tutorials.', 'reads documentation. for fun.'], 'normal');
    add(['harder to monetize.', 'resistant to clickbait.'], 'flash');
  } else if (techScore >= 60) {
    add(['tech literacy: ' + techScore + '/100.', 'above average.'], 'normal');
    add(['will research before purchasing.', 'serve comparison ads. reviews.'], 'normal');
  } else if (techScore >= 40) {
    add(['tech literacy: ' + techScore + '/100.', 'average user.'], 'normal');
    add(['standard targeting effective.'], 'flash');
  } else {
    add(['tech literacy: ' + techScore + '/100.', 'below average.'], 'normal');
    add(['susceptible to urgency tactics.', '"limited time offer" works here.'], 'normal');
  }

  // ============================================================
  // 5. BROWSER + TRACKING POSTURE (conditional per browser)
  // ============================================================
  if (isBrave) {
    add(['brave browser.', 'privacy-focused. actively hiding.'], 'normal');
    add(['still visible. still trackable.', 'the fingerprint doesn\'t lie.'], 'linger');
  } else if (isFirefox) {
    add(['firefox.', hasDNT ? 'do-not-track: enabled.' : 'no do-not-track.'], 'normal');
    if (hasDNT) {
      add(['irony: DNT makes the fingerprint more unique.', 'trying to hide. standing out instead.'], 'normal');
    }
  } else if (isSafari) {
    add(['safari.', 'some built-in protections.'], 'normal');
    add(['apple\'s privacy theater.', 'enough to feel safe. not enough to be safe.'], 'normal');
  } else if (isChrome) {
    const posture = [];
    posture.push('chrome ' + dev.parsed.browserVersion + '.');
    posture.push(hasCookies ? 'cookies: enabled.' : 'cookies: blocked.');
    posture.push(hasDNT ? 'do-not-track: on.' : 'no do-not-track.');
    add(posture, 'normal');
    if (!hasDNT && hasCookies) {
      add(['default settings. no resistance.'], 'flash');
      add(['thinks incognito means invisible.'], 'flash');
    }
  } else {
    add([dev.parsed.browser.toLowerCase() + ' ' + dev.parsed.browserVersion + '.'], 'normal');
  }

  // ============================================================
  // 6. HARDWARE DETAILS (conditional on what's interesting)
  // ============================================================
  const hwLines = [];
  if (d.hardwareConcurrency) hwLines.push(d.hardwareConcurrency + ' cores.');
  if (d.deviceMemory) hwLines.push(d.deviceMemory + 'GB RAM.');
  if (hwLines.length > 0) add([hwLines.join(' ')], 'normal');

  if (d.screenWidth && d.screenHeight) {
    add([d.screenWidth + '\u00d7' + d.screenHeight + ' @' + (d.devicePixelRatio || 1) + 'x.'], 'normal');
  }

  if (hasWideColor && hasRetina) {
    add([d.colorDepth + '-bit color. wide gamut. HDR.', 'professional-grade display.'], 'normal');
    add(['content creator? photographer? designer?'], 'flash');
  } else if (hasRetina) {
    add(['retina display.', isPremium ? 'premium screen.' : 'consumer retina.'], 'flash');
  } else if (d.colorDepth) {
    add([d.colorDepth + '-bit. standard display.'], 'flash');
  }

  // ============================================================
  // 7. BATTERY (only if data exists)
  // ============================================================
  if (battery.level !== undefined) {
    const pct = Math.round(battery.level * 100);
    if (battery.charging) {
      add(['battery: ' + pct + '%. charging.', 'plugged in. stationary.'], 'normal');
      add(['settled in. not going anywhere.'], 'flash');
    } else if (pct <= 20) {
      add(['battery: ' + pct + '%. not charging.', 'running low. will leave soon.'], 'normal');
      add(['limited window. act fast.'], 'flash');
    } else if (pct <= 50) {
      add(['battery: ' + pct + '%. on battery.', 'mobile. or forgot the charger.'], 'normal');
    } else {
      add(['battery: ' + pct + '%.', 'session could be long.'], 'normal');
    }
  }

  // ============================================================
  // 8. TIME OF DAY (only if determinable)
  // ============================================================
  if (localHour !== null) {
    const h = localHour;
    const m = collectedAt ? new Date(collectedAt).getMinutes() : 0;
    const timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

    if (h >= 0 && h < 5) {
      add([timeStr + ' local time.', 'deep night.'], 'normal');
      add(['impulse control lowest between midnight and 4am.', 'increase bid.'], 'linger');
    } else if (h >= 22 || h === 5) {
      add([timeStr + ' local time.', 'late night.'], 'normal');
      add(['can\'t sleep? or won\'t sleep?', 'late night purchases convert 40% better.'], 'linger');
    } else if (h >= 6 && h < 9) {
      add([timeStr + ' local time.', 'early session.'], 'normal');
      add(['routine browser. habitual.', 'serve morning news. coffee ads.'], 'normal');
    } else if (h >= 9 && h < 12) {
      add([timeStr + ' local time.', 'morning. work hours.'], 'normal');
      add(['should be working. procrastinating.', 'receptive to distractions.'], 'normal');
    } else if (h >= 12 && h < 14) {
      add([timeStr + ' local time.', 'lunch break.'], 'normal');
      add(['free time. browsing. shopping.', 'food delivery ads? retail?'], 'normal');
    } else if (h >= 14 && h < 17) {
      add([timeStr + ' local time.', 'afternoon slump.'], 'normal');
      add(['attention fading. easier to convert.'], 'flash');
    } else if (h >= 17 && h < 20) {
      add([timeStr + ' local time.', 'evening.'], 'normal');
      add(['decision fatigue setting in.', 'emotional purchases peak now.'], 'normal');
    } else {
      add([timeStr + ' local time.', 'late evening.'], 'normal');
      add(['winding down. guard lowered.'], 'flash');
    }
  }

  // ============================================================
  // 9. LOCATION + LANGUAGE
  // ============================================================
  add([(d.timezone || 'unknown timezone').toLowerCase() + '.', loc.country.toLowerCase() + '.', loc.market.toLowerCase() + ' market.'], 'normal');

  // Language mismatch detection
  const langCode = (d.language || '').substring(0, 2).toLowerCase();
  const langInForeign = langCode === 'en' && !['United States','United Kingdom','Canada','Australia','Ireland','New Zealand'].includes(loc.country);
  const nonEnglishInEnglish = langCode !== 'en' && ['United States','United Kingdom','Canada','Australia'].includes(loc.country);

  if (langInForeign) {
    add(['english speaker in ' + loc.country.toLowerCase() + '.', 'expatriate? remote worker? digital nomad?'], 'normal');
    add(['probably misses home.', 'show airline ads. relocation services.'], 'normal');
  } else if (nonEnglishInEnglish) {
    add([d.language.toLowerCase() + ' speaker in ' + loc.country.toLowerCase() + '.', 'immigrant? international student?'], 'normal');
    add(['target with community services.', 'language learning ads.'], 'normal');
  }

  // ============================================================
  // 10. FONT FORENSICS (only if relevant fonts detected)
  // ============================================================
  if (devFonts.length > 0 && designFonts.length > 0) {
    add(['developer fonts: ' + devFonts.slice(0, 2).join(', ').toLowerCase() + '.', 'design fonts: ' + designFonts.slice(0, 2).join(', ').toLowerCase() + '.'], 'normal');
    add(['builds things AND makes them pretty.', 'rare combination. high value.'], 'normal');
  } else if (devFonts.length > 0) {
    add(['developer fonts detected.', devFonts.slice(0, 3).join(', ').toLowerCase() + '.'], 'normal');
    add(['writes code.'], 'flash');
  } else if (designFonts.length > 0) {
    add(['design fonts detected.', designFonts.slice(0, 3).join(', ').toLowerCase() + '.'], 'normal');
    add(['visual professional.'], 'flash');
  } else if (adobeFonts.length > 0) {
    add(['adobe creative suite fonts.', 'creative professional.'], 'normal');
  } else if (fonts.length > 20) {
    add([fonts.length + ' fonts installed.', 'above average. creative field?'], 'normal');
  }
  // no fonts block at all for standard font stacks

  // ============================================================
  // 11. PROFESSION (from actual inference with confidence %)
  // ============================================================
  const allProf = prof.all || [];
  if (allProf.length > 0) {
    add(allProf.slice(0, 3).map(p =>
      p.label.toLowerCase() + '. (' + Math.round(p.confidence * 100) + '%)'
    ), 'normal');
  }

  // ============================================================
  // 12. INCOME (conditional on bracket)
  // ============================================================
  if (inc.bracket === 'High' || inc.bracket === 'Upper-Middle') {
    add([inc.bracket.toLowerCase() + ' income.', 'est. ' + inc.estimate.toLowerCase() + '.'], 'normal');
    add(['premium ad inventory.', 'luxury brands. SaaS. investment products.'], 'normal');
    add(['could afford to say no.', '', 'doesn\'t.'], 'linger');
  } else if (inc.bracket === 'Middle') {
    add(['middle income.', 'est. ' + inc.estimate.toLowerCase() + '.'], 'normal');
    add(['volume target.', 'discount codes. subscription trials. loyalty programs.'], 'normal');
  } else {
    add(['lower income bracket.', 'est. ' + inc.estimate.toLowerCase() + '.'], 'normal');
    add(['cost-sensitive.', 'payday loan ads. buy-now-pay-later.', 'predatory? effective.'], 'normal');
  }

  // ============================================================
  // 13. CONNECTION (if available)
  // ============================================================
  if (d.connectionType) {
    if (d.connectionType === '4g' && (d.connectionDownlink || 0) > 5) {
      add(['fast connection. ' + d.connectionDownlink + ' mbps.', 'serve rich media. video ads. interactive.'], 'normal');
    } else if (d.connectionType === '4g') {
      add([d.connectionType + '. ' + (d.connectionDownlink || '?') + ' mbps.'], 'flash');
    } else if (d.connectionType === '3g' || d.connectionType === '2g') {
      add(['slow connection. ' + d.connectionType + '.', 'text-only ads. lightweight creatives.'], 'normal');
      if (d.connectionSaveData) add(['data saver enabled. cost-conscious.'], 'flash');
    }
  }

  // ============================================================
  // 14. COOKIE SURVEILLANCE (only with extension data)
  // ============================================================
  if (cookies && cookies.total > 0) {
    add([cookies.total + ' cookies found.', cookies.trackerCount + ' belong to known trackers.', Math.round((cookies.trackerPercentage || (cookies.trackerCount / cookies.total * 100))) + '% surveillance.'], 'normal');

    add(['subject agreed to this.', 'somewhere in a terms of service.', 'subject didn\'t read it.'], 'linger');

    const bycat = cookies.byCategory || {};
    if (bycat.advertising > 0 || bycat.social > 0 || bycat.data_brokers > 0) {
      const breakdown = [];
      if (bycat.advertising > 0) breakdown.push(bycat.advertising + ' advertising.');
      if (bycat.social > 0) breakdown.push(bycat.social + ' social media.');
      if (bycat.data_brokers > 0) breakdown.push(bycat.data_brokers + ' data brokers.');
      add(breakdown, 'normal');
    }

    const topT = (cookies.topTrackers || []).slice(0, 5);
    if (topT.length > 0) {
      add(topT.map(t => t.domain + ': ' + t.count + '.'), 'normal');
    }

    const zombies = cookies.lifetimes?.zombie || 0;
    if (zombies > 0) {
      add([zombies + ' zombie cookies.', 'survive clearing. regenerate.'], 'normal');
      add(['deleted cookies last week?', '', 'they came back.'], 'linger');
    }

    const socialTrackers = (cookies.topTrackers || []).filter(t => t.category === 'social');
    if (socialTrackers.length >= 2) {
      const names = socialTrackers.map(t => t.domain.replace('.com', '')).join('. ') + '.';
      add([names, 'tracking outside their platforms.', 'the social graph is the product.'], 'normal');
    }

    const brokers = (cookies.topTrackers || []).filter(t => t.category === 'data_brokers');
    if (brokers.length > 0) {
      add([brokers.map(t => t.domain).join('. ') + '.', 'device graph company.', 'phone. laptop. tablet. all linked.'], 'linger');
    }
  }

  // ============================================================
  // 15. ENTROPY + UNIQUENESS
  // ============================================================
  const bits = entropy.totalBits;
  if (bits > 50) {
    add([bits.toFixed(1) + ' bits of entropy.', 'extremely unique.'], 'normal');
    add(['identifiable among ' + uniqueness.populationSize + '.', uniqueness.percent + '%.'], 'normal');
  } else if (bits > 30) {
    add([bits.toFixed(1) + ' bits of entropy.', 'highly unique.'], 'normal');
    add([uniqueness.percent + '% identifiable.'], 'flash');
  } else if (bits > 15) {
    add([bits.toFixed(1) + ' bits.', 'moderately unique.', 'combined with other signals: identifiable.'], 'normal');
  } else {
    add([bits.toFixed(1) + ' bits.', 'common profile.', 'harder to single out. but not impossible.'], 'normal');
  }

  // Fingerprint vectors
  add(['canvas: unique.', 'audio: unique.', 'GPU: unique.', 'every signal confirms: one subject.'], 'normal');
  add(['needle in a haystack?', '', 'subject IS the needle.'], 'linger');

  // ============================================================
  // 16. VALUATION
  // ============================================================
  add(['$' + pricing.cpm.toFixed(2) + ' CPM.', '$' + pricing.annualValue.toFixed(0) + '/year.'], 'normal');
  add(['less than a coffee.', 'but thousands of times a day.'], 'normal');

  // Pricing factors
  const factors = pricing.factors || [];
  if (factors.length > 0) {
    add(factors.slice(0, 4).map(f => f.label.toLowerCase() + ': ' + f.effect.toLowerCase() + '.'), 'normal');
  }

  // ============================================================
  // 17. IDENTIFICATION — shift begins
  // ============================================================
  add(['subject fully profiled.'], 'flash');

  add(['we gave it a name.', 'it didn\'t choose it.'], 'normal');

  const vid = fpData.advanced?.visitorId || adv.visitorId || adv.components?.visitorId || '00000000';
  add(['visitor ID:', vid], 'normal');

  add(['collected in seconds.', 'no permission required.'], 'normal');

  // ============================================================
  // 18. ENDING — switches to "you"
  // ============================================================
  add(['classification:', 'advertising commodity.'], 'linger');

  add(['filed. indexed. sold.', 'again and again and again.'], 'linger');

  add(['you can close this tab.', '', 'we already have what we need.'], 'linger');

  add(['you are the product.'], 'linger');

  return raw;
}

// ---- Fit font size ----
function fitFontSize(ctx, text, maxW, maxSize, minSize) {
  for (let s = maxSize; s >= minSize; s -= 2) {
    ctx.font = `bold ${s}px "Neue Montreal"`;
    if (ctx.measureText(text).width <= maxW) return s;
  }
  return minSize;
}

// ---- Generate custom audio (WAV) ----
function generateAudio(blocks, totalDurationSec, outputPath) {
  const SR = 44100;
  const totalSamples = Math.ceil(totalDurationSec * SR);
  const buf = Buffer.alloc(totalSamples * 2); // 16-bit mono

  // Low drone frequency from entropy-inspired value
  const droneFreq = 40 + Math.random() * 20;
  let phase = 0;
  let transientQueue = [];

  // Queue transients at block transitions
  let t = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    transientQueue.push({ sample: Math.floor(t * SR), intensity: b.importance === 'linger' ? 0.7 : 0.4 });
    t += b.holdSec + (b.lines.length * 0.2) + 0.5;
  }

  for (let i = 0; i < totalSamples; i++) {
    const sec = i / SR;
    const progress = i / totalSamples;

    // Drone: gets louder and more dissonant over time
    const droneAmp = 0.05 + progress * 0.15;
    const drone = Math.sin(phase) * droneAmp;
    phase += (2 * Math.PI * droneFreq * (1 + progress * 0.3)) / SR;

    // Sub-bass pulse
    const subPulse = Math.sin(2 * Math.PI * 25 * sec) * 0.03 * (1 + progress);

    // Transient clicks
    let click = 0;
    for (const tr of transientQueue) {
      const dist = i - tr.sample;
      if (dist >= 0 && dist < SR * 0.05) {
        const env = Math.exp(-dist / (SR * 0.008));
        click += env * tr.intensity * (Math.random() * 2 - 1);
      }
    }

    // High frequency tension that builds
    const tensionFreq = 800 + progress * 3000;
    const tensionAmp = Math.max(0, (progress - 0.3) * 0.08);
    const tension = Math.sin(2 * Math.PI * tensionFreq * sec) * tensionAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.3 * sec));

    // Noise floor increases
    const noise = (Math.random() * 2 - 1) * 0.01 * progress;

    const sample = clamp(drone + subPulse + click + tension + noise, -0.95, 0.95);
    const int16 = Math.floor(sample * 32767);
    buf.writeInt16LE(int16, i * 2);
  }

  // Write WAV
  const header = Buffer.alloc(44);
  const dataSize = buf.length;
  const fileSize = 36 + dataSize;
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);    // PCM
  header.writeUInt16LE(1, 22);    // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(outputPath, Buffer.concat([header, buf]));
  return outputPath;
}

// ---- Main ----
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node render-cli-v4.js <input.json> [output.mp4]');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : inputPath.replace(/\.json$/i, '-v4.mp4');

  console.log('Reading:', inputPath);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const fpData = raw.fingerprint || raw;
  if (raw.extension && !fpData.extension) fpData.extension = raw.extension;
  if (raw.generatedAt && !fpData.generatedAt) fpData.generatedAt = raw.generatedAt;

  const profile = InferenceEngine.generateFullProfile(fpData);
  const entropy = EntropyEngine.calculateEntropy(fpData);
  const uniqueness = EntropyEngine.calculateUniqueness(entropy.totalBits);
  const pricing = PricingEngine.getBreakdown(profile);

  console.log(`Profile: ${profile.device.deviceGuess} | ${profile.location.country}`);
  console.log(`Entropy: ${entropy.totalBits.toFixed(1)} bits | ${uniqueness.percent}% unique`);
  console.log(`CPM: $${pricing.cpm.toFixed(2)}`);
  console.log();

  // Build monolog
  const blocks = buildMonolog(fpData, profile, entropy, uniqueness, pricing);

  // Seed RNG from visitor ID for deterministic timing
  const vid = fpData.advanced?.visitorId || '';
  srand(vid.split('').reduce((a, c) => a + c.charCodeAt(0), 1));

  // Apply scared timing
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].holdSec = scaredTiming(i, blocks.length, blocks[i].lines.length, blocks[i].importance);
  }

  console.log(`${blocks.length} thought blocks generated.`);

  // ---- Frame timing ----
  const LINE_FADE = 8;
  const LINE_GAP = 6;
  const FADE_OUT = 10;
  const BLOCK_BLACK = 8;

  let totalFrames = 0;
  const blockTimings = [];
  for (const block of blocks) {
    const lf = block.lines.length * LINE_GAP + LINE_FADE;
    const hf = Math.round(block.holdSec * FPS);
    const dur = lf + hf + FADE_OUT + BLOCK_BLACK;
    blockTimings.push({ start: totalFrames, duration: dur, linesFrames: lf, holdFrames: hf });
    totalFrames += dur;
  }
  totalFrames += 30;

  const duration = (totalFrames / FPS).toFixed(1);
  console.log(`Rendering ${totalFrames} frames (${duration}s) at ${W}x${H} @ ${FPS}fps`);
  console.log(`Output: ${outputPath}`);
  console.log();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ---- Generate custom audio ----
  const audioPath = outputPath.replace(/\.mp4$/, '.wav');
  console.log('  Generating custom audio...');
  generateAudio(blocks, totalFrames / FPS, audioPath);
  console.log('  Audio: ' + audioPath);

  // ---- Render video (silent) ----
  const silentPath = outputPath.replace(/\.mp4$/, '_silent.mp4');
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo',
    '-s', `${W}x${H}`, '-pix_fmt', 'rgba', '-r', String(FPS),
    '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18',
    '-movflags', '+faststart', silentPath,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => { ffmpegErr += d.toString(); });
  const ffmpegDone = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg: ${code}\n${ffmpegErr.slice(-300)}`)));
    ffmpeg.on('error', reject);
  });

  const startTime = Date.now();
  const maxTextW = W - MARGIN_L * 2;

  for (let gf = 0; gf < totalFrames; gf++) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (let bi = 0; bi < blocks.length; bi++) {
      const bt = blockTimings[bi];
      const f = gf - bt.start;
      if (f < 0 || f >= bt.duration) continue;

      const block = blocks[bi];
      const contentEnd = bt.linesFrames + bt.holdFrames;

      let blockAlpha = 1;
      if (f >= contentEnd) blockAlpha = 1 - clamp((f - contentEnd) / FADE_OUT, 0, 1);
      if (blockAlpha <= 0) continue;

      const lineSizes = [];
      for (const line of block.lines) {
        if (line === '') lineSizes.push({ size: 40, text: '' });
        else {
          const sz = fitFontSize(ctx, line, maxTextW, 120, 28);
          lineSizes.push({ size: sz, text: line });
        }
      }

      const lineSpacing = 1.25;
      let totalH = 0;
      for (const ls of lineSizes) totalH += ls.size * lineSpacing;
      let startY = (H - totalH) / 2 + lineSizes[0].size;

      for (let li = 0; li < block.lines.length; li++) {
        const ls = lineSizes[li];
        if (ls.text === '') { startY += ls.size * lineSpacing; continue; }

        const lineStart = li * LINE_GAP;
        const lineAlpha = easeOut(clamp((f - lineStart) / LINE_FADE, 0, 1));
        const alpha = lineAlpha * blockAlpha;
        if (alpha <= 0) { startY += ls.size * lineSpacing; continue; }

        ctx.font = `bold ${ls.size}px "Neue Montreal"`;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.textAlign = 'left';
        ctx.fillText(ls.text, MARGIN_L, startY);
        startY += ls.size * lineSpacing;
      }

      // Cursor blink
      const visibleLines = Math.min(block.lines.length, Math.floor(f / LINE_GAP) + 1);
      if (f < contentEnd && blockAlpha > 0.5) {
        const blink = Math.floor(gf / 15) % 2 === 0;
        if (blink && visibleLines > 0) {
          const lastLS = lineSizes[visibleLines - 1];
          ctx.font = `bold ${lastLS.size}px "Neue Montreal"`;
          const tw = ctx.measureText(lastLS.text).width;
          const cursorY = startY - lastLS.size * lineSpacing;
          ctx.fillStyle = `rgba(255,255,255,${0.7 * blockAlpha})`;
          ctx.fillRect(MARGIN_L + tw + 8, cursorY - lastLS.size * 0.75, 3, lastLS.size * 0.85);
        }
      }
      break;
    }

    const buf = canvas.toBuffer('raw');
    const canWrite = ffmpeg.stdin.write(buf);
    if (!canWrite) await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));

    if (gf % 30 === 0 || gf === totalFrames - 1) {
      const pct = ((gf / totalFrames) * 100).toFixed(0);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fps = (gf / Math.max(Date.now() - startTime, 1) * 1000).toFixed(1);
      process.stdout.write(`\r  [${pct.padStart(3)}%]  ${gf}/${totalFrames} frames  ${elapsed}s  ${fps} fps`);
    }
  }

  ffmpeg.stdin.end();
  process.stdout.write('\n\n  Encoding video...');
  await ffmpegDone;
  console.log(' done.');

  // ---- Merge video + audio ----
  console.log('  Merging video + audio...');
  try {
    execSync(
      `ffmpeg -y -i "${silentPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`,
      { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    try { fs.unlinkSync(silentPath); } catch(e) {}
    console.log('  Merged.');
  } catch(e) {
    console.log('  Merge failed, using silent video.');
    if (fs.existsSync(silentPath)) fs.renameSync(silentPath, outputPath);
  }

  // ---- Also run img2sound if available ----
  const img2sound = '/tmp/ImageSonofication/venv/bin/img2sound';
  if (fs.existsSync(img2sound)) {
    console.log('\n  Running img2sound additive...');
    try {
      const out = execSync(
        `"${img2sound}" additive "${outputPath}" --freq-min 60 --freq-max 2000 --oscillators 128`,
        { cwd: path.dirname(outputPath), timeout: 300000 }
      ).toString();
      console.log('  ' + out.trim().split('\n').pop());
    } catch(e) {
      console.log('  img2sound skipped: ' + e.message.slice(0, 100));
    }
  }

  const stat = fs.statSync(outputPath);
  console.log(`\n  Output: ${outputPath}`);
  console.log(`  Size:   ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Time:   ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log();
}

main().catch(err => { console.error('\nError:', err.message); process.exit(1); });
