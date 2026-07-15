/**
 * Daily artwork selection.
 * Default: curated Met Open Access paintings (deterministic by date).
 * Fallback: bundled local catalog.
 */
(function (global) {
  const LOCAL_CATALOG = [
    { id: "01", title: "Aurora Ridge", artist: "Veil Collection", date: "", url: "assets/days/01.jpg", collection: "Veil" },
    { id: "02", title: "Harbor Dusk", artist: "Veil Collection", date: "", url: "assets/days/02.jpg", collection: "Veil" },
    { id: "03", title: "Glass Forest", artist: "Veil Collection", date: "", url: "assets/days/03.jpg", collection: "Veil" },
    { id: "04", title: "Quiet Dune", artist: "Veil Collection", date: "", url: "assets/days/04.jpg", collection: "Veil" },
    { id: "05", title: "Bronze Rain", artist: "Veil Collection", date: "", url: "assets/days/05.jpg", collection: "Veil" },
    { id: "06", title: "Ember Coast", artist: "Veil Collection", date: "", url: "assets/days/06.jpg", collection: "Veil" },
    { id: "07", title: "Silver Still", artist: "Veil Collection", date: "", url: "assets/days/07.jpg", collection: "Veil" },
  ];

  /** Curated public-domain paintings from The Met (Open Access). */
  const MET_CATALOG = [
    {
      id: "436528",
      title: "Irises",
      artist: "Vincent van Gogh",
      date: "1890",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP346474.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "437980",
      title: "Cypresses",
      artist: "Vincent van Gogh",
      date: "1889",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP130999.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "435882",
      title: "Still Life with Apples and a Pot of Primroses",
      artist: "Paul Cézanne",
      date: "ca. 1890",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DT47.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "436105",
      title: "The Death of Socrates",
      artist: "Jacques Louis David",
      date: "1787",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-13139-001.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "437394",
      title: "Aristotle with a Bust of Homer",
      artist: "Rembrandt",
      date: "1653",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-30758-001.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "436947",
      title: "Boating",
      artist: "Édouard Manet",
      date: "1874",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-25466-001.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "435809",
      title: "The Harvesters",
      artist: "Pieter Bruegel the Elder",
      date: "1565",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP119115.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "437853",
      title: "Venice, from the Porch of Madonna della Salute",
      artist: "J. M. W. Turner",
      date: "ca. 1835",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP169568.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "436121",
      title: "A Woman Seated beside a Vase of Flowers",
      artist: "Edgar Degas",
      date: "1865",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-25460-001.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "437654",
      title: "Circus Sideshow",
      artist: "Georges Seurat",
      date: "1887–88",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP375450_cropped.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "459108",
      title: "The Harvest, Pontoise",
      artist: "Camille Pissarro",
      date: "1881",
      url: "https://images.metmuseum.org/CRDImages/rl/web-large/DP-34499-001.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "435739",
      title: "The Toilette of Venus",
      artist: "François Boucher",
      date: "1751",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-411-01.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "436101",
      title: "The Rest on the Flight into Egypt",
      artist: "Gerard David",
      date: "ca. 1512–15",
      url: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-14936-023.jpg",
      collection: "The Metropolitan Museum of Art",
    },
    {
      id: "459090",
      title: "Condesa de Altamira and Her Daughter",
      artist: "Francisco de Goya",
      date: "1787–88",
      url: "https://images.metmuseum.org/CRDImages/rl/web-large/DP295708.jpg",
      collection: "The Metropolitan Museum of Art",
    },
  ];

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(catalog, dayKey, source) {
    const index = hashString(`veil:${source}:${dayKey}`) % catalog.length;
    const entry = catalog[index];
    return {
      ...entry,
      dayKey,
      index,
      source,
    };
  }

  function imageForDay(dayKey, source = "met") {
    if (source === "local") {
      return pick(LOCAL_CATALOG, dayKey, "local");
    }
    if (source === "remote") {
      const seed = encodeURIComponent(`veil-${dayKey}`);
      return {
        id: `remote-${dayKey}`,
        title: `Remote Study ${dayKey}`,
        artist: "Picsum",
        date: dayKey,
        url: `https://picsum.photos/seed/${seed}/2400/1600`,
        collection: "Remote",
        dayKey,
        source: "remote",
        index: -1,
      };
    }
    return pick(MET_CATALOG, dayKey, "met");
  }

  global.VeilImages = {
    LOCAL_CATALOG,
    MET_CATALOG,
    CATALOG: MET_CATALOG,
    imageForDay,
  };
})(window);
