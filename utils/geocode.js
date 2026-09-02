const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

//created lazily so this file can be required even when MAP_TOKEN is missing
let client = null;
function getClient() {
  if (!process.env.MAP_TOKEN) return null;
  if (!client) {
    client = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });
  }
  return client;
}

/**
 * Turn a turf area into a GeoJSON Point.
 * "Gokul Road" -> { type: "Point", coordinates: [75.12437, 15.351252] }
 *
 * The area alone is ambiguous - there is a Gokul Road in plenty of places - so the
 * city, state and country are appended to pin it to Hubballi.
 *
 * Returns null on any failure. The caller saves the turf anyway: a map pin is worth
 * less than the listing itself, so a Mapbox outage must not block creating a turf.
 */
module.exports.geocodeArea = async (area) => {
  const geocoder = getClient();
  if (!geocoder || !area) return null;

  try {
    const res = await geocoder.forwardGeocode({
      query: `${area}, Hubballi, Karnataka, India`,
      limit: 1
    }).send();

    const feature = res.body.features && res.body.features[0];
    if (!feature) return null;

    //Mapbox returns [longitude, latitude] - GeoJSON order, not the usual "lat, lng"
    return { type: "Point", coordinates: feature.geometry.coordinates };
  } catch (e) {
    console.log("Geocoding failed for '" + area + "':", e.message);
    return null;
  }
};
