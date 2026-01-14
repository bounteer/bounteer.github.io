import type { APIRoute } from 'astro';
import { EXTERNAL } from '@/constant';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale for country names
countries.registerLocale(enLocale);

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Fetch hiring_intent data with work_location populated
    const url = `${EXTERNAL.directus_url}/items/hiring_intent?fields=id,work_location.city,work_location.country_code&limit=1000`;

    console.log('[hiring-intent-location] Fetching from:', url);

    // Build headers - try to use session cookie or fall back to guest token
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Try to get directus session token from cookies
    const directusToken = cookies.get('directus_session_token');
    if (directusToken) {
      // If we have a session cookie, pass it through
      headers['Cookie'] = `directus_session_token=${directusToken.value}`;
    } else {
      // Fall back to guest token
      headers['Authorization'] = `Bearer ${EXTERNAL.directus_key}`;
    }

    const response = await fetch(url, {
      headers,
    });

    console.log('[hiring-intent-location] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.error('[hiring-intent-location] Error response:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch hiring intent data',
          status: response.status,
          details: errorText
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const hiringIntents = result.data || [];

    console.log('[hiring-intent-location] Fetched hiring intents count:', hiringIntents.length);

    // Aggregate by country and city
    const locationMap: {
      [country: string]: {
        total: number;
        cities: { [city: string]: number };
      };
    } = {};

    hiringIntents.forEach((intent: any) => {
      const location = intent.work_location;
      if (!location || !location.country_code || !location.city) {
        return; // Skip entries without location data
      }

      const countryCode = location.country_code;
      const city = location.city;

      // Initialize country if not exists
      if (!locationMap[countryCode]) {
        locationMap[countryCode] = {
          total: 0,
          cities: {},
        };
      }

      // Increment counts
      locationMap[countryCode].total += 1;
      locationMap[countryCode].cities[city] = (locationMap[countryCode].cities[city] || 0) + 1;
    });

    // Convert to array format with country names using i18n-iso-countries library
    const aggregatedData = Object.entries(locationMap)
      .map(([countryCode, data]) => ({
        country: countries.getName(countryCode, 'en') || countryCode,
        country_code: countryCode,
        total: data.total,
        cities: Object.entries(data.cities)
          .map(([city, count]) => ({
            name: city,
            count,
          }))
          .sort((a, b) => b.count - a.count), // Sort cities by count descending
      }))
      .sort((a, b) => b.total - a.total); // Sort countries by total descending

    return new Response(
      JSON.stringify({
        success: true,
        data: aggregatedData,
        total: hiringIntents.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Error in hiring-intent-location API:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
