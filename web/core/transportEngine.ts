
export function chooseBestRoute({
  busEta,
  TaxiEta,
  busPrice,
  TaxiPrice,
  weather,
}: {
  busEta: number,
  TaxiEta: number
  busPrice: number
  TaxiPrice: number
  weather: "sun" | "rain"
}) {
  const busScore =
    busEta * 1.0 +
    busPrice * 0.6 +
    (weather === "rain" ? 2 : 0)

  const TaxiScore =
    TaxiEta * 1.0 +
    TaxiPrice * 0.4

  if (busScore < TaxiScore) {
    return {
      type: "bus",
      eta: busEta,
      price: busPrice,
      reason: "cheaper and good arrival time",
    }
  }

  return {
    type: "Taxi",
    eta: TaxiEta,
    price: TaxiPrice,
    reason: "fastest option right now",
  }
}