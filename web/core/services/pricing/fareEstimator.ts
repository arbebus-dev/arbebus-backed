export const fareEstimator = {
  estimateFare(
    distanceMeters: number,
    durationSeconds: number,
    productName: string
  ): number {
    const distanceKm = distanceMeters / 1000;
    const durationMin = durationSeconds / 60;

    const baseFare = 2.0;
    const perKm = 0.9;
    const perMin = 0.15;

    let multiplier = 1.0;

    switch (productName.toLowerCase()) {
      case "premium":
        multiplier = 1.45;
        break;
      case "women for women":
        multiplier = 1.15;
        break;
      default:
        multiplier = 1.0;
        break;
    }

    const total =
      (baseFare + distanceKm * perKm + durationMin * perMin) * multiplier;

    return Math.round(total * 10) / 10;
  },
};