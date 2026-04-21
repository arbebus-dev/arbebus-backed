import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
} from "react-native-maps";

import { FloatingSearchBar } from "../core/features/rideBooking/components/FloatingSearchBar";
import { RoutePreviewCard } from "../core/features/rideBooking/components/RoutePreviewCard";
import { SearchResultsSheet } from "../core/features/rideBooking/components/SearchResultsSheet";
import { useRideBooking } from "../core/features/rideBooking/hooks/useRideBooking";

export default function RideBookingTestScreen() {
  const mapRef = useRef<MapView | null>(null);
  const {
    flowState,
    rideDraft,
    mapState,
    pickupDisplayText,
    destinationDisplayText,
    isSearchExpanded,
    searchQuery,
    searchResults,
    availableProducts,
    selectedProduct,
    expandSearch,
    collapseSearch,
    updateSearchQuery,
    selectDestinationSuggestion,
    initializeRideBooking,
    selectProduct,
    confirmRide,
    routeSummaryText,
    etaBadgeText,
    rideStatus,
    startRide,
  } = useRideBooking();

  useEffect(() => {
    initializeRideBooking();
  }, [initializeRideBooking]);

  const initialRegion = useMemo(() => {
    return {
      latitude: mapState.userCoordinate?.latitude ?? 55.7033,
      longitude: mapState.userCoordinate?.longitude ?? 21.1443,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [mapState.userCoordinate]);

  const routeCoords =
    rideDraft.route?.polyline?.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })) ?? [];

  useEffect(() => {
    if (!mapRef.current || routeCoords.length === 0) return;

    mapRef.current.fitToCoordinates(routeCoords, {
      edgePadding: {
        top: 140,
        right: 40,
        bottom: 320,
        left: 40,
      },
      animated: true,
    });
  }, [routeCoords]);

  const shouldShowPreviewCard =
    rideStatus === "idle" &&
    !!rideDraft.destination &&
    availableProducts.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {mapState.pickupCoordinate && (
            <Marker
              coordinate={mapState.pickupCoordinate}
              title="Pickup"
              pinColor="green"
            />
          )}

          {mapState.destinationCoordinate && (
            <Marker
              coordinate={mapState.destinationCoordinate}
              title="Destination"
              pinColor="red"
            />
          )}

          {mapState.driverCoordinate && (
            <Marker coordinate={mapState.driverCoordinate} title="Driver">
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerText}>🚗</Text>
              </View>
            </Marker>
          )}

          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeWidth={6}
              strokeColor="#2563eb"
            />
          )}
        </MapView>

        <View style={styles.searchWrap}>
          <FloatingSearchBar
            pickupText={pickupDisplayText}
            destinationText={destinationDisplayText}
            onPress={expandSearch}
          />
        </View>

        {isSearchExpanded && (
          <SearchResultsSheet
            query={searchQuery}
            onChangeQuery={updateSearchQuery}
            results={searchResults}
            onSelect={selectDestinationSuggestion}
            onClose={collapseSearch}
          />
        )}

        <RoutePreviewCard
  visible={shouldShowPreviewCard}
  destinationText={destinationDisplayText}
  routeSummary={routeSummaryText}
  etaText={etaBadgeText}
  products={availableProducts}
  selectedProductId={selectedProduct?.id}
  onSelectProduct={selectProduct}
  onConfirm={confirmRide}
/>

        {rideStatus === "driver_arriving" && (
          <View style={styles.statusCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>LIVE</Text>
            </View>
            <Text style={styles.statusTitle}>Driver is arriving</Text>
            <Text style={styles.statusSubtitle}>Be ready outside</Text>
          </View>
        )}

        {rideStatus === "driver_arrived" && (
          <View style={styles.statusCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>ARRIVED</Text>
            </View>
            <Text style={styles.statusTitle}>Driver has arrived</Text>
            <Text style={styles.statusSubtitle}>You can start the ride now</Text>

            <Pressable style={styles.primaryButton} onPress={startRide}>
              <Text style={styles.primaryButtonText}>Start ride</Text>
            </Pressable>
          </View>
        )}

        {rideStatus === "ride_started" && (
          <View style={styles.statusCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>ON TRIP</Text>
            </View>
            <Text style={styles.statusTitle}>Ride started</Text>
            <Text style={styles.statusSubtitle}>On the way to destination</Text>
          </View>
        )}

        {rideStatus === "ride_completed" && (
          <View style={styles.statusCard}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>DONE</Text>
            </View>
            <Text style={styles.statusTitle}>Ride completed</Text>
            <Text style={styles.statusSubtitle}>Thanks for riding</Text>

            <Pressable
              style={styles.primaryButton}
              onPress={initializeRideBooking}
            >
              <Text style={styles.primaryButtonText}>Book again</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  screen: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  driverMarker: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  driverMarkerText: {
    fontSize: 18,
  },
  statusCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4338CA",
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    color: "#111827",
  },
  statusSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});