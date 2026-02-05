/**
 * Activity Pattern Visualization — generates heatmap data and timeline components
 */

const PatternViz = (() => {

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function createHeatmap(heatmapData, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'heatmap';

    // Header row with hours
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap__header';
    headerRow.innerHTML = '<div class="heatmap__label"></div>';
    for (let h = 0; h < 24; h += 2) {
      const cell = document.createElement('div');
      cell.className = 'heatmap__hour-label';
      cell.textContent = h.toString().padStart(2, '0');
      headerRow.appendChild(cell);
    }
    wrapper.appendChild(headerRow);

    // Find max value for normalization
    let maxVal = 0;
    for (const row of heatmapData) {
      for (const val of row) {
        if (val > maxVal) maxVal = val;
      }
    }

    // Data rows
    for (let day = 0; day < 7; day++) {
      const row = document.createElement('div');
      row.className = 'heatmap__row';

      const label = document.createElement('div');
      label.className = 'heatmap__label';
      label.textContent = DAY_NAMES[day];
      row.appendChild(label);

      for (let h = 0; h < 24; h++) {
        const cell = document.createElement('div');
        cell.className = 'heatmap__cell';
        const intensity = maxVal > 0 ? heatmapData[day][h] / maxVal : 0;
        cell.style.backgroundColor = getHeatColor(intensity);
        cell.title = `${DAY_NAMES[day]} ${h}:00 — ${heatmapData[day][h]} visits`;
        row.appendChild(cell);
      }
      wrapper.appendChild(row);
    }

    // Legend
    const legend = document.createElement('div');
    legend.className = 'heatmap__legend';
    legend.innerHTML = `
      <span>Less</span>
      <div class="heatmap__legend-cell" style="background: ${getHeatColor(0)}"></div>
      <div class="heatmap__legend-cell" style="background: ${getHeatColor(0.25)}"></div>
      <div class="heatmap__legend-cell" style="background: ${getHeatColor(0.5)}"></div>
      <div class="heatmap__legend-cell" style="background: ${getHeatColor(0.75)}"></div>
      <div class="heatmap__legend-cell" style="background: ${getHeatColor(1)}"></div>
      <span>More</span>
    `;
    wrapper.appendChild(legend);

    container.appendChild(wrapper);
    return wrapper;
  }

  function getHeatColor(intensity) {
    if (intensity === 0) return 'rgba(255, 255, 255, 0.05)';
    const v = 255;
    const a = 0.1 + intensity * 0.9;
    return `rgba(${v}, ${v}, ${v}, ${a})`;
  }

  function createInterestChart(interests, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'interest-chart';

    const maxVisits = Math.max(...interests.map(i => i.visits), 1);

    for (const item of interests) {
      const row = document.createElement('div');
      row.className = 'interest-chart__row';
      const pct = Math.round((item.visits / maxVisits) * 100);
      row.innerHTML = `
        <div class="interest-chart__label">${item.interest || item.category}</div>
        <div class="interest-chart__bar-track">
          <div class="interest-chart__bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="interest-chart__count">${item.visits}</div>
      `;
      wrapper.appendChild(row);
    }

    container.appendChild(wrapper);
    return wrapper;
  }

  function createTimeline(patterns, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline';

    const items = [
      { time: patterns.estimatedSleep.split(' — ')[0] || '??', label: 'Probable bedtime', icon: '' },
      { time: patterns.estimatedSleep.split(' — ')[1] || '??', label: 'Probable wake time', icon: '' },
      { time: patterns.estimatedWork.split(' — ')[0] || '??', label: 'Work/study begins', icon: '' },
      { time: patterns.peakHour, label: 'Peak browsing activity', icon: '' },
      { time: patterns.estimatedWork.split(' — ')[1] || '??', label: 'Work/study ends', icon: '' },
    ];

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'timeline__item';
      el.innerHTML = `
        <div class="timeline__icon">${item.icon}</div>
        <div class="timeline__time">${item.time}</div>
        <div class="timeline__label">${item.label}</div>
      `;
      wrapper.appendChild(el);
    }

    container.appendChild(wrapper);
    return wrapper;
  }

  return { createHeatmap, createInterestChart, createTimeline };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PatternViz;
}
