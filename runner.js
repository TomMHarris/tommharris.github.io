// A tiny moon-rover runner hiding at the bottom of this page. Scroll to the very
// bottom and keep going, and a rover drives in; click it to play. (Or tap the
// space bar five times in a row.)
// Space / up to jump (hold for higher), down to duck, esc to put it back to sleep.
// On a touch screen: tap the right side to jump, hold the left side to duck.
(function () {
    'use strict';

    var INK = [62, 74, 94];             // rover, rocks, text
    var H = 176, GROUND = 142;
    var GRAV = 2400, JUMP_V = 520, HOLD_GRAV = 0.42, HOLD_MAX = 0.24, DIVE_GRAV = 2.4;
    var CLAY = [201, 110, 80];

    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

    var strip = null, canvas = null, ctx = null;
    var open = false, running = false, dead = false, deadAt = 0;
    var W = 720, t = 0;
    var raf = null, lastT = null;
    var jumpHeld = false, duckHeld = false, touchy = false, pace = 1;

    var rover, obstacles, debris, pickups, pops, craters;
    var speed, dist, bonus, nextSpawn, nextPickup, holdT, newBest;
    var hi = 0;
    try { hi = parseInt(localStorage.getItem('rover-hi') || '0', 10) || 0; } catch (e) { /* ignore */ }

    // Rolling hills: a few sine waves, sampled as the world scrolls past.
    function hill(x, seed, amp) {
        return amp * (0.5 + 0.28 * Math.sin(x / 190 + seed) + 0.14 * Math.sin(x / 77 + seed * 2.3) +
                      0.08 * Math.sin(x / 31 + seed * 4.1));
    }

    function reset() {
        rover = { x: 44, y: GROUND, vy: 0, grounded: true, duck: 0, tilt: 0 };
        obstacles = [];
        debris = [];
        pickups = [];
        pops = [];
        speed = 280 * pace;
        dist = 0;
        bonus = 0;
        nextSpawn = 520;
        nextPickup = 900;
        holdT = 0;
        newBest = false;
        dead = false;
        craters = [];
        for (var i = 0; i < Math.ceil(W / 60); i++) {
            craters.push({ x: Math.random() * W, y: GROUND + 8 + Math.random() * 22, w: 5 + Math.random() * 12 });
        }
    }

    function score() { return Math.floor(dist / 12) + bonus; }

    function spawnRocks() {
        var n = Math.random() < 0.55 ? 1 : (Math.random() < 0.7 ? 2 : 3);
        var tall = speed > 360 && Math.random() < 0.25;
        var parts = [], dx = 0;
        for (var i = 0; i < n; i++) {
            var h = tall ? 28 + Math.random() * 8 : (Math.random() < 0.6 ? 13 + Math.random() * 8 : 20 + Math.random() * 8);
            var w = h * (0.9 + Math.random() * 0.5);
            parts.push({ dx: dx, w: w, h: h, lean: (Math.random() - 0.5) * 0.3 });
            dx += w * 0.8 + Math.random() * 3;
        }
        obstacles.push({ x: W + 10, w: dx + 4, parts: parts });
    }

    // Tumbling bits of an old satellite, drifting at head height: duck, or time a jump.
    function spawnDebris() {
        var low = Math.random() < 0.75;
        debris.push({
            x: W + 20, y: low ? GROUND - 31 : GROUND - 62, r: 7 + Math.random() * 2,
            rot: Math.random() * 6.28, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 3),
            drift: 40 + Math.random() * 40
        });
    }

    function spawnPickup() {
        var high = Math.random() < 0.6;
        pickups.push({ x: W + 20, y: high ? GROUND - 70 - Math.random() * 25 : GROUND - 18, ph: Math.random() * 6.28 });
    }

    function jump() {
        if (rover.grounded && rover.duck < 0.5) {
            rover.vy = -JUMP_V;
            rover.grounded = false;
            holdT = 0;
        }
    }

    function act() {
        if (dead) {
            if (performance.now() - deadAt < 450) return;   // don't restart by accident
            reset();
            running = true;
            return;
        }
        if (!running) running = true;
        jump();
    }

    function die() {
        dead = true;
        deadAt = performance.now();
        running = false;
        var s = score();
        if (s > hi) {
            hi = s;
            newBest = true;
            try { localStorage.setItem('rover-hi', String(hi)); } catch (e) { /* ignore */ }
        }
    }

    function roverBox() {
        var h = rover.duck > 0.5 ? 17 : 29;
        return { x: rover.x + 3, y: rover.y - h, w: 27, h: h };
    }

    function hits(b, x, y, w, h) { return b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y; }

    function update(dt) {
        t += dt;
        rover.duck += ((duckHeld && rover.grounded ? 1 : 0) - rover.duck) * Math.min(1, dt * 18);
        if (!running || dead) return;

        speed = Math.min(620 * pace, speed + 6 * pace * dt);
        dist += speed * dt;
        var i, move = speed * dt;

        // rover physics: hold to float a little higher, press down to dive
        if (!rover.grounded) {
            var g = GRAV;
            if (jumpHeld && rover.vy < 0 && holdT < HOLD_MAX) { g *= HOLD_GRAV; holdT += dt; }
            if (duckHeld) g *= DIVE_GRAV;
            rover.vy += g * dt;
            rover.y += rover.vy * dt;
            if (rover.y >= GROUND) {
                rover.y = GROUND;
                rover.vy = 0;
                rover.grounded = true;
            }
        }
        rover.tilt += ((rover.grounded ? 0 : Math.max(-0.25, Math.min(0.25, rover.vy * 0.0005))) - rover.tilt) * Math.min(1, dt * 12);

        // what's coming: rocks from the start, debris once you're moving
        nextSpawn -= move;
        if (nextSpawn <= 0) {
            if (score() > 120 && Math.random() < 0.3) spawnDebris(); else spawnRocks();
            nextSpawn = (330 + Math.random() * 360) * pace + speed * 0.35;
        }
        nextPickup -= move;
        if (nextPickup <= 0) {
            spawnPickup();
            nextPickup = 700 + Math.random() * 1100;
        }

        for (i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= move;
            if (obstacles[i].x + obstacles[i].w < -20) obstacles.splice(i, 1);
        }
        for (i = debris.length - 1; i >= 0; i--) {
            debris[i].x -= move + debris[i].drift * dt;
            debris[i].rot += debris[i].spin * dt;
            if (debris[i].x < -30) debris.splice(i, 1);
        }
        for (i = pickups.length - 1; i >= 0; i--) {
            pickups[i].x -= move;
            if (pickups[i].x < -20) pickups.splice(i, 1);
        }
        for (i = pops.length - 1; i >= 0; i--) {
            pops[i].age += dt;
            if (pops[i].age > 0.8) pops.splice(i, 1);
        }
        for (i = 0; i < craters.length; i++) {
            craters[i].x -= move;
            if (craters[i].x + craters[i].w < 0) {
                craters[i].x = W + Math.random() * 60;
                craters[i].w = 5 + Math.random() * 12;
                craters[i].y = GROUND + 8 + Math.random() * 22;
            }
        }

        // collisions (forgiving hitboxes)
        var b = roverBox();
        for (i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.x > b.x + b.w || o.x + o.w < b.x) continue;
            for (var j = 0; j < o.parts.length; j++) {
                var p = o.parts[j];
                if (hits(b, o.x + p.dx + 3, GROUND - p.h + 4, p.w - 6, p.h - 4)) { die(); return; }
            }
        }
        for (i = 0; i < debris.length; i++) {
            var d = debris[i], r = d.r - 2;
            if (hits(b, d.x - r, d.y - r, r * 2, r * 2)) { die(); return; }
        }
        for (i = pickups.length - 1; i >= 0; i--) {
            var k = pickups[i];
            if (hits(b, k.x - 9, k.y - 9, 18, 18)) {
                bonus += 25;
                pops.push({ x: k.x, y: k.y, age: 0 });
                pickups.splice(i, 1);
            }
        }
    }

    // ---- drawing ----
    function drawHills(off, seed, amp, base, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (var x = 0; x <= W + 8; x += 8) ctx.lineTo(x, base - hill(x + off, seed, amp));
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // The rover, on whichever context `ctx` points at: rv is {x, y, duck, tilt}.
    function drawRover(rv, spin, moving, off) {
        var x = rv.x, y = rv.y, dk = rv.duck;
        var bob = moving ? Math.sin(t * 38) * 0.5 : 0;
        ctx.save();
        ctx.translate(x + 16, y - 10);
        ctx.rotate(rv.tilt);
        ctx.translate(-x - 16, -y + 10);

        // wheels, turning as the ground goes by
        var i;
        for (i = 0; i < 3; i++) {
            var wx = x + 5 + i * 11.5, wy = y - 5;
            ctx.strokeStyle = rgba(INK, 0.9);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + (i - 1) * 1.5, y - 13 + bob);
            ctx.stroke();
            ctx.fillStyle = rgba(INK, 1);
            ctx.beginPath();
            ctx.arc(wx, wy, 5, 0, 6.2832);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            for (var s = 0; s < 3; s++) {
                var a = spin + s * 2.094;
                ctx.moveTo(wx, wy);
                ctx.lineTo(wx + Math.cos(a) * 3.6, wy + Math.sin(a) * 3.6);
            }
            ctx.stroke();
        }

        // body, solar panel, mast and camera (the mast folds down to duck)
        ctx.fillStyle = rgba(INK, 1);
        roundRect(x - 1, y - 18 + bob, 34, 7, 2.5);
        ctx.fill();
        ctx.fillStyle = 'rgba(132,150,178,1)';
        roundRect(x + 2, y - 22 + bob + dk * 1.5, 18, 3.2, 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x + 8, y - 22 + bob + dk * 1.5); ctx.lineTo(x + 8, y - 18.8 + bob + dk * 1.5);
        ctx.moveTo(x + 14, y - 22 + bob + dk * 1.5); ctx.lineTo(x + 14, y - 18.8 + bob + dk * 1.5);
        ctx.stroke();

        var mastH = 10 * (1 - dk) + 2, hx = x + 21 + dk * 4, hy = y - 18 - mastH + bob;
        ctx.fillStyle = rgba(INK, 1);
        ctx.fillRect(x + 24.5, hy + 4, 2.4, mastH);
        roundRect(hx, hy - 2, 11, 6.5, 2);
        ctx.fill();
        ctx.fillStyle = off ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(hx + 8.3, hy + 1.2, 1.3, 0, 6.2832);
        ctx.fill();

        // antenna with a small warm light
        ctx.strokeStyle = rgba(INK, 0.9);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, y - 18 + bob);
        ctx.lineTo(x + 1, y - 28 + bob + dk * 5);
        ctx.stroke();
        var blink = off ? 0.2 : (Math.sin(t * 5) > 0.2 ? 1 : 0.35);
        ctx.fillStyle = rgba(CLAY, blink);
        ctx.beginPath();
        ctx.arc(x + 1, y - 29 + bob + dk * 5, 1.6, 0, 6.2832);
        ctx.fill();
        ctx.restore();
    }

    function drawRock(bx, p) {
        var cx = bx + p.w / 2, top = GROUND - p.h;
        ctx.fillStyle = rgba(INK, 0.82);
        ctx.beginPath();
        ctx.moveTo(bx, GROUND + 1);
        ctx.bezierCurveTo(bx - 1, top + p.h * 0.35, cx - p.w * 0.35 + p.lean * p.w, top - 1,
                          cx + p.lean * p.w, top);
        ctx.bezierCurveTo(cx + p.w * 0.4 + p.lean * p.w, top + 1, bx + p.w + 1, top + p.h * 0.4,
                          bx + p.w, GROUND + 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';     // light catching the top
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - p.w * 0.25 + p.lean * p.w, top + 3);
        ctx.quadraticCurveTo(cx + p.lean * p.w, top + 0.5, cx + p.w * 0.22 + p.lean * p.w, top + 3);
        ctx.stroke();
    }

    function drawDebris(d) {
        ctx.strokeStyle = rgba(INK, 0.18);               // a faint wake
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x + d.r, d.y);
        ctx.lineTo(d.x + d.r + 26, d.y);
        ctx.stroke();
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = rgba(INK, 0.9);
        ctx.fillRect(-d.r * 0.45, -d.r * 0.45, d.r * 0.9, d.r * 0.9);       // the box
        ctx.fillStyle = 'rgba(132,150,178,1)';
        ctx.fillRect(-d.r * 1.25, -d.r * 0.22, d.r * 0.7, d.r * 0.44);      // a broken panel
        ctx.fillRect(d.r * 0.55, -d.r * 0.22, d.r * 0.55, d.r * 0.44);
        ctx.restore();
    }

    function drawPickup(k) {
        var y = k.y + Math.sin(t * 4 + k.ph) * 2.5, s = 5 + Math.sin(t * 7 + k.ph) * 0.8;
        var g = ctx.createRadialGradient(k.x, y, 0, k.x, y, 12);
        g.addColorStop(0, 'rgba(255,255,255,0.7)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(k.x - 12, y - 12, 24, 24);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();                                  // a four-point sparkle
        ctx.moveTo(k.x, y - s);
        ctx.quadraticCurveTo(k.x, y, k.x + s, y);
        ctx.quadraticCurveTo(k.x, y, k.x, y + s);
        ctx.quadraticCurveTo(k.x, y, k.x - s, y);
        ctx.quadraticCurveTo(k.x, y, k.x, y - s);
        ctx.fill();
    }

    function pad(n) { var s = String(n); while (s.length < 5) s = '0' + s; return s; }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        var i;

        // two ranges of hills in slow parallax, then the ground itself
        drawHills(dist * 0.12, 1.3, 46, GROUND + 4, 'rgba(150,166,194,0.32)');
        drawHills(dist * 0.3, 4.2, 26, GROUND + 4, 'rgba(126,144,176,0.38)');
        ctx.fillStyle = 'rgba(112,130,162,0.5)';
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = rgba(INK, 0.55);
        ctx.fillRect(0, GROUND, W, 1);
        ctx.fillStyle = rgba(INK, 0.16);
        for (i = 0; i < craters.length; i++) {
            ctx.beginPath();
            ctx.ellipse(craters[i].x, craters[i].y, craters[i].w, 1.6, 0, 0, 6.2832);
            ctx.fill();
        }

        for (i = 0; i < pickups.length; i++) drawPickup(pickups[i]);
        for (i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            for (var j = 0; j < o.parts.length; j++) drawRock(o.x + o.parts[j].dx, o.parts[j]);
        }
        for (i = 0; i < debris.length; i++) drawDebris(debris[i]);
        drawRover(rover, dist / 5.5, rover.grounded && running && !dead, dead);

        ctx.font = "11px 'Menlo', 'Monaco', monospace";
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'center';
        for (i = 0; i < pops.length; i++) {
            var p = pops[i];
            ctx.fillStyle = 'rgba(255,255,255,' + (1 - p.age / 0.8) + ')';
            ctx.fillText('+25', p.x, p.y - 12 - p.age * 26);
        }

        // score
        ctx.textAlign = 'right';
        ctx.fillStyle = rgba(INK, 0.75);
        ctx.fillText((hi > 0 ? 'HI ' + pad(hi) + '   ' : '') + pad(score()), W - 56, 38);

        ctx.textAlign = 'center';
        if (!running && !dead) {
            ctx.fillStyle = rgba(INK, 0.85);
            if (touchy) {
                ctx.fillText('tap the right side to jump (hold for higher)', W / 2, 70);
                ctx.fillText('hold the left side to duck', W / 2, 86);
            } else {
                ctx.fillText('space to jump (hold for higher)  ·  ↓ to duck  ·  esc to sleep', W / 2, 72);
            }
        } else if (dead) {
            ctx.fillStyle = rgba(INK, 1);
            ctx.fillText(newBest ? 'n e w   b e s t' : 'g a m e   o v e r', W / 2, 64);
            ctx.fillStyle = rgba(INK, 0.8);
            ctx.fillText(touchy ? 'tap to try again' : 'space to try again  ·  esc to sleep', W / 2, 82);
        }
    }

    function loop(now) {
        if (!open) return;
        if (lastT === null) lastT = now;
        // fixed-timestep with a catch-up cap, so speed is frame-rate independent
        var elapsed = Math.min(0.1, (now - lastT) / 1000);
        lastT = now;
        while (elapsed > 0) {
            var dt = Math.min(elapsed, 1 / 60);
            update(dt);
            elapsed -= dt;
        }
        draw();
        raf = requestAnimationFrame(loop);
    }

    function sizeCanvas() {
        W = Math.max(280, window.innerWidth);
        pace = Math.max(0.72, Math.min(1, W / 900));
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // No box: the game sits on a soft band of dusk that fades up into the page.
    function ensureStrip() {
        if (strip) return;
        strip = document.createElement('div');
        var s = strip.style;
        s.position = 'fixed';
        s.left = '0';
        s.right = '0';
        s.bottom = '0';
        s.background = 'linear-gradient(to bottom, rgba(196,207,223,0) 0%, rgba(190,202,220,0.78) 38%, ' +
                       'rgba(178,192,214,0.94) 100%)';
        s.backdropFilter = s.webkitBackdropFilter = 'blur(2px)';
        s.zIndex = '1000';
        s.transform = 'translateY(100%)';
        s.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.display = 'block';
        canvas.style.cursor = 'pointer';
        canvas.style.touchAction = 'none';          // taps here are for the game, not the page
        strip.appendChild(canvas);

        var x = document.createElement('button');
        x.type = 'button';
        x.textContent = '×';
        x.setAttribute('aria-label', 'Close the game');
        x.style.cssText = 'position:absolute;top:18px;right:12px;width:32px;height:32px;border:0;' +
            'border-radius:50%;background:rgba(255,255,255,0.35);color:rgb(62,74,94);font:18px/32px ' +
            'ui-sans-serif,system-ui,sans-serif;cursor:pointer;padding:0;';
        x.addEventListener('click', function (e) { e.stopPropagation(); close(); });
        strip.appendChild(x);

        document.body.appendChild(strip);
        ctx = canvas.getContext('2d');
        canvas.addEventListener('pointerdown', function (e) {
            if (!open) return;
            if (e.pointerType === 'touch') touchy = true;
            // on a touch screen, holding the left side ducks; anywhere else jumps
            if (e.pointerType === 'touch' && running && e.offsetX < W * 0.4) { duckHeld = true; return; }
            jumpHeld = true;
            act();
        });
        window.addEventListener('pointerup', function () { jumpHeld = false; duckHeld = false; });
        window.addEventListener('pointercancel', function () { jumpHeld = false; duckHeld = false; });
        window.addEventListener('resize', function () { if (open) { sizeCanvas(); } });
        document.addEventListener('visibilitychange', function () {
            if (!open) return;
            if (document.hidden) { cancelAnimationFrame(raf); lastT = null; }
            else { raf = requestAnimationFrame(loop); }
        });
    }

    function summon() {
        hidePeek(true);
        ensureStrip();
        touchy = touchy || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        strip.style.visibility = 'visible';
        sizeCanvas();
        reset();
        running = false;
        open = true;
        lastT = null;
        // commit the offscreen position, then slide up
        void strip.offsetHeight;
        strip.style.transform = 'translateY(0)';
        raf = requestAnimationFrame(loop);
    }

    function close() {
        open = false;
        jumpHeld = duckHeld = false;
        cancelAnimationFrame(raf);
        strip.style.transform = 'translateY(100%)';
        setTimeout(function () { if (!open) strip.style.visibility = 'hidden'; }, 480);
    }

    // ---- the rover that waits at the bottom of the page ----
    var PW = 150, PH = 56, peek = null;

    function ensurePeek() {
        if (peek) return;
        var el = document.createElement('canvas');
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', 'A small rover. Click to play.');
        var st = el.style;
        st.position = 'fixed';
        st.right = '0';
        st.bottom = '4px';
        st.width = PW + 'px';
        st.height = PH + 'px';
        st.zIndex = '999';
        st.cursor = 'pointer';
        st.display = 'none';
        st.touchAction = 'manipulation';
        st.outline = 'none';
        document.body.appendChild(el);
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        el.width = PW * dpr;
        el.height = PH * dpr;
        var g = el.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        peek = { el: el, g: g, state: 'hidden', x: PW + 10, from: 0, t0: 0, odo: 0, hover: 0, over: false, raf: null };
        var play = function (e) { e.preventDefault(); summon(); };
        el.addEventListener('click', play);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') play(e); });
        el.addEventListener('mouseenter', function () { peek.over = true; });
        el.addEventListener('mouseleave', function () { peek.over = false; });
    }

    function showPeek() {
        if (open) return;
        ensurePeek();
        if (peek.state === 'in' || peek.state === 'idle') return;
        peek.el.style.display = 'block';
        peek.state = 'in';
        peek.from = peek.x;
        peek.t0 = performance.now();
        if (!peek.raf) peek.raf = requestAnimationFrame(peekLoop);
    }

    function hidePeek(now) {
        if (!peek || peek.state === 'hidden') return;
        if (now) {
            peek.state = 'hidden';
            peek.el.style.display = 'none';
            peek.x = PW + 10;
            return;
        }
        if (peek.state === 'out') return;
        peek.state = 'out';
        peek.from = peek.x;
        peek.t0 = performance.now();
    }

    function peekLoop(now) {
        var p = peek, park = PW - 60, gone = PW + 10;
        p.raf = null;
        if (p.state === 'hidden') return;
        var k = Math.min(1, (now - p.t0) / 1300), px = p.x;
        if (p.state === 'in') {
            p.x = p.from + (park - p.from) * (1 - Math.pow(1 - k, 3));     // rolls in, eases to a stop
            if (k >= 1) p.state = 'idle';
        } else if (p.state === 'out') {
            p.x = p.from + (gone - p.from) * k * k;                        // and pulls away
            if (k >= 1) { hidePeek(true); return; }
        }
        p.odo += Math.abs(p.x - px);

        var g = p.g, saved = ctx;
        g.clearRect(0, 0, PW, PH);
        ctx = g;
        t = now / 1000;
        var rv = { x: p.x, y: PH - 6, duck: 0, tilt: 0 };
        g.save();
        if (p.state !== 'out') {                         // faces the page while it waits
            g.translate(2 * (p.x + 16), 0);
            g.scale(-1, 1);
        }
        drawRover(rv, p.odo / 5.5, p.state !== 'idle', false);
        g.restore();
        ctx = saved;

        // "play", when you point at it (always, on a touch screen)
        var want = p.state === 'idle' && (p.over || touchy || document.activeElement === p.el) ? 1 : 0;
        p.hover += (want - p.hover) * 0.12;
        if (p.hover > 0.01) {
            g.font = "10px 'Menlo', 'Monaco', monospace";
            g.textAlign = 'right';
            g.textBaseline = 'alphabetic';
            g.fillStyle = rgba(INK, 0.75 * p.hover);
            g.fillText('play ›', p.x - 8, PH - 12);
        }
        p.raf = requestAnimationFrame(peekLoop);
    }

    function atBottom(slack) {
        var d = document.documentElement;
        return window.innerHeight + window.scrollY >= d.scrollHeight - (slack || 2);
    }

    // Keep scrolling once you've hit the bottom (wheel, swipe or keys) and it appears.
    var push = 0, touchY = null;
    function nudge(amount) {
        if (open || !atBottom()) { push = 0; return; }
        push += amount;
        if (push > 70) { push = 0; showPeek(); }
    }
    window.addEventListener('wheel', function (e) {
        // in pixels, whatever the browser reports (Firefox counts lines)
        var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
        if (dy > 0) nudge(dy); else if (dy < 0) push = 0;
    }, { passive: true });
    window.addEventListener('touchstart', function (e) {
        touchy = true;
        touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
        if (touchY === null || !e.touches.length) return;
        var dy = touchY - e.touches[0].clientY;             // finger moving up = scrolling down
        if (dy > 70 && atBottom()) { touchY = null; showPeek(); }
    }, { passive: true });
    window.addEventListener('scroll', function () {
        if (peek && (peek.state === 'in' || peek.state === 'idle') && !atBottom(80)) hidePeek(false);
    }, { passive: true });

    var JUMP_KEYS = { Space: 1, ArrowUp: 1, KeyW: 1 }, DUCK_KEYS = { ArrowDown: 1, KeyS: 1 };

    // five quick taps of the space bar
    var taps = 0, lastTap = 0;
    window.addEventListener('keydown', function (e) {
        if (open) {
            if (e.code === 'Escape') { close(); return; }
            if (JUMP_KEYS[e.code]) {
                e.preventDefault();
                jumpHeld = true;
                if (!e.repeat) act();
            } else if (DUCK_KEYS[e.code]) {
                e.preventDefault();
                duckHeld = true;
                if (!running && !dead) running = true;
            }
            return;
        }
        if (e.code === 'ArrowDown' || e.code === 'PageDown' || e.code === 'End') nudge(60);
        if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        nudge(60);
        var tag = e.target && e.target.tagName;
        if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
        var now = performance.now();
        if (now - lastTap > 1500) taps = 0;
        taps++;
        lastTap = now;
        if (taps >= 5) {
            taps = 0;
            e.preventDefault();
            summon();
        }
    });
    window.addEventListener('keyup', function (e) {
        if (JUMP_KEYS[e.code]) jumpHeld = false;
        if (DUCK_KEYS[e.code]) duckHeld = false;
    });
    window.addEventListener('blur', function () { jumpHeld = duckHeld = false; });

    window.rover = function () {
        if (!open) summon();
        return touchy ? 'tap right to jump · hold left to duck'
                      : '␣ to jump (hold for higher) · ↓ to duck · esc to sleep';
    };

    try {
        console.log('%c␣ ␣ ␣ ␣ ␣', 'color:#adb5bd;font-family:Menlo,monospace;font-size:11px');
    } catch (e) { /* ignore */ }
})();
