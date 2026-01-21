import { EXTERNAL } from '@/constant';

interface ArticleSourceData {
  source: string;
  count: number;
}

type TimePeriod = '24h' | '7d' | 'total';

/**
 * Fetches ingested article counts by source directly from Directus CMS
 * This runs client-side to ensure fresh data on every page load
 * Uses aggregation API for efficient query-level counting
 *
 * @param period - Time period to filter: '24h' (last 24 hours), '7d' (last 7 days), 'total' (all time)
 */
export async function fetchArticlesBySource(period: TimePeriod = 'total'): Promise<{
  success: boolean;
  data: ArticleSourceData[];
  total: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${EXTERNAL.directus_key}`,
    };

    let sourceMap: { [source: string]: number } = {};
    let totalRecords = 0;

    // Build date filter based on period
    const now = new Date();
    let dateFilter: any = {};

    if (period === '24h') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      dateFilter = {
        date_created: { _gte: yesterday.toISOString() }
      };
    } else if (period === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = {
        date_created: { _gte: sevenDaysAgo.toISOString() }
      };
    }

    try {
      // Try the optimized aggregation query first
      const aggregateUrl = `${EXTERNAL.directus_url}/items/ingested_article/aggregate`;
      const aggregateQuery = {
        aggregate: {
          count: { count: '*' }
        },
        groupBy: ['source'],
        filter: {
          source: { _nempty: true },
          ...dateFilter
        },
        limit: -1 // -1 means no limit in Directus
      };

      const queryString = new URLSearchParams({
        filter: JSON.stringify(aggregateQuery.filter),
        groupBy: JSON.stringify(aggregateQuery.groupBy),
        aggregate: JSON.stringify(aggregateQuery.aggregate),
        limit: aggregateQuery.limit.toString()
      }).toString();

      const url = `${aggregateUrl}?${queryString}`;

      console.log('[article_source_count] Fetching aggregated data from:', url);

      const response = await fetch(url, { headers });

      console.log('[article_source_count] Aggregation response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        const aggregatedResults = result.data || [];

        console.log('[article_source_count] Processing aggregated results count:', aggregatedResults.length);

        // Process aggregated results - counting is done at query level
        aggregatedResults.forEach((group: any) => {
          const source = group.group[0] || 'Unknown';
          const count = group.count.count;
          sourceMap[source] = count;
          totalRecords += count;
        });

      } else {
        throw new Error('Aggregation query failed');
      }
    } catch (error) {
      console.log('[article_source_count] Aggregation failed, falling back to original query');

      // Fallback to original query method - fetch all articles and aggregate client-side
      const filterParams: any = {
        fields: 'id,source',
        'filter[source][_nempty]': 'true',
        limit: '-1'
      };

      // Add date filter to fallback query
      if (period === '24h') {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filterParams['filter[date_created][_gte]'] = yesterday.toISOString();
      } else if (period === '7d') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filterParams['filter[date_created][_gte]'] = sevenDaysAgo.toISOString();
      }

      const queryString = new URLSearchParams(filterParams).toString();
      const fallbackUrl = `${EXTERNAL.directus_url}/items/ingested_article?${queryString}`;

      const response = await fetch(fallbackUrl, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.error('[article_source_count] Fallback query also failed:', errorText);
        throw new Error(`Failed to fetch article source data: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const articles = result.data || [];

      console.log('[article_source_count] Processing fallback data count:', articles.length);

      // Aggregate client-side
      articles.forEach((article: any) => {
        const source = article.source || 'Unknown';
        sourceMap[source] = (sourceMap[source] || 0) + 1;
        totalRecords += 1;
      });
    }

    // Convert to array format and sort by count descending
    const sourceData: ArticleSourceData[] = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    console.log(`[article_source_count] Returning ${sourceData.length} unique sources with ${totalRecords} total articles`);
    console.log('[article_source_count] Sources:', sourceData.map(s => `${s.source}(${s.count})`).join(', '));

    return {
      success: true,
      data: sourceData,
      total: totalRecords,
    };
  } catch (error) {
    console.error('[article_source_count] Error fetching article source data:', error);
    return {
      success: false,
      data: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
