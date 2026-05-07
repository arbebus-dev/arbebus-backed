import type { ArbebusDecision, ArbebusDecisionStep } from "./types";

type Input = {
  originName?: string;
  destinationName?: string;
  walkToStopMinutes?: number;
  busArrivesInMinutes?: number;
  rideMinutes?: number;
  walkFromStopMinutes?: number;
  routeNumber?: string;
  stopName?: string;
  stopCount?: number;
  delayMinutes?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createArbebusDecision(input: Input): ArbebusDecision {
  const walkToStop = input.walkToStopMinutes ?? 5;
  const busArrivesIn = input.busArrivesInMinutes ?? 8;
  const rideMinutes = input.rideMinutes ?? 12;
  const walkFromStop = input.walkFromStopMinutes ?? 4;
  const delay = input.delayMinutes ?? 0;

  const minutesToLeave = busArrivesIn - walkToStop - 1;
  const etaMinutes = walkToStop + Math.max(busArrivesIn, walkToStop) + rideMinutes + walkFromStop;

  const routeNumber = input.routeNumber ?? "—";
  const stopName = input.stopName ?? "artimiausia stotelė";
  const destinationName = input.destinationName ?? "kelionės tikslas";

  let title = "";
  let subtitle = "";
  let primaryAction = "";
  let urgency: ArbebusDecision["urgency"] = "calm";

  if (minutesToLeave > 5) {
    title = `Išeik po ${minutesToLeave} min`;
    subtitle = `Spėsi į ${routeNumber} autobusą iš stotelės „${stopName}“.`;
    primaryAction = "Dar gali palaukti";
    urgency = "calm";
  } else if (minutesToLeave > 1) {
    title = `Ruoškis išeiti`;
    subtitle = `Autobusas atvyks už ${busArrivesIn} min. Iki stotelės eisi apie ${walkToStop} min.`;
    primaryAction = `Išeik po ${minutesToLeave} min`;
    urgency = "soon";
  } else if (minutesToLeave >= -1) {
    title = "Eik dabar";
    subtitle = `Kad spėtum į ${routeNumber} autobusą, pajudėk dabar.`;
    primaryAction = "Pradėti ėjimą";
    urgency = "now";
  } else {
    title = "Gali būti per vėlu";
    subtitle = `Šitas autobusas gali būti per arti. Ieškome geresnio varianto.`;
    primaryAction = "Rasti kitą variantą";
    urgency = "late";
  }

  if (delay > 2 && urgency !== "late") {
    title = `Gali neskubėti`;
    subtitle = `${routeNumber} autobusas vėluoja apie ${delay} min. Išeik šiek tiek vėliau.`;
    primaryAction = `Išeik po ${Math.max(1, minutesToLeave + delay)} min`;
  }

  const steps: ArbebusDecisionStep[] = [
    {
      type: "walk_to_stop",
      title: `Eik iki stotelės „${stopName}“`,
      subtitle: `Apie ${walkToStop} min pėsčiomis`,
      durationMinutes: walkToStop,
    },
    {
      type: "wait_bus",
      title: `Lauk ${routeNumber} autobuso`,
      subtitle: `Atvyks maždaug už ${busArrivesIn + delay} min`,
      durationMinutes: Math.max(0, busArrivesIn + delay - walkToStop),
      routeNumber,
    },
    {
      type: "board_bus",
      title: "Lipk dabar",
      subtitle: `${routeNumber} autobusas atvyko`,
      routeNumber,
    },
    {
      type: "ride_bus",
      title: `Važiuok ${input.stopCount ?? 0} stoteles`,
      subtitle: `Kelionė autobusu apie ${rideMinutes} min`,
      durationMinutes: rideMinutes,
      stopCount: input.stopCount ?? 0,
      routeNumber,
    },
    {
      type: "exit_bus",
      title: "Išlipk kitoje stotelėje",
      subtitle: `Toliau iki „${destinationName}“ liks apie ${walkFromStop} min`,
    },
    {
      type: "walk_to_destination",
      title: `Eik iki „${destinationName}“`,
      subtitle: `Apie ${walkFromStop} min pėsčiomis`,
      durationMinutes: walkFromStop,
    },
    {
      type: "arrived",
      title: "Atvykai",
      subtitle: "Kelionė baigta.",
    },
  ];

  return {
    title,
    subtitle,
    primaryAction,
    secondaryText: `Atvyksi maždaug per ${etaMinutes} min`,
    urgency,
    confidence: clamp(0.86 - Math.abs(delay) * 0.03, 0.55, 0.95),
    minutesToLeave,
    busRoute: routeNumber,
    stopName,
    destinationName,
    etaMinutes,
    steps,
  };
}