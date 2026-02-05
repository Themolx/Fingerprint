#!/usr/bin/env node
/**
 * render-cli.js — Native CLI video renderer for fingerprint data
 * Robot internal monolog style — Neue Montreal, black & white, big text
 *
 * Usage:  node render-cli.js <input.json> [output.mp4]
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');
const { spawn } = require('child_process');

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
const MARGIN_T = 120;

// ---- Helpers ----
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

// ---- Build the robot monolog from data ----
function buildMonolog(fpData, profile, entropy, uniqueness, pricing) {
  const d = fpData.basic || {};
  const gpu = fpData.advanced?.components?.webGlBasics?.value?.rendererUnmasked || fpData.webgl?.renderer || '';
  const fonts = fpData.advanced?.components?.fonts?.value || fpData.fonts || [];

  // Extract key info
  const osStr = profile.device.parsed.os + ' ' + profile.device.parsed.osVersion;
  const browserStr = profile.device.parsed.browser + ' ' + profile.device.parsed.browserVersion;
  const chipMatch = gpu.match(/Apple (M\d+\s*\w*)/i);
  const chip = chipMatch ? chipMatch[1] : '';
  const loc = profile.location;
  const inc = profile.income;
  const tech = profile.techLiteracy;

  // Each block = array of lines displayed together, then fade to next block
  // The robot thinks in short bursts
  const blocks = [];

  // 1 - initial scan
  blocks.push({
    lines: ['scanning.'],
    hold: 0.8,
  });

  // 2 - OS detection
  blocks.push({
    lines: [
      osStr.toLowerCase() + '.',
      chip ? chip.toLowerCase() + '.' : 'apple hardware.',
      'premium device.',
    ],
    hold: 1.2,
  });

  // 3 - inference: power user
  blocks.push({
    lines: [
      'power savvy,',
      '',
      '=power user?',
    ],
    hold: 1.5,
  });

  // 4 - browser
  blocks.push({
    lines: [
      browserStr.toLowerCase() + '.',
      d.cookieEnabled ? 'cookies enabled.' : 'cookies blocked.',
      d.doNotTrack === '1' ? 'do-not-track: on.' : 'no do-not-track.',
      'no resistance.',
    ],
    hold: 1.2,
  });

  // 5 - hardware details
  blocks.push({
    lines: [
      (d.hardwareConcurrency || '?') + ' cores.',
      (d.deviceMemory || '?') + 'GB RAM.',
      d.screenWidth + 'x' + d.screenHeight + ' @' + d.devicePixelRatio + 'x.',
      d.devicePixelRatio >= 2 ? 'retina display.' : 'standard display.',
    ],
    hold: 1.2,
  });

  // 6 - location
  blocks.push({
    lines: [
      d.timezone ? d.timezone.toLowerCase().replace('/', '/\u200B') + '.' : 'unknown timezone.',
      loc.country.toLowerCase() + '.',
      loc.market.toLowerCase() + ' market.',
    ],
    hold: 1.2,
  });

  // 7 - language inference
  const langInCZ = d.language?.startsWith('en') && loc.country !== 'United States' && loc.country !== 'United Kingdom';
  if (langInCZ) {
    blocks.push({
      lines: [
        d.language.toLowerCase() + ' speaker',
        'in ' + loc.country.toLowerCase() + '?',
        'expat? digital nomad?',
        'target international ads.',
      ],
      hold: 1.3,
    });
  }

  // 8 - fonts / profession
  blocks.push({
    lines: [
      'fonts: ' + fonts.slice(0, 3).join(', ').toLowerCase() + '.',
      profile.profession.primary.toLowerCase() + '.',
    ],
    hold: 1.0,
  });

  // 9 - income
  blocks.push({
    lines: [
      inc.bracket.toLowerCase() + '.',
      'est. ' + inc.estimate.toLowerCase() + '.',
      '=sell premium ads?',
    ],
    hold: 1.3,
  });

  // 10 - entropy / uniqueness
  blocks.push({
    lines: [
      entropy.totalBits.toFixed(1) + ' bits of entropy.',
      'unique among ' + uniqueness.populationSize + '.',
      uniqueness.percent + '% identifiable.',
    ],
    hold: 1.3,
  });

  // 11 - valuation
  blocks.push({
    lines: [
      '$' + pricing.cpm.toFixed(2) + ' CPM.',
      '$' + pricing.annualValue.toFixed(0) + '/year.',
    ],
    hold: 1.2,
  });

  // 12 - connection
  blocks.push({
    lines: [
      (d.connectionType || 'unknown') + ' / ' + (d.connectionDownlink || '?') + ' mbps.',
      'serve rich media.',
    ],
    hold: 0.8,
  });

  // 13 - fingerprint ID
  blocks.push({
    lines: [
      'visitor ID:',
      fpData.advanced?.visitorId || '00000000',
    ],
    hold: 1.2,
  });

  // 14 - conclusion
  blocks.push({
    lines: [
      'classification:',
      'advertising commodity.',
    ],
    hold: 1.5,
  });

  // 15 - final
  blocks.push({
    lines: [
      'you are the product.',
    ],
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
    console.error('Usage: node render-cli.js <input.json> [output.mp4]');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : inputPath.replace(/\.json$/i, '.mp4');

  console.log('Reading:', inputPath);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const fpData = raw.fingerprint || raw;
  const profile = InferenceEngine.generateFullProfile(fpData);
  const entropy = EntropyEngine.calculateEntropy(fpData);
  const uniqueness = EntropyEngine.calculateUniqueness(entropy.totalBits);
  const pricing = PricingEngine.getBreakdown(profile);

  console.log(`Profile: ${profile.device.deviceGuess} | ${profile.location.country}`);
  console.log(`Entropy: ${entropy.totalBits.toFixed(1)} bits | ${uniqueness.percent}% unique`);
  console.log(`CPM: $${pricing.cpm.toFixed(2)}`);
  console.log();

  const blocks = buildMonolog(fpData, profile, entropy, uniqueness, pricing);

  // ---- Timing ----
  // Per line: fade-in frames + hold, then gap between lines, then block gap
  const LINE_FADE = 8;       // frames to fade in a line
  const LINE_GAP = 6;        // frames between lines appearing
  const BLOCK_BLACK = 12;    // black frames between blocks
  const FADE_OUT = 10;       // frames to fade out a block

  // Calculate total frames
  let totalFrames = 0;
  const blockTimings = [];

  for (const block of blocks) {
    const linesFrames = block.lines.length * LINE_GAP + LINE_FADE;
    const holdFrames = Math.round(block.hold * FPS);
    const blockDuration = linesFrames + holdFrames + FADE_OUT + BLOCK_BLACK;
    blockTimings.push({ start: totalFrames, duration: blockDuration, linesFrames, holdFrames });
    totalFrames += blockDuration;
  }

  // Add 30 frames of black at end
  totalFrames += 30;

  const duration = (totalFrames / FPS).toFixed(1);
  console.log(`Rendering ${totalFrames} frames (${duration}s) at ${W}x${H} @ ${FPS}fps`);
  console.log(`Output: ${outputPath}`);
  console.log();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Spawn ffmpeg
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
    outputPath,
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
    // Black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Find which block we're in
    let drawn = false;
    for (let bi = 0; bi < blocks.length; bi++) {
      const bt = blockTimings[bi];
      const f = gf - bt.start; // frame within this block
      if (f < 0 || f >= bt.duration) continue;

      const block = blocks[bi];
      const contentEnd = bt.linesFrames + bt.holdFrames;
      const fadeOutStart = contentEnd;

      // Block-level alpha (fade out at end)
      let blockAlpha = 1;
      if (f >= fadeOutStart) {
        blockAlpha = 1 - clamp((f - fadeOutStart) / FADE_OUT, 0, 1);
      }
      if (blockAlpha <= 0) continue;

      // Draw lines
      // First calculate all font sizes so we know line heights
      const lineSizes = [];
      for (const line of block.lines) {
        if (line === '') {
          lineSizes.push({ size: 40, text: '' }); // spacer
        } else {
          const sz = fitFontSize(ctx, line, maxTextW, 120, 36);
          lineSizes.push({ size: sz, text: line });
        }
      }

      // Total text height
      const lineSpacing = 1.25;
      let totalH = 0;
      for (const ls of lineSizes) {
        totalH += ls.size * lineSpacing;
      }

      // Vertical centering
      let startY = (H - totalH) / 2 + lineSizes[0].size;

      for (let li = 0; li < block.lines.length; li++) {
        const ls = lineSizes[li];
        if (ls.text === '') {
          startY += ls.size * lineSpacing;
          continue;
        }

        // Line appearance timing
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

      // Cursor blink (thin white rectangle after last visible line)
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

      drawn = true;
      break;
    }

    // Write frame
    const buf = canvas.toBuffer('raw');
    const canWrite = ffmpeg.stdin.write(buf);
    if (!canWrite) {
      await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
    }

    if (gf % 30 === 0 || gf === totalFrames - 1) {
      const pct = ((gf / totalFrames) * 100).toFixed(0);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fps = (gf / (Date.now() - startTime) * 1000).toFixed(1);
      process.stdout.write(`\r  [${pct.padStart(3)}%]  ${gf}/${totalFrames} frames  ${elapsed}s  ${fps} fps`);
    }
  }

  ffmpeg.stdin.end();
  process.stdout.write('\n\n  Encoding...');
  await ffmpegDone;

  const stat = fs.statSync(outputPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(` done!\n`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Size:   ${sizeMB} MB`);
  console.log(`  Time:   ${totalTime}s`);
  console.log();
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
