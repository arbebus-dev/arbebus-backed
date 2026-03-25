export default function BusesScreen() {
  return null
}
export const buses = [
  {
    id: 0,
    line: "8",
    color: "#2ecc71",
    route: [
      { lat: 55.6922, lng: 21.1506 },
      { lat: 55.7061, lng: 21.1312 },
      { lat: 55.7189, lng: 21.1231 },
      { lat: 55.7150, lng: 21.1330 },
      { lat: 55.7055, lng: 21.1285 },
    ],
  index: Math.floor(Math.random() * 4)
  },
  {
    id: 1,
    line: "10",
    color: "#3498db",
    route: [
      { lat: 55.7189, lng: 21.1231 },
      { lat: 55.7061, lng: 21.1312 },
      { lat: 55.6882, lng: 21.1590 },
      { lat: 55.6901, lng: 21.1650 },
      { lat: 55.7055, lng: 21.1285 },
    ],
  index: Math.floor(Math.random() * 4)
  },
  {
    id: 2,
    line: "5",
    color: "#f1c40f",
    route: [
      { lat: 55.6882, lng: 21.1590 },
      { lat: 55.7061, lng: 21.1312 },
      { lat: 55.6922, lng: 21.1506 },
      { lat: 55.7055, lng: 21.1285 },
      { lat: 55.7150, lng: 21.1330 },
    ],
  index: Math.floor(Math.random() * 4)
  },
  {
    id: 3,
    line: "12",
    color: "#e74c3c",
    route: [
      { lat: 55.7061, lng: 21.1312 },
      { lat: 55.7189, lng: 21.1231 },
      { lat: 55.6882, lng: 21.1590 },
      { lat: 55.6901, lng: 21.1650 },
      { lat: 55.7150, lng: 21.1330 },
    ],
  index: Math.floor(Math.random() * 4)
  },
  {
    id: 4,
    line: "15",
    color: "#9b59b6",
    route: [
      { lat: 55.6922, lng: 21.1506 },
      { lat: 55.6882, lng: 21.1590 },
      { lat: 55.7061, lng: 21.1312 },
      { lat: 55.7055, lng: 21.1285 },
      { lat: 55.7150, lng: 21.1330 },
    ],
  index: Math.floor(Math.random() * 4)
  },
  {
    id: 5,
    line: "20",
    color: "#1abc9c",
    route: [
      { lat: 55.7189, lng: 21.1231 },
      { lat: 55.6922, lng: 21.1506 },
      { lat: 55.6882, lng: 21.1590 },
      { lat: 55.6901, lng: 21.1650 },
      { lat: 55.7061, lng: 21.1312 },
    ],
  index: Math.floor(Math.random() * 4)
  },
];