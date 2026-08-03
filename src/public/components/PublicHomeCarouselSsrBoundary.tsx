import { useEffect, useMemo, useState } from "react";
import { Box, Container } from "@mui/material";
import type { CarouselSlide, HomepageCarouselSettings } from "../../types";
import { normalizeCarouselSlide } from "../../features/cms-carousel/normalization";
import CarouselImageStage from "../../shared/components/CarouselImageStage";
import { usePublicMediaLoading } from "../../shared/media/publicMediaLoadingState";
import PublicHomeCarousel from "./PublicHomeCarousel";
import { isCarouselSlideActive } from "../utils/homeCarousel";
import { PUBLIC_CAROUSEL_IMAGE_SIZES, PUBLIC_CAROUSEL_STAGE_HEIGHTS } from "../utils/homeCarouselPresentation";

const DEFAULT_SLIDE_ALT = "ภาพสไลด์หน้าแรก";

function normalizeInitialNowMs(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

export default function PublicHomeCarouselSsrBoundary({
  slides,
  settings,
  initialNowMs
}: {
  slides: CarouselSlide[];
  settings?: HomepageCarouselSettings;
  initialNowMs?: number;
}) {
  const [enhanced, setEnhanced] = useState(false);
  const { pageMediaAllowed } = usePublicMediaLoading();
  const referenceNowMs = normalizeInitialNowMs(initialNowMs);
  const firstActiveSlide = useMemo(() => {
    for (const slide of slides) {
      const normalized = normalizeCarouselSlide(slide);

      if (isCarouselSlideActive(normalized, referenceNowMs)) {
        return normalized;
      }
    }

    return null;
  }, [referenceNowMs, slides]);

  useEffect(() => {
    setEnhanced(true);
  }, []);

  if (enhanced) {
    return <PublicHomeCarousel slides={slides} settings={settings} />;
  }

  if (!firstActiveSlide) {
    return null;
  }

  const alt = firstActiveSlide.imageAlt || firstActiveSlide.title || DEFAULT_SLIDE_ALT;

  return (
    <Box
      component="section"
      aria-label="สไลด์ประชาสัมพันธ์หน้าแรก"
      data-public-home-carousel-static="true"
      sx={{
        mb: { xs: 2.5, md: 3.5 },
        borderRadius: { xs: 1.5, md: 2 }
      }}
    >
      <Container maxWidth="xl">
        <Box
          data-carousel-slide-stage="true"
          data-carousel-slide-selected="true"
          sx={{
            position: "relative",
            width: "100%",
            height: PUBLIC_CAROUSEL_STAGE_HEIGHTS,
            overflow: "hidden",
            borderRadius: { xs: 1.5, md: 2 },
            bgcolor: "primary.dark",
            boxShadow: "0 18px 34px rgba(31, 90, 44, 0.16)"
          }}
        >
          <CarouselImageStage
            slide={firstActiveSlide}
            alt={alt}
            loading="eager"
            fetchPriority="high"
            sizes={PUBLIC_CAROUSEL_IMAGE_SIZES}
            emptyLabel="ไม่สามารถแสดงภาพสไลด์ได้"
            shouldLoad={pageMediaAllowed}
          />
        </Box>
      </Container>
    </Box>
  );
}
