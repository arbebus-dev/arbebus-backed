export function explainRoute(route: any, context: any) {
  const reasons = []

  if (route.duration < 8) {
    reasons.push("fastest")
  }

  if (context.weather === "rain" && route.walkingDistance < 0.2) {
    reasons.push("avoids rain")
  }

  if (route.price < 2) {
    reasons.push("cheap")
  }

  return reasons.join(", ")
}