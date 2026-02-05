/**
 * Cookie Analyzer — categorizes cookies, identifies trackers, measures exposure
 */

const CookieAnalyzer = (() => {

  function analyze(cookies) {
    const total = cookies.length;
    const trackerCookies = [];
    const firstParty = [];
    const thirdParty = [];
    const byDomain = {};
    const byCategory = { advertising: 0, analytics: 0, social: 0, data_brokers: 0, fingerprinting: 0, consent_management: 0, unknown: 0 };
    const lifetimes = { session: 0, shortLived: 0, persistent: 0, zombie: 0 };

    const now = Date.now() / 1000;

    for (const cookie of cookies) {
      const domain = cookie.domain.replace(/^\./, '');
      if (!byDomain[domain]) byDomain[domain] = [];
      byDomain[domain].push(cookie);

      // Tracker detection
      const category = getTrackerCategory(domain);
      if (category) {
        trackerCookies.push({ ...cookie, trackerCategory: category });
        byCategory[category] = (byCategory[category] || 0) + 1;
      } else {
        byCategory.unknown++;
      }

      // First vs third party (heuristic: third-party if the domain contains known tracker patterns)
      if (category) {
        thirdParty.push(cookie);
      } else {
        firstParty.push(cookie);
      }

      // Lifetime analysis
      if (cookie.session) {
        lifetimes.session++;
      } else if (cookie.expirationDate) {
        const daysUntilExpiry = (cookie.expirationDate - now) / 86400;
        if (daysUntilExpiry < 1) lifetimes.shortLived++;
        else if (daysUntilExpiry > 365) lifetimes.zombie++;
        else lifetimes.persistent++;
      }
    }

    // Top tracker domains
    const trackerDomains = {};
    for (const tc of trackerCookies) {
      const d = tc.domain.replace(/^\./, '');
      if (!trackerDomains[d]) trackerDomains[d] = { count: 0, category: tc.trackerCategory };
      trackerDomains[d].count++;
    }

    const topTrackers = Object.entries(trackerDomains)
      .map(([domain, info]) => ({ domain, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Unique domains
    const uniqueDomains = Object.keys(byDomain).length;

    return {
      total,
      trackerCount: trackerCookies.length,
      firstPartyCount: firstParty.length,
      thirdPartyCount: thirdParty.length,
      uniqueDomains,
      byCategory,
      lifetimes,
      topTrackers,
      trackerPercentage: total > 0 ? Math.round((trackerCookies.length / total) * 100) : 0,
      summary: generateCookieSummary(total, trackerCookies.length, lifetimes, byCategory),
    };
  }

  function generateCookieSummary(total, trackerCount, lifetimes, byCategory) {
    const lines = [];
    lines.push(`${total} cookies found across your browser.`);
    lines.push(`${trackerCount} (${total > 0 ? Math.round((trackerCount / total) * 100) : 0}%) belong to known tracking companies.`);

    if (byCategory.advertising > 0) lines.push(`${byCategory.advertising} advertising cookies are following you across websites.`);
    if (byCategory.analytics > 0) lines.push(`${byCategory.analytics} analytics cookies are recording your behavior.`);
    if (byCategory.social > 0) lines.push(`${byCategory.social} social media cookies track you even outside those platforms.`);
    if (byCategory.data_brokers > 0) lines.push(`${byCategory.data_brokers} data broker cookies are building a profile to sell.`);
    if (lifetimes.zombie > 0) lines.push(`${lifetimes.zombie} "zombie" cookies expire more than a year from now.`);

    return lines;
  }

  return { analyze };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CookieAnalyzer;
}
