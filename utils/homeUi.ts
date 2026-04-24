import type { LiveBus, TravelMode } from "../types/home";

type ModeChipLabelParams = { mode: TravelMode; eta: number | null; };
type FloatingAiCopyParams = { selectedMode: TravelMode; selectedBus?: LiveBus | null; isPro: boolean; };
type PrimaryButtonParams = { rideStatus: string; liveEtaSeconds?: number | null; selectedMode: TravelMode; isPro: boolean; getFinalMode?: () => string | null; formatEtaCountdown?: (seconds: number | null) => string; };

function formatEtaLabel(eta: number | null, fallback: string) {
  if (typeof eta === 'number' && Number.isFinite(eta) && eta > 0) return `${eta} min`;
  return fallback;
}

function getResolvedMode(selectedMode: TravelMode, getFinalMode?: () => string | null) {
  const finalMode = getFinalMode?.();
  if (finalMode === 'smart' || finalMode === 'taxi' || finalMode === 'bus' || finalMode === 'walk' || finalMode === 'train' || finalMode === 'airport') {
    return finalMode as TravelMode;
  }
  return selectedMode;
}

export function getModeChipLabel({ mode, eta }: ModeChipLabelParams): string {
  if (mode === 'smart') return 'Smart';
  if (mode === 'taxi') return `Taxi • ${formatEtaLabel(eta, '5 min')}`;
  if (mode === 'bus') return `Bus • ${formatEtaLabel(eta, '7 min')}`;
  if (mode === 'walk') return `Walk • ${formatEtaLabel(eta, '14 min')}`;
  if (mode === 'train') return `Train • ${formatEtaLabel(eta, '18 min')}`;
  if (mode === 'airport') return `Airport • ${formatEtaLabel(eta, '32 min')}`;
  return 'Smart';
}

export function getPrimaryButtonIcon({ rideStatus, selectedMode, isPro, getFinalMode }: PrimaryButtonParams): string {
  if (rideStatus === 'driver_arriving') return 'car-clock';
  if (rideStatus === 'driver_arrived') return 'car-check';
  if (rideStatus === 'ride_started') return 'navigation-variant';
  const resolvedMode = getResolvedMode(selectedMode, getFinalMode);
  if (resolvedMode === 'smart') return isPro ? 'brain' : 'brain';
  if (resolvedMode === 'taxi') return 'taxi';
  if (resolvedMode === 'bus') return 'bus';
  if (resolvedMode === 'walk') return 'walk';
  if (resolvedMode === 'train') return 'train';
  if (resolvedMode === 'airport') return 'airplane';
  return 'arrow-right';
}

export function getPrimaryButtonLabel({ rideStatus, liveEtaSeconds, selectedMode, getFinalMode, formatEtaCountdown }: PrimaryButtonParams): string {
  if (rideStatus === 'driver_arriving') {
    const countdown = formatEtaCountdown?.(liveEtaSeconds ?? null);
    return countdown && countdown !== '—' ? `Driver arriving • ${countdown}` : 'Driver arriving';
  }
  if (rideStatus === 'driver_arrived') return 'Start ride';
  if (rideStatus === 'ride_started') {
    const countdown = formatEtaCountdown?.(liveEtaSeconds ?? null);
    return countdown && countdown !== '—' ? `Ride in progress • ${countdown}` : 'Ride in progress';
  }
  const resolvedMode = getResolvedMode(selectedMode, getFinalMode);
  if (resolvedMode === 'smart') return 'Run Smart Route';
  if (resolvedMode === 'taxi') return 'Open Bolt';
  if (resolvedMode === 'bus') return 'Open bus route';
  if (resolvedMode === 'walk') return 'Start walking';
  if (resolvedMode === 'train') return 'Open train route';
  if (resolvedMode === 'airport') return 'Plan airport trip';
  return 'Continue';
}

export function getFloatingAiCopy({ selectedMode, selectedBus }: FloatingAiCopyParams): string {
  if (selectedMode === 'smart') return 'AI palygina autobusą, taxi ir ėjimą, kad rastų geriausią maršrutą.';
  if (selectedMode === 'taxi') return 'Taxi flow paruoštas su Bolt deep link, pickup ir destination prefill.';
  if (selectedMode === 'bus') return selectedBus?.number ? `Stebimas ${selectedBus.number} autobusas realiu laiku su ETA ir kryptimi.` : 'Viešojo transporto režimas rodo geriausią autobusų variantą su live ETA.';
  if (selectedMode === 'walk') return 'Walk režimas tinka trumpiems atstumams be papildomų išlaidų.';
  if (selectedMode === 'train') return 'Train mode ruošiamas kaip intercity ir rail maršrutų sluoksnis.';
  if (selectedMode === 'airport') return 'Airport mode padeda greitai susiplanuoti kelionę į oro uostą.';
  return 'Arbebus padeda pasirinkti geriausią judėjimo būdą mieste.';
}
