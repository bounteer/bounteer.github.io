import type { APIRoute } from 'astro';
import { EXTERNAL } from '@/constant';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale for country names
countries.registerLocale(enLocale);

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Cache helper functions
function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedData(key: string, data: any, ttlMs: number = 5 * 60 * 1000): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Check cache first
    const cacheKey = 'hiring-intent-location-data';
    const cachedData = await getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('[hiring-intent-location] Returning cached data');
      return new Response(
        JSON.stringify(cachedData),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300', // 5 minutes cache
            'X-Cache': 'HIT',
          },
        }
      );
    }

    // Use Directus aggregation API for much more efficient query
    // Instead of fetching all records, we use aggregate endpoint
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
      limit: 500 // Increased limit for aggregation since we're getting grouped data
    };

    const queryString = new URLSearchParams({
      filter: JSON.stringify(aggregateQuery.filter),
      groupBy: JSON.stringify(aggregateQuery.groupBy),
      aggregate: JSON.stringify(aggregateQuery.aggregate),
      limit: aggregateQuery.limit.toString()
    }).toString();

    const url = `${aggregateUrl}?${queryString}`;

    console.log('[hiring-intent-location] Fetching aggregated data from:', url);

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
      
      console.log('[hiring-intent-location] Aggregation response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        const aggregatedResults = result.data || [];
        
        console.log('[hiring-intent-location] Processing aggregated results count:', aggregatedResults.length);

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
      console.log('[hiring-intent-location] Aggregation failed, falling back to original query');
      
      // Fallback to original query method
      const fallbackUrl = `${EXTERNAL.directus_url}/items/hiring_intent?fields=id,work_location.city,work_location.country_code&limit=1000`;
      
      const response = await fetch(fallbackUrl, { headers });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.error('[hiring-intent-location] Fallback query also failed:', errorText);
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

      console.log('[hiring-intent-location] Processing fallback data count:', hiringIntents.length);

      // Process the raw data (original method)
      hiringIntents.forEach((intent: any) => {
        const location = intent.work_location;
        if (!location || !location.country_code) {
          return; // Skip entries without country_code
        }

        const countryCode = location.country_code;
        const city = location.city || 'Not specified';

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
        totalRecords += 1;
      });
    }

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

    const response = {
      success: true,
      data: aggregatedData,
      total: totalRecords,
    };

    // Cache the result
    setCachedData(cacheKey, response, 5 * 60 * 1000); // 5 minutes

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // 5 minutes cache
          'X-Cache': 'MISS',
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
