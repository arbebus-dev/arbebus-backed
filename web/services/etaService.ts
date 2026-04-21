export function calculateETA(route: any) {
  // labai paprasta v1
  const base = route.duration

  // fake delay (vėliau pakeisim real)
  const delay = Math.random() * 2

  return Math.round(base + delay)
}