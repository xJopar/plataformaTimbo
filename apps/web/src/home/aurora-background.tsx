import { useEffect, useRef } from 'react';

const AURORA_POINTER_DEPTHS_PX = [20, -14, 10] as const;

export function AuroraBackground(): React.JSX.Element {
  const layerElementsRef = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const finePointerPreference = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrameId: number | undefined;
    let isListeningForPointer = false;
    let normalizedPointerX = 0;
    let normalizedPointerY = 0;

    const renderPointerPosition = () => {
      animationFrameId = undefined;
      layerElementsRef.current.forEach((layerElement, index) => {
        if (layerElement === null) {
          return;
        }

        const depth = AURORA_POINTER_DEPTHS_PX[index] ?? 0;
        layerElement.style.transform = `translate3d(${normalizedPointerX * depth}px, ${normalizedPointerY * depth}px, 0)`;
      });
    };

    const schedulePointerRender = () => {
      if (animationFrameId === undefined) {
        animationFrameId = window.requestAnimationFrame(renderPointerPosition);
      }
    };

    const resetPointerPosition = () => {
      normalizedPointerX = 0;
      normalizedPointerY = 0;
      schedulePointerRender();
    };

    const handlePointerMove = (event: PointerEvent) => {
      normalizedPointerX = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
      normalizedPointerY = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
      schedulePointerRender();
    };

    const startPointerTracking = () => {
      if (isListeningForPointer) {
        return;
      }

      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('blur', resetPointerPosition);
      document.addEventListener('mouseleave', resetPointerPosition);
      isListeningForPointer = true;
    };

    const stopPointerTracking = () => {
      if (!isListeningForPointer) {
        return;
      }

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('blur', resetPointerPosition);
      document.removeEventListener('mouseleave', resetPointerPosition);
      isListeningForPointer = false;
      resetPointerPosition();
    };

    const synchronizePointerTracking = () => {
      if (finePointerPreference.matches && !reducedMotionPreference.matches) {
        startPointerTracking();
        return;
      }

      stopPointerTracking();
    };

    finePointerPreference.addEventListener('change', synchronizePointerTracking);
    reducedMotionPreference.addEventListener('change', synchronizePointerTracking);
    synchronizePointerTracking();

    return () => {
      finePointerPreference.removeEventListener('change', synchronizePointerTracking);
      reducedMotionPreference.removeEventListener('change', synchronizePointerTracking);
      stopPointerTracking();
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div className="aurora-background" aria-hidden="true">
      {AURORA_POINTER_DEPTHS_PX.map((_, index) => (
        <span
          className={`aurora-background-layer aurora-background-layer--${index + 1}`}
          key={index}
          ref={(element) => {
            layerElementsRef.current[index] = element;
          }}
        >
          <span className="aurora-background-orb" />
        </span>
      ))}
    </div>
  );
}
