function formatTime(value) {
  if (!value) return null;
  const text = String(value);
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return text;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function formatStop(stop) {
  if (!stop) return null;
  return {
    ...stop,
    name: stop.name || stop.title || stop.stopName || 'Stotelė',
    title: stop.title || stop.name || stop.stopName || 'Stotelė',
    arrivalTime: formatTime(stop.arrivalTime),
    departureTime: formatTime(stop.departureTime),
  };
}

function formatStep(step) {
  if (!step || typeof step !== 'object') return step;
  const type = String(step.type || step.mode || 'step');
  const stops = Array.isArray(step.stops) ? step.stops.map(formatStop).filter(Boolean) : [];

  if (type === 'walk') {
    return {
      ...step,
      type: 'walk',
      mode: 'walk',
      title: step.title || 'Eikite pėsčiomis',
      subtitle: step.subtitle || step.instruction || `${step.distanceMeters || 0} m • ${step.durationMinutes || step.minutes || 1} min`,
      stops,
    };
  }

  if (['bus', 'ride', 'board', 'alight'].includes(type)) {
    return {
      ...step,
      type: type === 'bus' ? 'ride' : type,
      mode: 'bus',
      title: step.title || (step.routeNumber || step.routeLabel ? `Lipk į ${step.routeNumber || step.routeLabel}` : 'Lipkite į autobusą'),
      subtitle: step.subtitle || `${formatTime(step.departureTime) || ''}${step.arrivalTime ? ` → ${formatTime(step.arrivalTime)}` : ''}`.trim(),
      departureTime: formatTime(step.departureTime),
      arrivalTime: formatTime(step.arrivalTime),
      stops,
    };
  }

  if (type === 'transfer') {
    return {
      ...step,
      type: 'transfer',
      mode: 'walk',
      title: step.title || 'Persėskite',
      subtitle: step.subtitle || step.instruction || 'Persėdimas į kitą maršrutą',
      stops,
    };
  }

  return { ...step, stops };
}

function formatJourney(route) {
  if (!route || typeof route !== 'object') return route;
  const journeySteps = Array.isArray(route.journeySteps) ? route.journeySteps : Array.isArray(route.steps) ? route.steps : [];
  const steps = journeySteps.map(formatStep);
  return {
    ...route,
    journeySteps: steps,
    steps,
    routeIds: route.routeIds || route.routeNumbers || [],
    vehicleIds: route.vehicleIds || [],
    summary: {
      ...(route.summary || {}),
      totalDurationMinutes: route.totalDurationMinutes || route.totalMinutes || route.summary?.totalDurationMinutes || null,
      transfersCount: route.transfersCount || route.transfers || route.summary?.transfersCount || 0,
    },
  };
}

module.exports = { formatJourney, formatStep, formatStop };
