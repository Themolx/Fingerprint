#!/usr/bin/env node
/**
 * render-cli-v2.js — Native CLI video renderer for fingerprint data
 * Robot internal monolog style — Neue Montreal, black & white, big text
 * V2: Deeper inferences, cookie/tracker data, time analysis, img2sound integration
 *
 * Usage:  node render-cli-v2.js <input.json> [output.mp4]
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
registerFont(path.join(fontDir, 'NeueMontreal-Medium.otf'), { family: 'Neue Montreal', weight: '500' });
registerFont(path.join(fontDir, 'NeueMontreal-Light.otf'), { family: 'Neue Montreal', weight: '300' });

// ---- Constants ----
const W = 1920;
const H = 1080;
const FPS = 30;
const MARGIN_L = 80;

// ---- Helpers ----
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

// ---- Build the robot monolog from data ----
function buildMonolog(fpData, profile, entropy, uniqueness, pricing) {
  const d = fpData.basic || {};
  const adv = fpData.advanced || {};
  const ext = fpData.extension || (function() { /* check parent */ return null; })();
  const gpu = adv.components?.webGlBasics?.value?.rendererUnmasked || fpData.webgl?.renderer || '';
  const fonts = fpData.fonts || adv.components?.fonts?.value || [];
  const battery = fpData.battery || {};
  const media = fpData.mediaDevices || {};
  const cookies = ext?.cookies || fpData.cookies || null;

  const osStr = profile.device.parsed.os + ' ' + profile.device.parsed.osVersion;
  const browserStr = profile.device.parsed.browser + ' ' + profile.device.parsed.browserVersion;
  const chipMatch = gpu.match(/Apple (M\d+\s*\w*)/i);
  const chip = chipMatch ? chipMatch[1] : '';
  const loc = profile.location;
  const inc = profile.income;

  // Time analysis
  const collectedAt = fpData.collectedAt || fpData.generatedAt || '';
  let localHour = null;
  if (collectedAt && d.timezoneOffset !== undefined) {
    const utc = new Date(collectedAt);
    const local = new Date(utc.getTime() - d.timezoneOffset * 60000);
    localHour = local.getUTCHours();
  }

  // Font analysis
  const designFonts = fonts.filter(f => ['Futura', 'Avenir', 'Avenir Next', 'Gill Sans', 'Helvetica Neue', 'Open Sans'].includes(f));
  const devFonts = fonts.filter(f => ['Menlo', 'Monaco', 'Consolas', 'Fira Code', 'Source Code Pro', 'SF Mono'].includes(f));

  const blocks = [];

  // 1 - initial
  blocks.push({ lines: ['scanning.'], hold: 0.7 });

  // 2 - OS + chip
  blocks.push({
    lines: [
      osStr.toLowerCase() + '.',
      chip ? chip.toLowerCase() + '.' : 'apple hardware.',
      'premium device.',
    ],
    hold: 1.0,
  });

  // 3 - form factor deduction
  const hasWebcam = media.videoinput > 0;
  const hasMic = media.audioinput > 0;
  if (hasWebcam && hasMic && d.maxTouchPoints === 0) {
    blocks.push({
      lines: [
        'webcam. microphone. no touch.',
        '=macbook pro.',
      ],
      hold: 1.0,
    });
  }

  // 4 - power user inference
  blocks.push({
    lines: [
      'power savvy,',
      '',
      '=power user?',
    ],
    hold: 1.3,
  });

  // 5 - browser + tracking posture
  blocks.push({
    lines: [
      browserStr.toLowerCase() + '.',
      d.cookieEnabled ? 'cookies: on.' : 'cookies: blocked.',
      d.doNotTrack === '1' ? 'do-not-track: on.' : 'no do-not-track.',
      'no ad blocker detected.',
      'no resistance.',
    ],
    hold: 1.2,
  });

  // 6 - hardware
  blocks.push({
    lines: [
      (d.hardwareConcurrency || '?') + ' cores. ' + (d.deviceMemory || '?') + 'GB RAM.',
      d.screenWidth + 'x' + d.screenHeight + ' @' + d.devicePixelRatio + 'x.',
      d.colorDepth + '-bit color. P3 gamut. HDR.',
      'professional-grade display.',
    ],
    hold: 1.2,
  });

  // 7 - battery (if available)
  if (battery.level !== undefined) {
    const pct = Math.round(battery.level * 100);
    const charging = battery.charging;
    const timeLeft = battery.chargingTime ? Math.round(battery.chargingTime / 60) : null;
    blocks.push({
      lines: [
        'battery: ' + pct + '%.' + (charging ? ' charging.' : ''),
        charging ? 'plugged in at desk.' : 'on battery. mobile?',
        charging && timeLeft ? timeLeft + ' minutes to full.' : '',
      ].filter(Boolean),
      hold: 1.0,
    });
  }

  // 8 - time of day inference
  if (localHour !== null) {
    let timeDesc = '';
    let inference = '';
    const h = localHour;
    const timeStr = String(h).padStart(2, '0') + ':' + String(new Date(collectedAt).getMinutes()).padStart(2, '0');
    if (h >= 22 || h < 6) {
      timeDesc = 'late night.';
      inference = 'working late. dedicated? insomniac?';
    } else if (h >= 6 && h < 9) {
      timeDesc = 'early morning.';
      inference = 'early riser. disciplined.';
    } else if (h >= 9 && h < 17) {
      timeDesc = 'work hours.';
      inference = 'browsing during work.';
    } else if (h >= 17 && h < 22) {
      timeDesc = 'evening.';
      inference = 'after work. leisure time.';
    }
    blocks.push({
      lines: [
        timeStr + ' local time.',
        timeDesc,
        inference,
      ].filter(Boolean),
      hold: 1.1,
    });
  }

  // 9 - location
  blocks.push({
    lines: [
      (d.timezone || 'unknown').toLowerCase() + '.',
      loc.country.toLowerCase() + '.',
      loc.market.toLowerCase() + ' market.',
    ],
    hold: 1.0,
  });

  // 10 - language anomaly
  const langInForeign = d.language?.startsWith('en') && loc.country !== 'United States' && loc.country !== 'United Kingdom' && loc.country !== 'Canada' && loc.country !== 'Australia';
  if (langInForeign) {
    blocks.push({
      lines: [
        d.language.toLowerCase() + ' speaker',
        'in ' + loc.country.toLowerCase() + '.',
        'expat? digital nomad? remote worker?',
        'target international ads.',
      ],
      hold: 1.3,
    });
  }

  // 11 - font forensics
  if (devFonts.length > 0 || designFonts.length > 0) {
    const lines = [];
    if (devFonts.length > 0) {
      lines.push('fonts: ' + devFonts.join(', ').toLowerCase() + '.');
      lines.push('=developer.');
    }
    if (designFonts.length > 0) {
      lines.push('fonts: ' + designFonts.slice(0, 3).join(', ').toLowerCase() + '.');
      lines.push('=designer too.');
    }
    blocks.push({ lines, hold: 1.1 });
  }

  // 12 - profession chain
  const allProf = profile.profession.all || [];
  if (allProf.length > 0) {
    blocks.push({
      lines: allProf.map(p => p.label.toLowerCase() + '. (' + Math.round(p.confidence * 100) + '%)'),
      hold: 1.0,
    });
  }

  // 13 - income + what to sell
  blocks.push({
    lines: [
      inc.bracket.toLowerCase() + '.',
      'est. ' + inc.estimate.toLowerCase() + '.',
      '',
      '=sell premium ads?',
      'tech products. SaaS. creative tools.',
    ],
    hold: 1.5,
  });

  // 14 - cookie surveillance (the big reveal)
  if (cookies) {
    blocks.push({
      lines: [
        cookies.total + ' cookies found.',
        cookies.trackerCount + ' belong to trackers.',
        Math.round(cookies.trackerPercentage || (cookies.trackerCount / cookies.total * 100)) + '% of your cookies spy on you.',
      ],
      hold: 1.3,
    });

    // advertising breakdown
    const bycat = cookies.byCategory || {};
    if (bycat.advertising || bycat.social) {
      blocks.push({
        lines: [
          (bycat.advertising || 0) + ' advertising cookies.',
          (bycat.social || 0) + ' social media cookies.',
          (bycat.data_brokers || 0) + ' data broker cookies.',
          'building a profile to sell.',
        ],
        hold: 1.3,
      });
    }

    // top trackers
    const topT = (cookies.topTrackers || []).slice(0, 5);
    if (topT.length > 0) {
      blocks.push({
        lines: topT.map(t => t.domain + ': ' + t.count + ' cookies.'),
        hold: 1.2,
      });
    }

    // zombie cookies
    const zombies = cookies.lifetimes?.zombie || 0;
    if (zombies > 0) {
      blocks.push({
        lines: [
          zombies + ' zombie cookies.',
          'survive clearing.',
          'they never forget you.',
        ],
        hold: 1.3,
      });
    }

    // social cross-tracking
    const socialTrackers = (cookies.topTrackers || []).filter(t => t.category === 'social');
    if (socialTrackers.length > 0) {
      blocks.push({
        lines: [
          'facebook. instagram. twitter. linkedin.',
          'tracking you outside their platforms.',
          'your social graph is their product.',
        ],
        hold: 1.3,
      });
    }

    // data brokers
    const brokerTrackers = (cookies.topTrackers || []).filter(t => t.category === 'data_brokers');
    if (brokerTrackers.length > 0) {
      blocks.push({
        lines: [
          brokerTrackers.map(t => t.domain).join('. ') + '.',
          'device graph company.',
          'cross-device tracking.',
          'your phone. your laptop. your tablet.',
          'all linked.',
        ],
        hold: 1.5,
      });
    }
  }

  // 15 - entropy
  blocks.push({
    lines: [
      entropy.totalBits.toFixed(1) + ' bits of entropy.',
      'unique among ' + uniqueness.populationSize + '.',
      uniqueness.percent + '% identifiable.',
    ],
    hold: 1.2,
  });

  // 16 - fingerprint vectors
  blocks.push({
    lines: [
      'canvas: unique.',
      'audio: unique.',
      'GPU: unique.',
      'every signal confirms:',
      'one person.',
    ],
    hold: 1.3,
  });

  // 17 - valuation
  blocks.push({
    lines: [
      '$' + pricing.cpm.toFixed(2) + ' CPM.',
      '$' + pricing.annualValue.toFixed(0) + '/year.',
    ],
    hold: 1.0,
  });

  // 18 - the math
  const factors = pricing.factors || [];
  if (factors.length > 0) {
    blocks.push({
      lines: factors.slice(0, 4).map(f => f.label.toLowerCase() + ': ' + f.effect.toLowerCase() + '.'),
      hold: 1.0,
    });
  }

  // 19 - visitor ID
  blocks.push({
    lines: [
      'visitor ID:',
      fpData.advanced?.visitorId || adv.visitorId || '00000000',
    ],
    hold: 1.0,
  });

  // 20 - speed
  blocks.push({
    lines: [
      'collected in 1.4 seconds.',
      'no permission asked.',
    ],
    hold: 1.2,
  });

  // 21 - classification
  blocks.push({
    lines: [
      'classification:',
      'advertising commodity.',
    ],
    hold: 1.5,
  });

  // 22 - final
  blocks.push({
    lines: ['you are the product.'],
    hold: 2.5,
  });

  return blocks;
}

