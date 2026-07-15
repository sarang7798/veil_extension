/**
 * Progressive reveal tied to day progress (0 → 1).
 * Default "paint" mimics slow brushwork unveiling a museum painting.
 * Progress is linear with wall-clock time — midnight ≈ hidden, noon ≈ half, midnight ≈ full.
 */
(function (global) {
  const STYLES = ["paint", "mist", "mosaic", "curtain"];

  class RevealEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.source = null;
      this.progress = 0;
      this.style = "paint";
      this.daySeed = "veil";
      this.raf = 0;
      this.strokeCache = null;
      this.strokeCacheKey = "";
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this._onResize = () => this.resize();
      window.addEventListener("resize", this._onResize);
      if (typeof ResizeObserver !== "undefined") {
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(canvas);
      }
    }

    destroy() {
      window.removeEventListener("resize", this._onResize);
      if (this._ro) this._ro.disconnect();
      cancelAnimationFrame(this.raf);
    }

    setStyle(style) {
      this.style = STYLES.includes(style) ? style : "paint";
      this.draw(this.progress);
    }

    setDaySeed(seed) {
      this.daySeed = String(seed || "veil");
      this.strokeCache = null;
      this.strokeCacheKey = "";
    }

    async load(url, { remote = false } = {}) {
      const img = await loadImage(url, { remote });
      this.source = img;
      this.resize();
      this.canvas.classList.add("is-ready");
      this.draw(this.progress);
      return img;
    }

    resize() {
      const { canvas, dpr } = this;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      this.cssW = w;
      this.cssH = h;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.strokeCache = null;
      if (this.source) this.draw(this.progress);
    }

    setProgress(progress, { animate = false } = {}) {
      const target = clamp(progress, 0, 1);
      // Never animate large jumps (e.g. midnight → 6pm on open) — that reads as "image loads fully".
      const delta = Math.abs(target - this.progress);
      if (!animate || delta > 0.02) {
        cancelAnimationFrame(this.raf);
        this.progress = target;
        this.draw(this.progress);
        return;
      }

      cancelAnimationFrame(this.raf);
      const from = this.progress;
      const start = performance.now();
      const duration = 600;

      const step = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        this.progress = from + (target - from) * eased;
        this.draw(this.progress);
        if (t < 1) this.raf = requestAnimationFrame(step);
      };

      this.raf = requestAnimationFrame(step);
    }

    draw(progress) {
      const img = this.source;
      const ctx = this.ctx;
      const w = this.cssW || this.canvas.clientWidth;
      const h = this.cssH || this.canvas.clientHeight;
      if (!img || !ctx || !w || !h) return;

      const cover = coverRect(img.width, img.height, w, h);
      ctx.save();
      ctx.fillStyle = "#e7dfd1";
      ctx.fillRect(0, 0, w, h);

      if (this.style === "mist") {
        this.drawMist(ctx, img, cover, w, h, progress);
      } else if (this.style === "mosaic") {
        this.drawMosaic(ctx, img, cover, w, h, progress);
      } else if (this.style === "curtain") {
        this.drawCurtain(ctx, img, cover, w, h, progress);
      } else {
        this.drawPaint(ctx, img, cover, w, h, progress);
      }

      ctx.restore();
    }

    /**
     * Brush strokes accumulate linearly with day progress.
     * At 0 the linen is almost bare; at 0.5 roughly half the work is laid in; at 1 fully unveiled.
     */
    drawPaint(ctx, img, cover, w, h, progress) {
      const p = clamp(progress, 0, 1);

      // Faint underdrawing only — never enough to read as a finished painting.
      ctx.globalAlpha = 0.03 + 0.04 * p;
      ctx.filter = `blur(${lerp(14, 4, p).toFixed(2)}px)`;
      ctx.drawImage(img, cover.x, cover.y, cover.w, cover.h);
      ctx.filter = "none";
      ctx.globalAlpha = 1;

      const strokes = this.getStrokes(w, h);
      // Fractional stroke so each second can grow the next mark slightly.
      const exact = strokes.length * p;
      const count = Math.floor(exact);
      const frac = exact - count;

      const mask = document.createElement("canvas");
      mask.width = Math.max(1, Math.floor(w));
      mask.height = Math.max(1, Math.floor(h));
      const mctx = mask.getContext("2d");
      mctx.clearRect(0, 0, w, h);

      for (let i = 0; i < count; i += 1) {
        paintStroke(mctx, strokes[i], 1);
      }
      if (frac > 0.01 && count < strokes.length) {
        paintStroke(mctx, strokes[count], frac);
      }

      // Gap-fill only in the last ~12% of the day so completion feels earned.
      if (p > 0.88) {
        mctx.globalAlpha = easeIn((p - 0.88) / 0.12);
        mctx.fillStyle = "#fff";
        mctx.fillRect(0, 0, w, h);
        mctx.globalAlpha = 1;
      }

      const layer = document.createElement("canvas");
      layer.width = mask.width;
      layer.height = mask.height;
      const lctx = layer.getContext("2d");
      lctx.drawImage(img, cover.x, cover.y, cover.w, cover.h);
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(mask, 0, 0);

      ctx.drawImage(layer, 0, 0);

      if (p < 0.95) {
        ctx.globalAlpha = 0.04 * (1 - p);
        ctx.fillStyle = "#fff8ee";
        for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1);
        ctx.globalAlpha = 1;
      }
    }

    getStrokes(w, h) {
      const key = `${this.daySeed}:${Math.round(w)}x${Math.round(h)}`;
      if (this.strokeCache && this.strokeCacheKey === key) return this.strokeCache;

      const rand = mulberry32(hashSeed(this.daySeed));
      const strokes = [];
      // More, smaller strokes → coverage tracks progress instead of blotting early.
      const count = 420;
      for (let i = 0; i < count; i += 1) {
        const x = rand() * w;
        const y = rand() * h;
        const len = lerp(18, Math.max(w, h) * 0.16, rand());
        const thick = lerp(6, 28, rand() * rand());
        const angle = rand() * Math.PI * 2;
        const bend = (rand() - 0.5) * 0.7;
        strokes.push({ x, y, len, thick, angle, bend, round: rand() });
      }

      // Spatial order (top-left → bottom-right with jitter) so reveal reads as work in progress.
      strokes.sort((a, b) => {
        const ja = a.y + a.x * 0.15 + (a.round - 0.5) * h * 0.08;
        const jb = b.y + b.x * 0.15 + (b.round - 0.5) * h * 0.08;
        return ja - jb;
      });
      this.strokeCache = strokes;
      this.strokeCacheKey = key;
      return strokes;
    }

    drawMist(ctx, img, cover, w, h, progress) {
      const p = clamp(progress, 0, 1);
      // Linen haze first — do not draw a readable full image underneath.
      ctx.fillStyle = "#e7dfd1";
      ctx.fillRect(0, 0, w, h);

      const revealed = h * p;
      const feather = Math.max(40, h * 0.12);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, h - revealed - feather, w, revealed + feather + 2);
      ctx.clip();

      const grad = ctx.createLinearGradient(0, h - revealed - feather, 0, h - revealed + feather * 0.4);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.75)");
      grad.addColorStop(1, "rgba(0,0,0,1)");

      const layer = document.createElement("canvas");
      layer.width = Math.max(1, Math.floor(w));
      layer.height = Math.max(1, Math.floor(h));
      const lctx = layer.getContext("2d");
      lctx.filter = p < 0.95 ? `blur(${lerp(8, 0, p).toFixed(2)}px)` : "none";
      lctx.drawImage(img, cover.x, cover.y, cover.w, cover.h);
      lctx.filter = "none";
      lctx.globalCompositeOperation = "destination-in";
      lctx.fillStyle = grad;
      lctx.fillRect(0, 0, w, h);
      ctx.drawImage(layer, 0, 0);
      ctx.restore();

      if (p < 0.98) {
        const haze = ctx.createLinearGradient(0, 0, 0, h);
        haze.addColorStop(0, `rgba(231,223,209,${0.55 * (1 - p)})`);
        haze.addColorStop(Math.max(0.05, 1 - p), `rgba(231,223,209,${0.22 * (1 - p)})`);
        haze.addColorStop(1, "rgba(231,223,209,0)");
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, w, h);
      }
    }

    drawMosaic(ctx, img, cover, w, h, progress) {
      const p = clamp(progress, 0, 1);
      // Tiles appear over time — unrevealed area stays linen, not a full soft image.
      ctx.fillStyle = "#e7dfd1";
      ctx.fillRect(0, 0, w, h);

      const cols = 28;
      const rows = Math.max(1, Math.round((cols * h) / w));
      const cellW = w / cols;
      const cellH = h / rows;
      const total = cols * rows;
      const show = Math.floor(total * p);
      const frac = total * p - show;

      const order = mosaicOrder(cols, rows, this.daySeed);
      for (let i = 0; i < show; i += 1) {
        const idx = order[i];
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        drawTile(ctx, img, cover, c * cellW, r * cellH, cellW + 0.5, cellH + 0.5, 1);
      }
      if (frac > 0.01 && show < total) {
        const idx = order[show];
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        drawTile(ctx, img, cover, c * cellW, r * cellH, cellW + 0.5, cellH + 0.5, frac);
      }
    }

    drawCurtain(ctx, img, cover, w, h, progress) {
      const p = clamp(progress, 0, 1);
      ctx.fillStyle = "#e7dfd1";
      ctx.fillRect(0, 0, w, h);

      const blades = 14;
      const bladeH = h / blades;
      const mask = document.createElement("canvas");
      mask.width = Math.max(1, Math.floor(w));
      mask.height = Math.max(1, Math.floor(h));
      const mctx = mask.getContext("2d");
      mctx.fillStyle = "#fff";
      for (let i = 0; i < blades; i += 1) {
        const y = i * bladeH;
        const local = clamp(p * 1.08 - i * 0.01, 0, 1);
        mctx.fillRect(0, y, w * easeOut(local), bladeH + 1);
      }

      const layer = document.createElement("canvas");
      layer.width = mask.width;
      layer.height = mask.height;
      const lctx = layer.getContext("2d");
      lctx.drawImage(img, cover.x, cover.y, cover.w, cover.h);
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(mask, 0, 0);
      ctx.drawImage(layer, 0, 0);
    }
  }

  function paintStroke(ctx, s, alpha) {
    const x2 = s.x + Math.cos(s.angle) * s.len;
    const y2 = s.y + Math.sin(s.angle) * s.len;
    const cx = (s.x + x2) / 2 + Math.cos(s.angle + Math.PI / 2) * s.len * s.bend;
    const cy = (s.y + y2) / 2 + Math.sin(s.angle + Math.PI / 2) * s.len * s.bend;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s.thick;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x2, y2, s.thick * 0.55, s.thick * (0.25 + 0.35 * s.round), s.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function mosaicOrder(cols, rows, seed) {
    const rand = mulberry32(hashSeed(`mosaic:${seed}`));
    const order = Array.from({ length: cols * rows }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function drawTile(ctx, img, cover, x, y, tw, th, alpha) {
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.beginPath();
    ctx.rect(x, y, tw, th);
    ctx.clip();
    ctx.drawImage(img, cover.x, cover.y, cover.w, cover.h);
    ctx.restore();
  }

  function loadImage(url, { remote = false } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (remote) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  function coverRect(sw, sh, dw, dh) {
    const scale = Math.max(dw / sw, dh / sh);
    const width = sw * scale;
    const height = sh * scale;
    return { x: (dw - width) / 2, y: (dh - height) / 2, w: width, h: height };
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 2.4);
  }

  function easeIn(t) {
    const x = clamp(t, 0, 1);
    return x * x;
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function next() {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.VeilReveal = { RevealEngine, STYLES };
})(window);
