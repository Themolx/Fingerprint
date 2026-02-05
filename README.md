# Fingerprint

Digital fingerprint surveillance — what they know about you.

A tool that demonstrates how websites fingerprint and profile you using only the data your browser freely gives away. No cookies needed. No permissions asked.

## Live Scanner

Visit the [live version](https://themolx.github.io/Fingerprint/) to see what your browser reveals about you — in real time.

Black screen. White text. A machine thinks out loud as it scans you.

## Offline Renderer (CLI)

Render a cinematic video from fingerprint JSON data. Neue Montreal. Black & white. Robot internal monolog.

### Setup

```bash
npm install
```

### Render

```bash
# v1 — basic monolog
node render-cli.js json.json

# v2 — deeper inferences + img2sound sonification
node render-cli-v2.js json.json output.mp4
```

The v2 renderer integrates with [img2sound](https://github.com/Themolx/ImageSonofication) for additive synthesis audio — each frame of text becomes a sonic event. Output auto-versions into `YYMMDD/` directories with `.nfo` metadata.

### Sonification Setup

```bash
git clone https://github.com/Themolx/ImageSonofication.git /tmp/ImageSonofication
cd /tmp/ImageSonofication
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

## What It Detects

From a single page visit (< 2 seconds):

- **Device** — OS, chip, form factor (MacBook Pro? iPad? Budget Android?)
- **GPU** — exact model via WebGL renderer string
- **Display** — resolution, pixel ratio, color depth, HDR, P3 gamut
- **Location** — timezone + language → country, market tier
- **Profession** — font forensics (dev fonts → developer, design fonts → designer)
- **Income** — device tier × market tier → income bracket estimate
- **Tech literacy** — browser choice, DNT, ad blocker detection
- **Battery** — charge level, plugged in or mobile
- **Time** — local hour → working late? early riser? browsing at work?
- **Tracking posture** — cookies, DNT, resistance level
- **Entropy** — bits of uniqueness, population size, identifiability %
- **Valuation** — CPM pricing, annual advertising value

With extension data:

- **Cookies** — total count, tracker %, advertising/social/data broker breakdown
- **Zombie cookies** — persistent trackers that survive clearing
- **Cross-platform tracking** — Facebook, Instagram, Twitter, LinkedIn
- **Data brokers** — device graph companies linking all your devices
- **Top trackers** — who's watching, how many cookies each

## Structure

```
/
├── index.html              ← GitHub Pages live scanner
├── shared/
│   └── inference-engine.js ← inference logic
├── web/
│   ├── js/
│   │   ├── entropy.js      ← entropy calculator
│   │   ├── pricing.js      ← CPM pricing engine
│   │   ├── visualizer.js   ← web UI visualizer
│   │   └── video-renderer.js
│   ├── css/style.css
│   ├── index.html          ← original web visualizer
│   └── render.html         ← video render page
├── extension/              ← Chrome extension
├── render-cli.js           ← v1 CLI renderer
├── render-cli-v2.js        ← v2 CLI renderer + sonification
├── json.json               ← example fingerprint data
└── package.json
```

## License

MIT
