import type { MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import PublicSiteShell from "../components/PublicSiteShell";

type ItaIndicatorGroup = "9" | "10";

export interface ItaResourceLink {
  label: string;
  href: string;
}

export interface ItaItem {
  code: string;
  title: string;
  links: ItaResourceLink[];
}

export interface ItaSection {
  id: string;
  indicator: string;
  title: string;
  range: string;
  group: ItaIndicatorGroup;
  items: ItaItem[];
}

const RCAT_ORIGIN = "https://www.rcat.ac.th";

type ItaInternalTarget =
  { kind: "home"; hash: string } | { kind: "static"; to: "/contact" | "/news" } | { kind: "permalink"; slug: string };

/**
 * แก้ลิงก์เอกสาร ITA 2569 ตรง ITA_SECTIONS เท่านั้น
 * - เปลี่ยน href เป็น URL ที่ต้องการ
 * - เปลี่ยน label ได้ตามข้อความที่ต้องการให้แสดง
 * - หากหัวข้อเดียวมีหลายลิงก์ ให้เพิ่ม { label: "...", href: "..." } ใน links
 */
const ITA_SECTIONS: ItaSection[] = [
  {
    id: "indicator-9-1",
    indicator: "ตัวชี้วัดย่อยที่ 9.1",
    title: "ข้อมูลพื้นฐาน",
    range: "O1–O5",
    group: "9",
    items: [
      {
        code: "O1",
        title: "โครงสร้างและอำนาจหน้าที่",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/rcat-organization" }]
      },
      {
        code: "O2",
        title: "ข้อมูลผู้บริหารสถานศึกษา",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/rcat-director" }]
      },
      {
        code: "O3",
        title: "แผนพัฒนาสถานศึกษา",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/development-plan" }]
      },
      {
        code: "O4",
        title: "ข้อมูลการติดต่อ",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/contact" }]
      },
      {
        code: "O5",
        title: "กฎหมายที่เกี่ยวข้อง",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1tTaQEtfDpLbucjtkzxnNmtZfSCdcgxQX&usp=drive_fs"
          }
        ]
      }
    ]
  },
  {
    id: "indicator-9-2",
    indicator: "ตัวชี้วัดย่อยที่ 9.2",
    title: "การบริหารงาน ปฏิสัมพันธ์ข้อมูล และการดำเนินงาน",
    range: "O6–O9",
    group: "9",
    items: [
      {
        code: "O6",
        title: "แผนปฏิบัติราชการและแผนการใช้จ่ายงบประมาณประจำปี",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/action-plan" }]
      },
      {
        code: "O7",
        title: "รายงานผลการดำเนินงานของสถานศึกษาประจำปี",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1uXOZ0BHbIAb_YLNEMCuNUOTqN82AXs7c&usp=drive_fs"
          }
        ]
      },
      {
        code: "O8",
        title: "รายงานผลการประเมินตนเอง (SAR) ของสถานศึกษาประจำปี",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/sar" }]
      },
      {
        code: "O9",
        title: "ข่าวประชาสัมพันธ์",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/news" }]
      }
    ]
  },
  {
    id: "indicator-9-3",
    indicator: "ตัวชี้วัดย่อยที่ 9.3",
    title: "การจัดซื้อจัดจ้างหรือการจัดหาพัสดุ",
    range: "O10–O11",
    group: "9",
    items: [
      {
        code: "O10",
        title: "ประกาศต่าง ๆ เกี่ยวกับการจัดซื้อจัดจ้างหรือการจัดหาพัสดุ",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1GyJinLTWeP940I0am4dvyjc2eVaz3obW&usp=drive_fs"
          }
        ]
      },
      {
        code: "O11",
        title: "รายงานผลการจัดซื้อจัดจ้างหรือการจัดหาพัสดุประจำปี",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=16oGiE8AiXpD8PyTRRFK2WxVCLNFCZqvm&usp=drive_fs"
          }
        ]
      }
    ]
  },
  {
    id: "indicator-9-4",
    indicator: "ตัวชี้วัดย่อยที่ 9.4",
    title: "การปฏิบัติหน้าที่",
    range: "O12–O15",
    group: "9",
    items: [
      {
        code: "O12",
        title: "คู่มือหรือขั้นตอนการปฏิบัติงานภายในสถานศึกษา",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1YHiu7A1jW3v0RL7YVsFUZNQtaLxS4HFm&usp=drive_fs"
          }
        ]
      },
      {
        code: "O13",
        title: "คู่มือหรือขั้นตอนการให้บริการ",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1tBCJfsbg5Tsby9lhAZTO1apRf8zgeQA2&usp=drive_fs"
          }
        ]
      },
      {
        code: "O14",
        title: "E-Service",
        links: [{ label: "เปิดข้อมูล", href: "https://www.rcat.ac.th/#e-service" }]
      },
      {
        code: "O15",
        title: "ข้อมูลเชิงสถิติและความพึงพอใจต่อการให้บริการ",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1Flnk1IvIqP3dlc4TAB3hxsCENI_TTj7j&usp=drive_fs"
          }
        ]
      }
    ]
  },
  {
    id: "indicator-9-5",
    indicator: "ตัวชี้วัดย่อยที่ 9.5",
    title: "การบริหารและพัฒนาทรัพยากรบุคคล",
    range: "O16–O17",
    group: "9",
    items: [
      {
        code: "O16",
        title: "การบริหารและพัฒนาทรัพยากรบุคคล",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1GCmOmnlIOY4gHU2cF7rW5l8YqhDEpUZn&usp=drive_fs"
          }
        ]
      },
      {
        code: "O17",
        title: "ประมวลจริยธรรมและการขับเคลื่อนจริยธรรมของข้าราชการครูและบุคลากรทางการศึกษา",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1D1v0DuRxGkB4EvwVbT-hAGp1htstxbf-&usp=drive_fs"
          }
        ]
      }
    ]
  },
  {
    id: "indicator-10-1",
    indicator: "ตัวชี้วัดย่อยที่ 10.1",
    title: "การจัดการเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
    range: "O18–O19",
    group: "10",
    items: [
      {
        code: "O18",
        title: "แนวทางปฏิบัติการจัดการร้องเรียนการทุจริตและประพฤติมิชอบ",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1sJPjuI47Bt9uq5MK_VUZS3ILP5lVF6rd&usp=drive_fs"
          }
        ]
      },
      {
        code: "O19",
        title: "ข้อมูลเชิงสถิติเรื่องร้องเรียนการทุจริตและประพฤติมิชอบ",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1yZ47N9xrEFvFqBPE2SSZcwHI4f3kdQCM&usp=drive_fs"
          }
        ]
      }
    ]
  },
  {
    id: "indicator-10-2",
    indicator: "ตัวชี้วัดย่อยที่ 10.2",
    title: "มาตรการภายในเพื่อป้องกันการทุจริต",
    range: "O20–O23",
    group: "10",
    items: [
      {
        code: "O20",
        title: "ประกาศเจตนารมณ์นโยบายไม่รับของขวัญ (No Gift Policy)",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1W9AgBcPHVGwO3Gz9iXfsjOnvCIeEE1Mx&usp=drive_fs"
          }
        ]
      },
      {
        code: "O21",
        title: "การประเมินผลควบคุมภายในของสถานศึกษา",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1q5iOCxUCENzcJ7GTJbbN7ADaxKR9y4DX&usp=drive_fs"
          }
        ]
      },
      {
        code: "O22",
        title: "การเสริมสร้างวัฒนธรรมองค์กรให้มีความซื่อสัตย์สุจริต",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=1CKf4ZsU1QvaUh0SBTvbHQuKWm-6w_7cc&usp=drive_fs"
          }
        ]
      },
      {
        code: "O23",
        title: "มาตรการส่งเสริมคุณธรรมและความโปร่งใสภายในสถานศึกษา",
        links: [
          {
            label: "เปิดข้อมูล",
            href: "https://drive.google.com/open?id=19ukICUTYplRaBVqa86TtSMBSo1BieISQ&usp=drive_fs"
          }
        ]
      }
    ]
  }
];

