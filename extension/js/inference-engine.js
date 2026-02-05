/**
 * Inference Engine — transforms raw fingerprint data into human-readable insights
 * Maps technical signals to what advertisers/trackers actually infer about you
 */

const InferenceEngine = (() => {

  function parseUserAgent(ua) {
    const result = { browser: 'Unknown', browserVersion: '', os: 'Unknown', osVersion: '', mobile: false };
    if (!ua) return result;

    // OS detection
    if (/Windows NT 10/.test(ua)) { result.os = 'Windows'; result.osVersion = '10/11'; }
    else if (/Windows NT 6\.3/.test(ua)) { result.os = 'Windows'; result.osVersion = '8.1'; }
    else if (/Windows NT 6\.1/.test(ua)) { result.os = 'Windows'; result.osVersion = '7'; }
    else if (/Mac OS X ([\d_]+)/.test(ua)) {
      result.os = 'macOS';
      result.osVersion = ua.match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, '.');
    }
    else if (/CrOS/.test(ua)) { result.os = 'Chrome OS'; }
    else if (/Linux/.test(ua)) { result.os = 'Linux'; }
    else if (/Android ([\d.]+)/.test(ua)) { result.os = 'Android'; result.osVersion = ua.match(/Android ([\d.]+)/)[1]; result.mobile = true; }
    else if (/iPhone|iPad/.test(ua)) {
      result.os = 'iOS';
      const match = ua.match(/OS ([\d_]+)/);
      if (match) result.osVersion = match[1].replace(/_/g, '.');
      result.mobile = true;
    }

    // Browser detection
    if (/Edg\/([\d.]+)/.test(ua)) { result.browser = 'Edge'; result.browserVersion = ua.match(/Edg\/([\d.]+)/)[1]; }
    else if (/OPR\/([\d.]+)/.test(ua)) { result.browser = 'Opera'; result.browserVersion = ua.match(/OPR\/([\d.]+)/)[1]; }
    else if (/Chrome\/([\d.]+)/.test(ua) && !/Chromium/.test(ua)) { result.browser = 'Chrome'; result.browserVersion = ua.match(/Chrome\/([\d.]+)/)[1]; }
    else if (/Firefox\/([\d.]+)/.test(ua)) { result.browser = 'Firefox'; result.browserVersion = ua.match(/Firefox\/([\d.]+)/)[1]; }
    else if (/Safari\/([\d.]+)/.test(ua) && /Version\/([\d.]+)/.test(ua)) { result.browser = 'Safari'; result.browserVersion = ua.match(/Version\/([\d.]+)/)[1]; }

    if (/Mobile|Android/.test(ua)) result.mobile = true;

    return result;
  }

  function inferDeviceType(data) {
    const { basic, webgl } = data;
    const renderer = webgl?.renderer?.toLowerCase() || '';
    const ua = basic?.userAgent || '';
    const w = basic?.screenWidth || 0;
    const h = basic?.screenHeight || 0;
    const dpr = basic?.devicePixelRatio || 1;
    const parsed = parseUserAgent(ua);

    // Device type
    let deviceType = 'Desktop';
    if (parsed.mobile || basic?.maxTouchPoints > 0) {
      if (Math.min(w, h) >= 600) deviceType = 'Tablet';
      else deviceType = 'Phone';
    }

    // Device brand/model guess
    let deviceGuess = '';
    let deviceTier = 'Mid-range';

    if (parsed.os === 'macOS') {
      deviceGuess = 'Apple Mac';
      if (renderer.includes('m1') || renderer.includes('m2') || renderer.includes('m3') || renderer.includes('m4')) {
        deviceGuess = 'Apple Mac (Apple Silicon)';
        deviceTier = 'Premium';
      } else if (renderer.includes('radeon') || renderer.includes('intel')) {
        deviceGuess = 'Apple Mac (Intel)';
        deviceTier = 'Premium';
      } else {
        deviceTier = 'Premium';
      }
    } else if (parsed.os === 'iOS') {
      deviceGuess = 'Apple iPhone/iPad';
      deviceTier = 'Premium';
    } else if (parsed.os === 'Windows') {
      if (renderer.includes('nvidia') || renderer.includes('geforce')) {
        if (renderer.includes('rtx 40') || renderer.includes('rtx 30')) {
          deviceGuess = 'High-end PC (NVIDIA RTX)';
          deviceTier = 'Premium';
        } else {
          deviceGuess = 'Gaming/Workstation PC (NVIDIA)';
          deviceTier = 'Mid-range';
        }
      } else if (renderer.includes('radeon')) {
        deviceGuess = 'PC (AMD GPU)';
        deviceTier = 'Mid-range';
      } else if (renderer.includes('intel')) {
        deviceGuess = 'Standard PC (Intel integrated)';
        deviceTier = 'Budget';
      } else {
        deviceGuess = 'Windows PC';
        deviceTier = 'Mid-range';
      }
    } else if (parsed.os === 'Android') {
      if ((basic?.deviceMemory || 0) >= 8) {
        deviceGuess = 'High-end Android';
        deviceTier = 'Mid-range';
      } else if ((basic?.deviceMemory || 0) >= 4) {
        deviceGuess = 'Mid-range Android';
        deviceTier = 'Budget';
      } else {
        deviceGuess = 'Budget Android';
        deviceTier = 'Budget';
      }
    } else if (parsed.os === 'Linux') {
      deviceGuess = 'Linux Workstation';
      deviceTier = 'Mid-range';
    } else if (parsed.os === 'Chrome OS') {
      deviceGuess = 'Chromebook';
      deviceTier = 'Budget';
    }

    return { deviceType, deviceGuess, deviceTier, parsed };
  }

  function inferLocation(data) {
    const tz = data.basic?.timezone || '';
    const lang = data.basic?.language || '';
    const languages = data.basic?.languages || [];

    const tzToRegion = {
      'America/New_York': { region: 'US East Coast', country: 'United States', market: 'Tier 1' },
      'America/Chicago': { region: 'US Central', country: 'United States', market: 'Tier 1' },
      'America/Denver': { region: 'US Mountain', country: 'United States', market: 'Tier 1' },
      'America/Los_Angeles': { region: 'US West Coast', country: 'United States', market: 'Tier 1' },
      'America/Toronto': { region: 'Eastern Canada', country: 'Canada', market: 'Tier 1' },
      'America/Vancouver': { region: 'Western Canada', country: 'Canada', market: 'Tier 1' },
      'Europe/London': { region: 'United Kingdom', country: 'United Kingdom', market: 'Tier 1' },
      'Europe/Paris': { region: 'France', country: 'France', market: 'Tier 1' },
      'Europe/Berlin': { region: 'Germany', country: 'Germany', market: 'Tier 1' },
      'Europe/Amsterdam': { region: 'Netherlands', country: 'Netherlands', market: 'Tier 1' },
      'Europe/Zurich': { region: 'Switzerland', country: 'Switzerland', market: 'Tier 1' },
      'Europe/Stockholm': { region: 'Sweden', country: 'Sweden', market: 'Tier 1' },
      'Europe/Oslo': { region: 'Norway', country: 'Norway', market: 'Tier 1' },
      'Europe/Copenhagen': { region: 'Denmark', country: 'Denmark', market: 'Tier 1' },
      'Europe/Helsinki': { region: 'Finland', country: 'Finland', market: 'Tier 1' },
      'Europe/Dublin': { region: 'Ireland', country: 'Ireland', market: 'Tier 1' },
      'Europe/Brussels': { region: 'Belgium', country: 'Belgium', market: 'Tier 1' },
      'Europe/Vienna': { region: 'Austria', country: 'Austria', market: 'Tier 1' },
      'Europe/Madrid': { region: 'Spain', country: 'Spain', market: 'Tier 2' },
      'Europe/Rome': { region: 'Italy', country: 'Italy', market: 'Tier 2' },
      'Europe/Lisbon': { region: 'Portugal', country: 'Portugal', market: 'Tier 2' },
      'Europe/Prague': { region: 'Czech Republic', country: 'Czech Republic', market: 'Tier 2' },
      'Europe/Warsaw': { region: 'Poland', country: 'Poland', market: 'Tier 2' },
      'Europe/Budapest': { region: 'Hungary', country: 'Hungary', market: 'Tier 2' },
      'Europe/Bucharest': { region: 'Romania', country: 'Romania', market: 'Tier 3' },
      'Europe/Sofia': { region: 'Bulgaria', country: 'Bulgaria', market: 'Tier 3' },
      'Europe/Athens': { region: 'Greece', country: 'Greece', market: 'Tier 2' },
      'Europe/Istanbul': { region: 'Turkey', country: 'Turkey', market: 'Tier 3' },
      'Europe/Moscow': { region: 'Russia', country: 'Russia', market: 'Tier 3' },
      'Europe/Kiev': { region: 'Ukraine', country: 'Ukraine', market: 'Tier 3' },
      'Europe/Bratislava': { region: 'Slovakia', country: 'Slovakia', market: 'Tier 2' },
      'Europe/Ljubljana': { region: 'Slovenia', country: 'Slovenia', market: 'Tier 2' },
      'Europe/Zagreb': { region: 'Croatia', country: 'Croatia', market: 'Tier 2' },
      'Europe/Belgrade': { region: 'Serbia', country: 'Serbia', market: 'Tier 3' },
      'Asia/Tokyo': { region: 'Japan', country: 'Japan', market: 'Tier 1' },
      'Asia/Seoul': { region: 'South Korea', country: 'South Korea', market: 'Tier 1' },
      'Asia/Shanghai': { region: 'China', country: 'China', market: 'Tier 2' },
      'Asia/Hong_Kong': { region: 'Hong Kong', country: 'Hong Kong', market: 'Tier 1' },
      'Asia/Singapore': { region: 'Singapore', country: 'Singapore', market: 'Tier 1' },
      'Asia/Kolkata': { region: 'India', country: 'India', market: 'Tier 3' },
      'Asia/Dubai': { region: 'UAE', country: 'UAE', market: 'Tier 1' },
      'Australia/Sydney': { region: 'Australia (East)', country: 'Australia', market: 'Tier 1' },
      'Australia/Melbourne': { region: 'Australia (SE)', country: 'Australia', market: 'Tier 1' },
      'Pacific/Auckland': { region: 'New Zealand', country: 'New Zealand', market: 'Tier 1' },
      'America/Sao_Paulo': { region: 'Brazil', country: 'Brazil', market: 'Tier 3' },
      'America/Mexico_City': { region: 'Mexico', country: 'Mexico', market: 'Tier 3' },
      'America/Argentina/Buenos_Aires': { region: 'Argentina', country: 'Argentina', market: 'Tier 3' },
      'Africa/Johannesburg': { region: 'South Africa', country: 'South Africa', market: 'Tier 3' },
      'Africa/Lagos': { region: 'Nigeria', country: 'Nigeria', market: 'Tier 4' },
      'Africa/Cairo': { region: 'Egypt', country: 'Egypt', market: 'Tier 4' },
    };

    const location = tzToRegion[tz] || { region: tz || 'Unknown', country: 'Unknown', market: 'Tier 3' };

    // Language-based refinement
    const langCode = lang.split('-')[0];
    const langNames = {
      en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian',
      pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', cs: 'Czech', sk: 'Slovak',
      hu: 'Hungarian', ro: 'Romanian', bg: 'Bulgarian', hr: 'Croatian',
      sr: 'Serbian', sl: 'Slovenian', ja: 'Japanese', ko: 'Korean',
      zh: 'Chinese', hi: 'Hindi', ar: 'Arabic', ru: 'Russian', uk: 'Ukrainian',
      sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
      el: 'Greek', tr: 'Turkish', th: 'Thai', vi: 'Vietnamese',
    };

    return {
      ...location,
      primaryLanguage: langNames[langCode] || lang,
      allLanguages: languages,
      languageCode: langCode,
    };
  }

  function inferProfession(data) {
    const fonts = data.fonts || [];
    const renderer = data.webgl?.renderer?.toLowerCase() || '';
    const ua = data.basic?.userAgent || '';
    const parsed = parseUserAgent(ua);

    const signals = [];

    // Design fonts
    const designFonts = ['Helvetica Neue', 'Futura', 'Avenir', 'Avenir Next', 'Proxima Nova', 'Brandon Grotesque', 'Gill Sans'];
    const devFonts = ['Fira Code', 'Source Code Pro', 'Menlo', 'Monaco', 'Consolas', 'SF Mono'];
    const adobeFonts = ['Adobe Caslon Pro', 'Adobe Garamond Pro', 'Myriad Pro', 'Minion Pro'];

    const hasDesignFonts = fonts.filter(f => designFonts.includes(f)).length;
    const hasDevFonts = fonts.filter(f => devFonts.includes(f)).length;
    const hasAdobeFonts = fonts.filter(f => adobeFonts.includes(f)).length;

    if (hasAdobeFonts > 0) signals.push({ label: 'Creative Professional (Adobe user)', confidence: 0.8 });
    if (hasDesignFonts >= 3) signals.push({ label: 'Design-oriented', confidence: 0.6 });
    if (hasDevFonts >= 2) signals.push({ label: 'Software Developer', confidence: 0.7 });

    if (parsed.os === 'macOS') signals.push({ label: 'Creative/Tech Professional', confidence: 0.5 });
    if (parsed.os === 'Linux') signals.push({ label: 'Technical User / Developer', confidence: 0.7 });

    if (renderer.includes('quadro') || renderer.includes('firepro')) {
      signals.push({ label: 'Professional Workstation User (CAD/3D)', confidence: 0.9 });
    }
    if (renderer.includes('rtx 40') || renderer.includes('rtx 30')) {
      signals.push({ label: 'Power User / Gamer', confidence: 0.6 });
    }

    // High concurrency = workstation
    if ((data.basic?.hardwareConcurrency || 0) >= 16) {
      signals.push({ label: 'Power User / Professional', confidence: 0.5 });
    }

    if (signals.length === 0) {
      signals.push({ label: 'General Consumer', confidence: 0.5 });
    }

    // Pick top signal
    signals.sort((a, b) => b.confidence - a.confidence);
    return {
      primary: signals[0].label,
      all: signals,
    };
  }

  function inferTechLiteracy(data) {
    let score = 50;
    const reasons = [];
    const parsed = parseUserAgent(data.basic?.userAgent || '');

    // DNT enabled = slightly more aware
    if (data.basic?.doNotTrack === '1') {
      score += 10;
      reasons.push('Do Not Track enabled (+10)');
    }

    // Firefox = privacy-conscious
    if (parsed.browser === 'Firefox') {
      score += 15;
      reasons.push('Using Firefox (+15)');
    }

    // Linux = tech-savvy
    if (parsed.os === 'Linux') {
      score += 20;
      reasons.push('Running Linux (+20)');
    }

    // Webdriver = automation user
    if (data.basic?.webdriver) {
      score += 25;
      reasons.push('WebDriver detected (+25)');
    }

    // Many dev fonts
    const devFonts = ['Fira Code', 'Source Code Pro', 'Menlo', 'Monaco', 'Consolas'];
    const devFontCount = (data.fonts || []).filter(f => devFonts.includes(f)).length;
    if (devFontCount >= 2) {
      score += 10;
      reasons.push(`Developer fonts detected (${devFontCount}) (+10)`);
    }

    // High core count
    if ((data.basic?.hardwareConcurrency || 0) >= 8) {
      score += 5;
      reasons.push('High core count (+5)');
    }

    // Ad blocker detection (canvas blocked, etc)
    if (!data.canvas) {
      score += 15;
      reasons.push('Canvas fingerprinting blocked (+15)');
    }

    score = Math.min(100, Math.max(0, score));

    let level = 'Average';
    if (score >= 80) level = 'Expert';
    else if (score >= 60) level = 'Above Average';
    else if (score < 30) level = 'Below Average';

    return { score, level, reasons };
  }

  function inferIncome(data) {
    const device = inferDeviceType(data);
    const location = inferLocation(data);

    let bracket = 'Middle';
    let estimate = '$40,000 - $70,000';

    if (device.deviceTier === 'Premium' && location.market === 'Tier 1') {
      bracket = 'Upper-Middle to High';
      estimate = '$80,000 - $150,000+';
    } else if (device.deviceTier === 'Premium' && location.market === 'Tier 2') {
      bracket = 'Upper-Middle';
      estimate = '$50,000 - $100,000';
    } else if (device.deviceTier === 'Premium') {
      bracket = 'Above Average (local)';
      estimate = 'Above local median';
    } else if (device.deviceTier === 'Budget' && location.market === 'Tier 1') {
      bracket = 'Lower-Middle';
      estimate = '$25,000 - $45,000';
    } else if (device.deviceTier === 'Budget') {
      bracket = 'Lower';
      estimate = 'Below local median';
    }

    return { bracket, estimate, basedOn: [device.deviceGuess, location.country] };
  }

  function generateFullProfile(data) {
    const device = inferDeviceType(data);
    const location = inferLocation(data);
    const profession = inferProfession(data);
    const techLiteracy = inferTechLiteracy(data);
    const income = inferIncome(data);

    // Build the list of inferences
    const inferences = [
      {
        category: 'Device',
        icon: '',
        raw: `${data.webgl?.renderer || 'Unknown GPU'} | ${data.basic?.screenWidth}×${data.basic?.screenHeight} @ ${data.basic?.devicePixelRatio}x`,
        inference: `${device.deviceGuess} (${device.deviceTier} tier)`,
        usage: 'Ad bid pricing — premium devices see higher-value ads',
      },
      {
        category: 'Operating System',
        icon: '',
        raw: data.basic?.userAgent?.substring(0, 80) + '...',
        inference: `${device.parsed.os} ${device.parsed.osVersion} — ${device.parsed.browser} ${device.parsed.browserVersion}`,
        usage: 'Platform targeting — OS users see different product recommendations',
      },
      {
        category: 'Location',
        icon: '',
        raw: `Timezone: ${data.basic?.timezone} | Language: ${data.basic?.language}`,
        inference: `${location.region}, ${location.country} (${location.market} market)`,
        usage: `Geo-targeting — ${location.market} markets get different pricing and content`,
      },
      {
        category: 'Income Estimate',
        icon: '',
        raw: `${device.deviceGuess} + ${location.country}`,
        inference: `${income.bracket} — est. ${income.estimate}`,
        usage: 'Price discrimination — you may see different prices than others',
      },
      {
        category: 'Profession',
        icon: '',
        raw: `Fonts: ${(data.fonts || []).slice(0, 5).join(', ')} | GPU: ${(data.webgl?.renderer || '').substring(0, 30)}`,
        inference: profession.primary,
        usage: 'Interest-based targeting — profession determines which ads you see',
      },
      {
        category: 'Tech Literacy',
        icon: '',
        raw: `Browser: ${device.parsed.browser} | DNT: ${data.basic?.doNotTrack} | Platform: ${device.parsed.os}`,
        inference: `${techLiteracy.level} (${techLiteracy.score}/100)`,
        usage: 'Security targeting — less tech-savvy users see more aggressive ads',
      },
      {
        category: 'Hardware',
        icon: '',
        raw: `${data.basic?.hardwareConcurrency || '?'} cores | ${data.basic?.deviceMemory || '?'} GB RAM | ${data.basic?.colorDepth}-bit color`,
        inference: `${(data.basic?.hardwareConcurrency || 0) >= 8 ? 'High-performance' : 'Standard'} machine — ${(data.basic?.deviceMemory || 0) >= 8 ? 'power user hardware' : 'consumer hardware'}`,
        usage: 'Determines ad complexity — powerful machines get heavier, richer ads',
      },
      {
        category: 'Connection',
        icon: '',
        raw: `Type: ${data.basic?.connectionType || 'Unknown'} | Speed: ${data.basic?.connectionDownlink || '?'} Mbps`,
        inference: data.basic?.connectionType === '4g' ? 'Fast connection — likely home/office WiFi or good mobile' : (data.basic?.connectionType || 'Standard connection'),
        usage: 'Bandwidth-aware ads — slow connections get lighter, text-focused ads',
      },
      {
        category: 'Privacy Signals',
        icon: '',
        raw: `DNT: ${data.basic?.doNotTrack || 'not set'} | Cookies: ${data.basic?.cookieEnabled ? 'enabled' : 'blocked'} | Touch: ${data.basic?.maxTouchPoints} points`,
        inference: data.basic?.doNotTrack === '1' ? 'Privacy-conscious (irony: DNT makes you more unique)' : 'Standard tracking profile — no privacy measures detected',
        usage: 'DNT is ignored by most trackers. Enabling it adds to your fingerprint uniqueness.',
      },
      {
        category: 'Display',
        icon: '',
        raw: `${data.basic?.screenWidth}×${data.basic?.screenHeight} | ${data.basic?.colorDepth}-bit | ${data.basic?.devicePixelRatio}x DPR`,
        inference: data.basic?.devicePixelRatio >= 2 ? 'Retina/HiDPI display — premium device' : 'Standard display',
        usage: 'Visual ad quality selection — retina displays get high-res creatives',
      },
    ];

    return {
      device,
      location,
      profession,
      techLiteracy,
      income,
      inferences,
    };
  }

  return { generateFullProfile, parseUserAgent, inferDeviceType, inferLocation, inferProfession, inferTechLiteracy, inferIncome };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InferenceEngine;
}
