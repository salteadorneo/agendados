import { provinceFromName } from "@/utils";

export interface GeolocationCache {
	at: number;
	latitude: number;
	longitude: number;
	country: string | null;
	province: string | null;
}

// La deteccion se cachea para no volver a pedir el permiso ni a llamar al
// servicio de geocodificacion en cada visita.
const STORAGE_KEY = "geolocation";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
// Una deteccion sin provincia (fuera de Espana, error en el geocodificacion)
// se descarta antes para no dejar el permiso caducado para siempre.
const CACHE_TTL_WITHOUT_PROVINCE = 3 * 24 * 60 * 60 * 1000;

// Evento con el que se avisa a la pagina de la provincia detectada.
export const GEOLOCATION_EVENT = "agendados:geolocation";

type AdminPlace = {
	name: string;
	adminLevel: number;
	isoCode?: string;
};

const readCache = (): GeolocationCache | null => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;

		const cached = JSON.parse(raw) as GeolocationCache;
		const ttl = cached.province ? CACHE_TTL : CACHE_TTL_WITHOUT_PROVINCE;
		if (Date.now() - cached.at > ttl) {
			localStorage.removeItem(STORAGE_KEY);
			return null;
		}
		return cached;
	} catch {
		return null;
	}
};

const writeCache = (value: GeolocationCache) => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	} catch {
		// localStorage puede estar bloqueado, seguimos sin cache.
	}
};

/**
 * Provincia de una deteccion cacheada en una visita anterior, o null si la
 * cache no existe, ha caducado o no trae provincia.
 */
export const cachedProvince = (): string | null => readCache()?.province ?? null;

/**
 * Provincia del visitante, geolocalizando si hace falta. Es idempotente: si
 * ya hay una deteccion en cache se limita a devolverla. Notifica el resultado
 * con el evento GEOLOCATION_EVENT.
 */
export const detectProvince = (): Promise<string | null> => {
	const cached = readCache();
	if (cached) {
		notify(cached);
		return Promise.resolve(cached.province);
	}

	if (!("geolocation" in navigator)) {
		console.log("[geolocation] no disponible en este navegador");
		return Promise.resolve(null);
	}

	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			async ({ coords }) => {
				const result: GeolocationCache = {
					at: Date.now(),
					latitude: coords.latitude,
					longitude: coords.longitude,
					country: null,
					province: null,
				};

				try {
					// BigDataCloud resuelve gratis y sin clave.
					const url = new URL(
						"https://api.bigdatacloud.net/data/reverse-geocode-client",
					);
					url.searchParams.set("latitude", String(coords.latitude));
					url.searchParams.set("longitude", String(coords.longitude));
					url.searchParams.set("localityLanguage", "es");

					const response = await fetch(url);
					if (!response.ok) {
						throw new Error(`reverse-geocode ${response.status}`);
					}

					const data = await response.json();
					result.country = data.countryCode ?? null;
					result.province = provinceFromAdmin(
						data.localityInfo?.administrative ?? [],
					);
				} catch (error) {
					console.log("[geolocation] reverse geocode fallo", error);
				}

				writeCache(result);
				notify(result);
				resolve(result.province);
			},
			(error) => {
				console.log(`[geolocation] permiso denegado: ${error.message}`);
				resolve(null);
			},
			{ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
		);
	});
};

const notify = ({
	latitude,
	longitude,
	country,
	province,
}: GeolocationCache) => {
	window.dispatchEvent(
		new CustomEvent(GEOLOCATION_EVENT, { detail: { country, province } }),
	);

	if (country === "ES" && province) {
		console.log(`[geolocation] Espana: ${province}`, { latitude, longitude });
		return;
	}

	console.log(`[geolocation] fuera de Espana (${country ?? "desconocido"})`, {
		latitude,
		longitude,
	});
};

// El servicio devuelve la localidad y su jerarquia administrativa.
// La provincia es el nivel 6, pero Ceuta, Melilla, Baleares y La Rioja
// solo aparecen en niveles superiores, asi que se busca tambien ahi.
const provinceFromAdmin = (places: AdminPlace[]): string | null => {
	const candidates = places.filter((place) => place.adminLevel <= 6);

	const withIsoCode = candidates.filter(
		(place) => place.isoCode?.startsWith("ES-") ?? false,
	);

	for (const place of [
		...withIsoCode.filter((place) => place.adminLevel === 6),
		...withIsoCode,
		...candidates,
	]) {
		const province = provinceFromName(place.name);
		if (province) return province;
	}

	return null;
};
