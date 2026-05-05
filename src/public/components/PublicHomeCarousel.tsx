import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, Container, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import CircleIcon from "@mui/icons-material/Circle";
import useEmblaCarousel from "embla-carousel-react";
import { normalizeSafeHref } from "../../utils/safeUrl";

interface CarouselSlide {
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

const slides: CarouselSlide[] = [
  {
    id: "public-relations",
    chip: "ประชาสัมพันธ์",
    title: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    subtitle: "พัฒนาทักษะวิชาชีพเกษตร เทคโนโลยี และนวัตกรรม เพื่ออนาคตของผู้เรียน",
    imageUrl: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1800&q=80",
    altText: "แปลงเกษตรสีเขียวในบรรยากาศการเรียนรู้ด้านเกษตร",
    buttonLabel: "ดูข่าวสาร",
    href: "/news"
  },
  {
    id: "admissions",
    chip: "รับสมัครนักเรียน นักศึกษา",
    title: "เปิดรับสมัครหลักสูตรสายอาชีพ",
    subtitle: "เรียนรู้จากประสบการณ์จริง พร้อมต่อยอดสู่อาชีพและการศึกษาต่อ",
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1800&q=80",
    altText: "นักเรียนในพื้นที่สถานศึกษา",
    buttonLabel: "สมัครเรียน",
    href: "/departments"
  },
  {
    id: "campus-activities",
    chip: "กิจกรรมวิทยาลัย",
    title: "กิจกรรมเด่นและผลงานนักศึกษา",
    subtitle: "ติดตามภาพกิจกรรม โครงการ และความสำเร็จของนักเรียนนักศึกษา",
    imageUrl: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1800&q=80",
    altText: "กลุ่มนักศึกษาร่วมกิจกรรมในสถานศึกษา",
    buttonLabel: "ดูกิจกรรม",
    href: "/news"
  },
  {
    id: "announcements",
    chip: "บริการข้อมูล",
    title: "ประกาศและข้อมูลเผยแพร่",
    subtitle: "รวมข่าวประกาศ เอกสารสำคัญ และข้อมูลสำหรับผู้เรียน ผู้ปกครอง และชุมชน",
    imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80",
    altText: "พื้นที่ทำงานและเทคโนโลยีสำหรับบริการข้อมูล",
    buttonLabel: "ดูประกาศ",
    href: "/announcements"
  }
];

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

export default function PublicHomeCarousel() {
  ensureCarouselBrowserApis();

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

    if (!emblaApi || isHovering) {
      return stopAutoplay;
    }

    autoplayRef.current = window.setInterval(() => {
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return stopAutoplay;
  }, [emblaApi, isHovering, stopAutoplay]);

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
              {slides.map((slide) => (
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
            {slides.map((slide, index) => (
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
        </Box>
      </Container>
    </Box>
  );
}
