/**
 * Local-day helpers: progress is 0 at local midnight and 1 at end of day.
 */
(function (global) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function startOfLocalDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function dayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dayProgress(date = new Date()) {
    const start = startOfLocalDay(date).getTime();
    const elapsed = date.getTime() - start;
    return Math.min(1, Math.max(0, elapsed / MS_PER_DAY));
  }

  function msUntilTomorrow(date = new Date()) {
    const tomorrow = startOfLocalDay(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getTime() - date.getTime();
  }

  function formatRemaining(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m remaining`;
    return `${hours}h ${String(minutes).padStart(2, "0")}m remaining`;
  }

  function formatDateLine(date = new Date()) {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function formatClock(date, { use24h = true, showSeconds = false } = {}) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
      hour12: !use24h,
    });
  }

  global.VeilDay = {
    MS_PER_DAY,
    startOfLocalDay,
    dayKey,
    dayProgress,
    msUntilTomorrow,
    formatRemaining,
    formatDateLine,
    formatClock,
  };
})(window);
