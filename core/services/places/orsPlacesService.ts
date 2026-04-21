const ORS_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;

export type PlaceResult = {
  id: string;
  title: string;
  subtitle: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query || query.length < 3) return [];

  try {
    const res = await fetch(
      `https://api.openrouteservice.org/geocode/autocomplete?api_key=${ORS_KEY}&text=${encodeURIComponent(
        query
      )}&boundary.country=LT`
    );

    const data = await res.json();

    return (
      data.features?.map((f: any) => ({
        id: f.properties.id,
        title: f.properties.name,
        subtitle: f.properties.label,
        coordinate: {
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
        },
      })) || []
    );
  } catch (e) {
    console.log("ORS search error", e);
    return [];
  }
}