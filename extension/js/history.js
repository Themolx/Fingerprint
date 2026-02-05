/**
 * History Analyzer — analyzes browsing history to infer interests, patterns, and routines
 */

const HistoryAnalyzer = (() => {

  function analyze(historyItems) {
    if (!historyItems || historyItems.length === 0) {
      return { error: 'No history data available', items: 0 };
    }

    const domainVisits = {};
    const categoryVisits = {};
    const hourlyActivity = new Array(24).fill(0);
    const dailyActivity = new Array(7).fill(0); // 0=Sun, 6=Sat
    const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const dailyTimestamps = [];

    for (const item of historyItems) {
      const url = item.url;
      const visitCount = item.visitCount || 1;
      const lastVisit = item.lastVisitTime;

      // Domain extraction
      let hostname;
      try {
        hostname = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        continue;
      }

      // Domain aggregation
      if (!domainVisits[hostname]) domainVisits[hostname] = { visits: 0, urls: 0 };
      domainVisits[hostname].visits += visitCount;
      domainVisits[hostname].urls++;

      // Category mapping
      const category = categorizeUrl(url);
      if (category) {
        if (!categoryVisits[category]) categoryVisits[category] = 0;
        categoryVisits[category] += visitCount;
      }

      // Time analysis
      if (lastVisit) {
        const date = new Date(lastVisit);
        const hour = date.getHours();
        const day = date.getDay();
        hourlyActivity[hour] += visitCount;
        dailyActivity[day] += visitCount;
        heatmap[day][hour] += visitCount;
        dailyTimestamps.push({ hour, day, timestamp: lastVisit });
      }
    }

    // Top domains
    const topDomains = Object.entries(domainVisits)
      .map(([domain, data]) => ({ domain, ...data }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 30);

    // Top categories
    const topCategories = Object.entries(categoryVisits)
      .map(([category, visits]) => ({ category, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 15);

    // Interest profile
    const interests = deriveInterests(topCategories);

    // Activity patterns
    const patterns = analyzePatterns(hourlyActivity, dailyActivity, heatmap);

    return {
      totalItems: historyItems.length,
      uniqueDomains: Object.keys(domainVisits).length,
      topDomains,
      topCategories,
      interests,
      patterns,
      hourlyActivity,
      dailyActivity,
      heatmap,
    };
  }

  function deriveInterests(topCategories) {
    // Group subcategories
    const interestGroups = {};
    for (const { category, visits } of topCategories) {
      const topLevel = category.split('/')[0];
      if (!interestGroups[topLevel]) interestGroups[topLevel] = 0;
      interestGroups[topLevel] += visits;
    }

    return Object.entries(interestGroups)
      .map(([interest, visits]) => ({ interest, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  }

  function analyzePatterns(hourly, daily, heatmap) {
    // Find peak hours
    const peakHour = hourly.indexOf(Math.max(...hourly));
    const quietHour = hourly.indexOf(Math.min(...hourly));

    // Sleep detection: find the longest gap of low activity
    const threshold = Math.max(...hourly) * 0.1;
    let sleepStart = null;
    let sleepEnd = null;
    let longestGap = 0;
    let currentGapStart = null;

    for (let h = 0; h < 48; h++) {
      const hour = h % 24;
      if (hourly[hour] <= threshold) {
        if (currentGapStart === null) currentGapStart = hour;
      } else {
        if (currentGapStart !== null) {
          const gapLength = (h - currentGapStart + 24) % 24;
          if (gapLength > longestGap) {
            longestGap = gapLength;
            sleepStart = currentGapStart % 24;
            sleepEnd = hour;
          }
          currentGapStart = null;
        }
      }
    }

    // Work hours detection (weekday peak activity)
    const weekdayHours = new Array(24).fill(0);
    const weekendHours = new Array(24).fill(0);
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (day >= 1 && day <= 5) {
          weekdayHours[hour] += heatmap[day][hour];
        } else {
          weekendHours[hour] += heatmap[day][hour];
        }
      }
    }

    // Work hours = high weekday activity period
    const weekdayPeak = weekdayHours.indexOf(Math.max(...weekdayHours));
    let workStart = 9;
    let workEnd = 17;
    for (let h = 6; h < 12; h++) {
      if (weekdayHours[h] > Math.max(...weekdayHours) * 0.3) {
        workStart = h;
        break;
      }
    }
    for (let h = 20; h > 14; h--) {
      if (weekdayHours[h] > Math.max(...weekdayHours) * 0.3) {
        workEnd = h;
        break;
      }
    }

    // Weekend vs weekday ratio
    const weekdayTotal = dailyActivity.slice(1, 6).reduce((a, b) => a + b, 0);
    const weekendTotal = dailyActivity[0] + dailyActivity[6];
    const weekdayAvg = weekdayTotal / 5;
    const weekendAvg = weekendTotal / 2;

    return {
      peakHour: formatHour(peakHour),
      quietHour: formatHour(quietHour),
      estimatedSleep: sleepStart !== null ? `${formatHour(sleepStart)} — ${formatHour(sleepEnd)}` : 'Could not determine',
      estimatedWork: `${formatHour(workStart)} — ${formatHour(workEnd)}`,
      weekdayAvgVisits: Math.round(weekdayAvg),
      weekendAvgVisits: Math.round(weekendAvg),
      isWeekendWarrior: weekendAvg > weekdayAvg * 1.2,
      isWorkaholic: weekdayAvg > weekendAvg * 2,
      summary: generatePatternSummary(peakHour, sleepStart, sleepEnd, workStart, workEnd, weekdayAvg, weekendAvg),
    };
  }

  function formatHour(h) {
    if (h === null || h === undefined) return '??';
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:00 ${ampm}`;
  }

  function generatePatternSummary(peak, sleepStart, sleepEnd, workStart, workEnd, weekdayAvg, weekendAvg) {
    const lines = [];
    lines.push(`Most active around ${formatHour(peak)}.`);
    if (sleepStart !== null) {
      lines.push(`Probable sleep: ${formatHour(sleepStart)} to ${formatHour(sleepEnd)}.`);
    }
    lines.push(`Probable work/study hours: ${formatHour(workStart)} to ${formatHour(workEnd)}.`);
    if (weekendAvg > weekdayAvg * 1.2) {
      lines.push('More active on weekends than weekdays — leisure-heavy browsing pattern.');
    } else if (weekdayAvg > weekendAvg * 2) {
      lines.push('Much more active on weekdays — work-oriented browsing pattern.');
    }
    return lines;
  }

  return { analyze };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryAnalyzer;
}
