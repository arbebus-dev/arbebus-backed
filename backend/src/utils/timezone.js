const TIMEZONE = "Europe/Vilnius";

function getVilniusNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
}

function getVilniusSeconds() {
  const now = getVilniusNow();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function toVilniusISOString(date = new Date()) {
  return new Date(
    new Date(date).toLocaleString("en-US", { timeZone: TIMEZONE })
  ).toISOString();
}

module.exports = {
  getVilniusNow,
  getVilniusSeconds,
  toVilniusISOString,
};
