export type CarouselImageFit = "fill" | "fit" | "fit-blur";

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
  href: string;
  imageFit: CarouselImageFit;
  focalPointX: number;
  focalPointY: number;
  mobileImageUrl: string;
  backgroundColor: string;
  openInNewTab: boolean;
  enabled: boolean;
  order: number;
  startAt?: string;
  endAt?: string;
  updatedAt: string;
  revision?: number;
}

export type CarouselSlideInput = Partial<CarouselSlide>;
