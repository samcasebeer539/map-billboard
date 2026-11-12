// Place search with Photon (https://photon.komoot.io): free, no key, built on
// OpenStreetMap data and made for search-as-you-type. Please keep requests light
// (we debounce typing); for heavy use, self-host Photon or switch to a paid geocoder.

export type Place = {
  id: string;
  name: string;
  detail: string; // e.g. "Sacramento, California, United States"
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // west, south, east, north
  zoom: number; // used when there's no bbox
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    extent?: [number, number, number, number]; // west, north, east, south
  };
};

// How far to zoom for a result without a bounding box
const ZOOM_BY_TYPE: Record<string, number> = { country: 4, state: 6, county: 9, city: 12, district: 13, locality: 14 };

export async function searchPlaces(q: string, near: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lat", near.lat.toFixed(4)); // prefer results near the map
  url.searchParams.set("lon", near.lng.toFixed(4));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const { features } = (await res.json()) as { features: PhotonFeature[] };

  return features.map((f, i) => {
    const p = f.properties;
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const name = p.name || street || p.city || p.state || p.country || "Unnamed place";
    const detail = [p.name && street ? street : null, p.city, p.state, p.country]
      .filter((x): x is string => !!x && x !== name)
      .join(", ");
    const [lng, lat] = f.geometry.coordinates;
    const e = p.extent;
    return {
      id: `${p.osm_type ?? ""}${p.osm_id ?? i}`,
      name,
      detail,
      lat,
      lng,
      bbox: e ? [e[0], e[3], e[2], e[1]] : undefined,
      zoom: ZOOM_BY_TYPE[p.type ?? ""] ?? 16,
    };
  });
}
