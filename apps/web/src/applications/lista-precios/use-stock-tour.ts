import { useEffect, useState } from 'react';

const SEEN_STORAGE_KEY = 'lp-stock-tour-seen';
const MAX_UNITS_IN_TOUR = 5;
const START_DELAY_MS = 500;
const HIGHLIGHT_MS = 650;
const GAP_MS = 80;

function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(SEEN_STORAGE_KEY) === '1';
  } catch {
    return true; // si localStorage no está disponible, no insistimos con el tour.
  }
}

function markTourSeen(): void {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, '1');
  } catch {
    // Almacenamiento no disponible (modo privado, etc.): no es crítico, seguimos sin recordar.
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Recorrido de onboarding: resalta las primeras unidades de stock una por vez para enseñar,
 * la primera vez que el usuario ve la lista, que las filas son clickeables. Se muestra una sola
 * vez por navegador y se cancela apenas el usuario interactúa de verdad (elige una unidad).
 */
export function useStockTour(stocks: string[], enabled: boolean): string | null {
  const [highlightedStock, setHighlightedStock] = useState<string | null>(null);
  const stocksKey = stocks.join('|');

  useEffect(() => {
    if (!enabled || stocks.length < 2) return;
    if (prefersReducedMotion() || hasSeenTour()) return;

    // Se marca como visto al arrancar, no al terminar: si el usuario navega antes de que
    // termine, no queremos que el tour vuelva a jugar en su próxima visita.
    markTourSeen();

    let cancelled = false;
    let timeoutId: number;
    const tourStocks = stocks.slice(0, MAX_UNITS_IN_TOUR);

    function step(index: number): void {
      if (cancelled) return;
      const stock = tourStocks[index];
      if (stock === undefined) {
        setHighlightedStock(null);
        return;
      }
      setHighlightedStock(stock);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setHighlightedStock(null);
        timeoutId = window.setTimeout(() => {
          step(index + 1);
        }, GAP_MS);
      }, HIGHLIGHT_MS);
    }

    timeoutId = window.setTimeout(() => {
      step(0);
    }, START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // `stocksKey` (join de `stocks`) es la dependencia real; `stocks` en sí cambia de
    // referencia en cada render aunque el contenido sea el mismo.
  }, [stocksKey, enabled]);

  useEffect(() => {
    if (!enabled) setHighlightedStock(null);
  }, [enabled]);

  return highlightedStock;
}
