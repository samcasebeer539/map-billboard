// Distances between posts, for the nearby feed

type LatLng = { lat: number; lng: number };

// Great-circle distance in km (haversine)
export function distanceKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// A lat/lng box reaching `km` from a point in every direction
export function boundsAround(p: LatLng, km: number) {
  const lat = km / 111.32;
  const lng = km / (111.32 * Math.max(0.01, Math.cos((p.lat * Math.PI) / 180)));
  return {
    west: Math.max(-180, p.lng - lng),
    east: Math.min(180, p.lng + lng),
    south: Math.max(-85, p.lat - lat),
    north: Math.min(85, p.lat + lat),
  };
}

// Miles and feet for US English, otherwise metric
const usesMiles = () => typeof navigator !== "undefined" && /-(US|LR|MM)$/i.test(navigator.language);

export function formatDistance(km: number) {
  if (usesMiles()) {
    const mi = km / 1.609344;
    if (mi < 0.1) return `${Math.max(50, Math.round((mi * 5280) / 50) * 50)} ft`;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export const formatRadius = (km: number) =>
  usesMiles() ? `${Math.round(km / 1.609344)} mi` : `${km} km`;
