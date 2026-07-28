import { FooterDirectoryGroup } from "../../types";
import { normalizeSafeHref } from "../../utils/safeUrl";

export function getEnabledFooterDirectoryGroups(groups: FooterDirectoryGroup[]) {
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (link) => link.enabled && link.label && link.href && link.href !== "#" && normalizeSafeHref(link.href) !== "#"
      )
    }))
    .filter((group) => group.title && group.links.length > 0);
}
