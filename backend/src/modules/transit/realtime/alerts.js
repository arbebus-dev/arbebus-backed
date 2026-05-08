/* eslint-env node */
const { fetchFeed, feedTimestampSeconds } = require("./gtfsRT.client");

const DEFAULT_URL = "https://www.stops.lt/klaipeda/service_alerts.pb";

function textFromTranslatedString(value) {
  const translations = value?.translation || value?.translations || [];
  if (!Array.isArray(translations) || translations.length === 0) return "";
  return translations.find((item) => item?.language === "lt")?.text || translations[0]?.text || "";
}

async function getRealtimeAlerts() {
  const url =
    process.env.GTFS_RT_SERVICE_ALERTS_URL ||
    process.env.KKT_GTFS_RT_SERVICE_ALERTS_URL ||
    DEFAULT_URL;

  try {
    const feed = await fetchFeed(url);
    const feedTs = feedTimestampSeconds(feed);

    const alerts = feed.entities
      .map((entity) => {
        const alert = entity.alert;
        if (!alert) return null;

        return {
          id: entity.id || null,
          cause: alert.cause || null,
          effect: alert.effect || null,
          header: textFromTranslatedString(alert.headerText || alert.header_text),
          description: textFromTranslatedString(alert.descriptionText || alert.description_text),
          url: textFromTranslatedString(alert.url),
          activePeriods: Array.isArray(alert.activePeriod || alert.active_period)
            ? (alert.activePeriod || alert.active_period).map((period) => ({
                start: period.start ? Number(period.start) : null,
                end: period.end ? Number(period.end) : null,
              }))
            : [],
        };
      })
      .filter(Boolean);

    return {
      ok: true,
      source: "gtfs-rt",
      url,
      count: alerts.length,
      alerts,
      fetchedAt: feed.fetchedAt,
      feedTimestamp: feedTs,
      meta: {
        byteLength: feed.byteLength,
        entityCount: feed.entities.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      source: "gtfs-rt",
      error: error.message,
      alerts: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

module.exports = { getRealtimeAlerts };
