// Stay on this page a little while and evening comes. The page fades into a
// muted blue dusk with the last warmth of the sunset along the bottom, and a
// few stars come out. The moon shows its real phase for
// today, a small orrery shows where the planets really are, and the
// constellations appear on hover. A fast sweep of the cursor throws a comet.
// Console: night(), day(), comet(), shower(), sky.speed(n).
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

    // ---- the actual planets ----
    // JPL approximate Keplerian elements (Standish, valid 1800–2050): a, e, I,
    // mean longitude L, longitude of perihelion ϖ, ascending node Ω, each with
    // its rate per Julian century. Good to well under a degree for this.
    var PLANETS = [
        ['mercury', 0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749,
         252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
        ['venus', 0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890,
         181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
        ['earth', 1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
         100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
        ['mars', 1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131,
         -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
        ['jupiter', 5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714,
         34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
        ['saturn', 9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609,
         49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]
    ];
    function heliocentric(el, T) {
        var a = el[1] + el[2] * T, e = el[3] + el[4] * T, I = (el[5] + el[6] * T) * rad;
        var L = el[7] + el[8] * T, wbar = el[9] + el[10] * T, node = el[11] + el[12] * T;
        var w = (wbar - node) * rad, O = node * rad;
        var M = ((((L - wbar) % 360) + 540) % 360 - 180) * rad;
        var E = M + e * Math.sin(M);
        for (var k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        var xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
        var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O);
        var cI = Math.cos(I), sI = Math.sin(I);
        return {
            a: a,
            x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
            y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
            z: (sw * sI) * xp + (cw * sI) * yp
        };
    }
    function planetsToday() {
        var T = (Date.now() / 86400000 + 2440587.5 - 2451545) / 36525;
        var out = PLANETS.map(function (el) {
            var p = heliocentric(el, T);
            p.name = el[0];
            return p;
        });
        var earth = out[2];
        out.forEach(function (p) {
            var dx = p.x - earth.x, dy = p.y - earth.y, dz = p.z - earth.z;
            p.dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        });
        out.sunDist = Math.sqrt(earth.x * earth.x + earth.y * earth.y + earth.z * earth.z);
        return out;
    }

    // ---- meteor showers, on their real dates ----
    // name, month (0-based), peak day, where along the top the radiant sits
    var SHOWERS = [
        ['quadrantids', 0, 3, 0.64], ['lyrids', 3, 22, 0.30], ['eta aquariids', 4, 6, 0.78],
        ['perseids', 7, 12, 0.70], ['orionids', 9, 21, 0.38], ['leonids', 10, 17, 0.56],
        ['geminids', 11, 14, 0.34]
    ];
    var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    function showerNear(date, within) {
        var best = null;
        SHOWERS.forEach(function (s) {
            for (var y = date.getFullYear() - 1; y <= date.getFullYear() + 1; y++) {
                var days = (new Date(y, s[1], s[2]) - date) / 86400000;
                if (within ? Math.abs(days) <= within : days >= -1) {
                    if (!best || Math.abs(days) < Math.abs(best.days)) {
                        best = { name: s[0], month: s[1], day: s[2], rx: s[3], days: days };
                    }
                }
            }
        });
        return best;
    }
    var activeShower = showerNear(new Date(), 2.5);

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
    var zones = [], stars = [], consts = [], moon = null, orrery = null, skyFloor = 0;
    var built = false, narrow = false;              // narrow: a phone, with no margins to speak of
    var column = { l: 0, r: 0 };
    var meteors = [], comets = [], sparks = [], samples = [], labels = [];
    var mouse = { x: -1e4, y: -1e4 };
    var pm = { x: 0, y: 0 }, lens = 0;              // smoothed parallax + lensing

    var clock = 0, lastReal = 0, speedMul = 1, raf = null, running = false;
    var duskAt = Infinity, duskLen = 10000;
    var dusk = 0, duskRate = 0, duskBegun = false;
    var nextShootAt = Infinity, burst = [], lastCometAt = -1e9;
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
        orrery = null;
        zones = [];

        var main = document.querySelector('main');
        var rect = main ? main.getBoundingClientRect() : { left: vw / 2, right: vw / 2 };
        column = { l: rect.left, r: rect.right };
        skyFloor = vh * 0.9;          // below this, the afterglow washes the stars out

        // the moon, orrery and constellations keep to the margins
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
                r: 0.5 + mag * 1.3, depth: mag, boost: 0,
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

        // the orrery takes the top of the left margin
        var zl = bySide.left;
        if (zl && zl.w >= 150 && zl.skyBottom - zl.y >= 360) {
            var OR = Math.min(58, (zl.w - 40) / 2);
            var oy = zl.y + OR + 36;
            orrery = {
                x: zl.x + zl.w / 2, y: oy, R: OR,
                bodies: planetsToday(),
                label: '', la: 0, focus: null, fa: 0
            };
            placed.left.push({ y0: oy - OR - 8, y1: oy + OR + 26 });
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
                name: def.name, lines: def.lines, hover: 0, ig: -1,
                cx: x0 + w / 2, cy: y0 + h / 2,
                hoverR: Math.max(w, h) / 2 + 36,
                labelY: y0 + h + 18,
                stars: def.pts.map(function (pt) {
                    var x = x0 + pt[0] * w, y = y0 + pt[1] * h;
                    var st = {
                        x: x, y: y, px: x, py: y,
                        r: 1.3 + Math.random() * 0.4, depth: 0.8, boost: 0,
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

    function igniteAlpha(c, now) {
        if (c.ig < 0) return 0;
        var age = now - c.ig;
        if (age > 4000) { c.ig = -1; return 0; }
        return age < 3200 ? 1 : 1 - (age - 3200) / 800;
    }

    function drawStars(now) {
        var j, k, c;
        for (j = 0; j < consts.length; j++) {
            c = consts[j];
            c.igA = igniteAlpha(c, now);
            for (k = 0; k < c.stars.length; k++) c.stars[k].boost = c.igA * 0.4;
        }
        placeStars(reduced ? 0 : clamp01((dusk - 0.6) / 0.4));

        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var ap = reduced ? 1 : clamp01((dusk - s.appear) / 0.1);
            if (ap <= 0) continue;
            var tw = reduced ? 1 : 0.78 + 0.22 * Math.sin(now * 2 * Math.PI / s.period + s.ph);
            var a = Math.min(1, s.base * ap * tw * (1 + (s.boost || 0)));
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

        // constellation lines, on hover (or when a comet lights them)
        for (j = 0; j < consts.length; j++) {
            c = consts[j];
            var dx = mouse.x - c.cx, dy = mouse.y - c.cy;
            var target = (Math.sqrt(dx * dx + dy * dy) < c.hoverR && dusk > 0.8) ? 1 : 0;
            c.hover += (target - c.hover) * (reduced ? 1 : 0.08);
            var la = Math.max(c.hover * 0.8, c.igA * 0.9);
            if (la < 0.004) continue;
            var age = c.ig >= 0 ? now - c.ig : 1e9;
            ctx.strokeStyle = rgba(WHITE, la);
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            for (k = 0; k < c.lines.length; k++) {
                var prog = c.hover > 0.5 ? 1 : clamp01((age - k * 110) / 160);
                if (prog <= 0) continue;
                var a1 = c.stars[c.lines[k][0]], a2 = c.stars[c.lines[k][1]];
                ctx.moveTo(a1.px, a1.py);
                ctx.lineTo(a1.px + (a2.px - a1.px) * prog, a1.py + (a2.py - a1.py) * prog);
            }
            ctx.stroke();
            var na = Math.max(c.hover, c.igA * clamp01((age - 500) / 400)) * 0.75;
            if (na > 0.004) labels.push([c.name, c.cx, c.labelY, na]);
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

    // Sun at the centre, Mercury to Saturn where they really are today, seen
    // from above the north pole; distances square-rooted so all six fit.
    function drawOrrery(a) {
        if (a <= 0) return;
        var o = orrery, amax = 9.537;
        var scale = function (r) { return o.R * Math.sqrt(r / amax); };
        var i, b, pr;
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = rgba(INK, 0.22 * a);
        ctx.beginPath();
        for (i = 0; i < o.bodies.length; i++) {
            pr = scale(o.bodies[i].a);
            ctx.moveTo(o.x + pr, o.y);
            ctx.arc(o.x, o.y, pr, 0, 6.2832);
        }
        ctx.stroke();

        var sg = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 8);
        sg.addColorStop(0, rgba(CLAY, 0.35 * a));
        sg.addColorStop(1, rgba(CLAY, 0));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 8, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = rgba(CLAY, 0.9 * a);
        ctx.beginPath();
        ctx.arc(o.x, o.y, 1.9, 0, 6.2832);
        ctx.fill();

        var focus = null, fd = 9, earth = null;
        for (i = 0; i < o.bodies.length; i++) {
            b = o.bodies[i];
            pr = scale(Math.hypot(b.x, b.y));
            var ang = Math.atan2(b.y, b.x);
            b.sx = o.x + pr * Math.cos(ang);
            b.sy = o.y - pr * Math.sin(ang);
            if (b.name === 'earth') earth = b;
            var d = Math.hypot(mouse.x - b.sx, mouse.y - b.sy);
            if (d < fd) { fd = d; focus = b; }
            var br = b.name === 'jupiter' ? 2.1 : b.name === 'saturn' ? 1.9 : b.name === 'earth' ? 1.6 : 1.35;
            ctx.fillStyle = rgba(INK, 0.7 * a);
            ctx.beginPath();
            ctx.arc(b.sx, b.sy, br, 0, 6.2832);
            ctx.fill();
            if (b.name === 'saturn') {
                ctx.strokeStyle = rgba(INK, 0.5 * a);
                ctx.beginPath();
                ctx.ellipse(b.sx, b.sy, 4, 1.4, -0.4, 0, 6.2832);
                ctx.stroke();
            }
        }
        if (earth) {
            ctx.strokeStyle = rgba(INK, 0.45 * a);
            ctx.beginPath();
            ctx.arc(earth.sx, earth.sy, 3.6, 0, 6.2832);
            ctx.stroke();
        }
        if (!focus && Math.hypot(mouse.x - o.x, mouse.y - o.y) < 7) focus = 'sun';

        // a sight line from here to whatever you're pointing at
        if (focus) o.focus = focus;
        o.fa += ((focus && focus !== earth ? 1 : 0) - o.fa) * 0.12;
        if (o.fa > 0.01 && o.focus && o.focus !== earth && earth) {
            var tx = o.focus === 'sun' ? o.x : o.focus.sx, ty = o.focus === 'sun' ? o.y : o.focus.sy;
            ctx.save();
            ctx.setLineDash([2, 3]);
            ctx.strokeStyle = rgba(INK, 0.45 * o.fa * a);
            ctx.beginPath();
            ctx.moveTo(earth.sx, earth.sy);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.restore();
        }

        var label = '';
        if (focus === 'sun') label = 'sun · ' + o.bodies.sunDist.toFixed(2) + ' AU away';
        else if (focus === earth) label = 'earth · you are here';
        else if (focus) label = focus.name + ' · ' + focus.dist.toFixed(2) + ' AU away';
        else if (Math.hypot(mouse.x - o.x, mouse.y - o.y) < o.R + 12) {
            var today = new Date();
            label = 'the planets · ' + today.getDate() + ' ' + MONTHS[today.getMonth()] + ' ' + today.getFullYear();
        }
        if (label) o.label = label;
        o.la += ((label ? 1 : 0) - o.la) * (reduced ? 1 : 0.1);
        if (o.la > 0.01) labels.push([o.label, o.x, o.y + o.R + 22, 0.8 * o.la * a]);
    }

    // ---- falling stars ----
    function spawnMeteor(sh) {
        var now = performance.now();
        if (sh) {
            // a shower: every streak points back to the same radiant
            var rx = vw * sh.rx, ry = -30;
            var ang = Math.PI / 2 + (Math.random() - 0.5) * 1.6;
            var d0 = 60 + Math.random() * vh * 0.45, len = 130 + Math.random() * 150;
            meteors.push({
                x0: rx + Math.cos(ang) * d0, y0: ry + Math.sin(ang) * d0,
                dx: Math.cos(ang) * len, dy: Math.sin(ang) * len,
                t0: now, life: 480 + Math.random() * 300
            });
            return;
        }
        meteors.push({
            x0: vw * (0.08 + Math.random() * 0.84),
            y0: 16 + Math.random() * 90,
            dx: (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 150),
            dy: 40 + Math.random() * 70,
            t0: now,
            life: 600 + Math.random() * 250
        });
    }

    function drawMeteors(now) {
        for (var q = meteors.length - 1; q >= 0; q--) {
            var sh = meteors[q];
            var p = (now - sh.t0) / sh.life;
            if (p >= 1) { meteors.splice(q, 1); continue; }
            var e = 1 - (1 - p) * (1 - p);
            var hx = sh.x0 + sh.dx * e, hy = sh.y0 + sh.dy * e;
            var tx = hx - sh.dx * 0.3, ty = hy - sh.dy * 0.3;
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

    // ---- comets: throw one with a fast sweep of the cursor, after dark ----
    function cursorVel(now) {
        var n = samples.length;
        if (n < 2 || now - samples[n - 1].t > 40) return { x: 0, y: 0, s: 0 };
        var first = samples[n - 1], last = samples[n - 1];
        for (var i = n - 2; i >= 0 && last.t - samples[i].t <= 70; i--) first = samples[i];
        var dt = last.t - first.t;
        if (dt <= 0) return { x: 0, y: 0, s: 0 };
        var vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt;
        return { x: vx, y: vy, s: Math.hypot(vx, vy) };
    }

    function maybeLaunch(now, sideways) {
        if (reduced || dusk < 0.6 || duskRate < 0 || now - lastCometAt < 1200) return;
        for (var i = 0; i < comets.length; i++) if (comets[i].follow) return;
        if (samples.length < 5) return;
        var len = 0, first = null, last = samples[samples.length - 1];
        for (i = 1; i < samples.length; i++) {
            if (now - samples[i - 1].t > 300) continue;
            if (!first) first = samples[i - 1];
            len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
        }
        if (len < (sideways ? Math.min(250, vw * 0.45) : 250)) return;
        if (sideways && first && Math.abs(last.x - first.x) < 2 * Math.abs(last.y - first.y)) return;
        lastCometAt = now;
        var v = cursorVel(now);
        comets.push({
            x: mouse.x, y: mouse.y, vx: v.x, vy: v.y, tvx: v.x, tvy: v.y,
            follow: true, born: now, slow: 0, emit: 0,
            pts: samples.slice(-8).map(function (p) { return { x: p.x, y: p.y, t: p.t }; })
        });
        wake();
    }

    // A long, slow comet across the whole sky.
    function launchScripted() {
        var now = performance.now();
        var fromLeft = Math.random() < 0.5;
        var sp = 1.35 + Math.random() * 0.2, ang = (0.08 + Math.random() * 0.12) * (fromLeft ? 1 : -1);
        comets.push({
            x: fromLeft ? -20 : vw + 20, y: vh * (0.12 + Math.random() * 0.2),
            vx: (fromLeft ? 1 : -1) * sp * Math.cos(ang), vy: sp * Math.abs(Math.sin(ang)),
            follow: false, born: now, slow: 0, emit: 0, pts: [], life: 2400
        });
        wake();
    }

    function updateComets(now, dt) {
        for (var q = comets.length - 1; q >= 0; q--) {
            var c = comets[q];
            if (c.follow) {
                var v = cursorVel(now);
                if (v.s > 0.45) { c.tvx = v.x; c.tvy = v.y; c.slow = 0; } else c.slow += dt;
                var k = 1 - Math.exp(-dt / 30);
                var nx = c.x + (mouse.x - c.x) * k, ny = c.y + (mouse.y - c.y) * k;
                c.vx += ((nx - c.x) / Math.max(dt, 1) - c.vx) * 0.35;
                c.vy += ((ny - c.y) / Math.max(dt, 1) - c.vy) * 0.35;
                c.x = nx;
                c.y = ny;
                if (c.slow > 45 || now - c.born > 1800 || mouse.x < -1000) {
                    // let go: it carries on the way you threw it
                    c.follow = false;
                    var ts = Math.hypot(c.tvx, c.tvy), cap = ts > 1.7 ? 1.7 / ts : 1;
                    c.vx = c.tvx * cap;
                    c.vy = c.tvy * cap;
                }
            } else {
                var dec = Math.exp(-dt / (c.life ? c.life / 2 : 320));
                c.x += c.vx * dt;
                c.y += c.vy * dt;
                c.vx *= dec;
                c.vy *= dec;
            }
            c.pts.push({ x: c.x, y: c.y, t: now });
            while (c.pts.length && now - c.pts[0].t > 240) c.pts.shift();
            // and no tail longer than ~300px, however hard it was thrown
            var tl = 0;
            for (var pi = c.pts.length - 1; pi > 0; pi--) {
                tl += Math.hypot(c.pts[pi].x - c.pts[pi - 1].x, c.pts[pi].y - c.pts[pi - 1].y);
                if (tl > 300) { c.pts.splice(0, pi - 1); break; }
            }

            var speed = Math.hypot(c.vx, c.vy);
            c.int = clamp01((now - c.born) / 120) * (c.follow ? 1 : clamp01(speed / 0.5));
            if (!c.follow && (speed < 0.03 || c.x < -200 || c.x > vw + 200 || c.y < -200 || c.y > vh + 200)) {
                comets.splice(q, 1);
                continue;
            }

            // sparks shed along the way
            if (speed > 0.3 && c.int > 0.3) {
                c.emit = Math.min(3, c.emit + speed * dt * 0.05);
                while (c.emit >= 1 && sparks.length < 150) {
                    c.emit -= 1;
                    sparks.push({
                        x: c.x + (Math.random() - 0.5) * 3, y: c.y + (Math.random() - 0.5) * 3,
                        vx: c.vx * 0.1 + (Math.random() - 0.5) * 0.09,
                        vy: c.vy * 0.1 + (Math.random() - 0.5) * 0.09,
                        t0: now, life: 600 + Math.random() * 300,
                        r: 0.5 + Math.random() * 0.6, warm: Math.random() < 0.4
                    });
                }
            }

            // passing through a constellation lights it up
            if (speed > 0.25) {
                for (var j = 0; j < consts.length; j++) {
                    var cs = consts[j];
                    if (cs.ig < 0 && Math.hypot(c.x - cs.cx, c.y - cs.cy) < cs.hoverR * 0.75) cs.ig = now;
                }
            }
        }

        for (var s = sparks.length - 1; s >= 0; s--) {
            var sp = sparks[s];
            if (now - sp.t0 > sp.life) { sparks.splice(s, 1); continue; }
            var sd = Math.exp(-dt / 400);
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.vx *= sd;
            sp.vy *= sd;
        }
    }

    function drawComets(now) {
        var i, p;
        for (i = 0; i < sparks.length; i++) {
            p = sparks[i];
            var a = Math.pow(1 - (now - p.t0) / p.life, 1.5) * 0.8;
            ctx.fillStyle = rgba(p.warm ? CLAY : WHITE, a);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.2832);
            ctx.fill();
        }
        ctx.lineCap = 'round';
        for (var q = 0; q < comets.length; q++) {
            var c = comets[q], pts = c.pts, n = pts.length;
            if (!c.int) continue;
            for (i = 1; i < n; i++) {
                var u = i / (n - 1);
                var m = Math.pow(clamp01((u - 0.5) / 0.5), 1.4);
                ctx.strokeStyle = rgba(lerpC(WHITE, CLAY, m), 0.9 * Math.pow(u, 1.5) * c.int);
                ctx.lineWidth = 0.4 + 2.4 * Math.pow(u, 1.6);
                ctx.beginPath();
                ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
                ctx.lineTo(pts[i].x, pts[i].y);
                ctx.stroke();
            }
            var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 12);
            g.addColorStop(0, rgba(CLAY, 0.35 * c.int));
            g.addColorStop(1, rgba(CLAY, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 12, 0, 6.2832);
            ctx.fill();
            ctx.fillStyle = rgba(WHITE, c.int);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 1.8, 0, 6.2832);
            ctx.fill();
        }
        ctx.lineCap = 'butt';
    }

    function draw(now) {
        ctx.clearRect(0, 0, vw, vh);
        var a = !built ? 0 : reduced ? 1 : smooth(clamp01(dusk / 0.6));   // the page fades into dusk
        tintText(a);
        if (!built || (dusk <= 0 && !comets.length && !sparks.length && !meteors.length)) return;
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
            if (orrery) drawOrrery(clamp01((dusk - 0.7) / 0.3));
            if (moon) drawMoon(clamp01((dusk - 0.45) / 0.5));
            ctx.globalAlpha = 1;
        }

        drawMeteors(now);
        drawComets(now);

        ctx.font = "10px 'Menlo', 'Monaco', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        for (var i = 0; i < labels.length; i++) {
            ctx.textAlign = labels[i][4] || 'center';
            ctx.fillStyle = rgba(INK, labels[i][3] * a);
            ctx.fillText(labels[i][0], labels[i][1], labels[i][2]);
        }
    }

    // ---- the clock ----
    function beginDusk(len) {
        duskBegun = true;
        duskLen = Math.max(1, len);
        duskRate = 1 / duskLen;
        nextShootAt = clock + duskLen + 6000 + Math.random() * (activeShower ? 8000 : 30000);
        if (!PREVIEW) { try { sessionStorage.setItem('night-fell', '1'); } catch (e) { /* ignore */ } }
    }

    function tick(now, dt) {
        var sdt = dt * speedMul;
        clock += sdt;
        if (!duskBegun && clock >= duskAt) beginDusk(duskLen);
        if (duskRate) {
            dusk = clamp01(dusk + duskRate * sdt);
            if (dusk >= 1 || dusk <= 0) duskRate = 0;
        }

        var onScreen = mouse.x > -1000;
        pm.x += ((onScreen ? mouse.x / vw * 2 - 1 : 0) - pm.x) * 0.04;
        pm.y += ((onScreen ? mouse.y / vh * 2 - 1 : 0) - pm.y) * 0.04;
        lens += ((onScreen ? 1 : 0) - lens) * 0.06;

        if (dusk >= 0.95 && clock >= nextShootAt) {
            spawnMeteor(activeShower);
            nextShootAt = clock + (activeShower ? 4000 + Math.random() * 14000 : 30000 + Math.random() * 80000);
        }
        while (burst.length && clock >= burst[0]) {
            burst.shift();
            spawnMeteor(showerNear(new Date(), 2.5) || showerNear(new Date(), 0));
        }

        updateComets(now, dt);
    }

    function loop(now) {
        raf = null;
        var dt = lastReal ? Math.min(64, now - lastReal) : 16;
        lastReal = now;
        tick(now, dt);
        draw(now);
        if (built || comets.length || sparks.length || meteors.length) {
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
            var now = performance.now();
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            samples.push({ x: e.clientX, y: e.clientY, t: now });
            while (samples.length && now - samples[0].t > 320) samples.shift();
            maybeLaunch(now);
        }, { passive: true });

        document.documentElement.addEventListener('mouseleave', function () {
            mouse.x = mouse.y = -1e4;
            samples.length = 0;
        });

        // Touch: a fast sideways flick throws a comet; a tap reveals what a hover
        // would (the moon's phase, a planet, a constellation).
        var touch0 = null, clearTouch = null;
        function touchPoint(e) { var p = e.changedTouches[0]; return { x: p.clientX, y: p.clientY }; }
        document.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) { touch0 = null; return; }
            var p = touchPoint(e);
            touch0 = { x: p.x, y: p.y, t: performance.now() };
            clearTimeout(clearTouch);
            samples.length = 0;
        }, { passive: true });
        document.addEventListener('touchmove', function (e) {
            if (!touch0) return;
            var p = touchPoint(e), now = performance.now();
            mouse.x = p.x;
            mouse.y = p.y;
            samples.push({ x: p.x, y: p.y, t: now });
            while (samples.length && now - samples[0].t > 320) samples.shift();
            maybeLaunch(now, true);
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
        // came on an earlier visit this session, it comes back sooner.
        var fell = false;
        try { fell = !!sessionStorage.getItem('night-fell'); } catch (e) { /* ignore */ }
        if (PREVIEW) {
            duskAt = 0;
            duskLen = 1500;
        } else if (fell) {
            duskAt = 3000;
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
        beginDusk(typeof seconds === 'number' ? Math.max(0, seconds * 1000) : 6000);
        wake();
        return '☾ ' + phaseName(moonPhase()) + ' tonight';
    };

    window.day = function () {
        duskAt = Infinity;                        // and don't let it fall again on its own
        duskBegun = true;
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

    window.comet = function () {
        if (reduced) return '(comets are resting: reduced motion is on)';
        ensureCanvas();
        launchScripted();
        return '☄︎';
    };

    window.shower = function () {
        if (reduced) return '(meteors are resting: reduced motion is on)';
        var wait = 0;
        if (dusk < 0.9) { window.night(3); wait = 3500; }
        for (var i = 0; i < 10; i++) burst.push(clock + wait + i * 450 + Math.random() * 400);
        burst.sort(function (a, b) { return a - b; });
        wake();
        if (activeShower) return '☄︎ the ' + activeShower.name + ' are at their peak about now';
        var next = showerNear(new Date(), 0);
        return '☄︎ a preview. next real one: the ' + next.name + ', peaking ' + next.day + ' ' + MONTHS[next.month];
    };

    window.sky = {
        night: window.night,
        day: window.day,
        comet: window.comet,
        shower: window.shower,
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
        comets.length = 0;
        sparks.length = 0;
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
         ['comet', function () { window.comet(); }],
         ['shower', function () { window.shower(); }],
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
        console.log(activeShower
            ? '%c☄︎ the ' + activeShower.name + ' peak around now. stay for nightfall  (night() if impatient)'
            : '%c☾ stay a while: evening comes around here  (night() if impatient)',
            'color:#6c757d;font-family:Menlo,monospace;font-size:11px');
    } catch (e) { /* ignore */ }
})();
