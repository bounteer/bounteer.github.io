import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { MapPin, ChevronRight } from 'lucide-react';

export function InternalDashboard() {

  const [hiringIntentByLocation, setHiringIntentByLocation] = useState<Array<{
    country: string;
    total: number;
    cities: Array<{ name: string; count: number }>;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch hiring intent data from API
  useEffect(() => {
    const fetchHiringIntentData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[InternalDashboard] Fetching hiring intent data...');

        const startTime = performance.now();
        
        const response = await fetch('/api/hiring-intent-location', {
          credentials: 'include',
        });

        const endTime = performance.now();
        console.log(`[InternalDashboard] API response time: ${(endTime - startTime).toFixed(2)}ms`);
        console.log('[InternalDashboard] Response status:', response.status);

        // Check if response is from cache
        const fromCache = response.headers.get('X-Cache') === 'HIT';
        console.log('[InternalDashboard] From cache:', fromCache);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[InternalDashboard] Error response:', errorData);
          throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('[InternalDashboard] Result:', result);

        if (result.success && result.data) {
          setHiringIntentByLocation(result.data);
          console.log(`[InternalDashboard] Loaded ${result.data.length} countries with ${result.total} total records`);
        } else if (result.error) {
          throw new Error(result.error);
        }
      } catch (err) {
        console.error('Error fetching hiring intent data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHiringIntentData();

    // Optional: Add a refresh button functionality or periodic refresh
    // const refreshInterval = setInterval(fetchHiringIntentData, 5 * 60 * 1000); // Refresh every 5 minutes
    // return () => clearInterval(refreshInterval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Hiring Intent by Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Hiring Intent by Location
          </CardTitle>
          <CardDescription>Geographic breakdown of hiring signals</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading hiring intent data...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-red-500">
              Error: {error}
            </div>
          ) : hiringIntentByLocation.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No hiring intent data available
            </div>
          ) : (
            <div className="space-y-4">
              {hiringIntentByLocation.map((location, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between font-semibold text-base">
                  <span className="flex items-center gap-2">
                    {location.country}
                  </span>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {location.total}
                  </Badge>
                </div>
                <div className="ml-6 space-y-1.5">
                  {location.cities.map((city, cityIndex) => (
                    <div
                      key={cityIndex}
                      className="flex items-center justify-between text-sm text-muted-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <ChevronRight className="h-3 w-3" />
                        {city.name}
                      </span>
                      <span className="font-medium">({city.count})</span>
                    </div>
                  ))}
                </div>
                {index < hiringIntentByLocation.length - 1 && (
                  <div className="pt-2">
                    <div className="border-t border-gray-200" />
                  </div>
                )}
              </div>
            ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