// ---- Calculate font size to fit width ----
function fitFontSize(ctx, text, maxW, maxSize, minSize) {
  for (let s = maxSize; s >= minSize; s -= 2) {
    ctx.font = `bold ${s}px "Neue Montreal"`;
    if (ctx.measureText(text).width <= maxW) return s;
  }
  return minSize;
}

// ---- Main ----
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node render-cli-v2.js <input.json> [output.mp4]');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : inputPath.replace(/\.json$/i, '-v2.mp4');

  console.log('Reading:', inputPath);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // The JSON may have nested fingerprint + extension data at top level
  const fpData = raw.fingerprint || raw;
  // Attach extension data if at top level
  if (raw.extension && !fpData.extension) {
    fpData.extension = raw.extension;
  }
  // Attach generatedAt
  if (raw.generatedAt && !fpData.generatedAt) {
    fpData.generatedAt = raw.generatedAt;
  }

  const profile = InferenceEngine.generateFullProfile(fpData);
  const entropy = EntropyEngine.calculateEntropy(fpData);
  const uniqueness = EntropyEngine.calculateUniqueness(entropy.totalBits);
  const pricing = PricingEngine.getBreakdown(profile);

  console.log(`Profile: ${profile.device.deviceGuess} | ${profile.location.country}`);
  console.log(`Entropy: ${entropy.totalBits.toFixed(1)} bits | ${uniqueness.percent}% unique`);
  console.log(`CPM: $${pricing.cpm.toFixed(2)}`);
  console.log();

  const blocks = buildMonolog(fpData, profile, entropy, uniqueness, pricing);
  console.log(`${blocks.length} thought blocks generated.`);

  // ---- Timing ----
  const LINE_FADE = 8;
  const LINE_GAP = 6;
  const BLOCK_BLACK = 12;
  const FADE_OUT = 10;

  let totalFrames = 0;
  const blockTimings = [];

  for (const block of blocks) {
    const linesFrames = block.lines.length * LINE_GAP + LINE_FADE;
    const holdFrames = Math.round(block.hold * FPS);
    const blockDuration = linesFrames + holdFrames + FADE_OUT + BLOCK_BLACK;
    blockTimings.push({ start: totalFrames, duration: blockDuration, linesFrames, holdFrames });
    totalFrames += blockDuration;
  }
  totalFrames += 30; // black at end

  const duration = (totalFrames / FPS).toFixed(1);
  console.log(`Rendering ${totalFrames} frames (${duration}s) at ${W}x${H} @ ${FPS}fps`);
  console.log(`Output: ${outputPath}`);
  console.log();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Spawn ffmpeg — render silent video first
  const silentPath = outputPath.replace(/\.mp4$/, '_silent.mp4');
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-s', `${W}x${H}`,
    '-pix_fmt', 'rgba',
    '-r', String(FPS),
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    '-movflags', '+faststart',
    silentPath,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  let ffmpegErr = '';
  ffmpeg.stderr.on('data', d => { ffmpegErr += d.toString(); });

  const ffmpegDone = new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}\n${ffmpegErr.slice(-500)}`));
    });
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
      if (f >= contentEnd) {
        blockAlpha = 1 - clamp((f - contentEnd) / FADE_OUT, 0, 1);
      }
      if (blockAlpha <= 0) continue;

      const lineSizes = [];
      for (const line of block.lines) {
        if (line === '') {
          lineSizes.push({ size: 40, text: '' });
        } else {
          const sz = fitFontSize(ctx, line, maxTextW, 120, 32);
          lineSizes.push({ size: sz, text: line });
        }
      }

      const lineSpacing = 1.25;
      let totalH = 0;
      for (const ls of lineSizes) totalH += ls.size * lineSpacing;

      let startY = (H - totalH) / 2 + lineSizes[0].size;

      for (let li = 0; li < block.lines.length; li++) {
        const ls = lineSizes[li];
        if (ls.text === '') {
          startY += ls.size * lineSpacing;
          continue;
        }

        const lineStart = li * LINE_GAP;
        const lineAlpha = easeOut(clamp((f - lineStart) / LINE_FADE, 0, 1));
        const alpha = lineAlpha * blockAlpha;

        if (alpha <= 0) {
          startY += ls.size * lineSpacing;
          continue;
        }

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
    if (!canWrite) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }

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

  // ---- Sonification with img2sound ----
  console.log('\n  Sonifying video with img2sound (additive mode)...');
  const img2soundVenv = '/tmp/ImageSonofication/venv/bin/img2sound';
  const audioDir = path.dirname(outputPath);

  try {
    // Use additive mode for best visual sync — white text on black creates tonal bursts
    // Run from audioDir so the YYMMDD/ output lands next to the video
    const sonifyOut = execSync(
      `"${img2soundVenv}" additive "${silentPath}" --freq-min 60 --freq-max 2000 --oscillators 128`,
      { cwd: audioDir, timeout: 300000 }
    ).toString();
    console.log('  ' + sonifyOut.trim().split('\n').pop());

    // Find the generated wav file in YYMMDD subdirectories
    let wavPath = null;
    const dirs = fs.readdirSync(audioDir).filter(f => {
      const full = path.join(audioDir, f);
      return fs.statSync(full).isDirectory() && /^\d{6}$/.test(f);
    }).sort().reverse();
    for (const dir of dirs) {
      const dirPath = path.join(audioDir, dir);
      const wavs = fs.readdirSync(dirPath).filter(f => f.endsWith('.wav') && f.includes('additive')).sort().reverse();
      if (wavs.length > 0) {
        wavPath = path.join(dirPath, wavs[0]);
        break;
      }
    }
    // Also check audioDir itself
    if (!wavPath) {
      const wavFiles = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav') && f.includes('additive'));
      if (wavFiles.length > 0) wavPath = path.join(audioDir, wavFiles[wavFiles.length - 1]);
    }

    if (wavPath && fs.existsSync(wavPath)) {
      console.log(`  Audio: ${wavPath}`);
      console.log('  Merging video + audio...');

      // Merge silent video with sonified audio
      execSync(
        `ffmpeg -y -i "${silentPath}" -i "${wavPath}" -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`,
        { timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log('  Merged.');

      // Clean up silent video
      try { fs.unlinkSync(silentPath); } catch(e) {}
    } else {
      console.log('  Warning: No wav file found. Using silent video.');
      fs.renameSync(silentPath, outputPath);
    }
  } catch (err) {
    console.log('  Sonification error: ' + err.message.slice(0, 200));
    console.log('  Falling back to silent video.');
    if (fs.existsSync(silentPath)) {
      fs.renameSync(silentPath, outputPath);
    }
  }

  const stat = fs.statSync(outputPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n  Output: ${outputPath}`);
  console.log(`  Size:   ${sizeMB} MB`);
  console.log(`  Time:   ${totalTime}s`);
  console.log();
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
