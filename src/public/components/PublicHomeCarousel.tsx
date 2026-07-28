import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { Box, Container, IconButton, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import CircleIcon from "@mui/icons-material/Circle";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import useEmblaCarousel from "embla-carousel-react";
import type { CarouselSlide, HomepageCarouselSettings } from "../../types";
import { normalizeCarouselSlide } from "../../features/cms-carousel/normalization";
import CarouselImageStage from "../../shared/components/CarouselImageStage";
import { usePublicMediaLoading } from "../../shared/media/publicMediaLoadingState";
import {
  getCarouselScheduleDelayMs,
  getNextCarouselScheduleBoundaryMs,
  isCarouselSlideActive,
  normalizeCarouselAutoplayIntervalSeconds
} from "../utils/homeCarousel";
import {
  getLoopedCarouselIndex,
  normalizePublicCarouselTransition,
  shouldRunCarouselAutoplay
} from "../utils/homeCarouselInteraction";
import {
  getPublicCarouselControlVisibility,
  PUBLIC_CAROUSEL_IMAGE_SIZES,
  PUBLIC_CAROUSEL_STAGE_HEIGHTS
} from "../utils/homeCarouselPresentation";

interface ResolvedCarouselSlide {
  id: string;
  slide: CarouselSlide;
  altText: string;
  label: string;
}

const DEFAULT_SLIDE_ALT = "ภาพสไลด์หน้าแรก";
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
const FADE_SWIPE_DISTANCE_PX = 48;

let carouselBrowserApisEnsured = false;

function ensureCarouselBrowserApis() {
  if (carouselBrowserApisEnsured) {
    return;
  }

  carouselBrowserApisEnsured = true;

  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
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

function getInitialDocumentVisibility() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function getInitialReducedMotionPreference() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches
  );
}

const visuallyHiddenSx = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0
} as const;