const INDICATOR_SUMMARIES = [
  {
    group: "9" as const,
    label: "ตัวชี้วัดที่ 9",
    range: "O1–O17",
    title: "การเปิดเผยข้อมูล",
    detail: "ข้อมูลพื้นฐาน การบริหารงาน พัสดุ การปฏิบัติหน้าที่ และทรัพยากรบุคคล"
  },
  {
    group: "10" as const,
    label: "ตัวชี้วัดที่ 10",
    range: "O18–O23",
    title: "การป้องกันการทุจริต",
    detail: "การจัดการเรื่องร้องเรียนและมาตรการภายในเพื่อป้องกันการทุจริต"
  }
];

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function getInternalRcatTarget(href: string): ItaInternalTarget | null {
  try {
    const url = new URL(href, RCAT_ORIGIN);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (url.origin !== RCAT_ORIGIN) {
      return null;
    }

    if (pathname === "/") {
      return { kind: "home", hash: url.hash.replace(/^#/, "") };
    }

    if (pathname === "/contact" || pathname === "/news") {
      return { kind: "static", to: pathname };
    }

    const slug = pathname.slice(1);
    if (!slug || slug.includes("/")) {
      return null;
    }

    return { kind: "permalink", slug };
  } catch {
    return null;
  }
}

function ItaInternalLink({ link, target }: { link: ItaResourceLink; target: ItaInternalTarget }) {
  const navigate = useNavigate();

  return (
    <a
      href={link.href}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) {
          return;
        }

        event.preventDefault();

        if (target.kind === "home") {
          if (target.hash) {
            void navigate({
              to: "/",
              hash: target.hash,
              resetScroll: false,
              hashScrollIntoView: false
            });
            return;
          }

          void navigate({ to: "/" });
          return;
        }

        if (target.kind === "static") {
          void navigate({ to: target.to });
          return;
        }

        void navigate({ to: "/$slug", params: { slug: target.slug } });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-rcat-green px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rcat-deep-green focus:outline-none focus:ring-4 focus:ring-emerald-100"
    >
      {link.label || "เปิดข้อมูล"}
      <span aria-hidden="true">→</span>
    </a>
  );
}

function ItaLinkButton({ link }: { link: ItaResourceLink }) {
  if (!link.href.trim()) {
    return (
      <span className="inline-flex items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
        รอใส่ลิงก์
      </span>
    );
  }

  const internalTarget = getInternalRcatTarget(link.href);

  if (internalTarget) {
    return <ItaInternalLink link={link} target={internalTarget} />;
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg bg-rcat-green px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rcat-deep-green focus:outline-none focus:ring-4 focus:ring-emerald-100"
    >
      {link.label || "เปิดข้อมูล"}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function ItaSectionCard({ section }: { section: ItaSection }) {
  const isIndicatorTen = section.group === "10";

  return (
    <section
      id={section.id}
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div
        className={
          isIndicatorTen
            ? "border-b border-amber-200 bg-amber-50 px-5 py-5 md:px-7"
            : "border-b border-emerald-200 bg-emerald-50 px-5 py-5 md:px-7"
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className={isIndicatorTen ? "text-sm font-bold text-amber-800" : "text-sm font-bold text-emerald-800"}>
              {section.indicator}
            </p>
            <h2 className="mt-1 text-xl font-extrabold leading-snug text-slate-900 md:text-2xl">{section.title}</h2>
          </div>
          <span
            className={
              isIndicatorTen
                ? "w-fit rounded-full bg-amber-200 px-3 py-1 text-xs font-extrabold text-amber-900"
                : "w-fit rounded-full bg-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-900"
            }
          >
            {section.range}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {section.items.map((item) => (
          <article
            key={item.code}
            data-ita-code={item.code}
            className="grid gap-4 px-5 py-5 transition hover:bg-slate-50 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:items-center md:px-7"
          >
            <div className="flex items-center gap-3 md:block">
              <span
                className={
                  isIndicatorTen
                    ? "inline-flex min-w-14 justify-center rounded-xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-800"
                    : "inline-flex min-w-14 justify-center rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800"
                }
              >
                {item.code}
              </span>
            </div>
            <h3 className="text-sm font-bold leading-6 text-slate-800 md:text-base">{item.title}</h3>
            <div className="flex flex-wrap gap-2 md:max-w-72 md:justify-end">
              {item.links.map((link, index) => (
                <ItaLinkButton key={`${item.code}-${index}-${link.label}`} link={link} />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PublicIta2569Page() {
  return (
    <PublicSiteShell
      title="ITA ประจำปีงบประมาณ พ.ศ. 2569"
      description="การเปิดเผยข้อมูลสาธารณะ (OIT) ของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ประจำปีงบประมาณ พ.ศ. 2569"
      canonicalPath="/ita2569"
      hidePageHeader
    >
      <div className="w-full [font-family:'Sarabun',sans-serif]">
        <section className="relative isolate overflow-hidden rounded-3xl bg-rcat-deep-green px-5 py-10 text-white shadow-xl md:px-10 md:py-14">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-rcat-yellow/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div
              aria-label="ITA 2569"
              className="mx-auto mb-5 flex h-20 w-20 flex-col items-center justify-center rounded-2xl border border-white/30 bg-white/10 shadow-lg ring-4 ring-white/10 backdrop-blur"
            >
              <span className="text-xl font-black leading-none text-amber-200">ITA</span>
              <span className="mt-1 text-xs font-extrabold tracking-wider text-white">2569</span>
            </div>
            <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-extrabold tracking-wider text-amber-200 backdrop-blur">
              ITA 2569 · OPEN DATA INTEGRITY AND TRANSPARENCY ASSESSMENT
            </span>
            <h1 className="mx-auto mt-5 max-w-4xl text-2xl font-black leading-tight md:text-4xl">
              การประเมินคุณธรรมและความโปร่งใสในการดำเนินงาน
            </h1>
            <p className="mt-3 text-lg font-bold text-emerald-50 md:text-2xl">ประจำปีงบประมาณ พ.ศ. 2569</p>
            <p className="mx-auto mt-5 max-w-3xl text-sm font-medium leading-7 text-emerald-50/90 md:text-base">
              วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด เผยแพร่ข้อมูลสาธารณะตามแบบวัดการเปิดเผยข้อมูลสาธารณะ (OIT)
              เพื่อส่งเสริมคุณธรรม ความโปร่งใส และการตรวจสอบได้ของสถานศึกษา
            </p>
          </div>
        </section>

        <section
          aria-label="สรุปตัวชี้วัด"
          className="relative z-10 mx-auto -mt-5 grid max-w-5xl gap-4 px-3 md:grid-cols-3"
        >
          {INDICATOR_SUMMARIES.map((summary) => (
            <div
              key={summary.group}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-extrabold text-rcat-deep-green">{summary.label}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                  {summary.range}
                </span>
              </div>
              <p className="mt-3 text-lg font-black text-slate-900">{summary.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{summary.detail}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-lg shadow-amber-100/60">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-amber-800">ข้อมูล OIT</span>
              <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black text-amber-900">O1–O23</span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">23 หัวข้อ</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              จัดกลุ่มตามตัวชี้วัดที่ 9 และตัวชี้วัดที่ 10 เพื่อค้นหาข้อมูลได้สะดวก
            </p>
          </div>
        </section>

        <div className="mx-auto mt-8 max-w-6xl">
          <nav
            aria-label="สารบัญ ITA 2569"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-slate-900">เลือกหมวดข้อมูล</p>
              <span className="text-xs font-semibold text-slate-400">7 หมวด</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ITA_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-rcat-green hover:bg-emerald-50 hover:text-rcat-deep-green focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                  {section.indicator.replace("ตัวชี้วัดย่อยที่ ", "")} · {section.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-950">
            <strong>หมายเหตุ:</strong>{" "}
            ข้อมูลในหน้านี้จัดทำเพื่อการเปิดเผยข้อมูลสาธารณะของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ประจำปีงบประมาณ พ.ศ.
            2569 โดยลิงก์เอกสารแต่ละรายการสามารถเผยแพร่จากเว็บไซต์หรือแหล่งข้อมูลภายนอกได้
          </div>

          <div className="mt-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-emerald-200" />
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Indicator 9</p>
              <h2 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">ตัวชี้วัดที่ 9 การเปิดเผยข้อมูล</h2>
            </div>
            <div className="h-px flex-1 bg-emerald-200" />
          </div>

          <div className="mt-6 space-y-6">
            {ITA_SECTIONS.filter((section) => section.group === "9").map((section) => (
              <ItaSectionCard key={section.id} section={section} />
            ))}
          </div>

          <div className="mt-12 flex items-center gap-4">
            <div className="h-px flex-1 bg-amber-200" />
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-700">Indicator 10</p>
              <h2 className="mt-1 text-xl font-black text-slate-900 md:text-2xl">
                ตัวชี้วัดที่ 10 การป้องกันการทุจริต
              </h2>
            </div>
            <div className="h-px flex-1 bg-amber-200" />
          </div>

          <div className="mt-6 space-y-6">
            {ITA_SECTIONS.filter((section) => section.group === "10").map((section) => (
              <ItaSectionCard key={section.id} section={section} />
            ))}
          </div>

          <footer className="mt-10 rounded-2xl bg-slate-900 px-5 py-7 text-center text-white md:px-8">
            <p className="font-extrabold">วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              การประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของสถานศึกษา ประจำปีงบประมาณ พ.ศ. 2569
            </p>
          </footer>
        </div>
      </div>
    </PublicSiteShell>
  );
}
