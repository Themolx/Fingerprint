/**
 * Background Service Worker — handles data collection that requires extension permissions
 * Responds to messages from popup and report page
 */

importScripts('js/trackers.js', 'js/cookies.js', 'js/categories.js', 'js/history.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookieAnalysis') {
    analyzeCookies().then(sendResponse);
    return true;
  }

  if (request.action === 'getHistoryAnalysis') {
    analyzeHistory(request.days || 30).then(sendResponse);
    return true;
  }

  if (request.action === 'getBookmarks') {
    analyzeBookmarks().then(sendResponse);
    return true;
  }

  if (request.action === 'getFullReport') {
    getFullReport().then(sendResponse);
    return true;
  }
});

async function analyzeCookies() {
  try {
    const cookies = await chrome.cookies.getAll({});
    return CookieAnalyzer.analyze(cookies);
  } catch (e) {
    return { error: e.message };
  }
}

async function analyzeHistory(days) {
  try {
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const results = await chrome.history.search({
      text: '',
      startTime,
      maxResults: 10000,
    });
    return HistoryAnalyzer.analyze(results);
  } catch (e) {
    return { error: e.message };
  }
}

async function analyzeBookmarks() {
  try {
    const tree = await chrome.bookmarks.getTree();
    return { count: countBookmarks(tree), tree };
  } catch (e) {
    return { error: e.message };
  }
}

function countBookmarks(nodes) {
  let count = 0;
  for (const node of nodes) {
    if (node.url) count++;
    if (node.children) count += countBookmarks(node.children);
  }
  return count;
}

async function getFullReport() {
  const [cookies, history, bookmarks] = await Promise.all([
    analyzeCookies(),
    analyzeHistory(30),
    analyzeBookmarks(),
  ]);
  return { cookies, history, bookmarks };
}
