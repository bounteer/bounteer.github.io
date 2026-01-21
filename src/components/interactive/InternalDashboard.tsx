import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { MapPin, ChevronRight, FileText, Clock, Calendar, Infinity, TrendingUp } from 'lucide-react';
import { fetchHiringIntentByLocation } from '@/client_side/fetch/hiring_intent_count';
import { fetchArticlesBySource } from '@/client_side/fetch/article_source_count';
import { fetchHiringIntentBySource } from '@/client_side/fetch/hiring_intent_source_count';

export function InternalDashboard() {

  const [hiringIntentByLocation, setHiringIntentByLocation] = useState<Array<{
    country: string;
    total: number;
    cities: Array<{ name: string; count: number }>;
  }>>([]);

  // Separate state for each time period
  const [articles24h, setArticles24h] = useState<Array<{ source: string; count: number }>>([]);
  const [articles7d, setArticles7d] = useState<Array<{ source: string; count: number }>>([]);
  const [articlesTotal, setArticlesTotal] = useState<Array<{ source: string; count: number }>>([]);

  // Hiring intent by source state
  const [hiringIntent24h, setHiringIntent24h] = useState<Array<{ source: string; count: number }>>([]);
  const [hiringIntent7d, setHiringIntent7d] = useState<Array<{ source: string; count: number }>>([]);
  const [hiringIntentTotal, setHiringIntentTotal] = useState<Array<{ source: string; count: number }>>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [isLoadingHiringIntent, setIsLoadingHiringIntent] = useState(true);
  const [hiringIntentError, setHiringIntentError] = useState<string | null>(null);

  // Fetch hiring intent data directly from Directus (client-side)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[InternalDashboard] Fetching hiring intent data from Directus...');

        const startTime = performance.now();

        const result = await fetchHiringIntentByLocation();

        const endTime = performance.now();
        console.log(`[InternalDashboard] Fetch time: ${(endTime - startTime).toFixed(2)}ms`);
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

    fetchData();

    // Optional: Add periodic refresh to keep data fresh
    // const refreshInterval = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 minutes
    // return () => clearInterval(refreshInterval);
  }, []);

  // Fetch article source data for all time periods
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingArticles(true);
        setArticlesError(null);
        console.log('[InternalDashboard] Fetching article source data from Directus...');

        const startTime = performance.now();

        // Fetch all three time periods in parallel
        const [result24h, result7d, resultTotal] = await Promise.all([
          fetchArticlesBySource('24h'),
          fetchArticlesBySource('7d'),
          fetchArticlesBySource('total')
        ]);

        const endTime = performance.now();
        console.log(`[InternalDashboard] Article fetch time: ${(endTime - startTime).toFixed(2)}ms`);

        // Handle 24h results
        if (result24h.success && result24h.data) {
          setArticles24h(result24h.data);
          console.log(`[InternalDashboard] Loaded ${result24h.data.length} sources (24h) with ${result24h.total} total articles`);
        }

        // Handle 7d results
        if (result7d.success && result7d.data) {
          setArticles7d(result7d.data);
          console.log(`[InternalDashboard] Loaded ${result7d.data.length} sources (7d) with ${result7d.total} total articles`);
        }

        // Handle total results
        if (resultTotal.success && resultTotal.data) {
          setArticlesTotal(resultTotal.data);
          console.log(`[InternalDashboard] Loaded ${resultTotal.data.length} sources (total) with ${resultTotal.total} total articles`);
        }

        // If any failed, show error
        if (result24h.error || result7d.error || resultTotal.error) {
          throw new Error(result24h.error || result7d.error || resultTotal.error);
        }
      } catch (err) {
        console.error('Error fetching article source data:', err);
        setArticlesError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingArticles(false);
      }
    };

    fetchData();
  }, []);

  // Fetch hiring intent by source data for all time periods
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingHiringIntent(true);
        setHiringIntentError(null);
        console.log('[InternalDashboard] Fetching hiring intent by source data from Directus...');

        const startTime = performance.now();

        // Fetch all three time periods in parallel
        const [result24h, result7d, resultTotal] = await Promise.all([
          fetchHiringIntentBySource('24h'),
          fetchHiringIntentBySource('7d'),
          fetchHiringIntentBySource('total')
        ]);

        const endTime = performance.now();
        console.log(`[InternalDashboard] Hiring intent by source fetch time: ${(endTime - startTime).toFixed(2)}ms`);

        // Handle 24h results
        if (result24h.success && result24h.data) {
          setHiringIntent24h(result24h.data);
          console.log(`[InternalDashboard] Loaded ${result24h.data.length} sources (24h) with ${result24h.total} total hiring intents`);
        }

        // Handle 7d results
        if (result7d.success && result7d.data) {
          setHiringIntent7d(result7d.data);
          console.log(`[InternalDashboard] Loaded ${result7d.data.length} sources (7d) with ${result7d.total} total hiring intents`);
        }

        // Handle total results
        if (resultTotal.success && resultTotal.data) {
          setHiringIntentTotal(resultTotal.data);
          console.log(`[InternalDashboard] Loaded ${resultTotal.data.length} sources (total) with ${resultTotal.total} total hiring intents`);
        }

        // If any failed, show error
        if (result24h.error || result7d.error || resultTotal.error) {
          throw new Error(result24h.error || result7d.error || resultTotal.error);
        }
      } catch (err) {
        console.error('Error fetching hiring intent by source data:', err);
        setHiringIntentError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingHiringIntent(false);
      }
    };

    fetchData();
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

      {/* Two-column grid for source tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Article by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ingested Article by Source
            </CardTitle>
            <CardDescription>Number of ingested articles per source across different time periods</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingArticles ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading article source data...
              </div>
            ) : articlesError ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                Error: {articlesError}
              </div>
            ) : articlesTotal.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No article data available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        Last 24h
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3 w-3" />
                        Last 7d
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Infinity className="h-3 w-3" />
                        Total
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articlesTotal.map((totalSource, index) => {
                    const source24h = articles24h.find(s => s.source === totalSource.source);
                    const source7d = articles7d.find(s => s.source === totalSource.source);

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{totalSource.source}</TableCell>
                        <TableCell className="text-right">
                          {source24h ? (
                            <Badge variant="outline">{source24h.count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {source7d ? (
                            <Badge variant="outline">{source7d.count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{totalSource.count}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Hiring Intent by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Hiring Intent by Source
            </CardTitle>
            <CardDescription>Number of hiring intents per source across different time periods</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHiringIntent ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading hiring intent source data...
              </div>
            ) : hiringIntentError ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                Error: {hiringIntentError}
              </div>
            ) : hiringIntentTotal.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No hiring intent data available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        Last 24h
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="h-3 w-3" />
                        Last 7d
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Infinity className="h-3 w-3" />
                        Total
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hiringIntentTotal.map((totalSource, index) => {
                    const source24h = hiringIntent24h.find(s => s.source === totalSource.source);
                    const source7d = hiringIntent7d.find(s => s.source === totalSource.source);

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{totalSource.source}</TableCell>
                        <TableCell className="text-right">
                          {source24h ? (
                            <Badge variant="outline">{source24h.count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {source7d ? (
                            <Badge variant="outline">{source7d.count}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{totalSource.count}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
