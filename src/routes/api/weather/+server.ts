import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/api-error';

const cache = new Map<string, { data: WeatherData; expires: number }>();
const CACHE_TTL = 600_000; // 10 minutes

interface WeatherData {
	temperature: number;
	weatherCode: number;
	location: string;
	zipcode?: string;
	country?: string;
}

const WMO_CODES: Record<number, string> = {
	0: 'clear', 1: 'mainly-clear', 2: 'partly-cloudy', 3: 'overcast',
	45: 'fog', 48: 'fog',
	51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
	56: 'drizzle', 57: 'drizzle',
	61: 'rain', 63: 'rain', 65: 'rain',
	66: 'rain', 67: 'rain',
	71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
	80: 'showers', 81: 'showers', 82: 'showers',
	85: 'snow', 86: 'snow',
	95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm'
};

export const GET: RequestHandler = async ({ url }) => {
	const lat = url.searchParams.get('lat');
	const lon = url.searchParams.get('lon');

	if (!lat || !lon) {
		return apiError(400, 'errors.missingLatLon');
	}

	const cacheKey = `${lat},${lon}`;
	const cached = cache.get(cacheKey);
	if (cached && cached.expires > Date.now()) {
		return json(cached.data);
	}

	try {
		const res = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code`,
			{ signal: AbortSignal.timeout(5000) }
		);

		if (!res.ok) {
			return apiError(502, 'errors.weatherFailed');
		}

		const data = await res.json();
		const temperature = data.current?.temperature_2m ?? null;
		const weatherCode = data.current?.weather_code ?? 0;

		const result: WeatherData = {
			temperature,
			weatherCode,
			location: '',
		};

		cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
		return json(result);
	} catch {
		return apiError(503, 'errors.weatherUnavailable');
	}
};
