type Bus = {
  id: string
  number: string
  lat: number
  lng: number
}

let buses: Bus[] = [
  { id: "1", number: "8", lat: 55.7032, lng: 21.1442 },
  { id: "2", number: "10", lat: 55.7041, lng: 21.1460 },
  { id: "3", number: "15", lat: 55.7024, lng: 21.1471 },
]

function moveBus(bus: Bus): Bus {
  return {
    ...bus,
    lat: bus.lat + (Math.random() - 0.5) * 0.001,
    lng: bus.lng + (Math.random() - 0.5) * 0.001,
  }
}

export function getLiveBuses() {
  buses = buses.map(moveBus)
  return buses
}