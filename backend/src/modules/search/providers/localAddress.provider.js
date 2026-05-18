const {
  searchUnifiedLocal,
  getUnifiedLocalDetails,
  unifiedLocalHealth,
} = require("./unifiedLocalSearch.provider");

/**
 * Backwards-compatible local address provider.
 *
 * Search.service and older routes already call searchLocalAddresses(). Instead of keeping a
 * second broken address-only implementation, this file now delegates to the Unified Local
 * Search Engine. That engine searches:
 * - public.addresses
 * - public.adr_gyvenvietoves
 * - public.poi / local POI JSON
 * - GTFS stops
 *
 * Result: address search, settlements such as Melnragė/Smiltynė/Giruliai, POI and stops are
 * returned in one ranked list without relying on full_address or unaccent().
 */

const PROVIDER_VERSION = "local-address-delegates-to-unified-v1";

async function searchLocalAddresses(query, options = {}) {
  return searchUnifiedLocal(query, options);
}

async function getLocalAddressDetails(id) {
  return getUnifiedLocalDetails(id);
}

function localAddressHealth() {
  return {
    postgresAddressProvider: true,
    providerMode: "unified-local-search-delegate",
    providerVersion: PROVIDER_VERSION,
    requiresFullAddressColumn: false,
    requiresUnaccentExtension: false,
    supportsHouseNumber: true,
    supportsAccentlessLithuanian: true,
    ...unifiedLocalHealth(),
  };
}

module.exports = {
  searchLocalAddresses,
  getLocalAddressDetails,
  localAddressHealth,
};
