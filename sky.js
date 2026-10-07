// Stay on this page a little while and evening comes. As the light starts to
// go, the starlings come in for a murmuration over the sunset, then drop down
// to roost. Once they've settled, the page fades on into a muted blue dusk
// with the last warmth along the bottom, and a few stars come out. The moon
// shows its real phase for today, the constellations appear on hover, and
// once in a while a star falls.
// Console: night(), day(), starlings(), sky.speed(n).
(function () {
    'use strict';

    // TEMPORARY, while we iterate: evening is already here when the page loads,
    // and a small control panel sits at the bottom. Set to false before
    // shipping to restore the real timing (10 s on the page, then 10 s of dusk).
    var PREVIEW = false;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var PAD = 26;               // breathing room between content column and sky features
    // a muted dusk, light enough that the page reads exactly as before
    var PAGE = [249, 250, 251];
    var SKY_TOP = [172, 187, 210], SKY_MID = [194, 205, 221], SKY_LOW = [214, 216, 224];
    var GLOW = [232, 196, 174], CLAY = [201, 110, 80];
    // the page's grey text, darkened a touch at dusk so it keeps its contrast
    var DIM_DAY = [113, 113, 122], DIM_DUSK = [70, 72, 82];
    var WHITE = [255, 255, 255];
    var INK = [84, 96, 110];
    var FONT = '"Source Serif 4", Georgia, serif';     // the site's typeface (style.css --serif)
    var rad = Math.PI / 180;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
    function lerpC(a, b, t) {
        return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t),
                Math.round(a[2] + (b[2] - a[2]) * t)];
    }

    // ---- the actual moon ----
    var PHASE_NAMES = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous',
                       'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
    // Sun/moon ecliptic longitudes with the main perturbation terms (truncated
    // Meeus). Elongation comes out within ~0.5°, so the lit percentage matches
    // the almanac to about a point. 0 = new, 0.5 = full.
    function moonPhase() {
        var d = Date.now() / 86400000 - 10957.5;     // days since J2000.0
        var Ms = 357.529 + 0.98560028 * d;           // sun mean anomaly
        var sunLon = 280.459 + 0.98564736 * d
            + 1.915 * Math.sin(Ms * rad)
            + 0.020 * Math.sin(2 * Ms * rad);
        var Lm = 218.316 + 13.176396 * d;            // moon mean longitude
        var Mm = 134.963 + 13.064993 * d;            // moon mean anomaly
        var Dm = 297.850 + 12.190749 * d;            // mean elongation
        var moonLon = Lm
            + 6.289 * Math.sin(Mm * rad)             // equation of the centre
            + 1.274 * Math.sin((2 * Dm - Mm) * rad)  // evection
            + 0.658 * Math.sin(2 * Dm * rad)         // variation
            - 0.186 * Math.sin(Ms * rad);            // annual equation
        var elong = (((moonLon - sunLon) % 360) + 360) % 360;
        return elong / 360;
    }
    function phaseName(p) { return PHASE_NAMES[Math.round(p * 8) % 8]; }
    function phaseIllum(p) { return (1 - Math.cos(2 * Math.PI * p)) / 2; }

    // Traces the lit part of the moon for phase p (0 = new, 0.5 = full).
    function moonLitPath(c, x, y, r, p) {
        var k = Math.cos(2 * Math.PI * p);
        var waxing = p < 0.5;
        c.beginPath();
        if (waxing) {
            c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
            c.ellipse(x, y, Math.abs(r * k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
        } else {
            c.arc(x, y, r, Math.PI / 2, -Math.PI / 2, false);
            c.ellipse(x, y, Math.abs(r * k), r, 0, -Math.PI / 2, Math.PI / 2, k > 0);
        }
        c.closePath();
    }

    // ---- constellations (normalized boxes, y down; array order = priority) ----
    var CONSTELLATIONS = [
        {
            name: 'ursa major', zone: 'right', aspect: 0.50, maxW: 215, vpos: 0.52,
            pts: [[0.04, 0.50], [0.24, 0.32], [0.42, 0.26], [0.58, 0.22], [0.78, 0.12], [0.82, 0.42], [0.62, 0.48]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
        },
        {
            name: 'orion', zone: 'left', aspect: 1.40, maxW: 140, vpos: 0.58,
            pts: [[0.26, 0.12], [0.72, 0.16], [0.40, 0.54], [0.50, 0.50], [0.60, 0.46], [0.34, 0.88], [0.74, 0.86]],
            lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]]
        },
        {
            // the little dipper, pouring back toward the big one; Polaris at the handle tip
            name: 'ursa minor', zone: 'right', aspect: 0.62, maxW: 150, vpos: 0.32,
            pts: [[0.96, 0.08], [0.80, 0.20], [0.62, 0.33], [0.45, 0.44], [0.26, 0.58], [0.06, 0.46], [0.24, 0.31]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
        },
        {
            name: 'cassiopeia', zone: 'left', aspect: 0.45, maxW: 160, vpos: 0.36,
            pts: [[0.04, 0.52], [0.27, 0.20], [0.50, 0.48], [0.73, 0.16], [0.96, 0.40]],
            lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
        },
        {
            // the northern cross: Deneb at the top, Albireo at the foot
            name: 'cygnus', zone: 'right', aspect: 1.20, maxW: 120, vpos: 0.70,
            pts: [[0.50, 0.04], [0.50, 0.40], [0.54, 0.96], [0.12, 0.22], [0.88, 0.56]],
            lines: [[0, 1], [1, 2], [3, 1], [1, 4]]
        }
    ];

    // ---- state ----
    var canvas = null, ctx = null, grain = null;
    var vw = 0, vh = 0, dpr = 1;
    var zones = [], stars = [], consts = [], moon = null, skyFloor = 0;
    var built = false, narrow = false;              // narrow: a phone, with no margins to speak of
    var column = { l: 0, r: 0 };
    var meteors = [], labels = [];
    var mouse = { x: -1e4, y: -1e4 };
    var pm = { x: 0, y: 0 }, lens = 0;              // smoothed parallax + lensing

    var clock = 0, lastReal = 0, speedMul = 1, raf = null, running = false;
    var duskAt = Infinity, duskLen = 10000;
    var dusk = 0, duskRate = 0, duskBegun = false;
    var nextShootAt = Infinity;
    var flock = null, nextFlockAt = Infinity;
    var SUNSET = 0.4;                       // how far dusk gets while the starlings are out: no stars yet
    var resizeTimer = null;

    function sizeCanvas() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        vw = window.innerWidth;
        vh = window.innerHeight;
        canvas.width = vw * dpr;
        canvas.height = vh * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // A faint paper grain: a small tile of light and dark specks, repeated.
    function makeGrain() {
        var g = document.createElement('canvas');
        g.width = g.height = 160;
        var gc = g.getContext('2d');
        var img = gc.createImageData(160, 160), d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            var light = Math.random() < 0.5, v = light ? 255 : 40;
            d[i] = d[i + 1] = d[i + 2] = v;
            d[i + 3] = Math.random() * (light ? 30 : 22);
        }
        gc.putImageData(img, 0, 0);
        return ctx.createPattern(g, 'repeat');
    }

    // The sky sits behind the page: fixed, beneath the text, never in its way.
    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        var s = canvas.style;
        s.position = 'fixed';
        s.inset = '0';
        s.width = '100%';
        s.height = '100%';
        s.pointerEvents = 'none';
        s.zIndex = '-1';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        sizeCanvas();
        grain = makeGrain();
    }

    function buildSky() {
        stars = [];
        consts = [];
        moon = null;
        zones = [];

        var main = document.querySelector('main');
        var rect = main ? main.getBoundingClientRect() : { left: vw / 2, right: vw / 2 };
        column = { l: rect.left, r: rect.right };
        skyFloor = vh * 0.9;          // below this, the afterglow washes the stars out

        // the moon and constellations keep to the margins
        var bySide = {};
        [
            { side: 'left', x: 10, y: 12, w: rect.left - PAD - 10, h: vh - 24 },
            { side: 'right', x: rect.right + PAD, y: 12, w: vw - rect.right - PAD - 10, h: vh - 24 }
        ].forEach(function (z) {
            if (z.w < 80 || z.h < 300) return;
            z.skyBottom = skyFloor - 30;
            zones.push(z);
            bySide[z.side] = z;
        });
        built = vw >= 280 && vh >= 400;
        narrow = !zones.length;
        if (!built) return false;

        // a few stars, mostly in the margins; the brightest come out first
        // (on a phone the text fills the screen, so just a handful, kept faint)
        var n = narrow ? Math.min(40, Math.round(vw * vh / 9000)) : Math.min(120, Math.round(vw * vh / 10000));
        for (var i = 0; i < n * 2 && stars.length < n; i++) {
            var x = Math.random() * vw, y = 10 + Math.random() * vh * 0.8;
            if (y > skyFloor - 30) continue;
            var inCol = narrow || (x > column.l - 20 && x < column.r + 20);
            if (inCol && !narrow && Math.random() > 0.3) continue;
            var mag = Math.pow(Math.random(), 2.4);
            var high = Math.pow(clamp01(1 - y / (vh * 0.85)), 0.6);   // fainter toward the horizon
            stars.push({
                x: x, y: y, px: x, py: y,
                r: 0.5 + mag * 1.3, depth: mag,
                base: (0.45 + mag * 0.5) * (inCol ? (narrow ? 0.7 : 0.45) : 1) * (0.35 + 0.65 * high),
                period: 2500 + Math.random() * 4500,
                ph: Math.random() * 6.28,
                appear: 0.45 + (1 - mag) * 0.45 + Math.random() * 0.05
            });
        }

        var placed = { left: [], right: [] };

        // the moon claims the top of the right margin (on a phone, the top-right corner)
        var zr = bySide.right;
        if (narrow) {
            moon = { x: vw - 34, y: 44, r: 10, phase: moonPhase(), hover: 0, corner: true };
        } else if (zr && zr.w >= 90) {
            moon = {
                x: zr.x + Math.min(zr.w * 0.5, 130),
                y: zr.y + 92,
                r: 14,
                phase: moonPhase(),
                hover: 0
            };
            placed.right.push({ y0: zr.y + 30, y1: zr.y + 160 }); // glow + phase label space
        }

        CONSTELLATIONS.forEach(function (def) {
            var z = bySide[def.zone];
            if (!z || z.w < 120) return;
            var w = Math.min(def.maxW, z.w - 36);
            var h = w * def.aspect;
            if (h > z.skyBottom - z.y - 60) return;
            var x0 = z.x + (z.w - w) / 2;
            var y0 = Math.min(Math.max(z.y + 14, vh * def.vpos - h / 2), z.skyBottom - h - 22);
            var rects = placed[def.zone];
            for (var k = 0; k < rects.length; k++) {
                if (y0 - 26 < rects[k].y1 && y0 + h + 26 > rects[k].y0) return; // crowded: skip
            }
            rects.push({ y0: y0, y1: y0 + h + 18 }); // body + name label
            consts.push({
                name: def.name, lines: def.lines, hover: 0,
                cx: x0 + w / 2, cy: y0 + h / 2,
                hoverR: Math.max(w, h) / 2 + 36,
                labelY: y0 + h + 18,
                stars: def.pts.map(function (pt) {
                    var x = x0 + pt[0] * w, y = y0 + pt[1] * h;
                    var st = {
                        x: x, y: y, px: x, py: y,
                        r: 1.3 + Math.random() * 0.4, depth: 0.8,
                        base: 0.85 + Math.random() * 0.1,
                        period: 3500 + Math.random() * 4000,
                        ph: Math.random() * 6.28,
                        appear: 0.45 + Math.random() * 0.06
                    };
                    stars.push(st);
                    return st;
                })
            });
        });
        return true;
    }

    // ---- drawing ----
    function drawBackdrop() {
        var g = ctx.createLinearGradient(0, 0, 0, vh);
        g.addColorStop(0, rgba(SKY_TOP, 1));
        g.addColorStop(0.6, rgba(SKY_MID, 1));
        g.addColorStop(1, rgba(SKY_LOW, 1));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, vw, vh);

        // a little lighter behind the text, like lamplight on the page
        var L = column.l / vw, Rr = column.r / vw;
        if (L > 0.08 && Rr < 0.92 && Rr - L > 0.26) {
            var h = ctx.createLinearGradient(0, 0, vw, 0);
            h.addColorStop(0, rgba(PAGE, 0));
            h.addColorStop(L - 0.07, rgba(PAGE, 0));
            h.addColorStop(L + 0.12, rgba(PAGE, 0.3));
            h.addColorStop(Rr - 0.12, rgba(PAGE, 0.3));
            h.addColorStop(Rr + 0.07, rgba(PAGE, 0));
            h.addColorStop(1, rgba(PAGE, 0));
            ctx.fillStyle = h;
            ctx.fillRect(0, 0, vw, vh);
        }
    }

    // the last of the sunset, low along the bottom of the screen
    function drawAfterglow() {
        var g = ctx.createLinearGradient(0, vh * 0.55, 0, vh);
        g.addColorStop(0, rgba(GLOW, 0));
        g.addColorStop(0.7, rgba(GLOW, 0.28));
        g.addColorStop(1, rgba(GLOW, 0.5));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, vw, vh);
    }

    // Keeps the page's grey text legible against the sky.
    var dimShown = -1;
    function tintText(a) {
        var k = Math.round(a * 50) / 50;
        if (k === dimShown) return;
        dimShown = k;
        var c = lerpC(DIM_DAY, DIM_DUSK, k);
        if (k <= 0) document.documentElement.style.removeProperty('--text-dim');
        else document.documentElement.style.setProperty('--text-dim', 'rgb(' + c.join(',') + ')');
    }

    function placeStars(w) {
        var R = 90;
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var x = s.x, y = s.y;
            if (w > 0) {
                x -= pm.x * 6 * s.depth * w;             // nearer stars drift more
                y -= pm.y * 4 * s.depth * w;
                if (lens > 0.01) {                       // light bends around the cursor
                    var dx = x - mouse.x, dy = y - mouse.y, d2 = dx * dx + dy * dy;
                    if (d2 < R * R) {
                        var d = Math.sqrt(d2) || 0.001, f = 1 - d / R;
                        var push = 20 * f * f * lens * w;
                        x += dx / d * push;
                        y += dy / d * push;
                    }
                }
            }
            s.px = x;
            s.py = y;
        }
    }

    function drawStars(now) {
        var j, k, c;
        placeStars(reduced ? 0 : clamp01((dusk - 0.6) / 0.4));

        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var ap = reduced ? 1 : clamp01((dusk - s.appear) / 0.1);
            if (ap <= 0) continue;
            var tw = reduced ? 1 : 0.78 + 0.22 * Math.sin(now * 2 * Math.PI / s.period + s.ph);
            var a = Math.min(1, s.base * ap * tw);
            if (s.r > 1.2) {
                var g = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, s.r * 4);
                g.addColorStop(0, rgba(WHITE, a * 0.45));
                g.addColorStop(1, rgba(WHITE, 0));
                ctx.fillStyle = g;
                ctx.fillRect(s.px - s.r * 4, s.py - s.r * 4, s.r * 8, s.r * 8);
            }
            ctx.fillStyle = rgba(WHITE, a);
            ctx.beginPath();
            ctx.arc(s.px, s.py, s.r, 0, 6.2832);
            ctx.fill();
        }

        // constellation lines, on hover
        for (j = 0; j < consts.length; j++) {
            c = consts[j];
            var dx = mouse.x - c.cx, dy = mouse.y - c.cy;
            var target = (Math.sqrt(dx * dx + dy * dy) < c.hoverR && dusk > 0.8) ? 1 : 0;
            c.hover += (target - c.hover) * (reduced ? 1 : 0.08);
            if (c.hover < 0.005) continue;
            ctx.strokeStyle = rgba(WHITE, c.hover * 0.8);
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            for (k = 0; k < c.lines.length; k++) {
                var a1 = c.stars[c.lines[k][0]], a2 = c.stars[c.lines[k][1]];
                ctx.moveTo(a1.px, a1.py);
                ctx.lineTo(a2.px, a2.py);
            }
            ctx.stroke();
            labels.push([c.name, c.cx, c.labelY, c.hover * 0.75]);
        }
    }

    function drawMoon(map) {
        if (map <= 0) return;
        var rise = reduced ? 0 : (1 - (1 - Math.pow(1 - map, 2))) * 22;
        var my = moon.y + rise;
        var glow = ctx.createRadialGradient(moon.x, my, moon.r * 0.5, moon.x, my, moon.r * 4.5);
        glow.addColorStop(0, rgba(WHITE, 0.5 * map));
        glow.addColorStop(1, rgba(WHITE, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(moon.x, my, moon.r * 4.5, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = rgba(INK, 0.07 * map);     // the dark side, just visible
        ctx.beginPath();
        ctx.arc(moon.x, my, moon.r, 0, 6.2832);
        ctx.fill();
        moonLitPath(ctx, moon.x, my, moon.r, moon.phase);
        ctx.fillStyle = rgba(WHITE, 0.95 * map);
        ctx.fill();

        var mdx = mouse.x - moon.x, mdy = mouse.y - my;
        var mTarget = Math.sqrt(mdx * mdx + mdy * mdy) < moon.r + 26 ? 1 : 0;
        moon.hover += (mTarget - moon.hover) * (reduced ? 1 : 0.08);
        if (moon.hover > 0.01) {
            labels.push([phaseName(moon.phase) + ' · ' + Math.round(phaseIllum(moon.phase) * 100) + '% lit',
                         moon.corner ? vw - 14 : moon.x, my + moon.r + 22, moon.hover * 0.8,
                         moon.corner ? 'right' : 'center']);
        }
    }

    // ---- falling stars: one now and then, once night has fallen ----
    function spawnMeteor() {
        meteors.push({
            x0: vw * (0.08 + Math.random() * 0.84),
            y0: 16 + Math.random() * 90,
            dx: (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 150),
            dy: 40 + Math.random() * 70,
            t0: performance.now(),
            life: 600 + Math.random() * 250
        });
    }

    function drawMeteors(now) {
        for (var q = meteors.length - 1; q >= 0; q--) {
            var m = meteors[q];
            var p = (now - m.t0) / m.life;
            if (p >= 1) { meteors.splice(q, 1); continue; }
            var e = 1 - (1 - p) * (1 - p);
            var hx = m.x0 + m.dx * e, hy = m.y0 + m.dy * e;
            var tx = hx - m.dx * 0.3, ty = hy - m.dy * 0.3;
            var grad = ctx.createLinearGradient(tx, ty, hx, hy);
            grad.addColorStop(0, rgba(WHITE, 0));
            grad.addColorStop(1, rgba(WHITE, Math.sin(Math.PI * p) * 0.95));
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(hx, hy);
            ctx.stroke();
        }
    }

    // ---- starlings: a murmuration at sunset, before they go down to roost ----
    // A small agent-based flock after the StarDisplay model (Hildenbrandt,
    // Carere & Hemelrijk 2010). Each bird flies at its own cruise speed, banks
    // into turns it can't make too tightly, and steers by its seven nearest
    // neighbours, however far away they are, which is how real starlings do it
    // (Ballerini et al. 2008). Birds on the edge pull in harder, and all of them
    // are drawn toward a roost that wanders, so the flock keeps wheeling back
    // over it. Three neighbouring parts of the flock each favour their own
    // point circling the roost, so it stretches, folds and streams past itself
    // rather than moving as one block. Now and then a few birds startle and the
    // turn runs through the flock as a wave. Nothing is scripted, so no two
    // evenings are alike. They stay fifteen seconds or so, then go down to roost.
    // Point at the flock and it parts around you like it would round a falcon.
    var STARLINGS = true;                   // the experiment: false leaves them out
    var BIRD = [44, 52, 66];
    var K = 7, CELL = 24, LOBES = 3;

    function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }
    function gauss() { return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(6.2832 * Math.random()); }

    function startFlock() {
        var n = narrow ? Math.round(rnd(240, 340))
                       : Math.round(Math.max(450, Math.min(1100, vw * vh / 1200)) * rnd(0.75, 1.1));
        var v0 = rnd(95, 120) * (narrow ? 0.8 : 1);
        var f = {
            t: 0, birds: [], v0: v0,
            ph: [], fr: [], lobes: [],
            bias: rnd(-0.08, 0.08),                           // which side of the sky it favours
            roostAt: rnd(9.5, 10.5), roostX: 0,               // seconds of wheeling before they go down
            wa: rnd(1.6, 2.4), wc: rnd(1.0, 1.8), wg: rnd(60, 85),  // alignment, cohesion, roost pull
            wf: rnd(0.1, 0.14),                               // pull of the flock as a whole
            scale: narrow ? 1.1 : 1.35,
            nextStartle: rnd(1.2, 2.5)
        };
        nextFlockAt = Infinity;                               // one flock at a time
        for (var i = 0; i < 8; i++) { f.ph.push(Math.random() * 6.28); f.fr.push(rnd(0.75, 1.35)); }
        // each part of the flock circles the roost its own way, some one way, some the other
        for (i = 0; i < LOBES; i++) {
            f.lobes.push({ a: Math.random() * 6.28, w: (i % 2 ? -1 : 1) * rnd(0.7, 1.2), r: rnd(55, 105) * f.scale });
        }
        // they come in from whichever edge is nearer the side of the sky they're making for
        var g0 = guideAt(f, 0), dir = g0.x > vw / 2 ? -1 : 1;
        f.roostX = Math.max(vw * 0.1, Math.min(vw * 0.9, g0.x + rnd(-0.1, 0.1) * vw));
        var y0 = g0.y + rnd(-0.08, 0.08) * vh, spread = Math.min(140, vw * 0.1);
        for (i = 0; i < n; i++) {
            var back = Math.pow(Math.random(), 1.2) * spread, dy = gauss() * 30;
            var v = v0 * rnd(0.92, 1.08);
            f.birds.push({
                x: dir > 0 ? -10 - back : vw + 10 + back,
                y: y0 + dy, z: gauss() * 45,
                vx: dir * v, vy: gauss() * 8, vz: gauss() * 6,
                ax: 0, ay: 0, az: 0, cruise: v, startle: 0,
                lobe: Math.floor(((Math.atan2(dy, back - spread / 2) / 6.2832 + 1) % 1) * LOBES),  // neighbours share a part
                wing: Math.random() * 6.28, beat: rnd(20, 28),   // wingbeat, radians/s
                roost: Math.random() * 1.6,               // when, after the rest begin, it heads down
                home: false, gone: false
            });
        }
        flock = f;
    }

    // The point the flock keeps coming back to: it lingers out over one side of
    // the sky, then drifts across to the other (and finally down below the
    // horizon), so the birds spend most of their time clear of the text.
    function guideAt(f, T) {
        var p = f.ph, r = f.fr;
        var side = Math.tanh(2.5 * Math.sin(0.07 * r[0] * T + p[0]));
        var reach = narrow ? 0.12 : Math.max(0.1, Math.min(0.34, (vw - column.r) / vw * 0.75 + 0.05));
        return {
            x: vw * (0.5 + f.bias * 0.5 + reach * side + 0.05 * Math.sin(0.21 * r[1] * T + p[1])),
            y: vh * (0.52 + 0.09 * Math.sin(0.12 * r[2] * T + p[2]) + 0.04 * Math.sin(0.29 * r[3] * T + p[3]))
        };
    }

    function stepFlock(f, dt, hunters) {
        var birds = f.birds, n = birds.length, i, j, b, o;
        var g = guideAt(f, f.t), G = [];
        for (i = 0; i < LOBES; i++) {
            var lb = f.lobes[i], la = lb.a + lb.w * f.t;
            G.push({ x: g.x + Math.cos(la) * lb.r, y: g.y + Math.sin(la) * lb.r * 0.6 });
        }
        var roost = { x: f.roostX, y: vh + 80 };

        // a coarse grid on the screen plane, to find neighbours quickly
        var grid = new Map();
        for (i = 0; i < n; i++) {
            b = birds[i];
            if (b.gone) continue;
            var key = (Math.floor(b.x / CELL) + 4096) * 8192 + Math.floor(b.y / CELL) + 4096;
            var cell = grid.get(key);
            if (cell) cell.push(i); else grid.set(key, [i]);
        }

        // where the flock is as a whole: starlings respond to the shape of the
        // whole flock against the sky, not only to their neighbours (Pearce et
        // al. 2014), and it's what keeps a murmuration from breaking apart
        var C = centroid(f, true);

        var nd = new Float64Array(K), ni = new Int32Array(K);
        var sepR = 11 * f.scale, maxR = CELL * 1.5, turnMax = f.v0 * f.v0 / 35, M = 50;
        for (i = 0; i < n; i++) {
            b = birds[i];
            if (b.gone) continue;
            var cx = Math.floor(b.x / CELL), cy = Math.floor(b.y / CELL), cnt = 0;
            var sx = 0, sy = 0, sz = 0;
            for (var gx = cx - 1; gx <= cx + 1; gx++) {
                for (var gy = cy - 1; gy <= cy + 1; gy++) {
                    var list = grid.get((gx + 4096) * 8192 + gy + 4096);
                    if (!list) continue;
                    for (var q = 0; q < list.length; q++) {
                        j = list[q];
                        if (j === i) continue;
                        o = birds[j];
                        var dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
                        var d2 = dx * dx + dy * dy + dz * dz;
                        if (d2 > maxR * maxR) continue;
                        if (d2 < sepR * sepR) {               // too close: ease apart
                            var d = Math.sqrt(d2) || 0.01, push = (sepR - d) / sepR * 900 / d;
                            sx -= dx * push; sy -= dy * push; sz -= dz * push;
                        }
                        // keep the K nearest (insertion into a short sorted list)
                        if (cnt < K || d2 < nd[cnt - 1]) {
                            var k = cnt < K ? cnt++ : K - 1;
                            while (k > 0 && nd[k - 1] > d2) { nd[k] = nd[k - 1]; ni[k] = ni[k - 1]; k--; }
                            nd[k] = d2; ni[k] = j;
                        }
                    }
                }
            }

            var ax = sx, ay = sy, az = sz;
            if (cnt) {
                var mx = 0, my = 0, mz = 0, mvx = 0, mvy = 0, mvz = 0, ux = 0, uy = 0, uz = 0;
                for (k = 0; k < cnt; k++) {
                    o = birds[ni[k]];
                    mx += o.x; my += o.y; mz += o.z;
                    mvx += o.vx; mvy += o.vy; mvz += o.vz;
                    var dd = Math.sqrt(nd[k]) || 1;
                    ux += (o.x - b.x) / dd; uy += (o.y - b.y) / dd; uz += (o.z - b.z) / dd;
                }
                // how lopsided its neighbours are: high on the edge of the flock
                var edge = Math.sqrt(ux * ux + uy * uy + uz * uz) / cnt;
                ax += (mvx / cnt - b.vx) * f.wa;
                ay += (mvy / cnt - b.vy) * f.wa;
                az += (mvz / cnt - b.vz) * f.wa;
                var wc = f.wc * (0.3 + edge);
                ax += (mx / cnt - b.x) * wc;
                ay += (my / cnt - b.y) * wc;
                az += (mz / cnt - b.z) * wc;
            }

            // the roost: a gentle pull that grows with distance (and, at the end, the real one)
            var tg = b.home ? roost : G[b.lobe];
            var gdx = tg.x - b.x, gdy = tg.y - b.y, gd = Math.sqrt(gdx * gdx + gdy * gdy) || 1;
            var pull = b.home ? 5 * f.wg : f.wg * smooth(clamp01((gd - 30) / 180));
            ax += gdx / gd * pull;
            ay += gdy / gd * pull;
            az -= b.z * 0.9;                                  // a flock, not a tunnel: some depth, not too much
            if (!b.home) {
                ax += (C.x - b.x) * f.wf;
                ay += (C.y - b.y) * f.wf;
                // and the sky ends at the edges of the screen
                if (b.x < M) ax += (M - b.x) * 8; else if (b.x > vw - M) ax -= (b.x - vw + M) * 8;
                if (b.y < vh * 0.2) ay += (vh * 0.2 - b.y) * 8; else if (b.y > vh * 0.86) ay -= (b.y - vh * 0.86) * 8;
            }

            // predators: swerve away, and go faster
            for (var h = 0; h < hunters.length; h++) {
                var hx = b.x - hunters[h][0], hy = b.y - hunters[h][1], R = hunters[h][2];
                var hd2 = hx * hx + hy * hy;
                if (hd2 < R * R) {
                    var hd = Math.sqrt(hd2) || 0.01, fear = (1 - hd / R) * 1400;
                    ax += hx / hd * fear;
                    ay += hy / hd * fear;
                }
            }

            if (b.startle > 0) {
                b.startle -= dt;
                ax += b.sx * 900; ay += b.sy * 900;
            }

            ax += gauss() * 32; ay += gauss() * 32; az += gauss() * 14;

            // flight: hold cruise speed, and bank into turns no tighter than a set radius
            var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz) || 1;
            var fx = b.vx / sp, fy = b.vy / sp, fz = b.vz / sp;
            var along = ax * fx + ay * fy + az * fz;
            var lx = ax - along * fx, ly = ay - along * fy, lz = az - along * fz;
            var lat = Math.sqrt(lx * lx + ly * ly + lz * lz);
            var cap = turnMax * (b.home ? 2.2 : 1);
            if (lat > cap) { lx *= cap / lat; ly *= cap / lat; lz *= cap / lat; }
            var want = b.cruise * (b.home ? 2 : 1);
            along = Math.max(-120, Math.min(160, along * 0.25 + (want - sp) * 2.2));
            b.ax = lx + along * fx;
            b.ay = ly + along * fy;
            b.az = lz + along * fz;
        }

        var live = 0;
        for (i = 0; i < n; i++) {
            b = birds[i];
            if (b.gone) continue;
            b.vx += b.ax * dt; b.vy += b.ay * dt; b.vz += b.az * dt;
            b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
            b.wing += b.beat * dt;
            if (!b.home && f.t > f.roostAt + b.roost) b.home = true;
            if (b.home && b.y > vh + 20) b.gone = true; else live++;
        }
        return live;
    }

    function updateFlock(now, sdt) {
        var f = flock, total = Math.min(0.05, sdt / 1000);
        var hunters = [];
        if (mouse.x > -1000 && lens > 0.3) hunters.push([mouse.x, mouse.y, 70]);

        // now and then a few birds near each other startle, and veer
        if (f.t > f.nextStartle && f.t < f.roostAt) {
            f.nextStartle = f.t + rnd(1.2, 2.5);
            var lead = f.birds[Math.floor(Math.random() * f.birds.length)];
            var ang = Math.random() * 6.2832, ux = Math.cos(ang), uy = Math.sin(ang);
            for (var si = 0; si < f.birds.length; si++) {
                var sb = f.birds[si];
                if (sb.gone) continue;
                var ddx = sb.x - lead.x, ddy = sb.y - lead.y;
                if (ddx * ddx + ddy * ddy < 2000) { sb.startle = 0.4; sb.sx = ux; sb.sy = uy; }
            }
        }

        var live = f.birds.length;
        while (total > 1e-4) {
            var dt = Math.min(total, 1 / 60);
            total -= dt;
            f.t += dt;
            live = stepFlock(f, dt, hunters);
        }
        if (!live) flock = null;
    }

    function centroid(f, all) {
        var x = 0, y = 0, n = 0;
        for (var i = 0; i < f.birds.length; i++) {
            var b = f.birds[i];
            if (b.gone || b.home || (!all && (b.x < 0 || b.x > vw))) continue;
            x += b.x; y += b.y; n++;
        }
        return n ? { x: x / n, y: y / n } : { x: vw / 2, y: vh / 2 };
    }

    // Each bird is a small dart in 3D: pointed nose, swept wings, a notch at
    // the tail. It rolls into its turns (its lift tilts to carry the turn, as a
    // real bird's does) and its wingtips beat, so the flock shimmers as it
    // wheels. We watch from the ground, looking up at them, so a bird flying
    // level shows its wings. Nearer birds are drawn larger.
    var LIFT = 260, LOOK = 0.6, LOOK_C = Math.cos(LOOK), LOOK_S = Math.sin(LOOK);
    function birdPath(x, y, z, vx, vy, vz, ax, ay, az, wing, size) {
        var sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
        var fx = vx / sp, fy = vy / sp, fz = vz / sp;
        // which way is "up" for the bird: against gravity, tipped by the turn
        var ux = ax, uy = ay - LIFT, uz = az;
        var dot = ux * fx + uy * fy + uz * fz;
        ux -= dot * fx; uy -= dot * fy; uz -= dot * fz;
        var ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
        ux /= ul; uy /= ul; uz /= ul;
        var rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;  // its right wing
        var k = size * (1 + z / 260);                        // perspective
        var flap = Math.sin(wing) * 0.9;
        // nose, right wingtip, tail notch, left wingtip (forward, right, up)
        var P = [[1.9, 0, 0], [-1.1, 2.2, flap], [-0.5, 0, 0], [-1.1, -2.2, flap]];
        for (var i = 0; i < 4; i++) {
            var ox = fx * P[i][0] + rx * P[i][1] + ux * P[i][2];
            var oy = fy * P[i][0] + ry * P[i][1] + uy * P[i][2];
            var oz = fz * P[i][0] + rz * P[i][1] + uz * P[i][2];
            var px = x + ox * k, py = y + (oy * LOOK_C + oz * LOOK_S) * k;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
    }

    function drawFlock() {
        var f = flock, n = f.birds.length;
        // three soft inks, one per depth: light enough that the flock reads as
        // a haze over the sky rather than a mark on the page
        for (var depth = 0; depth < 3; depth++) {
            ctx.fillStyle = rgba(BIRD, (0.25 + depth * 0.11) * (narrow ? 0.8 : 1));
            ctx.beginPath();
            for (var i = 0; i < n; i++) {
                var b = f.birds[i];
                if (b.gone || b.x < -10 || b.x > vw + 10 || b.y < -10 || b.y > vh + 10) continue;
                var bd = b.z < -20 ? 0 : b.z > 20 ? 2 : 1;
                if (bd !== depth) continue;
                birdPath(b.x, b.y, b.z, b.vx, b.vy, b.vz, b.ax, b.ay, b.az, b.wing, f.scale);
            }
            ctx.fill();
        }
    }

    function draw(now) {
        ctx.clearRect(0, 0, vw, vh);
        var a = !built ? 0 : reduced ? 1 : smooth(clamp01(dusk / 0.6));   // the page fades into dusk
        tintText(a);
        if (!built || (dusk <= 0 && !meteors.length && !flock)) return;
        labels.length = 0;

        if (a > 0) {
            ctx.globalAlpha = a;
            drawBackdrop();
            drawAfterglow();
            ctx.fillStyle = grain;
            ctx.globalAlpha = a * 0.35;
            ctx.fillRect(0, 0, vw, vh);
            ctx.globalAlpha = a;                   // everything in the sky fades with it
            drawStars(now);
            if (moon) drawMoon(clamp01((dusk - 0.45) / 0.5));
            ctx.globalAlpha = 1;
        }

        if (flock) drawFlock();                    // dark against the sunset, from the first moment
        drawMeteors(now);

        ctx.font = '11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        for (var i = 0; i < labels.length; i++) {
            ctx.textAlign = labels[i][4] || 'center';
            ctx.fillStyle = rgba(INK, labels[i][3] * a);
            ctx.fillText(labels[i][0], labels[i][1], labels[i][2]);
        }
    }

    // ---- the clock ----
    // The evening, in order: the light starts to go, the starlings come in and
    // the sky holds at sunset while they're out, and only once they've gone
    // down to roost does night carry on and the stars come out.
    function beginDusk(len, birds) {
        duskBegun = true;
        duskLen = Math.max(1, len);
        duskRate = 1 / duskLen;
        if (birds && STARLINGS && !flock) nextFlockAt = clock + duskLen * 0.15;
        if (!PREVIEW) { try { sessionStorage.setItem('night-fell', '1'); } catch (e) { /* ignore */ } }
    }

    function tick(now, dt) {
        var sdt = dt * speedMul;
        clock += sdt;
        if (!duskBegun && clock >= duskAt) beginDusk(duskLen, true);
        if (duskRate) {
            dusk = clamp01(dusk + duskRate * sdt);
            var birdsOut = flock || nextFlockAt < Infinity;
            if (duskRate > 0 && birdsOut && dusk > SUNSET) dusk = Math.max(SUNSET, dusk - duskRate * sdt);
            else if (dusk >= 1 || dusk <= 0) duskRate = 0;
        }

        var onScreen = mouse.x > -1000;
        pm.x += ((onScreen ? mouse.x / vw * 2 - 1 : 0) - pm.x) * 0.04;
        pm.y += ((onScreen ? mouse.y / vh * 2 - 1 : 0) - pm.y) * 0.04;
        lens += ((onScreen ? 1 : 0) - lens) * 0.06;

        if (STARLINGS && !flock && clock >= nextFlockAt) startFlock();   // once a visit, unless called back
        if (flock) {
            if (dusk <= 0) flock = null; else updateFlock(now, sdt);
        }

        // a falling star now and then, once it's properly night
        if (dusk >= 1 && duskRate >= 0) {
            if (nextShootAt === Infinity) nextShootAt = clock + 6000 + Math.random() * 20000;
            else if (clock >= nextShootAt) {
                spawnMeteor();
                nextShootAt = clock + 30000 + Math.random() * 50000;
            }
        }
    }

    function loop(now) {
        raf = null;
        var dt = lastReal ? Math.min(64, now - lastReal) : 16;
        lastReal = now;
        tick(now, dt);
        draw(now);
        if (built || meteors.length) {
            raf = requestAnimationFrame(loop);
        } else {
            running = false;
        }
    }

    function wake() {
        if (reduced || running) return;
        ensureCanvas();
        running = true;
        lastReal = 0;
        raf = requestAnimationFrame(loop);
    }

    // --- wiring ---
    if (!reduced) {
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }, { passive: true });

        document.documentElement.addEventListener('mouseleave', function () {
            mouse.x = mouse.y = -1e4;
        });

        // Touch: a tap reveals what a hover would (the moon's phase, a constellation).
        var touch0 = null, clearTouch = null;
        function touchPoint(e) { var p = e.changedTouches[0]; return { x: p.clientX, y: p.clientY }; }
        document.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) { touch0 = null; return; }
            var p = touchPoint(e);
            touch0 = { x: p.x, y: p.y, t: performance.now() };
            clearTimeout(clearTouch);
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (!touch0) return;
            var p = touchPoint(e);
            mouse.x = p.x;
            mouse.y = p.y;
        }, { passive: true });
        document.addEventListener('touchend', function (e) {
            if (!touch0) return;
            var p = touchPoint(e), now = performance.now();
            var tap = now - touch0.t < 350 && Math.hypot(p.x - touch0.x, p.y - touch0.y) < 12;
            touch0 = null;
            if (!tap) { clearTouch = setTimeout(function () { mouse.x = mouse.y = -1e4; }, 200); return; }
            mouse.x = p.x;
            mouse.y = p.y;
            clearTouch = setTimeout(function () { mouse.x = mouse.y = -1e4; }, 2600);
        }, { passive: true });
    }

    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (!canvas) return;
            sizeCanvas();
            grain = makeGrain();
            buildSky();
            if (reduced) { if (dusk > 0) draw(performance.now()); return; }
            if (built) wake();
        }, 180);
    });

    if (!reduced) {
        // Evening comes after ten seconds here, over another ten. If it already
        // came on an earlier visit this session, it falls a little faster.
        var fell = false;
        try { fell = !!sessionStorage.getItem('night-fell'); } catch (e) { /* ignore */ }
        if (PREVIEW) {
            duskAt = 0;
            duskLen = 1500;
        } else if (fell) {
            duskAt = 10000;
            duskLen = 6000;
        } else {
            duskAt = 10000;
            duskLen = 10000;
        }
        ensureCanvas();
        buildSky();
        if (built) wake();
    }

    window.night = function (seconds) {
        ensureCanvas();
        if (!built) buildSky();
        if (!built) return '(no room for a sky on this screen)';
        if (reduced) {
            dusk = 1;
            draw(performance.now());
            return '☾ ' + phaseName(moonPhase()) + ' tonight';
        }
        if (dusk >= 1 || duskRate > 0) return '☾ already out';
        duskAt = clock;
        beginDusk(typeof seconds === 'number' ? Math.max(0, seconds * 1000) : 6000, false);
        wake();
        return '☾ ' + phaseName(moonPhase()) + ' tonight';
    };

    window.day = function () {
        duskAt = Infinity;                        // and don't let it fall again on its own
        duskBegun = true;
        nextFlockAt = Infinity;
        nextShootAt = Infinity;
        if (dusk <= 0) return '☀︎ it is day';
        if (reduced) {
            dusk = 0;
            if (ctx) ctx.clearRect(0, 0, vw, vh);
            tintText(0);
            return '☀︎ until next time';
        }
        duskRate = -1 / 2600;
        wake();
        return '☀︎ until next time';
    };

    window.starlings = function () {
        if (reduced) return '(the starlings are resting: reduced motion is on)';
        if (!STARLINGS) return '(no starlings tonight)';
        if (flock) return '⌒ already here';
        ensureCanvas();
        if (!built) buildSky();
        if (dusk <= 0 && duskRate <= 0) {         // the whole evening, from the start
            duskAt = clock;
            beginDusk(10000, true);
        } else {
            startFlock();
        }
        wake();
        return '⌒ starlings, coming in';
    };

    window.sky = {
        night: window.night,
        starlings: window.starlings,
        day: window.day,
        speed: function (n) {
            speedMul = typeof n === 'number' && n > 0 ? Math.min(n, 50) : 1;
            return '⏩ time ×' + speedMul;
        }
    };

    // Replays the real first-visit timeline from scratch (pair with speed).
    function replay() {
        dusk = 0;
        duskRate = 0;
        duskBegun = false;
        meteors.length = 0;
        flock = null;
        nextFlockAt = Infinity;
        duskAt = clock + 10000;
        duskLen = 10000;
        wake();
    }

    function devPanel() {
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:1000;' +
            'display:flex;gap:4px;font:11px Menlo,Monaco,monospace;background:rgba(249,250,251,0.92);' +
            'border:1px solid #e4e4e7;border-radius:6px;padding:4px;';
        var speedBtn;
        [['day', function () { window.day(); }],
         ['night', function () { window.night(4); }],
         ['starlings', function () { window.starlings(); }],
         ['replay', replay],
         ['×1', function () {
             window.sky.speed(speedMul === 1 ? 5 : speedMul === 5 ? 20 : 1);
             speedBtn.textContent = '×' + speedMul;
         }]].forEach(function (b) {
            var btn = document.createElement('button');
            btn.textContent = b[0];
            btn.style.cssText = 'font:inherit;color:#52525b;background:none;border:0;padding:3px 7px;' +
                'border-radius:4px;cursor:pointer;';
            btn.onmouseenter = function () { btn.style.background = '#f1f1f3'; };
            btn.onmouseleave = function () { btn.style.background = 'none'; };
            btn.onclick = b[1];
            if (b[0] === '×1') speedBtn = btn;
            bar.appendChild(btn);
        });
        document.body.appendChild(bar);
    }
    if (PREVIEW) devPanel();

    try {
        console.log('%c☾ stay a while: evening comes around here  (night() if impatient)',
            'color:#6c757d;font-family:Menlo,monospace;font-size:11px');
    } catch (e) { /* ignore */ }
})();
