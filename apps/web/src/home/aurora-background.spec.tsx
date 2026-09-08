import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuroraBackground } from './aurora-background';

function installMatchMedia(reducedMotion: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string): MediaQueryList => {
      const matches = query.includes('prefers-reduced-motion') ? reducedMotion : true;

      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuroraBackground', () => {
  it('agrupa los movimientos del puntero en un solo frame y transforma las capas directamente', () => {
    installMatchMedia(false);
    let scheduledFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { container } = render(<AuroraBackground />);

    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: 0 });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => {
      scheduledFrame?.(0);
    });

    const layers = container.querySelectorAll<HTMLElement>('.aurora-background-layer');
    expect(layers).toHaveLength(3);
    expect(layers[0]).toHaveStyle({ transform: 'translate3d(10px, -10px, 0)' });
    expect(layers[1]).toHaveStyle({ transform: 'translate3d(-7px, 7px, 0)' });
    expect(layers[2]).toHaveStyle({ transform: 'translate3d(5px, -5px, 0)' });
  });

  it('no escucha el puntero cuando la persona solicita movimiento reducido', () => {
    installMatchMedia(true);
    const requestAnimationFrame = vi.fn<Window['requestAnimationFrame']>();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(<AuroraBackground />);

    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: window.innerHeight });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