export default function PublicHomeCarousel({
  slides,
  settings
}: {
  slides: CarouselSlide[];
  settings?: HomepageCarouselSettings;
}) {
  ensureCarouselBrowserApis();

  const instructionsId = useId();

  const [visibleAtMs, setVisibleAtMs] = useState(() => Date.now());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(getInitialDocumentVisibility);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialReducedMotionPreference);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [requestedSlideIds, setRequestedSlideIds] = useState<ReadonlySet<string>>(() => new Set());
  const [loadedSlideIds, setLoadedSlideIds] = useState<ReadonlySet<string>>(() => new Set());

  const autoplayTimerRef = useRef<number | null>(null);
  const idlePreloadRef = useRef<number | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const announceOnNextEmblaSelectionRef = useRef(false);

  const transition = normalizePublicCarouselTransition(settings?.transition);
  const isFadeTransition = transition === "fade";

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true
  });

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

  const autoplayEnabled = settings?.autoplayEnabled ?? true;

  const autoplayIntervalMs = normalizeCarouselAutoplayIntervalSeconds(settings?.autoplayIntervalSeconds) * 1000;

  const pauseOnHover = settings?.pauseOnHover ?? true;

  const pauseOnFocus = settings?.pauseOnFocus ?? true;

  const controlVisibility = getPublicCarouselControlVisibility(settings, resolvedSlides.length);

  const showAutoplayControl = autoplayEnabled && resolvedSlides.length > 1;
  const autoplayControlPaused = isUserPaused || prefersReducedMotion;

  const effectiveSelectedIndex = resolvedSlides.length > 0 ? Math.min(selectedIndex, resolvedSlides.length - 1) : 0;
  const { pageMediaAllowed } = usePublicMediaLoading();

  const requestSlideByIndex = useCallback(
    (index: number) => {
      if (!pageMediaAllowed || resolvedSlides.length === 0) {
        return;
      }

      const normalizedIndex = getLoopedCarouselIndex(index, resolvedSlides.length);
      const slideId = resolvedSlides[normalizedIndex]?.id;

      if (!slideId) {
        return;
      }

      setRequestedSlideIds((current) => {
        if (current.has(slideId)) {
          return current;
        }

        return new Set(current).add(slideId);
      });
    },
    [pageMediaAllowed, resolvedSlides]
  );

  const scheduleNextSlidePreload = useCallback(
    (loadedIndex: number) => {
      if (!pageMediaAllowed || resolvedSlides.length < 2 || typeof window === "undefined") {
        return;
      }

      if (idlePreloadRef.current !== null) {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idlePreloadRef.current);
        } else {
          window.clearTimeout(idlePreloadRef.current);
        }
      }

      const preload = () => {
        idlePreloadRef.current = null;
        requestSlideByIndex(loadedIndex + 1);
      };

      idlePreloadRef.current =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(preload, { timeout: 1_000 })
          : window.setTimeout(preload, 120);
    },
    [pageMediaAllowed, requestSlideByIndex, resolvedSlides.length]
  );

  const handleSlideImageLoad = useCallback(
    (index: number, slideId: string) => {
      setLoadedSlideIds((current) => {
        if (current.has(slideId)) {
          return current;
        }

        return new Set(current).add(slideId);
      });

      if (index === effectiveSelectedIndex) {
        scheduleNextSlidePreload(index);
      }
    },
    [effectiveSelectedIndex, scheduleNextSlidePreload]
  );

  const autoplayRunning = shouldRunCarouselAutoplay({
    autoplayEnabled,
    slideCount: resolvedSlides.length,
    userPaused: isUserPaused,
    hovering: isHovering,
    pauseOnHover,
    focusWithin: isFocusWithin,
    pauseOnFocus,
    documentVisible: isDocumentVisible,
    prefersReducedMotion
  });

  const stopAutoplay = useCallback(() => {
    if (autoplayTimerRef.current !== null) {
      window.clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const announceSlide = useCallback(
    (index: number) => {
      if (resolvedSlides.length === 0) {
        return;
      }

      const normalizedIndex = getLoopedCarouselIndex(index, resolvedSlides.length);

      const resolvedSlide = resolvedSlides[normalizedIndex];

      setLiveAnnouncement(`สไลด์ ${normalizedIndex + 1} จาก ${resolvedSlides.length}: ${resolvedSlide.label}`);
    },
    [resolvedSlides]
  );

  const setFadeIndex = useCallback(
    (index: number, announce: boolean) => {
      const normalizedIndex = getLoopedCarouselIndex(index, resolvedSlides.length);

      setSelectedIndex(normalizedIndex);

      if (announce) {
        announceSlide(normalizedIndex);
      }
    },
    [announceSlide, resolvedSlides.length]
  );

  const markManualNavigation = useCallback(() => {
    setIsUserPaused(true);
    announceOnNextEmblaSelectionRef.current = true;
  }, []);

  const scrollTo = useCallback(
    (index: number) => {
      if (resolvedSlides.length === 0) {
        return;
      }

      requestSlideByIndex(index);
      markManualNavigation();

      if (isFadeTransition) {
        setFadeIndex(index, true);

        announceOnNextEmblaSelectionRef.current = false;

        return;
      }

      emblaApi?.scrollTo(getLoopedCarouselIndex(index, resolvedSlides.length));
    },
    [emblaApi, isFadeTransition, markManualNavigation, requestSlideByIndex, resolvedSlides.length, setFadeIndex]
  );

  const scrollPrev = useCallback(() => {
    if (resolvedSlides.length === 0) {
      return;
    }

    requestSlideByIndex(effectiveSelectedIndex - 1);
    markManualNavigation();

    if (isFadeTransition) {
      setFadeIndex(effectiveSelectedIndex - 1, true);

      announceOnNextEmblaSelectionRef.current = false;

      return;
    }

    emblaApi?.scrollPrev();
  }, [
    emblaApi,
    effectiveSelectedIndex,
    isFadeTransition,
    markManualNavigation,
    requestSlideByIndex,
    resolvedSlides.length,
    setFadeIndex
  ]);

  const scrollNext = useCallback(() => {
    if (resolvedSlides.length === 0) {
      return;
    }

    requestSlideByIndex(effectiveSelectedIndex + 1);
    markManualNavigation();

    if (isFadeTransition) {
      setFadeIndex(effectiveSelectedIndex + 1, true);

      announceOnNextEmblaSelectionRef.current = false;

      return;
    }

    emblaApi?.scrollNext();
  }, [
    emblaApi,
    effectiveSelectedIndex,
    isFadeTransition,
    markManualNavigation,
    requestSlideByIndex,
    resolvedSlides.length,
    setFadeIndex
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi || isFadeTransition) {
      return;
    }

    const nextSelectedIndex = emblaApi.selectedScrollSnap();

    requestSlideByIndex(nextSelectedIndex);
    setSelectedIndex(nextSelectedIndex);

    if (announceOnNextEmblaSelectionRef.current) {
      announceSlide(nextSelectedIndex);

      announceOnNextEmblaSelectionRef.current = false;
    }
  }, [announceSlide, emblaApi, isFadeTransition, requestSlideByIndex]);

  useEffect(() => {
    const selectedSlideId = resolvedSlides[effectiveSelectedIndex]?.id;

    if (selectedSlideId && loadedSlideIds.has(selectedSlideId)) {
      scheduleNextSlidePreload(effectiveSelectedIndex);
    }
  }, [effectiveSelectedIndex, loadedSlideIds, resolvedSlides, scheduleNextSlidePreload]);

  useEffect(() => {
    return () => {
      if (idlePreloadRef.current === null || typeof window === "undefined") {
        return;
      }

      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idlePreloadRef.current);
      } else {
        window.clearTimeout(idlePreloadRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nowMs = Date.now();

    const nextBoundaryMs = getNextCarouselScheduleBoundaryMs(slides, nowMs);

    if (nextBoundaryMs === null) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => {
        setVisibleAtMs(Date.now());
      },
      getCarouselScheduleDelayMs(nextBoundaryMs, nowMs)
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [slides, visibleAtMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleReducedMotionChange);

      return () => {
        mediaQueryList.removeEventListener("change", handleReducedMotionChange);
      };
    }

    mediaQueryList.addListener(handleReducedMotionChange);

    return () => {
      mediaQueryList.removeListener(handleReducedMotionChange);
    };
  }, []);

  useEffect(() => {
    if (!emblaApi || isFadeTransition) {
      return undefined;
    }

    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, isFadeTransition, onSelect]);

  useEffect(() => {
    if (!isFadeTransition && emblaApi) {
      /*
       * Synchronize Embla with the current
       * collection of visible slides.
       *
       * The registered reInit listener updates
       * selectedIndex from the Embla instance.
       */
      emblaApi.reInit();
    }
  }, [emblaApi, isFadeTransition, resolvedSlides.length]);

  useEffect(() => {
    stopAutoplay();

    if (!autoplayRunning) {
      return stopAutoplay;
    }

    if (!isFadeTransition && !emblaApi) {
      return stopAutoplay;
    }

    autoplayTimerRef.current = window.setInterval(() => {
      if (isFadeTransition) {
        setSelectedIndex((currentIndex) => getLoopedCarouselIndex(currentIndex + 1, resolvedSlides.length));

        return;
      }

      emblaApi?.scrollNext();
    }, autoplayIntervalMs);

    return stopAutoplay;
  }, [autoplayIntervalMs, autoplayRunning, emblaApi, isFadeTransition, resolvedSlides.length, stopAutoplay]);

  const handleAutoplayToggle = useCallback(() => {
    const nextPaused = !isUserPaused;

    setIsUserPaused(nextPaused);
    setLiveAnnouncement(nextPaused ? "หยุดการเล่นสไลด์อัตโนมัติแล้ว" : "เริ่มการเล่นสไลด์อัตโนมัติแล้ว");

    if (!nextPaused) {
      /*
       * The play button is a direct command
       * from the user. Allow autoplay to
       * resume immediately even while that
       * button still owns focus.
       */
      setIsFocusWithin(false);
    }
  }, [isUserPaused]);

  const handleKeyboardNavigation = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        scrollPrev();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        scrollNext();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        scrollTo(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();

        scrollTo(resolvedSlides.length - 1);
      }
    },
    [resolvedSlides.length, scrollNext, scrollPrev, scrollTo]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      pointerStartXRef.current = event.clientX;

      setIsUserPaused(true);

      if (!isFadeTransition) {
        announceOnNextEmblaSelectionRef.current = true;
      }
    },
    [isFadeTransition]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const pointerStartX = pointerStartXRef.current;

      pointerStartXRef.current = null;

      if (!isFadeTransition || pointerStartX === null) {
        return;
      }

      const distanceX = event.clientX - pointerStartX;

      if (Math.abs(distanceX) < FADE_SWIPE_DISTANCE_PX) {
        return;
      }

      if (distanceX < 0) {
        scrollNext();
      } else {
        scrollPrev();
      }
    },
    [isFadeTransition, scrollNext, scrollPrev]
  );

  const handlePointerCancel = useCallback(() => {
    pointerStartXRef.current = null;
  }, []);

  if (resolvedSlides.length === 0) {
    return null;
  }

  const autoplayState = !autoplayEnabled
    ? "disabled"
    : prefersReducedMotion
      ? "reduced-motion"
      : autoplayRunning
        ? "running"
        : "paused";

  return (
    <Box
      component="section"
      aria-label="สไลด์ประชาสัมพันธ์หน้าแรก"
      aria-roledescription="carousel"
      aria-describedby={instructionsId}
      tabIndex={0}
      data-public-home-carousel="true"
      data-carousel-transition={transition}
      data-carousel-autoplay-state={autoplayState}
      onKeyDown={handleKeyboardNavigation}
      onFocusCapture={() => {
        setIsFocusWithin(true);
      }}
      onBlurCapture={(event) => {
        const nextFocusedElement = event.relatedTarget;

        if (!(nextFocusedElement instanceof Node) || !event.currentTarget.contains(nextFocusedElement)) {
          setIsFocusWithin(false);
        }
      }}
      onMouseEnter={() => {
        setIsHovering(true);
      }}
      onMouseLeave={() => {
        setIsHovering(false);
      }}
      sx={(theme) => ({
        mb: {
          xs: 2.5,
          md: 3.5
        },
        borderRadius: {
          xs: 1.5,
          md: 2
        },
        "&:focus-visible": {
          outline: `3px solid ${theme.palette.secondary.main}`,
          outlineOffset: 4
        }
      })}
    >
      <Box id={instructionsId} component="span" sx={visuallyHiddenSx}>
        ใช้ปุ่มลูกศรซ้ายและขวาเพื่อเปลี่ยนสไลด์ กดปุ่มหยุดเพื่อหยุดการเล่นอัตโนมัติ
      </Box>

      <Box component="span" aria-live="polite" aria-atomic="true" sx={visuallyHiddenSx}>
        {liveAnnouncement}
      </Box>

      <Container maxWidth="xl">
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            isolation: "isolate",
            borderRadius: {
              xs: 1.5,
              md: 2
            },
            bgcolor: "primary.dark",
            boxShadow: "0 18px 34px rgba(31, 90, 44, 0.16)"
          }}
        >
          <Box
            ref={isFadeTransition ? undefined : emblaRef}
            data-carousel-viewport="true"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            sx={{
              position: "relative",
              overflow: "hidden",
              height: isFadeTransition ? PUBLIC_CAROUSEL_STAGE_HEIGHTS : "auto",
              touchAction: "pan-y pinch-zoom"
            }}
          >
            {isFadeTransition ? (
              resolvedSlides.map((resolvedSlide, index) => {
                const isSelected = effectiveSelectedIndex === index;
                const shouldLoadSlide = pageMediaAllowed && (isSelected || requestedSlideIds.has(resolvedSlide.id));

                return (
                  <Box
                    key={resolvedSlide.id}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} จาก ${resolvedSlides.length}: ${resolvedSlide.label}`}
                    aria-hidden={isSelected ? undefined : true}
                    data-carousel-slide-stage="true"
                    data-carousel-stage-sizing="fixed-responsive"
                    data-carousel-slide-index={index}
                    data-carousel-slide-selected={isSelected ? "true" : "false"}
                    data-carousel-slide-media-requested={shouldLoadSlide ? "true" : "false"}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      bgcolor: "primary.dark",
                      overflow: "hidden",
                      opacity: isSelected ? 1 : 0,
                      visibility: isSelected ? "visible" : "hidden",
                      pointerEvents: isSelected ? "auto" : "none",
                      transition: prefersReducedMotion ? "none" : "opacity 420ms ease"
                    }}
                  >
                    <CarouselImageStage
                      slide={resolvedSlide.slide}
                      alt={resolvedSlide.altText}
                      loading={isSelected ? "eager" : "lazy"}
                      fetchPriority={isSelected ? "high" : "auto"}
                      sizes={PUBLIC_CAROUSEL_IMAGE_SIZES}
                      emptyLabel="ไม่สามารถแสดงภาพสไลด์ได้"
                      shouldLoad={shouldLoadSlide}
                      onMainImageLoad={() => handleSlideImageLoad(index, resolvedSlide.id)}
                    />
                  </Box>
                );
              })
            ) : (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "stretch"
                }}
              >
                {resolvedSlides.map((resolvedSlide, index) => {
                  const isSelected = effectiveSelectedIndex === index;
                  const shouldLoadSlide = pageMediaAllowed && (isSelected || requestedSlideIds.has(resolvedSlide.id));

                  return (
                    <Box
                      key={resolvedSlide.id}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${index + 1} จาก ${resolvedSlides.length}: ${resolvedSlide.label}`}
                      aria-hidden={isSelected ? undefined : true}
                      data-carousel-slide-stage="true"
                      data-carousel-stage-sizing="fixed-responsive"
                      data-carousel-slide-index={index}
                      data-carousel-slide-selected={isSelected ? "true" : "false"}
                      data-carousel-slide-media-requested={shouldLoadSlide ? "true" : "false"}
                      sx={{
                        position: "relative",
                        flex: "0 0 100%",
                        width: "100%",
                        minWidth: 0,
                        height: PUBLIC_CAROUSEL_STAGE_HEIGHTS,
                        bgcolor: "primary.dark",
                        overflow: "hidden"
                      }}
                    >
                      <CarouselImageStage
                        slide={resolvedSlide.slide}
                        alt={resolvedSlide.altText}
                        loading={isSelected ? "eager" : "lazy"}
                        fetchPriority={isSelected ? "high" : "auto"}
                        sizes={PUBLIC_CAROUSEL_IMAGE_SIZES}
                        emptyLabel="ไม่สามารถแสดงภาพสไลด์ได้"
                        shouldLoad={shouldLoadSlide}
                        onMainImageLoad={() => handleSlideImageLoad(index, resolvedSlide.id)}
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          {controlVisibility.dots && (
            <Box
              aria-hidden="true"
              data-carousel-control-scrim="true"
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: {
                  xs: 72,
                  md: 88
                },
                zIndex: 2,
                pointerEvents: "none",
                background: "linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.34) 100%)"
              }}
            />
          )}

          {(showAutoplayControl || controlVisibility.arrows) && (
            <Stack
              direction="row"
              spacing={0.5}
              data-carousel-top-controls="true"
              sx={(theme) => ({
                position: "absolute",
                right: {
                  xs: 10,
                  md: 18
                },
                top: {
                  xs: 10,
                  md: 18
                },
                zIndex: 3,
                p: 0.5,
                borderRadius: 999,
                color: "common.white",
                bgcolor: alpha(theme.palette.common.black, 0.3),
                border: `1px solid ${alpha(theme.palette.common.white, 0.22)}`,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)",
                backdropFilter: "blur(8px)"
              })}
            >
              {showAutoplayControl && (
                <IconButton
                  aria-label={
                    prefersReducedMotion
                      ? "การเล่นสไลด์อัตโนมัติถูกปิดตามการตั้งค่าลดการเคลื่อนไหว"
                      : autoplayControlPaused
                        ? "เล่นสไลด์อัตโนมัติ"
                        : "หยุดสไลด์อัตโนมัติ"
                  }
                  aria-pressed={autoplayControlPaused}
                  disabled={prefersReducedMotion}
                  data-carousel-autoplay-control="true"
                  onClick={handleAutoplayToggle}
                  sx={(theme) => ({
                    width: {
                      xs: 34,
                      md: 40
                    },
                    height: {
                      xs: 34,
                      md: 40
                    },
                    color: "white",
                    bgcolor: alpha(theme.palette.common.black, 0.12),
                    "&:hover": {
                      bgcolor: alpha(theme.palette.common.black, 0.4)
                    },
                    "&.Mui-disabled": {
                      color: alpha(theme.palette.common.white, 0.62)
                    },
                    "&:focus-visible": {
                      outline: `2px solid ${theme.palette.secondary.main}`,
                      outlineOffset: 2
                    }
                  })}
                >
                  {autoplayControlPaused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
                </IconButton>
              )}

              {controlVisibility.arrows && (
                <Box
                  data-carousel-arrow-controls="true"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5
                  }}
                >
                  <IconButton
                    aria-label="สไลด์ก่อนหน้า"
                    onClick={scrollPrev}
                    sx={(theme) => ({
                      width: {
                        xs: 34,
                        md: 40
                      },
                      height: {
                        xs: 34,
                        md: 40
                      },
                      color: "white",
                      bgcolor: alpha(theme.palette.common.black, 0.12),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.common.black, 0.4)
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${theme.palette.secondary.main}`,
                        outlineOffset: 2
                      }
                    })}
                  >
                    <ArrowBackIosNewRoundedIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    aria-label="สไลด์ถัดไป"
                    onClick={scrollNext}
                    sx={(theme) => ({
                      width: {
                        xs: 34,
                        md: 40
                      },
                      height: {
                        xs: 34,
                        md: 40
                      },
                      color: "white",
                      bgcolor: alpha(theme.palette.common.black, 0.12),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.common.black, 0.4)
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${theme.palette.secondary.main}`,
                        outlineOffset: 2
                      }
                    })}
                  >
                    <ArrowForwardIosRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Stack>
          )}

          {controlVisibility.dots && (
            <Stack
              direction="row"
              spacing={0.15}
              justifyContent="center"
              data-carousel-dot-controls="true"
              sx={(theme) => ({
                position: "absolute",
                left: "50%",
                bottom: {
                  xs: 8,
                  md: 14
                },
                zIndex: 3,
                maxWidth: "calc(100% - 24px)",
                overflowX: "auto",
                transform: "translateX(-50%)",
                p: 0.25,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.common.black, 0.26),
                border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.22)",
                backdropFilter: "blur(8px)",
                scrollbarWidth: "thin"
              })}
            >
              {resolvedSlides.map((slide, index) => (
                <IconButton
                  key={slide.id}
                  aria-label={`ไปยังสไลด์ ${index + 1}`}
                  aria-current={effectiveSelectedIndex === index ? "true" : undefined}
                  onClick={() => {
                    scrollTo(index);
                  }}
                  sx={(theme) => ({
                    flex: "0 0 auto",
                    width: {
                      xs: 28,
                      md: 30
                    },
                    height: {
                      xs: 28,
                      md: 30
                    },
                    color:
                      effectiveSelectedIndex === index ? "secondary.main" : alpha(theme.palette.common.white, 0.78),
                    "&:hover": {
                      bgcolor: alpha(theme.palette.common.white, 0.12)
                    },
                    "&:focus-visible": {
                      outline: `2px solid ${theme.palette.secondary.main}`,
                      outlineOffset: 1
                    }
                  })}
                >
                  <CircleIcon
                    sx={{
                      fontSize: effectiveSelectedIndex === index ? 9 : 7
                    }}
                  />
                </IconButton>
              ))}
            </Stack>
          )}
        </Box>
      </Container>
    </Box>
  );
}
