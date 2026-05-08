/* eslint-env node */
const https = require("https");
const http = require("http");

function getBindings() {
  try {
    return require("gtfs-realtime-bindings");
  } catch (error) {
    const message =
      "Missing dependency: gtfs-realtime-bindings. Run `npm install` in backend or deploy with updated package.json.";
    const err = new Error(message);
    err.cause = error;
    throw err;
  }
}

function requestBuffer(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("GTFS-RT URL missing"));
      return;
    }

    const client = String(url).startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Arbebus/1.0 gtfs-rt",
          Accept: "application/x-protobuf,application/octet-stream,*/*",
          "Cache-Control": "no-cache",
        },
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`GTFS-RT HTTP ${res.statusCode}`));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );

    req.on("timeout", () => req.destroy(new Error("GTFS-RT timeout")));
    req.on("error", reject);
  });
}

async function fetchFeed(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || process.env.GTFS_RT_TIMEOUT_MS || 10000);
  const buffer = await requestBuffer(url, timeoutMs);

  const bindings = getBindings();
  const FeedMessage = bindings.transit_realtime.FeedMessage;
  const decoded = FeedMessage.decode(buffer);

  return {
    ok: true,
    source: "gtfs-rt",
    url,
    byteLength: buffer.length,
    fetchedAt: new Date().toISOString(),
    header: decoded.header || null,
    entities: Array.isArray(decoded.entity) ? decoded.entity : [],
  };
}

function feedTimestampSeconds(feed) {
  const ts = Number(feed?.header?.timestamp || 0);
  return Number.isFinite(ts) && ts > 0 ? ts : Math.floor(Date.now() / 1000);
}

module.exports = {
  fetchFeed,
  requestBuffer,
  feedTimestampSeconds,
};
