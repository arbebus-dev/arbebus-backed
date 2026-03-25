import React, { useEffect, useRef, useState } from "react"
import {
  Animated, Image, Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"

let MapView: any
let Marker: any
let Polyline: any

if (Platform.OS !== "web") {
  const maps = require("react-native-maps")
  MapView = maps.default
  Marker = maps.Marker
  Polyline = maps.Polyline
}

type RoutePoint = {
  latitude: number
  longitude: number
}

type StopPoint = {
  id: string
  name: string
  latitude: number
  longitude: number
  routes: string[]
}

type LiveBus = {
  id: string
  number: string
  coordinate: {
    latitude: number
    longitude: number
    latitudeDelta?: number
    longitudeDelta?: number
  }
  route: RoutePoint[]
  routeIndex: number
  direction: 1 | -1
  targetIndex: number
}

const BUS_ROUTES = {
  "10": [
    { latitude: 55.7033, longitude: 21.1443 },
    { latitude: 55.703, longitude: 21.145 },
    { latitude: 55.7027, longitude: 21.1458 },
    { latitude: 55.7024, longitude: 21.1466 },
    { latitude: 55.702, longitude: 21.1474 },
    { latitude: 55.7016, longitude: 21.1482 },
    { latitude: 55.7012, longitude: 21.149 },
    { latitude: 55.7008, longitude: 21.1498 },
    { latitude: 55.7004, longitude: 21.1506 },
    { latitude: 55.7, longitude: 21.1514 },
    { latitude: 55.6996, longitude: 21.1522 },
    { latitude: 55.6992, longitude: 21.153 },
    { latitude: 55.6988, longitude: 21.1538 },
    { latitude: 55.6984, longitude: 21.1546 },
    { latitude: 55.698, longitude: 21.1554 },
    { latitude: 55.6977, longitude: 21.1561 },
    { latitude: 55.6974, longitude: 21.1568 },
    { latitude: 55.6971, longitude: 21.1575 },
  ],

  "8": [
    { latitude: 55.7005, longitude: 21.149 },
    { latitude: 55.7003, longitude: 21.1481 },
    { latitude: 55.7001, longitude: 21.1472 },
    { latitude: 55.6999, longitude: 21.1463 },
    { latitude: 55.6997, longitude: 21.1454 },
    { latitude: 55.6995, longitude: 21.1445 },
    { latitude: 55.6993, longitude: 21.1436 },
    { latitude: 55.6991, longitude: 21.1427 },
    { latitude: 55.6989, longitude: 21.1418 },
    { latitude: 55.6987, longitude: 21.1409 },
    { latitude: 55.6985, longitude: 21.14 },
    { latitude: 55.6983, longitude: 21.1391 },
    { latitude: 55.6981, longitude: 21.1382 },
    { latitude: 55.6979, longitude: 21.1373 },
    { latitude: 55.6977, longitude: 21.1364 },
    { latitude: 55.6975, longitude: 21.1355 },
    { latitude: 55.6973, longitude: 21.1346 },
    { latitude: 55.6971, longitude: 21.1337 },
  ],

  "15": [
    { latitude: 55.698, longitude: 21.155 },
    { latitude: 55.6979, longitude: 21.156 },
    { latitude: 55.6978, longitude: 21.157 },
    { latitude: 55.6977, longitude: 21.158 },
    { latitude: 55.6976, longitude: 21.159 },
    { latitude: 55.6975, longitude: 21.16 },
    { latitude: 55.6974, longitude: 21.161 },
    { latitude: 55.6973, longitude: 21.162 },
    { latitude: 55.6972, longitude: 21.163 },
    { latitude: 55.6971, longitude: 21.164 },
    { latitude: 55.697, longitude: 21.165 },
    { latitude: 55.6969, longitude: 21.166 },
    { latitude: 55.6968, longitude: 21.167 },
    { latitude: 55.6967, longitude: 21.168 },
    { latitude: 55.6966, longitude: 21.169 },
    { latitude: 55.6965, longitude: 21.17 },
    { latitude: 55.6964, longitude: 21.171 },
    { latitude: 55.6963, longitude: 21.172 },
  ],
}

const BUS_STOPS: StopPoint[] = [
  {
    id: "stop-1",
    name: "Klaipėdos centras",
    latitude: 55.7033,
    longitude: 21.1443,
    routes: ["10"],
  },
  {
    id: "stop-2",
    name: "Vėtrungė",
    latitude: 55.6992,
    longitude: 21.153,
    routes: ["10", "15"],
  },
  {
    id: "stop-3",
    name: "Kauno st.",
    latitude: 55.7005,
    longitude: 21.149,
    routes: ["8"],
  },
  {
    id: "stop-4",
    name: "Taikos pr.",
    latitude: 55.6987,
    longitude: 21.1409,
    routes: ["8"],
  },
  {
    id: "stop-5",
    name: "Paryžiaus Komunos",
    latitude: 55.6974,
    longitude: 21.161,
    routes: ["15"],
  },
  {
    id: "stop-6",
    name: "Arena",
    latitude: 55.6968,
    longitude: 21.167,
    routes: ["15"],
  },
]

const PLACES = [
  { name: "Akropolis", lat: 55.6928, lng: 21.1632 },
  { name: "Studlendas", lat: 55.718, lng: 21.117 },
  { name: "Klaipėdos centras", lat: 55.7033, lng: 21.1443 },
  { name: "Vėtrungė", lat: 55.699, lng: 21.148 },
  { name: "Smiltynė", lat: 55.706, lng: 21.098 },
]

function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const R = 6371e3

  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const deltaPhi = toRad(lat2 - lat1)
  const deltaLambda = toRad(lon2 - lon1)

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function getNearestStopForBus(bus: LiveBus, stops: StopPoint[]) {
  const relevantStops = stops.filter((stop) => stop.routes.includes(bus.number))
  if (relevantStops.length === 0) return null

  let nearestStop = relevantStops[0]
  let nearestDistance = getDistanceMeters(
    bus.coordinate.latitude,
    bus.coordinate.longitude,
    nearestStop.latitude,
    nearestStop.longitude
  )

  for (const stop of relevantStops) {
    const distance = getDistanceMeters(
      bus.coordinate.latitude,
      bus.coordinate.longitude,
      stop.latitude,
      stop.longitude
    )

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestStop = stop
    }
  }

  return {
    stop: nearestStop,
    distanceMeters: nearestDistance,
  }
}

