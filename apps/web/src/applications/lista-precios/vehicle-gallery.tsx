import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Api } from '../../api';
import { AppIcon } from '../../ui/app-icon';
import { useVehicleImages } from './use-vehicle-images';

interface VehicleGalleryProps {
  api: Api;
  stock: string;
  altLabel: string;
}

interface ResolvedImage {
  full: string;
  thumb: string;
}

function Slide({ src, alt, eager }: { src: string; alt: string; eager: boolean }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="lp-gallery-slide">
      {loaded ? null : <div className="lp-gallery-skeleton" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        className={`lp-gallery-img${loaded ? ' lp-gallery-img--loaded' : ''}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export function VehicleGallery({ api, stock, altLabel }: VehicleGalleryProps): React.JSX.Element | null {
  const imagesState = useVehicleImages(api, stock);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const images: ResolvedImage[] = useMemo(
    () =>
      imagesState.status === 'ready'
        ? imagesState.images.map((image) => ({
            full: api.applications.getListaPreciosImageUrl(image.full),
            thumb: api.applications.getListaPreciosImageUrl(image.thumb),
          }))
        : [],
    [imagesState],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  useEffect(() => {
    const track = trackRef.current;
    if (track === null || images.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce((best, entry) =>
          entry.intersectionRatio > best.intersectionRatio ? entry : best,
        );
        if (mostVisible.intersectionRatio > 0.5) {
          const index = slideRefs.current.findIndex((el) => el === mostVisible.target);
          if (index !== -1) setActiveIndex(index);
        }
      },
      { root: track, threshold: [0.5, 0.9] },
    );
    for (const slide of slideRefs.current) {
      if (slide !== null) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, [images]);

  useEffect(() => {
    const thumb = thumbsRef.current?.children[activeIndex];
    if (thumb instanceof HTMLElement) {
      thumb.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeIndex]);

  const goTo = useCallback((index: number) => {
    const slide = slideRefs.current[index];
    slide?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
  }, []);

  if (imagesState.status === 'loading') {
    return (
      <div className="lp-gallery">
        <div className="lp-gallery-viewport">
          <div className="lp-gallery-slide">
            <div className="lp-gallery-skeleton" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  if (images.length === 0) return null;

  return (
    <div className="lp-gallery">
      <div className="lp-gallery-viewport">
        <div className="lp-gallery-track" ref={trackRef}>
          {images.map((image, index) => (
            <div
              key={image.full}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className="lp-gallery-slide-wrap"
            >
              <Slide
                src={image.full}
                alt={`${altLabel} — foto ${index + 1} de ${images.length}`}
                eager={index === 0}
              />
            </div>
          ))}
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="lp-gallery-arrow lp-gallery-arrow--prev"
              aria-label="Foto anterior"
              disabled={activeIndex === 0}
              onClick={() => goTo(activeIndex - 1)}
            >
              <AppIcon icon={ArrowLeft01Icon} size={18} />
            </button>
            <button
              type="button"
              className="lp-gallery-arrow lp-gallery-arrow--next"
              aria-label="Foto siguiente"
              disabled={activeIndex === images.length - 1}
              onClick={() => goTo(activeIndex + 1)}
            >
              <AppIcon icon={ArrowRight01Icon} size={18} />
            </button>
            <span className="lp-gallery-counter">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="lp-gallery-thumbs" ref={thumbsRef}>
          {images.map((image, index) => (
            <button
              type="button"
              key={image.full}
              className={`lp-gallery-thumb${index === activeIndex ? ' lp-gallery-thumb--active' : ''}`}
              aria-label={`Ir a la foto ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => goTo(index)}
            >
              <img src={image.thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
