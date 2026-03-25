export function scoreRoute(route: any, context: any) {
  let score = 0

  score -= route.duration
  score -= route.walkingDistance * 2
  score -= route.price * 0.5

  if (context.weather === "rain") {
    score -= route.walkingDistance * 3
  }

  if (context.time === "night" && route.type === "scooter") {
    score -= 20
  }

  return score
}