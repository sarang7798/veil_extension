(function () {
  const STORAGE_KEY = "veil.settings.v1";
  const PARTNER_KEY = "veil.partner.v1";

  const defaults = {
    showChrome: true,
    use24h: true,
    showSeconds: false,
    revealStyle: "paint",
    imageSource: "met",
    premiumUnlocked: false,
    /** null = follow wall clock; 0–1 = debug override (progress preview). */
    previewProgress: null,
  };

  const els = {
    stage: document.getElementById("stage"),
    canvas: document.getElementById("reveal-canvas"),
    clock: document.getElementById("clock"),
    dateLine: document.getElementById("date-line"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    timeLeft: document.getElementById("time-left"),
    dayId: document.getElementById("day-id"),
    workTitle: document.getElementById("work-title"),
    workArtist: document.getElementById("work-artist"),
    workDate: document.getElementById("work-date"),
    collectionLabel: document.getElementById("collection-label"),
    toggleChrome: document.getElementById("toggle-chrome"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsSheet: document.getElementById("settings-sheet"),
    settingChrome: document.getElementById("setting-chrome"),
    setting24h: document.getElementById("setting-24h"),
    settingSeconds: document.getElementById("setting-seconds"),
    settingReveal: document.getElementById("setting-reveal"),
    settingPreviewEnable: document.getElementById("setting-preview-enable"),
    settingPreview: document.getElementById("setting-preview"),
    settingPreviewValue: document.getElementById("setting-preview-value"),
    openOptions: document.getElementById("open-options"),
    premiumHint: document.getElementById("premium-hint"),
    partnerSlot: document.getElementById("partner-slot"),
    partnerLink: document.getElementById("partner-link"),
  };

  let settings = { ...defaults };
  let currentDayKey = null;
  let currentImageUrl = null;
  const engine = new VeilReveal.RevealEngine(els.canvas);

  // Console helper for newbies: __veil.setPreview(0.25) or __veil.clearPreview()
  window.__veil = {
    setPreview(pct) {
      const n = Number(pct);
      if (!Number.isFinite(n)) return;
      settings.previewProgress = Math.min(1, Math.max(0, n > 1 ? n / 100 : n));
      applyPreviewUI();
      saveSettings();
      tick(false);
    },
    clearPreview() {
      settings.previewProgress = null;
      applyPreviewUI();
      saveSettings();
      tick(false);
    },
    getProgress() {
      return resolveProgress(new Date());
    },
  };

  init();

  async function init() {
    settings = await loadSettings();
    applySettingsToUI();
    bindUI();
    await refreshDay(true);
    startTicker();
    maybeShowPartner();
  }

  function bindUI() {
    els.toggleChrome.addEventListener("click", () => {
      settings.showChrome = !settings.showChrome;
      applyChromeVisibility();
      saveSettings();
      els.settingChrome.checked = settings.showChrome;
    });

    els.settingsBtn.addEventListener("click", () => {
      els.settingsSheet.showModal();
    });

    els.settingChrome.addEventListener("change", () => {
      settings.showChrome = els.settingChrome.checked;
      applyChromeVisibility();
      saveSettings();
    });

    els.setting24h.addEventListener("change", () => {
      settings.use24h = els.setting24h.checked;
      saveSettings();
      tick(false);
    });

    els.settingSeconds.addEventListener("change", () => {
      settings.showSeconds = els.settingSeconds.checked;
      saveSettings();
      tick(false);
    });

    if (els.settingReveal) {
      els.settingReveal.addEventListener("change", () => {
        settings.revealStyle = els.settingReveal.value;
        engine.setStyle(settings.revealStyle);
        saveSettings();
        tick(false);
      });
    }

    if (els.settingPreviewEnable && els.settingPreview) {
      els.settingPreviewEnable.addEventListener("change", () => {
        if (els.settingPreviewEnable.checked) {
          const v = Number(els.settingPreview.value) / 100;
          settings.previewProgress = Number.isFinite(v) ? v : 0;
        } else {
          settings.previewProgress = null;
        }
        applyPreviewUI();
        saveSettings();
        tick(false);
      });

      els.settingPreview.addEventListener("input", () => {
        if (!els.settingPreviewEnable.checked) {
          els.settingPreviewEnable.checked = true;
        }
        settings.previewProgress = Number(els.settingPreview.value) / 100;
        if (els.settingPreviewValue) {
          els.settingPreviewValue.textContent = `${els.settingPreview.value}%`;
        }
        saveSettings();
        tick(false);
      });
    }

    if (els.openOptions) {
      els.openOptions.addEventListener("click", (e) => {
        e.preventDefault();
        if (chrome?.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open("options.html", "_blank");
        }
      });
    }

    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") return;
        if (changes[STORAGE_KEY]) {
          settings = { ...defaults, ...(changes[STORAGE_KEY].newValue || {}) };
          applySettingsToUI();
          engine.setStyle(settings.revealStyle);
          refreshDay(true);
        }
        if (changes[PARTNER_KEY]) maybeShowPartner();
      });
    }

    window.addEventListener("resize", () => engine.resize());
  }

  function applySettingsToUI() {
    els.settingChrome.checked = settings.showChrome;
    els.setting24h.checked = settings.use24h;
    els.settingSeconds.checked = settings.showSeconds;
    if (els.settingReveal) els.settingReveal.value = settings.revealStyle || "paint";
    engine.setStyle(settings.revealStyle || "paint");
    applyChromeVisibility();
    applyPreviewUI();
    if (els.premiumHint) {
      els.premiumHint.hidden = !settings.premiumUnlocked;
    }
  }

  function applyPreviewUI() {
    const previewOn =
      settings.previewProgress !== null &&
      settings.previewProgress !== undefined &&
      Number.isFinite(Number(settings.previewProgress));
    if (els.settingPreviewEnable) els.settingPreviewEnable.checked = previewOn;
    if (els.settingPreview) {
      const pct = previewOn ? Math.round(Number(settings.previewProgress) * 100) : Math.round(VeilDay.dayProgress() * 100);
      els.settingPreview.value = String(pct);
      els.settingPreview.disabled = !previewOn;
    }
    if (els.settingPreviewValue) {
      const pct = previewOn
        ? Math.round(Number(settings.previewProgress) * 100)
        : Math.round(VeilDay.dayProgress() * 100);
      els.settingPreviewValue.textContent = previewOn ? `${pct}% (preview)` : `${pct}% (live day)`;
    }
  }

  function applyChromeVisibility() {
    els.stage.classList.toggle("is-chrome-hidden", !settings.showChrome);
    els.toggleChrome.textContent = settings.showChrome ? "Hide" : "Show";
  }

  function applyPlaque(image) {
    els.workTitle.textContent = image.title || "Untitled";
    els.workArtist.textContent = image.artist || "";
    els.workDate.textContent = image.date || "";
    els.collectionLabel.textContent =
      image.collection || (image.source === "met" ? "The Metropolitan Museum of Art" : "Veil Collection");
    els.dayId.textContent = image.title || "—";
  }

  function resolveProgress(now) {
    if (
      settings.previewProgress !== null &&
      settings.previewProgress !== undefined &&
      Number.isFinite(Number(settings.previewProgress))
    ) {
      return Math.min(1, Math.max(0, Number(settings.previewProgress)));
    }
    return VeilDay.dayProgress(now);
  }

  async function refreshDay(forceImage) {
    const now = new Date();
    const key = VeilDay.dayKey(now);
    const dayChanged = key !== currentDayKey;
    const image = VeilImages.imageForDay(key, settings.imageSource || "met");

    if (dayChanged || forceImage || image.url !== currentImageUrl) {
      currentDayKey = key;
      currentImageUrl = image.url;
      engine.setDaySeed(key);
      applyPlaque(image);
      els.canvas.classList.remove("is-ready");
      // Snap progress before the image paints so the first frame is already masked.
      engine.setProgress(resolveProgress(now), { animate: false });
      try {
        await engine.load(image.url, { remote: image.source !== "local" });
      } catch (err) {
        console.warn(err);
        if (image.source !== "local") {
          const fallback = VeilImages.imageForDay(key, "local");
          currentImageUrl = fallback.url;
          applyPlaque(fallback);
          try {
            await engine.load(fallback.url, { remote: false });
          } catch (err2) {
            console.warn(err2);
          }
        }
      }
    }

    // Always snap — mid-day open must show the correct partial unveil, not animate 0→now.
    tick(false);
  }

  function tick(animateReveal = false) {
    const now = new Date();
    const key = VeilDay.dayKey(now);
    if (key !== currentDayKey) {
      refreshDay(true);
      return;
    }

    const progress = resolveProgress(now);
    const pct = Math.floor(progress * 100);
    const previewOn =
      settings.previewProgress !== null &&
      settings.previewProgress !== undefined &&
      Number.isFinite(Number(settings.previewProgress));

    els.clock.textContent = VeilDay.formatClock(now, {
      use24h: settings.use24h,
      showSeconds: settings.showSeconds,
    });
    els.dateLine.textContent = VeilDay.formatDateLine(now);
    els.progressFill.style.width = `${(progress * 100).toFixed(3)}%`;
    els.progressLabel.textContent = previewOn ? `${pct}% preview` : `${pct}% painted`;
    els.timeLeft.textContent = previewOn
      ? "Progress preview on"
      : VeilDay.formatRemaining(VeilDay.msUntilTomorrow(now));

    engine.setProgress(progress, { animate: animateReveal });
  }

  function startTicker() {
    const align = 1000 - (Date.now() % 1000);
    setTimeout(() => {
      tick(false);
      setInterval(() => tick(false), 1000);
    }, align);
  }

  function loadSettings() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.sync) {
        resolve({ ...defaults });
        return;
      }
      chrome.storage.sync.get(STORAGE_KEY, (data) => {
        resolve({ ...defaults, ...(data?.[STORAGE_KEY] || {}) });
      });
    });
  }

  function saveSettings() {
    if (!chrome?.storage?.sync) return;
    chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  }

  function maybeShowPartner() {
    if (!chrome?.storage?.sync) return;
    chrome.storage.sync.get(PARTNER_KEY, (data) => {
      const partner = data?.[PARTNER_KEY];
      if (!partner?.label || !partner?.href) {
        els.partnerSlot.hidden = true;
        return;
      }
      els.partnerLink.textContent = partner.label;
      els.partnerLink.href = partner.href;
      els.partnerSlot.hidden = false;
    });
  }
})();
