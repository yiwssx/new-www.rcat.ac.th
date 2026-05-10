import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, Container, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import CircleIcon from "@mui/icons-material/Circle";
import useEmblaCarousel from "embla-carousel-react";
import { CarouselSlide } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface ResolvedCarouselSlide {
  id: string;
  chip: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  altText: string;
  buttonLabel: string;
  href: string;
}

const AUTOPLAY_INTERVAL_MS = 5000;

function ensureCarouselBrowserApis() {
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

export default function PublicHomeCarousel({ slides }: { slides: CarouselSlide[] }) {
  ensureCarouselBrowserApis();

  const resolvedSlides = slides
    .map((slide): ResolvedCarouselSlide | null => {
      if (!slide.enabled || !slide.imageUrl || !slide.title) {
        return null;
      }

      return {
        id: slide.id,
        chip: slide.chip || "ประชาสัมพันธ์",
        title: slide.title,
        subtitle: slide.subtitle,
        imageUrl: slide.imageUrl,
        altText: slide.imageAlt || slide.title,
        buttonLabel: slide.buttonLabel || "อ่านต่อ",
        href: slide.href || "/"
      };
    })
    .filter((slide): slide is ResolvedCarouselSlide => Boolean(slide));
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

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

    if (!emblaApi || isHovering || resolvedSlides.length < 2) {
      return stopAutoplay;
    }

    autoplayRef.current = window.setInterval(() => {
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return stopAutoplay;
  }, [emblaApi, isHovering, resolvedSlides.length, stopAutoplay]);

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
              {resolvedSlides.map((slide) => (
                <Box
                  key={slide.id}
                  role="group"
                  aria-label={`${slide.title}: ${slide.altText}`}
                  sx={(theme) => ({
                    position: "relative",
                    flex: "0 0 100%",
                    minWidth: 0,
                    minHeight: { xs: 260, sm: 320, md: 420 },
                    display: "flex",
                    alignItems: "center",
                    p: { xs: 2, sm: 3, md: 5 },
                    color: "white",
                    backgroundImage: `linear-gradient(105deg, ${alpha(theme.palette.primary.dark, 0.92)} 0%, ${alpha(
                      theme.palette.primary.main,
                      0.72
                    )} 45%, ${alpha(theme.palette.common.black, 0.34)} 100%), url(${JSON.stringify(slide.imageUrl)})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover"
                  })}
                >
                  <Stack spacing={{ xs: 1.25, md: 1.6 }} sx={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
                    <Chip
                      label={slide.chip}
                      color="secondary"
                      sx={{
                        alignSelf: "flex-start",
                        color: "primary.dark",
                        fontWeight: 800
                      }}
                    />
                    <Typography
                      variant="h1"
                      sx={{
                        maxWidth: 680,
                        fontSize: { xs: "1.72rem", sm: "2.2rem", md: "3rem" },
                        lineHeight: 1.08,
                        textShadow: "0 2px 18px rgba(0, 0, 0, 0.28)"
                      }}
                    >
                      {slide.title}
                    </Typography>
                    <Typography
                      sx={{
                        maxWidth: 560,
                        color: "rgba(255, 255, 255, 0.88)",
                        fontSize: { xs: "0.94rem", md: "1.08rem" },
                        lineHeight: 1.6
                      }}
                    >
                      {slide.subtitle}
                    </Typography>
                    <Button
                      variant="contained"
                      color="secondary"
                      href={normalizeSafeHref(slide.href)}
                      endIcon={<ArrowForwardIosRoundedIcon />}
                      sx={{ alignSelf: "flex-start", color: "primary.dark", fontWeight: 800 }}
                    >
                      {slide.buttonLabel}
                    </Button>
                  </Stack>
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
                top: { xs: 12, md: 20 }
              }}
            >
              <IconButton
                aria-label="สไลด์ก่อนหน้า"
                onClick={scrollPrev}
                sx={(theme) => ({
                  width: { xs: 34, md: 40 },
                  height: { xs: 34, md: 40 },
                  color: "white",
                  bgcolor: alpha(theme.palette.common.black, 0.32),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.common.black, 0.46)
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
                  bgcolor: alpha(theme.palette.common.black, 0.32),
                  "&:hover": {
                    bgcolor: alpha(theme.palette.common.black, 0.46)
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
                bottom: { xs: 10, md: 16 }
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
