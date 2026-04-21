import { useMemo } from "react";
import { Coordinate } from "../rideBooking/models";


type Mode = "walk" | "bus" | "taxi";

type SmartOption = {
  id: string;
  mode: Mode;
  eta: number;
  price: number;
  score: number;
};

function estimateWalk(from: Coordinate, to: Coordinate) {
  const dist = getDistance(from, to);
  const speed = 5; // km/h
  const hours = dist / speed;
  return Math.round(hours * 60);
}

function estimateTaxi(from: Coordinate, to: Coordinate) {
  const dist = getDistance(from, to);
  return Math.round((dist / 40) * 60);
}

function estimateBus(from: Coordinate, to: Coordinate) {
  const dist = getDistance(from, to);
  return Math.round((dist / 25) * 60 + 5);
}

function getDistance(a: Coordinate, b: Coordinate) {
  const dx = a.latitude - b.latitude;
  const dy = a.longitude - b.longitude;
  return Math.sqrt(dx * dx + dy * dy) * 111;
}



export function useSmartRoute({
  from,
  to,
}: {
  from: Coordinate | null;
  to: Coordinate | null;
}) {
  return useMemo(() => {
    if (!from || !to) return null;

    const options: SmartOption[] = [
      {
        id: "walk",
        mode: "walk",
        eta: estimateWalk(from, to),
        price: 0,
        score: 0,
      },
      {
        id: "bus",
        mode: "bus",
        eta: estimateBus(from, to),
        price: 1.5,
        score: 0,
      },
      {
        id: "taxi",
        mode: "taxi",
        eta: estimateTaxi(from, to),
        price: 6,
        score: 0,
      },
    ];

    const scored = options.map((opt) => ({
      ...opt,
      score: opt.eta + opt.price * 2,
    }));

    scored.sort((a, b) => a.score - b.score);

    return {
      best: scored[0],
      all: scored,
    };
  }, [from, to]);
}