function moveTowards(
  current: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number },
  step = 0.00012
) {
  const latDiff = target.latitude - current.latitude
  const lngDiff = target.longitude - current.longitude
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

  if (distance <= step) {
    return {
      latitude: target.latitude,
      longitude: target.longitude,
      reached: true,
    }
  }

  return {
    latitude: current.latitude + (latDiff / distance) * step,
    longitude: current.longitude + (lngDiff / distance) * step,
    reached: false,
  }
}

function getArrivalsForStop(stop: StopPoint, buses: LiveBus[]) {
  const relevantBuses = buses.filter((bus) => stop.routes.includes(bus.number))
  const BUS_SPEED_MPS = 7

  return relevantBuses
    .map((bus) => {
      const distanceMeters = getDistanceMeters(
        bus.coordinate.latitude,
        bus.coordinate.longitude,
        stop.latitude,
        stop.longitude
      )

      const etaMin = Math.max(1, Math.round(distanceMeters / BUS_SPEED_MPS / 60))

      return {
        busNumber: bus.number,
        etaMin,
        distanceMeters: Math.round(distanceMeters),
      }
    })
    .sort((a, b) => a.etaMin - b.etaMin)
}

export default function HomeScreen() {
  const mapRef = useRef<any>(null)
  const translateY = useRef(new Animated.Value(0)).current

  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null)
  const [isFollowingBus, setIsFollowingBus] = useState(false)
  useEffect(() => {
  if (!selectedBus || !isFollowingBus) return

  const timeout = setTimeout(() => {
    mapRef.current?.animateToRegion({
      latitude: selectedBus.coordinate.latitude,
      longitude: selectedBus.coordinate.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    })
  }, 300)

  return () => clearTimeout(timeout)
}, [
  selectedBus?.coordinate.latitude,
  selectedBus?.coordinate.longitude,
  isFollowingBus,
])
  const [location, setLocation] = useState<any>(null)
  const [routeOptions, setRouteOptions] = useState<any[]>([])
  const [searchText, setSearchText] = useState("")
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [destination, setDestination] = useState<any>(null)
  const [bestRoute, setBestRoute] = useState<any>(null)
  const [selectedStop, setSelectedStop] = useState<StopPoint | null>(null)
  const [busEtas, setBusEtas] = useState<
    {
      busNumber: string
      stopName: string
      etaMin: number
      distanceMeters: number
    }[]
  >([])
  const [selectedTransport, setSelectedTransport] = useState("Smart Route")
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([])
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy)
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100) {
          Animated.spring(translateY, {
            toValue: 220,
            useNativeDriver: true,
          }).start()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  useEffect(() => {
  const fetchLiveBuses = async () => {
    try {
      const res = await fetch("http://192.168.0.73:3000/live-buses")
      const data = await res.json()

      console.log("RAW DATA:", data)
      console.log("DATA LENGTH:", data?.length)

      const normalized = data.map((bus: any) => ({
        id: bus.id,
        number: bus.number,
        coordinate: {
          latitude: bus.latitude,
          longitude: bus.longitude,
        },
      }))

      console.log("NORMALIZED:", normalized)

      setLiveBuses(normalized)
    } catch (e) {
      console.log("❌ GPS error", e)
    }
  }

  fetchLiveBuses()
  const interval = setInterval(fetchLiveBuses, 7000)

  return () => clearInterval(interval)
}, [])

  useEffect(() => {
    const BUS_SPEED_MPS = 7

    const etaData = liveBuses
      .map((bus) => {
        const nearest = getNearestStopForBus(bus, BUS_STOPS)
        if (!nearest) return null

        const etaMin = Math.max(
          1,
          Math.round(nearest.distanceMeters / BUS_SPEED_MPS / 60)
        )

        return {
          busNumber: bus.number,
          stopName: nearest.stop.name,
          etaMin,
          distanceMeters: Math.round(nearest.distanceMeters),
        }
      })
      .filter(Boolean) as {
      busNumber: string
      stopName: string
      etaMin: number
      distanceMeters: number
    }[]

    setBusEtas(etaData)
  }, [liveBuses])

  useEffect(() => {
    if (!selectedBus) return

    const updatedBus = liveBuses.find((bus) => bus.id === selectedBus.id)
    if (updatedBus) {
      setSelectedBus(updatedBus)
    }
  }, [liveBuses, selectedBus])

  useEffect(() => {
    if (!destination) return

    mapRef.current?.animateToRegion({
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    })
  }, [destination])

  useEffect(() => {
    if (!location || !destination) return

    const distanceMeters = getDistanceMeters(
      location.latitude,
      location.longitude,
      destination.latitude,
      destination.longitude
    )

    const taxiPrice = Math.max(4, Math.round((distanceMeters / 1000) * 1.8))
    const taxiEta = Math.max(3, Math.round(distanceMeters / 500))
    const busEta = Math.max(5, Math.round(distanceMeters / 350))
    const scooterEta = Math.max(2, Math.round(distanceMeters / 450))

    const options = [
      {
        type: "Taxi",
        eta: taxiEta,
        price: taxiPrice,
        subtitle: "Greičiausias variantas",
      },
      {
        type: "Bus",
        eta: busEta,
        price: 1,
        subtitle: "Viešasis transportas",
      },
      {
        type: "Scooter",
        eta: scooterEta,
        price: 3,
        subtitle: "Ekologiškas pasirinkimas",
      },
    ]

    setRouteOptions(options)

    const best = [...options].sort((a, b) => a.eta - b.eta)[0]
    setBestRoute(best)
  }, [location, destination])

  const getRouteColor = () => {
    if (selectedTransport === "Taxi") return "#facc15"
    if (selectedTransport === "Bus") return "#22c55e"
    if (selectedTransport === "Scooter") return "#06b6d4"
    return "#2563eb"
  }

  const activeOption =
    selectedTransport === "Smart Route"
      ? bestRoute
      : routeOptions.find((item) => item.type === selectedTransport)

  const primaryBusEta =
    busEtas.find((item) => item.busNumber === "10") || busEtas[0] || null

  function getBusStatus(
    busNumber: string,
    busEtaList: {
      busNumber: string
      stopName: string
      etaMin: number
      distanceMeters: number
    }[]
  ) {
    const eta = busEtaList.find((item) => item.busNumber === busNumber)

    if (!eta) return "normal"
    if (eta.etaMin <= 1) return "arriving"
    if (eta.etaMin <= 2) return "approaching"
    return "normal"
  }

  function getBusStatusLabel(status: string) {
    switch (status) {
      case "arriving":
        return "Atvyksta"
      case "approaching":
        return "Artėja"
      default:
        return "Kelyje"
    }
  }

  const selectedStopArrivals = selectedStop
    ? getArrivalsForStop(selectedStop, liveBuses)
    : []

  const selectedBusNearestStop = selectedBus
    ? getNearestStopForBus(selectedBus, BUS_STOPS)
    : null

  const selectedBusEta = selectedBusNearestStop
    ? Math.max(1, Math.round(selectedBusNearestStop.distanceMeters / 7 / 60))
    : null

  const selectedBusStatus = selectedBus
    ? getBusStatus(selectedBus.number, busEtas)
    : "normal"

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: 55.7033,
          longitude: 21.1443,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        onPress={() => {
          setSelectedStop(null)
          setSelectedBus(null)
        }}
      >
        {location && destination && (
          <Polyline
            coordinates={[
              {
                latitude: location.latitude,
                longitude: location.longitude,
              },
              {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            ]}
            strokeColor={getRouteColor()}
            strokeWidth={5}
          />
        )}

        {(selectedTransport === "Bus" ||
          selectedTransport === "Smart Route") &&
          BUS_STOPS.map((stop) => {
            const arrivingHere = liveBuses.some((bus) => {
              if (!stop.routes.includes(bus.number)) return false

              const distanceMeters = getDistanceMeters(
                bus.coordinate.latitude,
                bus.coordinate.longitude,
                stop.latitude,
                stop.longitude
              )

              const etaMin = Math.max(1, Math.round(distanceMeters / 7 / 60))
              return etaMin <= 1
            })

            return (
              <Marker
                key={stop.id}
                coordinate={{
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                }}
                title={stop.name}
                description={`Routes: ${stop.routes.join(", ")}`}
                onPress={() => {
                  setSelectedStop(stop)
                  setSelectedBus(null)
                }}
              >
                <View
                  style={[
                    styles.stopMarker,
                    selectedStop?.id === stop.id && styles.stopMarkerActive,
                    arrivingHere && styles.stopArriving,
                  ]}
                >
                  <Text style={styles.stopMarkerText}>🚏</Text>
                </View>
              </Marker>
            )
          })}

        {liveBuses.map((bus) => {
          const busStatus = getBusStatus(bus.number, busEtas)

          return (
            <Marker
              key={bus.id}
              coordinate={{
                latitude: bus.coordinate.latitude,
                longitude: bus.coordinate.longitude,
              }}
              onPress={() => {
                setSelectedBus(bus)
                setSelectedStop(null)
                setIsFollowingBus(true)
                mapRef.current?.animateToRegion({
                  latitude: bus.coordinate.latitude,
                  longitude: bus.coordinate.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                })
              }}

            >
              <View
                style={[
                  styles.busPill,
                  busStatus === "approaching" && styles.busPillApproaching,
                  busStatus === "arriving" && styles.busPillArriving,
                  selectedBus?.id === bus.id && styles.busMarkerSelected,
                ]}
              >
                <Text style={styles.busPillText}>{bus.number}</Text>
              </View>
            </Marker>
          )
        })}
      </MapView>

     {selectedBus && (
  <View style={styles.selectedBusBox}>
    <View style={styles.selectedBusHeader}>
      <Text style={styles.selectedBusTitle}>
        Autobusas {selectedBus.number}
      </Text>
      <TouchableOpacity
        onPress={() => {
          setSelectedBus(null)
          setIsFollowingBus(false)
        }}
      >
        <Text style={styles.selectedBusClose}>✕</Text>
      </TouchableOpacity>
    </View>

    <Text style={styles.selectedBusText}>
      Artimiausia stotelė: {selectedBusNearestStop?.stop.name || "Nerasta"}
    </Text>

    <Text style={styles.selectedBusText}>
      ETA: {selectedBusEta ? `${selectedBusEta} min` : "—"}
    </Text>

    <Text style={styles.selectedBusText}>
      Statusas: {getBusStatusLabel(selectedBusStatus)}
    </Text>

    <Pressable
      style={styles.followBusButton}
      onPress={() => setIsFollowingBus((prev) => !prev)}
    >
      <Text style={styles.followBusButtonText}>
        {isFollowingBus ? "Nebesekti autobuso" : "Sekti autobusą"}
      </Text>
    </Pressable>
  </View>
)}

      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
         <Image
  source={require("../../assets/logo.png")}
  style={styles.logo}
/>

<Text style={styles.brandText}>Arbebus</Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔎</Text>

          <TextInput
            placeholder="Kur vyksite?"
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text)

              if (text.length > 1) {
                const filtered = PLACES.filter((place) =>
                  place.name.toLowerCase().includes(text.toLowerCase())
                )
                setSuggestions(filtered)
              } else {
                setSuggestions([])
              }
            }}
            style={styles.searchBarInput}
          />

          <Text style={styles.micIcon}>🎤</Text>
        </View>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((place, index) => (
            <Pressable
              key={index}
              onPress={() => {
                setDestination({
                  name: place.name,
                  latitude: place.lat,
                  longitude: place.lng,
                })
                setSearchText(place.name)
                setSuggestions([])
                Keyboard.dismiss()
              }}
              style={styles.suggestionItem}
            >
              <Text style={styles.suggestionText}>{place.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {destination && (
        <View style={styles.destinationBox}>
          <Text style={styles.infoTitle}>Kelionės tikslas</Text>
          <Text style={styles.infoName}>{destination.name}</Text>
        </View>
      )}

      <View style={styles.transportChipsRow}>
        <Pressable
          style={[
            styles.transportChip,
            selectedTransport === "Smart Route" && styles.transportChipActive,
          ]}
          onPress={() => setSelectedTransport("Smart Route")}
        >
          <Text style={styles.transportChipText}>🧭 Smart Route</Text>
        </Pressable>

        <Pressable
          style={[
            styles.transportChip,
            selectedTransport === "Bus" && styles.transportChipActive,
          ]}
          onPress={() => setSelectedTransport("Bus")}
        >
          <Text style={styles.transportChipText}>🚌 Bus</Text>
        </Pressable>

        <Pressable
          style={[
            styles.transportChip,
            selectedTransport === "Taxi" && styles.transportChipActive,
          ]}
          onPress={() => setSelectedTransport("Taxi")}
        >
          <Text style={styles.transportChipText}>🚕 Taxi</Text>
        </Pressable>

        <Pressable
          style={[
            styles.transportChip,
            selectedTransport === "Scooter" && styles.transportChipActive,
          ]}
          onPress={() => setSelectedTransport("Scooter")}
        >
          <Text style={styles.transportChipText}>🛴 Scooter</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.routesPanel, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.panelHandle} />
        <Text style={styles.routesTitle}>{selectedTransport}</Text>

        <View style={styles.routeCard}>
          {selectedTransport === "Smart Route" && !bestRoute && (
            <>
              <Text style={styles.routeTitle}>🧭 Smart Route</Text>
              <Text style={styles.routeSub}>
                Pasirink kelionės tikslą viršuje
              </Text>

              {primaryBusEta && (
                <Text style={styles.routeSub}>
                  🚌 Bus {primaryBusEta.busNumber} • {primaryBusEta.stopName} •{" "}
                  {primaryBusEta.etaMin} min
                </Text>
              )}
            </>
          )}

          {activeOption && (
            <>
              <Text style={styles.routeTitle}>
                {selectedTransport === "Smart Route"
                  ? "🔥 Geriausias pasirinkimas dabar"
                  : `${
                      selectedTransport === "Taxi"
                        ? "🚕"
                        : selectedTransport === "Bus"
                        ? "🚌"
                        : "🛴"
                    } ${activeOption.type}`}
              </Text>

              <Text style={styles.routeInfo}>
                {selectedTransport === "Smart Route" &&
                  activeOption.type === "Taxi" &&
                  "🚕 "}
                {selectedTransport === "Smart Route" &&
                  activeOption.type === "Bus" &&
                  "🚌 "}
                {selectedTransport === "Smart Route" &&
                  activeOption.type === "Scooter" &&
                  "🛴 "}
                {selectedTransport === "Smart Route" ? activeOption.type : ""}
              </Text>

              <Text style={styles.routeInfo}>
                {activeOption.eta} min • €{activeOption.price}
              </Text>

              <Text style={styles.routeSub}>{activeOption.subtitle}</Text>
            </>
          )}

          {selectedTransport === "Bus" && primaryBusEta && (
            <Text style={styles.routeSub}>
              🚌 Bus {primaryBusEta.busNumber} • {primaryBusEta.stopName} •{" "}
              {primaryBusEta.etaMin} min
            </Text>
          )}

          {selectedTransport === "Bus" &&
            busEtas
              .filter(
                (item, index, self) =>
                  index === self.findIndex((i) => i.busNumber === item.busNumber)
              )
              .map((item) => (
                <Text key={item.busNumber} style={styles.routeSub}>
                  🚌 {item.busNumber} • {item.stopName} • {item.etaMin} min
                </Text>
              ))}

          {selectedStop && (
            <View style={styles.stopInfoBox}>
              <Text style={styles.routeTitle}>🚏 {selectedStop.name}</Text>

              <Text style={styles.routeSub}>
                Maršrutai: {selectedStop.routes.join(", ")}
              </Text>

              {selectedStopArrivals.map((arrival) => (
                <Text key={arrival.busNumber} style={styles.routeSub}>
                  🚌 {arrival.busNumber} • {arrival.etaMin} min{" "}
                  {arrival.etaMin <= 1
                    ? "• Atvyksta"
                    : arrival.etaMin <= 2
                    ? "• Artėja"
                    : ""}
                </Text>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.orderButton}>
          <Text style={styles.orderButtonText}>Užsakyk</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  topHeader: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    zIndex: 30,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  brandLogo: {
    fontSize: 34,
    fontWeight: "900",
    color: "#38bdf8",
    marginRight: 8,
  },

  brandText: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
    flex: 1,
  },

  brandSideText: {
    color: "black",
    fontSize: 18,
    marginRight: 10,
  },

  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 20,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },

  searchBarInput: {
    flex: 1,
    color: "white",
    fontSize: 16,
  },

  micIcon: {
    fontSize: 18,
    marginLeft: 10,
  },

  suggestionsBox: {
    position: "absolute",
    top: 160,
    left: 16,
    right: 16,
    backgroundColor: "#0f172a",
    borderRadius: 16,
    zIndex: 50,
    padding: 8,
  },

  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  suggestionText: {
    color: "white",
  },

  destinationBox: {
    position: "absolute",
    top: 170,
    left: 16,
    right: 16,
    zIndex: 11,
    backgroundColor: "#111827",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  infoTitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 2,
  },

  infoName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },

  transportChipsRow: {
    position: "absolute",
    top: 265,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
  },

  transportChip: {
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },

  transportChipActive: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#38bdf8",
  },

  transportChipText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },

  routesPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 40,
    maxHeight: 420,
    minHeight: 260,
  },

  panelHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#475569",
    marginBottom: 12,
  },

  routesTitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "600",
  },

  routeCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },

  routeTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  routeInfo: {
    color: "white",
    fontSize: 14,
    marginTop: 4,
  },

  routeSub: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },

  orderButton: {
    marginTop: 10,
    backgroundColor: "#1d4ed8",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
logo: {
  width: 36,
  height: 34,
  borderRadius: 10,
  marginRight: 10,
},
  orderButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },

  busPill: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  busPillText: {
    color: "white",
    fontWeight: "700",
  },

  busPillApproaching: {
    backgroundColor: "#f59e0b",
    transform: [{ scale: 1.08 }],
  },

  busPillArriving: {
    backgroundColor: "#ef4444",
    transform: [{ scale: 1.15 }],
  },

  busMarkerSelected: {
    borderWidth: 2,
    borderColor: "#111",
    transform: [{ scale: 1.15 }],
  },

  stopMarker: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#1d4ed8",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  stopMarkerActive: {
    borderColor: "#22c55e",
    backgroundColor: "#bbf7d0",
    transform: [{ scale: 1.15 }],
  },

  stopArriving: {
    borderColor: "#ef4444",
    transform: [{ scale: 1.15 }],
  },

  stopMarkerText: {
    fontSize: 14,
  },

  stopInfoBox: {
    marginTop: 10,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },

  selectedBusBox: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 285,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 35,
  },

  selectedBusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  selectedBusTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },

  selectedBusClose: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
  },

  selectedBusText: {
    fontSize: 15,
    color: "#333",
    marginBottom: 6,
  },

  destinationMarker: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
  },

  destinationMarkerText: {
    color: "white",
    fontWeight: "700",
  },
  followBusButton: {
  marginTop: 10,
  backgroundColor: "#2563eb",
  paddingVertical: 10,
  borderRadius: 12,
  alignItems: "center",
},

followBusButtonText: {
  color: "white",
  fontSize: 14,
  fontWeight: "700",
},
})