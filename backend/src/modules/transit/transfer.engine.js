function countTransfers(legs = []) {
  return Math.max(0, legs.filter((leg) => leg.type === 'ride' || leg.mode === 'bus').length - 1);
}
module.exports = { countTransfers };
