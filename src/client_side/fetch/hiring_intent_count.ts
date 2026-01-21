import { EXTERNAL } from '@/constant';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale for country names
countries.registerLocale(enLocale);

interface LocationData {
  country: string;
  country_code: string;
  total: number;
  cities: Array<{ name: string; count: number }>;
}

/**
 * Fetches hiring intent data directly from Directus CMS
 * This runs client-side to ensure fresh data on every page load
 */
export async function fetchHiringIntentByLocation(): Promise<{
  success: boolean;
  data: LocationData[];
  total: number;
  error?: string;
}> {
  try {
    // Use Directus aggregation API for efficient querying
    const aggregateUrl = `${EXTERNAL.directus_url}/items/hiring_intent/aggregate`;
    const aggregateQuery = {
      aggregate: {
        count: { count: '*' }
      },
      groupBy: ['work_location.country_code', 'work_location.city'],
      filter: {
        work_location: {
          country_code: { _nempty: true }
        }
      },
      limit: 500
    };

    const queryString = new URLSearchParams({
      filter: JSON.stringify(aggregateQuery.filter),
      groupBy: JSON.stringify(aggregateQuery.groupBy),
      aggregate: JSON.stringify(aggregateQuery.aggregate),
      limit: aggregateQuery.limit.toString()
    }).toString();

    const url = `${aggregateUrl}?${queryString}`;

    console.log('[hiring_intent_count] Fetching aggregated data from:', url);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${EXTERNAL.directus_key}`, // Use guest token for client-side
    };

    let locationMap: {
      [country: string]: {
        total: number;
        cities: { [city: string]: number };
      };
    } = {};

    let totalRecords = 0;

    try {
      // Try the optimized aggregation query first
      const response = await fetch(url, { headers });

      console.log('[hiring_intent_count] Aggregation response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        const aggregatedResults = result.data || [];

        console.log('[hiring_intent_count] Processing aggregated results count:', aggregatedResults.length);

        // Process aggregated results
        aggregatedResults.forEach((group: any) => {
          const countryCode = group.group[0];
          const city = group.group[1] || 'Not specified';
          const count = group.count.count;

          if (!countryCode) return;

          // Initialize country if not exists
          if (!locationMap[countryCode]) {
            locationMap[countryCode] = {
              total: 0,
              cities: {},
            };
          }

          // Increment counts
          locationMap[countryCode].total += count;
          locationMap[countryCode].cities[city] = (locationMap[countryCode].cities[city] || 0) + count;
          totalRecords += count;
        });

      } else {
        throw new Error('Aggregation query failed');
      }
    } catch (error) {
      console.log('[hiring_intent_count] Aggregation failed, falling back to original query');

      // Fallback to original query method
      const fallbackUrl = `${EXTERNAL.directus_url}/items/hiring_intent?fields=id,work_location.city,work_location.country_code&limit=1000`;

      const response = await fetch(fallbackUrl, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.error('[hiring_intent_count] Fallback query also failed:', errorText);
        throw new Error(`Failed to fetch hiring intent data: ${response.status}`);
      }

      const result = await response.json();
      const hiringIntents = result.data || [];

      console.log('[hiring_intent_count] Processing fallback data count:', hiringIntents.length);

      // Process the raw data
      hiringIntents.forEach((intent: any) => {
        const location = intent.work_location;
        if (!location || !location.country_code) {
          return;
        }

        const countryCode = location.country_code;
        const city = location.city || 'Not specified';

        if (!locationMap[countryCode]) {
          locationMap[countryCode] = {
            total: 0,
            cities: {},
          };
        }

        locationMap[countryCode].total += 1;
        locationMap[countryCode].cities[city] = (locationMap[countryCode].cities[city] || 0) + 1;
        totalRecords += 1;
      });
    }

    // Convert to array format with country names
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

    return {
      success: true,
      data: aggregatedData,
      total: totalRecords,
    };
  } catch (error) {
    console.error('[hiring_intent_count] Error fetching hiring intent data:', error);
    return {
      success: false,
      data: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
