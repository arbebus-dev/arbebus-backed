export async function getRoutes(context: any) {
  return [
    {
      type: "bus",
      duration: 12,
      walkingDistance: 0.4,
      price: 1,
    },
    {
      type: "taxi",
      duration: 7,
      walkingDistance: 0,
      price: 6,
    },
    {
      type: "scooter",
      duration: 8,
      walkingDistance: 0.1,
      price: 3,
    },
  ]
}