import type { SiteSettings } from "../../../features/cms-settings/types";
import { normalizeLeadershipSettings } from "../../../services/siteSettings";

export interface LeadershipPortrait {
  slot: number;
  name: string;
  title: string;
  description: string;
  imageUrl: string;
}

export function getHomepageLeadershipPortraits(site: SiteSettings): LeadershipPortrait[] {
  const portraits: LeadershipPortrait[] = [];
  // Existing director settings are still the authoritative first slot.
  if (site.directorName || site.directorTitle || site.directorDescription || site.directorImageUrl) {
    portraits.push({
      slot: 0,
      name: site.directorName,
      title: site.directorTitle,
      description: site.directorDescription,
      imageUrl: site.directorImageUrl
    });
  }

  const { deputies } = normalizeLeadershipSettings(site.leadership);
  deputies.forEach((deputy, index) => {
    // A title or image alone must never turn a vacant deputy slot into a
    // fictitious executive. Missing images are handled by the portrait card.
    if (!deputy.enabled || !deputy.name) return;
    portraits.push({
      slot: index + 1,
      name: deputy.name,
      title: deputy.title,
      description: deputy.description,
      imageUrl: deputy.imageUrl
    });
  });
  return portraits;
}

export function getLoopedLeadershipIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}
