/**
 * Fingerprint Engine — collects all browser fingerprint signals
 * Uses FingerprintJS for advanced signals + native APIs for basic ones
 */

const FingerprintEngine = (() => {
  let fpPromise = null;

  function init() {
    if (typeof FingerprintJS !== 'undefined') {
      fpPromise = FingerprintJS.load();
    }
  }

  async function getBasicSignals() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: Array.from(navigator.languages || [navigator.language]),
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      screenWidth: screen.width,
      screenHeight: screen.height,
      screenAvailWidth: screen.availWidth,
      screenAvailHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: window.devicePixelRatio || 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      connectionType: connection?.effectiveType || null,
      connectionDownlink: connection?.downlink || null,
      connectionRtt: connection?.rtt || null,
      connectionSaveData: connection?.saveData || false,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
      webdriver: navigator.webdriver || false,
    };
  }

  async function getAdvancedSignals() {
    if (!fpPromise) return null;
    try {
      const fp = await fpPromise;
      const result = await fp.get();
      return {
        visitorId: result.visitorId,
        confidence: result.confidence?.score || null,
        components: result.components || {},
      };
    } catch (e) {
      console.warn('FingerprintJS failed:', e);
      return null;
    }
  }

  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Fingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Fingerprint', 4, 17);
      return canvas.toDataURL();
    } catch (e) {
      return null;
    }
  }

  function getWebGLInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      };
    } catch (e) {
      return null;
    }
  }

  function getInstalledPlugins() {
    const plugins = [];
    if (navigator.plugins) {
      for (let i = 0; i < navigator.plugins.length; i++) {
        plugins.push({
          name: navigator.plugins[i].name,
          description: navigator.plugins[i].description,
          filename: navigator.plugins[i].filename,
        });
      }
    }
    return plugins;
  }

  function detectFonts() {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
      'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype',
      'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
      'Helvetica', 'Helvetica Neue', 'Futura', 'Gill Sans',
      'Menlo', 'Monaco', 'Consolas', 'Fira Code', 'Source Code Pro',
      'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald',
      'Segoe UI', 'Calibri', 'Cambria', 'Candara',
      'Adobe Caslon Pro', 'Adobe Garamond Pro', 'Myriad Pro', 'Minion Pro',
      'Avenir', 'Avenir Next', 'Proxima Nova', 'Brandon Grotesque',
      'SF Pro Display', 'SF Mono',
    ];

    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = testSize;
    span.style.lineHeight = 'normal';
    span.textContent = testString;
    document.body.appendChild(span);

    const baseWidths = {};
    for (const base of baseFonts) {
      span.style.fontFamily = base;
      baseWidths[base] = span.offsetWidth;
    }

    const detected = [];
    for (const font of testFonts) {
      let found = false;
      for (const base of baseFonts) {
        span.style.fontFamily = `'${font}', ${base}`;
        if (span.offsetWidth !== baseWidths[base]) {
          found = true;
          break;
        }
      }
      if (found) detected.push(font);
    }

    document.body.removeChild(span);
    return detected;
  }

  function getAudioFingerprint() {
    return new Promise((resolve) => {
      try {
        const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!AudioContext) { resolve(null); return; }
        const context = new AudioContext(1, 44100, 44100);
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(10000, context.currentTime);
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-50, context.currentTime);
        compressor.knee.setValueAtTime(40, context.currentTime);
        compressor.ratio.setValueAtTime(12, context.currentTime);
        compressor.attack.setValueAtTime(0, context.currentTime);
        compressor.release.setValueAtTime(0.25, context.currentTime);
        oscillator.connect(compressor);
        compressor.connect(context.destination);
        oscillator.start(0);
        context.startRendering();
        context.oncomplete = (event) => {
          const data = event.renderedBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
          resolve(sum.toString());
        };
      } catch (e) {
        resolve(null);
      }
    });
  }

  function getBatteryInfo() {
    return new Promise((resolve) => {
      if (navigator.getBattery) {
        navigator.getBattery().then((battery) => {
          resolve({
            charging: battery.charging,
            level: battery.level,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
          });
        }).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  }

  function getMediaDevices() {
    return new Promise((resolve) => {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          resolve({
            audioinput: devices.filter(d => d.kind === 'audioinput').length,
            audiooutput: devices.filter(d => d.kind === 'audiooutput').length,
            videoinput: devices.filter(d => d.kind === 'videoinput').length,
          });
        }).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  }

  async function collectAll() {
    const [basic, advanced, audio, battery, mediaDevices] = await Promise.all([
      getBasicSignals(),
      getAdvancedSignals(),
      getAudioFingerprint(),
      getBatteryInfo(),
      getMediaDevices(),
    ]);

    const webgl = getWebGLInfo();
    const canvas = getCanvasFingerprint();
    const plugins = getInstalledPlugins();
    const fonts = detectFonts();

    return {
      basic,
      advanced,
      webgl,
      canvas,
      audio,
      plugins,
      fonts,
      battery,
      mediaDevices,
      collectedAt: new Date().toISOString(),
    };
  }

  return { init, collectAll, getBasicSignals, getAdvancedSignals, getWebGLInfo, detectFonts, getAudioFingerprint };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FingerprintEngine;
}
