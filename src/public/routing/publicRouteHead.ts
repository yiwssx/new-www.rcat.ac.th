import { projectSettings } from "../../config/projectSettings";
import { buildDocumentTitle, resolveCanonicalUrl } from "../../utils/seo";

export interface PublicRouteHeadInput {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  canonicalPath?: string;
  robots?: string;
  siteName?: string;
}

export interface StaticPublicRouteHead {
  title?: string;
  description: string;
  canonicalPath: string;
  robots?: string;
}

const DEFAULT_PUBLIC_DESCRIPTION = "เว็บไซต์ประชาสัมพันธ์และระบบจัดการเนื้อหาของสถานศึกษา";

export const STATIC_PUBLIC_ROUTE_HEADS: Readonly<Record<string, StaticPublicRouteHead>> = {
  "/": {
    description: DEFAULT_PUBLIC_DESCRIPTION,
    canonicalPath: "/"
  },
  "/news": {
    title: "ข่าว",
    description: "กิจกรรมล่าสุด เรื่องราวในสถานศึกษา และข่าวประชาสัมพันธ์จาก CMS",
    canonicalPath: "/news"
  },
  "/announcements": {
    title: "ประกาศ",
    description: "ประกาศราชการ ข้อมูลการรับสมัคร และเอกสารสาธารณะที่เผยแพร่โดยสถานศึกษา",
    canonicalPath: "/announcements"
  },
  "/achievements": {
    title: "ผลงานและความภาคภูมิใจ",
    description: "ผลงาน รางวัล และความสำเร็จของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    canonicalPath: "/achievements"
  },
  "/blog": {
    title: "บทความ",
    description: "บทความและเนื้อหาระยะยาวที่เผยแพร่จาก CMS",
    canonicalPath: "/blog"
  },
  "/departments": {
    title: "หลักสูตร",
    description: "ข้อมูลหลักสูตรที่เผยแพร่จาก CMS",
    canonicalPath: "/departments"
  },
  "/documents": {
    title: "เอกสารเผยแพร่",
    description: "เอกสารเผยแพร่ของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    canonicalPath: "/documents"
  },
  "/calendar": {
    title: "กำหนดการ",
    description: "กำหนดการและกิจกรรมสาธารณะของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
    canonicalPath: "/calendar"
  },
  "/contact": {
    title: "ติดต่อ",
    description: "ข้อมูลติดต่อที่เผยแพร่จาก CMS",
    canonicalPath: "/contact"
  },
  "/search": {
    title: "ค้นหา",
    description: "ค้นหาเนื้อหา ข่าว ประกาศ หลักสูตร และบทความในเว็บไซต์",
    canonicalPath: "/search",
    robots: "noindex,follow"
  }
};

export function buildPublicRouteHead(input: PublicRouteHeadInput) {
  const siteName = input.siteName?.trim() || projectSettings.site.name;
  const title = buildDocumentTitle(input.title, siteName);
  const description = input.description?.trim();
  const canonicalHref = resolveCanonicalUrl({
    canonicalUrl: input.canonicalUrl,
    canonicalPath: input.canonicalPath
  });
  const robots = input.robots?.trim();

  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),
      ...(robots ? [{ name: "robots", content: robots }] : [])
    ],
    links: canonicalHref ? [{ rel: "canonical", href: canonicalHref }] : []
  };
}

export function getStaticPublicRouteHead(pathname: string) {
  return buildPublicRouteHead(STATIC_PUBLIC_ROUTE_HEADS[pathname] ?? { description: DEFAULT_PUBLIC_DESCRIPTION });
}

export function getPublicContentRouteHead(slug: string) {
  const normalizedSlug = String(slug || "").trim();

  return buildPublicRouteHead({
    title: "เนื้อหา",
    description: "เนื้อหาที่เผยแพร่ต่อสาธารณะของสถานศึกษา",
    canonicalPath: normalizedSlug ? `/content/${normalizedSlug}` : undefined
  });
}

export function getCmsRouteHead() {
  return buildPublicRouteHead({
    title: "ระบบจัดการเนื้อหา",
    robots: "noindex,nofollow"
  });
}
