/**
 * Golf Intelligence — Data Loading Hook
 */

import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import type { RawShot, ProcessedShot, Tiger5Metrics, RoundSummary } from '../types/golf';
import { processShots, calculateTiger5Metrics, getRoundSummaries } from '../utils/calculations';

// Google Sheet CSV URL - published to web
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6xTTDWTSzaRvoiACi2PT-l7uqvwcZwdlIZsCGunz-8t-227TBihATnDfUoi5VzDqhOIGcAbJViw9O/pub?output=csv';

interface UseGolfDataResult {
  rawShots: RawShot[];
  processedShots: ProcessedShot[];
  tiger5Metrics: Tiger5Metrics;
  roundSummaries: RoundSummary[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useGolfData(): UseGolfDataResult {
  const [rawShots, setRawShots] = useState<RawShot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const csvText = await response.text();
        
        Papa.parse<RawShot>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.warn('CSV parsing warnings:', results.errors);
            }
            
            // Clean up the data - trim strings and convert numbers
            const cleanedData = results.data.map(shot => {
              const cleaned: Partial<RawShot> = {};
              (Object.keys(shot) as Array<keyof RawShot>).forEach(key => {
                const value = shot[key];
                if (typeof value === 'string') {
                  const trimmed = value.trim();
                  // Convert numeric fields
                  if (['Shot', 'Hole', 'Score', 'Starting Distance', 'Ending Distance', 'Starting SG', 'Ending SG', 'Strokes Gained'].includes(key)) {
                    cleaned[key] = parseFloat(trimmed) as never;
                  } else {
                    cleaned[key] = trimmed as never;
                  }
                } else {
                  cleaned[key] = value as never;
                }
              });
              return cleaned as RawShot;
            });
            
            setRawShots(cleanedData);
            setLastUpdated(new Date());
          },
          error: (parseError: Error) => {
            throw new Error(`CSV parsing failed: ${parseError}`);
          }
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error loading data';
        setError(message);
        console.error('Failed to load golf data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Process shots when raw data changes
  const processedShots = useMemo(() => {
    if (rawShots.length === 0) return [];
    return processShots(rawShots);
  }, [rawShots]);

  // Calculate metrics
  const tiger5Metrics = useMemo(() => {
    return calculateTiger5Metrics(processedShots);
  }, [processedShots]);

  // Get round summaries
  const roundSummaries = useMemo(() => {
    return getRoundSummaries(processedShots);
  }, [processedShots]);

  return {
    rawShots,
    processedShots,
    tiger5Metrics,
    roundSummaries,
    isLoading,
    error,
    lastUpdated,
  };
}
