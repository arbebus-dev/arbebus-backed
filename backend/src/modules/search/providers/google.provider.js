const axios = require("axios");

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function searchGooglePlaces(query) {
  if (!GOOGLE_API_KEY) {
    console.warn("[google] API key missing");
    return [];
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;

    const response = await axios.get(url, {
      params: {
        query,
        key: GOOGLE_API_KEY,
        region: "lt",
        language: "lt",
      },
    });

    const results = response.data.results || [];

    return results.map((place) => ({
      name: place.name,
      address: place.formatted_address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      source: "google",
    }));
  } catch (error) {
    console.error("[google search error]", error.message);
    return [];
  }
}

module.exports = { searchGooglePlaces };
