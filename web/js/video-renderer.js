/**
 * VideoRenderer — abstract generative visualization of fingerprint data
 * Node networks, orbital rings, particles, geometric symbols
 * Uses Canvas API + MediaRecorder to produce downloadable WebM
 */

const VideoRenderer = (() => {

  const W = 1920;
  const H = 1080;
  const FPS = 30;
  const CX = W / 2;
  const CY = H / 2;

  let canvas, ctx;
  let frame = 0;
  let seed = 0;

  // Seeded random for deterministic visuals
  function rng() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  function setup() {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
  }

  // ---- Math helpers ----
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

  // ---- Abstract drawing primitives ----

  function clear() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
  }

  // Persistent node network — generated from data
  let nodes = [];
  let connections = [];
  let particles = [];
  let rings = [];

  function generateNetwork(data, entropy) {
    seed = 42;
    nodes = [];
    connections = [];
    particles = [];
    rings = [];

    // Create nodes from entropy contributions
    const contribs = (entropy.contributions || []).filter(c => c.present);
    const maxBits = Math.max(...contribs.map(c => c.bits), 1);

    // Central node
    nodes.push({ x: CX, y: CY, r: 6, bits: entropy.totalBits, label: '', orbit: 0, angle: 0, speed: 0, base: true });

    // Data-driven nodes arranged in orbital layers
    for (let i = 0; i < contribs.length; i++) {
      const c = contribs[i];
      const layer = Math.floor(i / 4);
      const inLayer = i % 4 + (layer > 0 ? 0.5 : 0);
      const count = Math.min(4 + layer, contribs.length - layer * 4);
      const angle = (inLayer / Math.max(count, 4)) * Math.PI * 2 + layer * 0.4;
      const dist = 140 + layer * 130 + (c.bits / maxBits) * 60;
      const r = 2 + (c.bits / maxBits) * 5;

      nodes.push({
        x: CX + Math.cos(angle) * dist,
        y: CY + Math.sin(angle) * dist,
        r: r,
        bits: c.bits,
        label: c.label,
        orbit: dist,
        angle: angle,
        speed: 0.002 + rng() * 0.004,
        base: false,
      });
    }

    // Add ambient nodes (smaller, decorative)
    for (let i = 0; i < 30; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 80 + rng() * 420;
      nodes.push({
        x: CX + Math.cos(angle) * dist,
        y: CY + Math.sin(angle) * dist,
        r: 0.5 + rng() * 1.5,
        bits: 0,
        label: '',
        orbit: dist,
        angle: angle,
        speed: 0.001 + rng() * 0.005,
        base: false,
      });
    }

    // Connections — connect nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 220 && (nodes[i].bits > 0 || nodes[j].bits > 0 || rng() > 0.7)) {
          connections.push({ a: i, b: j, dist: d });
        }
      }
    }

    // Orbital rings from data
    rings.push({ radius: 140, width: 0.5, speed: 0.003 });
    rings.push({ radius: 270, width: 0.3, speed: -0.002 });
    rings.push({ radius: 400, width: 0.2, speed: 0.001 });

    // Floating particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: rng() * W,
        y: rng() * H,
        vx: (rng() - 0.5) * 0.5,
        vy: (rng() - 0.5) * 0.5,
        r: 0.5 + rng() * 1.5,
        life: rng(),
      });
    }
  }

  function updateNodes(t) {
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      n.angle += n.speed;
      n.x = CX + Math.cos(n.angle) * n.orbit;
      n.y = CY + Math.sin(n.angle) * n.orbit;
    }
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life += 0.003;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    }
  }

  // Draw the network with a visibility factor (0-1)
  function drawNetwork(visibility, labelAlpha) {
    const t = frame / FPS;

    // Orbital ring guides
    ctx.save();
    for (const ring of rings) {
      const a = 0.04 * visibility;
      ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
      ctx.lineWidth = ring.width;
      ctx.beginPath();
      ctx.arc(CX, CY, ring.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Tick marks on rings
      for (let i = 0; i < 36; i++) {
        const ang = (i / 36) * Math.PI * 2 + t * ring.speed * 10;
        const ix = CX + Math.cos(ang) * ring.radius;
        const iy = CY + Math.sin(ang) * ring.radius;
        ctx.fillStyle = 'rgba(255,255,255,' + (a * 1.5) + ')';
        ctx.fillRect(ix - 0.5, iy - 0.5, 1, 1);
      }
    }
    ctx.restore();

    // Connections
    ctx.save();
    for (const conn of connections) {
      const na = nodes[conn.a];
      const nb = nodes[conn.b];
      const maxD = 220;
      const dx = na.x - nb.x;
      const dy = na.y - nb.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const alpha = (1 - d / maxD) * 0.12 * visibility;
      if (alpha <= 0) continue;
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();

      // Data pulse along connection
      const pulse = (t * 0.5 + conn.dist * 0.001) % 1;
      const px = lerp(na.x, nb.x, pulse);
      const py = lerp(na.y, nb.y, pulse);
      ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Nodes
    ctx.save();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const a = (n.bits > 0 ? 0.7 : 0.15) * visibility;

      // Glow
      if (n.bits > 0) {
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 8);
        glow.addColorStop(0, 'rgba(255,255,255,' + (a * 0.15) + ')');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * visibility, 0, Math.PI * 2);
      ctx.fill();

      // Diamond shape for data nodes
      if (n.bits > 2 && visibility > 0.5) {
        const s = n.r * 2.5;
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.3) + ')';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y - s);
        ctx.lineTo(n.x + s, n.y);
        ctx.lineTo(n.x, n.y + s);
        ctx.lineTo(n.x - s, n.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    // Particles
    ctx.save();
    for (const p of particles) {
      const a = (0.5 + 0.5 * Math.sin(p.life * 4)) * 0.15 * visibility;
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Labels near data nodes
    if (labelAlpha > 0) {
      ctx.save();
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'center';
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n.label) continue;
        ctx.fillStyle = 'rgba(255,255,255,' + (labelAlpha * 0.4) + ')';
        ctx.fillText(n.label, n.x, n.y + n.r + 14);
      }
      ctx.restore();
    }
  }

  // Text with backdrop glow for readability
  function textGlow(str, x, y, font, color, align) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align || 'left';
    // Subtle dark backdrop
    const m = ctx.measureText(str);
    const bx = align === 'center' ? x - m.width / 2 - 12 : x - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const sz = parseInt(font) || 16;
    ctx.fillRect(bx, y - sz - 2, m.width + 24, sz + 12);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Crosshair around a point
  function drawCrosshair(x, y, size, alpha) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.lineWidth = 0.5;
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x - size * 0.3, y);
    ctx.moveTo(x + size * 0.3, y); ctx.lineTo(x + size, y);
    // Vertical
    ctx.moveTo(x, y - size); ctx.lineTo(x, y - size * 0.3);
    ctx.moveTo(x, y + size * 0.3); ctx.lineTo(x, y + size);
    ctx.stroke();
    // Corner brackets
    const s = size * 0.7;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s + 8); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s + 8, y - s);
    ctx.moveTo(x + s - 8, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + 8);
    ctx.moveTo(x + s, y + s - 8); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - 8, y + s);
    ctx.moveTo(x - s + 8, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - 8);
    ctx.stroke();
    ctx.restore();
  }

  // Concentric expanding circle
  function drawPulse(x, y, t, maxR, alpha) {
    const r = (t % 1) * maxR;
    const a = (1 - t % 1) * alpha;
    ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ---- Scene builder ----

  function buildScenes(data, profile, entropy, uniqueness, pricing) {
    const scenes = [];
    const inferences = profile.inferences || [];
    const contributions = (entropy.contributions || []).filter(c => c.present).slice(0, 10);
    const maxBits = Math.max(...contributions.map(c => c.bits), 1);
    const factors = pricing.factors || [];

    // ===== SCENE 1: EMERGENCE (3s) =====
    // Network fades in from void, title appears
    scenes.push({
      duration: 90,
      draw(f) {
        const netVis = easeOut(clamp(f / 60, 0, 1));
        updateNodes(f / FPS);
        drawNetwork(netVis, 0);

        // Center pulse
        drawPulse(CX, CY, f / 60, 300, 0.1);
        if (f > 20) drawPulse(CX, CY, (f - 20) / 60, 200, 0.08);

        // Title
        if (f > 25) {
          const a = easeOut(clamp((f - 25) / 30, 0, 1));
          ctx.globalAlpha = a;
          textGlow('SUBJECT DOSSIER', CX, CY - 8, 'bold 52px "Courier New", monospace', '#fff', 'center');
          ctx.globalAlpha = 1;
        }
        if (f > 50) {
          const a = easeOut(clamp((f - 50) / 25, 0, 1));
          ctx.globalAlpha = a;
          ctx.font = '14px "Courier New", monospace';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('CLASSIFICATION: ADVERTISING COMMODITY', CX, CY + 30);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        // Crosshair fades in
        drawCrosshair(CX, CY, 60 * netVis, 0.15 * netVis);
      }
    });

    // ===== SCENE 2: IDENTITY (6s) =====
    // Network on left half, text panel on right
    const profileLines = inferences.map(inf => ({
      label: inf.category.toUpperCase(),
      value: inf.inference
    }));

    scenes.push({
      duration: 180,
      draw(f) {
        updateNodes(f / FPS);
        drawNetwork(1, clamp(f / 60, 0, 1));

        // Text panel on right side
        const panelX = W * 0.52;
        const panelW = W * 0.44;

        // Panel background
        const panelAlpha = easeOut(clamp(f / 30, 0, 1));
        ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * panelAlpha) + ')';
        ctx.fillRect(panelX - 20, 60, panelW + 40, H - 120);

        // Vertical accent
        ctx.fillStyle = 'rgba(255,255,255,' + (0.08 * panelAlpha) + ')';
        ctx.fillRect(panelX - 20, 60, 1, H - 120);

        // Header
        if (f > 10) {
          const ha = clamp((f - 10) / 15, 0, 1);
          ctx.globalAlpha = ha;
          ctx.font = '11px "Courier New", monospace';
          ctx.fillStyle = '#555';
          ctx.fillText('// IDENTITY PROFILE', panelX, 95);
          ctx.fillStyle = '#222';
          ctx.fillRect(panelX, 102, panelW * ha, 1);
          ctx.globalAlpha = 1;
        }

        // Data rows
        const startY = 135;
        const rowH = 56;

        for (let i = 0; i < profileLines.length && i < 14; i++) {
          const rs = 20 + i * 9;
          const rp = clamp((f - rs) / 18, 0, 1);
          if (rp <= 0) continue;

          const y = startY + i * rowH;
          ctx.globalAlpha = easeOut(rp);

          // Label
          ctx.font = '11px "Courier New", monospace';
          ctx.fillStyle = '#444';
          ctx.fillText(profileLines[i].label, panelX, y);

          // Value
          ctx.font = '16px "Courier New", monospace';
          ctx.fillStyle = '#fff';
          const val = profileLines[i].value;
          ctx.fillText(val.length > 45 ? val.substring(0, 42) + '...' : val, panelX, y + 20);

          // Separator
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(panelX, y + 32, panelW, 1);

          ctx.globalAlpha = 1;
        }

        // Highlight: connect a network node to its label with a subtle line
        if (f > 60) {
          const lineA = clamp((f - 60) / 30, 0, 1) * 0.06;
          for (let i = 1; i < Math.min(nodes.length, contributions.length + 1); i++) {
            const n = nodes[i];
            if (!n.label || n.x > panelX - 30) continue;
            const labelIdx = profileLines.findIndex(p => p.label === n.label.toUpperCase());
            if (labelIdx < 0) continue;
            const ly = startY + labelIdx * rowH + 10;
            ctx.strokeStyle = 'rgba(255,255,255,' + lineA + ')';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 6]);
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(panelX - 5, ly);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    });

    // ===== SCENE 3: ENTROPY CONSTELLATION (5s) =====
    // Entropy visualized as expanding rings with data orbiting
    scenes.push({
      duration: 150,
      draw(f) {
        updateNodes(f / FPS);
        drawNetwork(0.4, 0);

        // Center: entropy value
        const countUp = easeOut(clamp(f / 60, 0, 1));
        const bitsStr = (entropy.totalBits * countUp).toFixed(1);

        // Radial bars around center — one per contribution
        for (let i = 0; i < contributions.length; i++) {
          const barStart = 15 + i * 5;
          const bp = easeOut(clamp((f - barStart) / 40, 0, 1));
          if (bp <= 0) continue;

          const c = contributions[i];
          const baseAngle = (i / contributions.length) * Math.PI * 2 - Math.PI / 2;
          const innerR = 120;
          const outerR = innerR + (c.bits / maxBits) * 200 * bp;

          // Bar
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * bp) + ')';
          ctx.lineWidth = 12;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.arc(CX, CY, (innerR + outerR) / 2, baseAngle - 0.08, baseAngle + 0.08);
          ctx.stroke();

          // Thin extension line
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 * bp) + ')';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(CX + Math.cos(baseAngle) * outerR, CY + Math.sin(baseAngle) * outerR);
          ctx.lineTo(CX + Math.cos(baseAngle) * (outerR + 50), CY + Math.sin(baseAngle) * (outerR + 50));
          ctx.stroke();

          // Label at end
          if (bp > 0.5) {
            const lx = CX + Math.cos(baseAngle) * (outerR + 60);
            const ly = CY + Math.sin(baseAngle) * (outerR + 60);
            ctx.font = '10px "Courier New", monospace';
            ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * bp) + ')';
            ctx.textAlign = baseAngle > Math.PI / 2 && baseAngle < Math.PI * 1.5 ? 'right' : 'left';
            ctx.fillText(c.label + ' ' + c.bits.toFixed(1) + 'b', lx, ly + 3);
            ctx.textAlign = 'left';
          }
          ctx.restore();
        }

        // Inner ring
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(CX, CY, 120, 0, Math.PI * 2);
        ctx.stroke();

        // Center text
        textGlow(bitsStr + ' BITS', CX, CY - 5, 'bold 48px "Courier New", monospace', '#fff', 'center');

        if (f > 30) {
          ctx.globalAlpha = clamp((f - 30) / 20, 0, 1);
          ctx.font = '13px "Courier New", monospace';
          ctx.fillStyle = '#555';
          ctx.textAlign = 'center';
          ctx.fillText(uniqueness.percent + '% UNIQUE  //  ' + uniqueness.description.toUpperCase(), CX, CY + 30);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        // Rotating scanner line
        const scanAngle = (f / FPS) * 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(scanAngle) * 500, CY + Math.sin(scanAngle) * 500);
        ctx.stroke();
      }
    });

    // ===== SCENE 4: VALUATION (4.5s) =====
    // Price emerges from the network center
    scenes.push({
      duration: 135,
      draw(f) {
        updateNodes(f / FPS);
        drawNetwork(0.5, 0);

        // Concentric value rings
        const pp = easeOut(clamp(f / 50, 0, 1));
        for (let r = 1; r <= 3; r++) {
          const ringR = 80 * r * pp;
          const a = 0.05 / r;
          ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(CX, CY, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Price
        const priceStr = '$' + (pricing.cpm * pp).toFixed(2);
        textGlow(priceStr, CX, CY - 15, 'bold 72px "Courier New", monospace', '#fff', 'center');

        // Subtitle
        ctx.globalAlpha = pp;
        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.fillText('ESTIMATED CPM — COST PER THOUSAND IMPRESSIONS', CX, CY + 25);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;

        // Factors orbit around price
        for (let i = 0; i < Math.min(factors.length, 6); i++) {
          const fs = 40 + i * 12;
          const fp = easeOut(clamp((f - fs) / 25, 0, 1));
          if (fp <= 0) continue;

          const fAngle = (i / Math.min(factors.length, 6)) * Math.PI * 2 - Math.PI / 2 + (f / FPS) * 0.1;
          const fDist = 280 + i * 15;
          const fx = CX + Math.cos(fAngle) * fDist;
          const fy = CY + Math.sin(fAngle) * fDist;

          ctx.globalAlpha = fp * 0.8;

          // Connector to center
          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(CX + Math.cos(fAngle) * 130, CY + Math.sin(fAngle) * 130);
          ctx.lineTo(fx, fy);
          ctx.stroke();

          // Factor text
          ctx.font = '11px "Courier New", monospace';
          ctx.fillStyle = '#888';
          ctx.textAlign = 'center';
          ctx.fillText(factors[i].label, fx, fy - 8);
          ctx.font = '14px "Courier New", monospace';
          ctx.fillStyle = '#fff';
          ctx.fillText(factors[i].effect, fx, fy + 10);
          ctx.textAlign = 'left';

          // Small dot
          ctx.fillStyle = 'rgba(255,255,255,' + (fp * 0.5) + ')';
          ctx.beginPath();
          ctx.arc(fx, fy - 20, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 1;
        }
      }
    });

    // ===== SCENE 5: DATA RAIN (3s) =====
    // Raw data cascading as abstract columns
    const rawStrings = [
      data.basic?.userAgent?.substring(0, 60) || '',
      data.canvas?.substring(20, 60) || '',
      data.webgl?.renderer?.substring(0, 50) || '',
      data.audio || '',
      (data.fonts || []).join(' / ').substring(0, 80),
      data.basic?.timezone || '',
      data.basic?.screenWidth + 'x' + data.basic?.screenHeight,
      '' + (data.basic?.hardwareConcurrency || ''),
    ].filter(Boolean);

    scenes.push({
      duration: 90,
      draw(f) {
        updateNodes(f / FPS);
        drawNetwork(0.25, 0);

        // Vertical data streams
        ctx.save();
        ctx.font = '10px "Courier New", monospace';
        const colW = W / (rawStrings.length + 1);

        for (let i = 0; i < rawStrings.length; i++) {
          const col = colW * (i + 1);
          const str = rawStrings[i];
          const startDelay = i * 4;
          const sp = clamp((f - startDelay) / 15, 0, 1);
          if (sp <= 0) continue;

          // Vertical line
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.03 * sp) + ')';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(col, 0);
          ctx.lineTo(col, H);
          ctx.stroke();

          // Characters falling
          for (let c = 0; c < str.length; c++) {
            const charDelay = startDelay + c * 0.5;
            const cp = clamp((f - charDelay) / 30, 0, 1);
            if (cp <= 0) continue;
            const cy = 40 + c * 14 + (1 - cp) * 100;
            const ca = cp * 0.4 * (1 - c / str.length * 0.5);
            ctx.fillStyle = 'rgba(255,255,255,' + ca + ')';
            ctx.textAlign = 'center';
            ctx.fillText(str[c], col, cy);
          }
        }
        ctx.restore();

        // Center overlay text
        if (f > 30) {
          const ta = easeOut(clamp((f - 30) / 20, 0, 1));
          ctx.globalAlpha = ta;
          textGlow((data.fonts || []).length + ' SIGNALS COLLECTED', CX, CY - 10, '24px "Courier New", monospace', '#fff', 'center');
          ctx.font = '12px "Courier New", monospace';
          ctx.fillStyle = '#555';
          ctx.textAlign = 'center';
          ctx.fillText('EVERY DATA POINT ADDS TO YOUR UNIQUE FINGERPRINT', CX, CY + 25);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }
      }
    });

    // ===== SCENE 6: OUTRO (4s) =====
    // Network collapses to center, final message
    scenes.push({
      duration: 120,
      draw(f) {
        const collapse = easeInOut(clamp(f / 50, 0, 1));
        const fadeIn = easeInOut(clamp(f / 30, 0, 1));
        const fadeOut = easeInOut(clamp((120 - f) / 25, 0, 1));
        const vis = Math.min(fadeIn, fadeOut);

        // Shrink network to center
        updateNodes(f / FPS);
        const savedNodes = nodes.map(n => ({ x: n.x, y: n.y }));
        for (let i = 1; i < nodes.length; i++) {
          nodes[i].x = lerp(savedNodes[i].x, CX, collapse * 0.8);
          nodes[i].y = lerp(savedNodes[i].y, CY, collapse * 0.8);
        }
        drawNetwork((1 - collapse * 0.7) * vis, 0);
        // Restore positions
        for (let i = 1; i < nodes.length; i++) {
          nodes[i].x = savedNodes[i].x;
          nodes[i].y = savedNodes[i].y;
        }

        // Central pulse
        if (collapse > 0.3) {
          drawPulse(CX, CY, (f - 15) / 40, 400, 0.08 * vis);
          drawPulse(CX, CY, (f - 25) / 50, 300, 0.06 * vis);
        }

        // Text
        ctx.globalAlpha = vis;
        textGlow('YOU ARE THE PRODUCT', CX, CY - 15, 'bold 48px "Courier New", monospace', '#fff', 'center');

        if (f > 30) {
          ctx.font = '16px "Courier New", monospace';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('Collected in seconds. No permissions asked.', CX, CY + 30);
          ctx.textAlign = 'left';
        }

        ctx.globalAlpha = 1;
      }
    });

    return scenes;
  }

  // ---- Progress UI ----

  function createProgressUI() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10000;font-family:"Courier New",monospace;';
    const label = document.createElement('div');
    label.style.cssText = 'color:#fff;font-size:14px;letter-spacing:0.2em;margin-bottom:24px;text-transform:uppercase;';
    label.textContent = 'RENDERING VIDEO...';
    const track = document.createElement('div');
    track.style.cssText = 'width:400px;height:2px;background:#222;';
    const fill = document.createElement('div');
    fill.style.cssText = 'width:0%;height:100%;background:#fff;transition:width 0.1s linear;';
    track.appendChild(fill);
    const pct = document.createElement('div');
    pct.style.cssText = 'color:#666;font-size:12px;margin-top:14px;';
    pct.textContent = '0%';
    const hint = document.createElement('div');
    hint.style.cssText = 'color:#333;font-size:11px;margin-top:30px;';
    hint.textContent = 'Rendering 1920x1080 / 30fps — abstract visualization';
    overlay.appendChild(label);
    overlay.appendChild(track);
    overlay.appendChild(pct);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    return {
      update(progress) {
        const p = Math.round(progress * 100);
        fill.style.width = p + '%';
        pct.textContent = p + '%';
      },
      remove() { overlay.remove(); }
    };
  }

  // ---- Main render ----

  async function render(data, profile, entropy, uniqueness, pricing, vid) {
    setup();
    seed = 42;
    frame = 0;

    generateNetwork(data, entropy);

    const scenes = buildScenes(data, profile, entropy, uniqueness, pricing);
    const totalFrames = scenes.reduce((sum, s) => sum + s.duration, 0);

    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const progress = createProgressUI();

    return new Promise(resolve => {
      recorder.onstop = () => {
        progress.remove();
        resolve(new Blob(chunks, { type: 'video/webm' }));
      };

      recorder.start(100);
      const t0 = performance.now();

      function tick() {
        const elapsed = performance.now() - t0;
        frame = Math.floor(elapsed * FPS / 1000);

        if (frame >= totalFrames) { recorder.stop(); return; }

        let fi = frame;
        let active = null;
        for (const scene of scenes) {
          if (fi < scene.duration) { active = scene; break; }
          fi -= scene.duration;
        }
        if (!active) { recorder.stop(); return; }

        clear();
        active.draw(fi);

        // Global overlay: subtle vignette
        const vignette = ctx.createRadialGradient(CX, CY, H * 0.3, CX, CY, H * 0.9);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, W, H);

        // ID watermark
        ctx.font = '10px "Courier New", monospace';
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'right';
        ctx.fillText('ID: ' + (vid || ''), W - 20, H - 15);
        ctx.fillText((frame / FPS).toFixed(1) + 's', W - 20, 20);
        ctx.textAlign = 'left';

        progress.update(frame / totalFrames);
        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    });
  }

  return { render };

})();
