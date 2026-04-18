type Stop = {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
};

type StopTime = {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
};

type Trip = {
  trip_id: string;
  route_id: string;
};

type DirectRouteMatch = {
  routeId: string;
  tripId: string;
  fromStopId: string;
  toStopId: string;
  fromStopName: string;
  toStopName: string;
  stopCount: number;
};

export function findDirectRouteMatch(params: {
  originStops: Stop[];
  destinationStops: Stop[];
  stopTimes: StopTime[];
  trips: Trip[];
  stops: Stop[];
}): DirectRouteMatch | null {
  const { originStops, destinationStops, stopTimes, trips, stops } = params;

  if (!originStops.length || !destinationStops.length) return null;

  // Greitam lookup
  const stopMap = new Map<string, Stop>();
  for (const s of stops) {
    stopMap.set(String(s.stop_id), s);
  }

  // Grupuoja stop_times pagal trip
  const stopTimesByTrip = new Map<string, StopTime[]>();

  for (const st of stopTimes) {
    const tripId = String(st.trip_id);
    if (!stopTimesByTrip.has(tripId)) {
      stopTimesByTrip.set(tripId, []);
    }
    stopTimesByTrip.get(tripId)!.push(st);
  }

  // Tikrinam kiekvieną trip
  for (const [tripId, times] of stopTimesByTrip.entries()) {
    const sorted = times.sort(
      (a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)
    );

    let originIndex = -1;
    let destinationIndex = -1;

    for (let i = 0; i < sorted.length; i++) {
      const stopId = String(sorted[i].stop_id);

      if (
        originIndex === -1 &&
        originStops.some((s) => String(s.stop_id) === stopId)
      ) {
        originIndex = i;
      }

      if (
        originIndex !== -1 &&
        destinationStops.some((s) => String(s.stop_id) === stopId)
      ) {
        destinationIndex = i;
        break;
      }
    }

    if (originIndex !== -1 && destinationIndex !== -1 && destinationIndex > originIndex) {
      const fromStopId = String(sorted[originIndex].stop_id);
      const toStopId = String(sorted[destinationIndex].stop_id);

      const fromStop = stopMap.get(fromStopId);
      const toStop = stopMap.get(toStopId);

      const trip = trips.find((t) => String(t.trip_id) === tripId);

      return {
        routeId: trip?.route_id || "UNKNOWN",
        tripId,
        fromStopId,
        toStopId,
        fromStopName: fromStop?.stop_name || "Unknown",
        toStopName: toStop?.stop_name || "Unknown",
        stopCount: destinationIndex - originIndex,
      };
    }
  }

  return null;
}