# Arbebus Mobile Search Flow Restore Fix

Overwrite these files from project root:

- mobile/core/features/transit/hooks/useSearchPlaces.ts
- mobile/core/features/transit/hooks/useTransitPlanner.ts
- mobile/core/features/transit/services/transitApi.ts
- mobile/core/features/map/SearchResultsSheet.tsx
- mobile/core/features/rideBooking/components/SearchResultsSheet.tsx
- mobile/constants/api.ts

Included fixes:
- debounce 250ms
- stale request cancellation by request id
- top 8 rendered/search results
- local-first search params: limit=8&external=false
- immediate cached results
- route planning only after selected result
- route cards before background geometry hydration
- auto current-location origin fill
- skeleton loading for search results
- no retry loop that blocks route planning for long periods

After overwrite:

cd mobile
npx tsc --noEmit

If OK:

eas build --platform ios --profile production --clear-cache
eas submit --platform ios --latest

Important: backend /api/transit/plan must also be fixed on Render first. Test:

curl.exe "https://arbebus-backed.onrender.com/api/transit/plan?fromLat=55.7033&fromLng=21.1443&toLat=55.6886&toLng=21.1567"

Expected: ok:true, not options.push error.
