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
    previewProgress: null,
  };

  const els = {
    chrome: document.getElementById("setting-chrome"),
    use24h: document.getElementById("setting-24h"),
    seconds: document.getElementById("setting-seconds"),
    reveal: document.getElementById("setting-reveal"),
    source: document.getElementById("setting-source"),
    premium: document.getElementById("setting-premium"),
    previewEnable: document.getElementById("setting-preview-enable"),
    preview: document.getElementById("setting-preview"),
    previewValue: document.getElementById("setting-preview-value"),
    partnerLabel: document.getElementById("partner-label"),
    partnerHref: document.getElementById("partner-href"),
    savePartner: document.getElementById("save-partner"),
    clearPartner: document.getElementById("clear-partner"),
    status: document.getElementById("status"),
  };

  let settings = { ...defaults };

  init();

  async function init() {
    settings = await get(STORAGE_KEY, defaults);
    const partner = await get(PARTNER_KEY, null);

    els.chrome.checked = settings.showChrome;
    els.use24h.checked = settings.use24h;
    els.seconds.checked = settings.showSeconds;
    els.reveal.value = settings.revealStyle || "paint";
    els.source.value = settings.imageSource || "met";
    els.premium.checked = !!settings.premiumUnlocked;
    applyPreviewUI();

    if (partner) {
      els.partnerLabel.value = partner.label || "";
      els.partnerHref.value = partner.href || "";
    }

    [
      ["change", els.chrome, () => { settings.showChrome = els.chrome.checked; }],
      ["change", els.use24h, () => { settings.use24h = els.use24h.checked; }],
      ["change", els.seconds, () => { settings.showSeconds = els.seconds.checked; }],
      ["change", els.reveal, () => { settings.revealStyle = els.reveal.value; }],
      ["change", els.source, () => { settings.imageSource = els.source.value; }],
      ["change", els.premium, () => { settings.premiumUnlocked = els.premium.checked; }],
    ].forEach(([evt, el, fn]) => {
      el.addEventListener(evt, () => {
        fn();
        persistSettings();
      });
    });

    if (els.previewEnable && els.preview) {
      els.previewEnable.addEventListener("change", () => {
        if (els.previewEnable.checked) {
          settings.previewProgress = Number(els.preview.value) / 100;
        } else {
          settings.previewProgress = null;
        }
        applyPreviewUI();
        persistSettings();
      });
      els.preview.addEventListener("input", () => {
        if (!els.previewEnable.checked) els.previewEnable.checked = true;
        settings.previewProgress = Number(els.preview.value) / 100;
        applyPreviewUI();
        persistSettings();
      });
    }

    els.savePartner.addEventListener("click", () => {
      const label = els.partnerLabel.value.trim();
      const href = els.partnerHref.value.trim();
      if (!label || !href) {
        flash("Add both a label and URL, or Clear.");
        return;
      }
      chrome.storage.sync.set({ [PARTNER_KEY]: { label, href } }, () => {
        flash("Partner slot saved.");
      });
    });

    els.clearPartner.addEventListener("click", () => {
      els.partnerLabel.value = "";
      els.partnerHref.value = "";
      chrome.storage.sync.remove(PARTNER_KEY, () => flash("Partner slot cleared."));
    });
  }

  function applyPreviewUI() {
    const previewOn =
      settings.previewProgress !== null &&
      settings.previewProgress !== undefined &&
      Number.isFinite(Number(settings.previewProgress));
    if (els.previewEnable) els.previewEnable.checked = previewOn;
    const pct = previewOn ? Math.round(Number(settings.previewProgress) * 100) : 0;
    if (els.preview) {
      els.preview.value = String(pct);
      els.preview.disabled = !previewOn;
    }
    if (els.previewValue) {
      els.previewValue.textContent = previewOn ? `${pct}% (preview)` : "off (live day)";
    }
  }

  function persistSettings() {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => flash("Saved."));
  }

  function get(key, fallback) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(key, (data) => {
        resolve(data?.[key] ?? fallback);
      });
    });
  }

  function flash(msg) {
    els.status.textContent = msg;
  }
})();
