import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Container, IconButton, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import CircleIcon from "@mui/icons-material/Circle";
import useEmblaCarousel from "embla-carousel-react";
import { CarouselSlide, HomepageCarouselSettings } from "../../types";
import { normalizeCarouselSlide } from "../../features/cms-carousel";
import CarouselImageStage from "../../shared/components/CarouselImageStage";
import {
  isCarouselSlideActive,
  normalizeCarouselAutoplayIntervalSeconds,
  shouldStartCarouselAutoplay
} from "../utils/homeCarousel";

interface ResolvedCarouselSlide {
  id: string;
  slide: CarouselSlide;
  altText: string;
  label: string;
}

const DEFAULT_SLIDE_ALT = "ภาพสไลด์หน้าแรก";
let carouselBrowserApisEnsured = false;

function ensureCarouselBrowserApis() {
  if (carouselBrowserApisEnsured) {
    return;
  }

  carouselBrowserApisEnsured = true;

  if (typeof window === "undefined" || typeof window.matchMedia === "function") {
    // Continue below so jsdom can still receive observer fallbacks when needed.
  } else {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    });
  }

  if (typeof globalThis.IntersectionObserver !== "function") {
    globalThis.IntersectionObserver = class NoopIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly thresholds = [];

      constructor(_callback: IntersectionObserverCallback) {}

      disconnect() {}

      observe() {}

      takeRecords() {
        return [];
      }

      unobserve() {}
    };
  }

  if (typeof globalThis.ResizeObserver !== "function") {
    globalThis.ResizeObserver = class NoopResizeObserver implements ResizeObserver {
      constructor(_callback: ResizeObserverCallback) {}

      disconnect() {}

      observe() {}

      unobserve() {}
    };
  }
}

export default function PublicHomeCarousel({
  slides,
  settings
}: {
  slides: CarouselSlide[];
  settings?: HomepageCarouselSettings;
}) {
  ensureCarouselBrowserApis();
  const [visibleAtMs] = useState(() => Date.now());

  const resolvedSlides = useMemo(() => {
    return slides
      .map((slide): ResolvedCarouselSlide | null => {
        const normalizedSlide = normalizeCarouselSlide(slide);

        if (!isCarouselSlideActive(normalizedSlide, visibleAtMs)) {
          return null;
        }

        const altText = normalizedSlide.imageAlt || normalizedSlide.title || DEFAULT_SLIDE_ALT;

        return {
          id: normalizedSlide.id,
          slide: normalizedSlide,
          altText,
          label: normalizedSlide.title || altText
        };
      })
      .filter((slide): slide is ResolvedCarouselSlide => Boolean(slide));
  }, [slides, visibleAtMs]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const autoplayRef = useRef<number | null>(null);
  const autoplayEnabled = settings?.autoplayEnabled ?? true;
  const autoplayIntervalMs = normalizeCarouselAutoplayIntervalSeconds(settings?.autoplayIntervalSeconds) * 1000;

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  const scrollTo = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) {
      return;
    }

    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return undefined;
    }

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    stopAutoplay();

    if (!emblaApi || isHovering || !shouldStartCarouselAutoplay(autoplayEnabled, resolvedSlides.length)) {
      return stopAutoplay;
    }

    autoplayRef.current = window.setInterval(() => {
      emblaApi.scrollNext();
    }, autoplayIntervalMs);

    return stopAutoplay;
  }, [autoplayEnabled, autoplayIntervalMs, emblaApi, isHovering, resolvedSlides.length, stopAutoplay]);

  if (resolvedSlides.length === 0) {
    return null;
  }

  return (
    <Box component="section" aria-label="สไลด์ประชาสัมพันธ์หน้าแรก" sx={{ mb: { xs: 2.5, md: 3.5 } }}>
      <Container maxWidth="xl">
        <Box
          onMouseEnter={() => {
            setIsHovering(true);
          }}
          onMouseLeave={() => {
            setIsHovering(false);
          }}
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 1,
            bgcolor: "primary.dark",
            boxShadow: "0 18px 34px rgba(31, 90, 44, 0.16)"
          }}
        >
          <Box ref={emblaRef} sx={{ overflow: "hidden" }}>
            <Box sx={{ display: "flex" }}>
              {resolvedSlides.map((resolvedSlide, index) => (
                <Box
                  key={resolvedSlide.id}
                  role="group"
                  aria-label={resolvedSlide.label}
                  sx={{
                    position: "relative",
                    flex: "0 0 100%",
                    minWidth: 0,
                    minHeight: { xs: 260, sm: 320, md: 420 },
                    bgcolor: "primary.dark",
                    overflow: "hidden"
                  }}
                >
                  <CarouselImageStage
                    slide={resolvedSlide.slide}
                    alt={resolvedSlide.altText}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    sizes="(max-width: 900px) 100vw, 1280px"
                    emptyLabel="ไม่สามารถแสดงภาพสไลด์ได้"
                  />
                </Box>
              ))}
            </Box>
          </Box>

          {resolvedSlides.length > 1 && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: "absolute",
                right: { xs: 12, md: 20 },
                top: { xs: 12, md: 20 },
                zIndex: 2
              }}
            >
              <IconButton
                aria-label="สไลด์ก่อนหน้า"
                onClick={scrollPrev}
                sx={(theme) => ({
                  width: { xs: 34, md: 40 },
                  height: { xs: 34, md: 40 },
                  color: "white",
                  bgcolor: alpha(theme.palette.common.black, 0.22),
                  backdropFilter: "blur(2px)",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.common.black, 0.38)
                  }
                })}
              >
                <ArrowBackIosNewRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="สไลด์ถัดไป"
                onClick={scrollNext}
                sx={(theme) => ({
                  width: { xs: 34, md: 40 },
                  height: { xs: 34, md: 40 },
                  color: "white",
                  bgcolor: alpha(theme.palette.common.black, 0.22),
                  backdropFilter: "blur(2px)",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.common.black, 0.38)
                  }
                })}
              >
                <ArrowForwardIosRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}

          {resolvedSlides.length > 1 && (
            <Stack
              direction="row"
              spacing={0.4}
              justifyContent="center"
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: { xs: 10, md: 16 },
                zIndex: 2
              }}
            >
              {resolvedSlides.map((slide, index) => (
                <IconButton
                  key={slide.id}
                  aria-label={`ไปยังสไลด์ ${index + 1}`}
                  aria-current={selectedIndex === index ? "true" : undefined}
                  onClick={() => {
                    scrollTo(index);
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    color: selectedIndex === index ? "secondary.main" : "rgba(255, 255, 255, 0.7)"
                  }}
                >
                  <CircleIcon sx={{ fontSize: selectedIndex === index ? 9 : 7 }} />
                </IconButton>
              ))}
            </Stack>
          )}
        </Box>
      </Container>
    </Box>
  );
}
