export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
  href: string;
  enabled: boolean;
  order: number;
  startAt?: string;
  endAt?: string;
  updatedAt: string;
  revision?: number;
}

export type CarouselSlideInput = Partial<CarouselSlide>;
