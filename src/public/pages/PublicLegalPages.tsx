import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import PublicSiteShell from "../components/PublicSiteShell";

interface NoticeSection {
  id: string;
  number: string;
  heading: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}

const privacySections: readonly NoticeSection[] = [
  {
    id: "scope",
    number: "๑",
    heading: "ขอบเขตของประกาศ",
    paragraphs: [
      "ประกาศฉบับนี้ใช้สำหรับการเข้าชมและใช้บริการเว็บไซต์วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด (www.rcat.ac.th) ซึ่งจัดทำขึ้นเพื่อเผยแพร่ข่าวสาร ประกาศ และข้อมูลเกี่ยวกับการดำเนินงานของสถานศึกษา ตลอดจนเป็นช่องทางติดต่อและรับเรื่องร้องเรียน",
      "การเข้าชมข้อมูลสาธารณะโดยทั่วไปไม่จำเป็นต้องแจ้งชื่อหรือข้อมูลติดต่อแก่เว็บไซต์ ทั้งนี้ บริการบางประเภทอาจมีการรับข้อมูลเพิ่มเติมตามที่ผู้ใช้บริการเป็นผู้ให้ไว้"
    ]
  },
  {
    id: "information",
    number: "๒",
    heading: "ข้อมูลที่เกี่ยวข้องกับการใช้บริการ",
    paragraphs: [
      "วิทยาลัยอาจเก็บรวบรวมหรือประมวลผลข้อมูลเท่าที่จำเป็นตามลักษณะของการใช้บริการ ดังต่อไปนี้"
    ],
    items: [
      "ข้อมูลทางเทคนิคที่เกิดจากการเชื่อมต่อและการทำงานของเว็บไซต์ เช่น วันเวลาในการเข้าถึงและข้อมูลที่จำเป็นสำหรับการรักษาความมั่นคงปลอดภัยของระบบ",
      "ข้อมูลสถิติการเข้าชมและประสิทธิภาพเว็บไซต์ ซึ่งระบบวิเคราะห์ที่ไม่จำเป็นจะเริ่มทำงานเมื่อผู้ใช้บริการได้ให้ความยินยอมแล้ว",
      "ข้อมูลที่ผู้ใช้บริการส่งผ่านช่องทางติดต่อหรือแบบฟอร์มร้องเรียน เช่น ชื่อ หมายเลขโทรศัพท์ ที่อยู่อีเมล รายละเอียดเรื่อง และเอกสารแนบตามที่ผู้ใช้บริการส่งเข้ามา",
      "ข้อมูลบัญชีและการใช้งานระบบสำหรับเจ้าหน้าที่เฉพาะผู้มีสิทธิเข้าถึง เพื่อการยืนยันตัวตนและรักษาความปลอดภัย"
    ]
  },
  {
    id: "purposes",
    number: "๓",
    heading: "วัตถุประสงค์ในการใช้ข้อมูล",
    paragraphs: [
      "วิทยาลัยใช้ข้อมูลตามความจำเป็นเพื่อให้บริการเว็บไซต์ ดำเนินการและติดต่อกลับเกี่ยวกับเรื่องที่ได้รับแจ้ง ดูแลความปลอดภัยของระบบ และปรับปรุงประสิทธิภาพการให้บริการ โดยพิจารณาฐานทางกฎหมายให้เหมาะสมกับกิจกรรมแต่ละประเภท ทั้งการดำเนินภารกิจของหน่วยงาน การปฏิบัติตามกฎหมาย และการดำเนินการตามคำขอของผู้ใช้บริการ",
      "ในส่วนของคุกกี้หรือเครื่องมือวิเคราะห์การเข้าชมที่ไม่จำเป็น วิทยาลัยใช้ความยินยอมที่ผู้ใช้บริการแสดงผ่านระบบจัดการคุกกี้ โดยการเข้าชมเว็บไซต์เพียงอย่างเดียวไม่ถือเป็นการให้ความยินยอมดังกล่าว"
    ]
  },
  {
    id: "security",
    number: "๔",
    heading: "การเก็บรักษา ความปลอดภัย และการเปิดเผยข้อมูล",
    paragraphs: [
      "วิทยาลัยดำเนินมาตรการรักษาความมั่นคงปลอดภัยและจำกัดการเข้าถึงข้อมูลตามความเหมาะสม โดยเก็บรักษาข้อมูลเท่าที่จำเป็นต่อวัตถุประสงค์ของการดำเนินงาน หรือตามระยะเวลาที่กฎหมายและระเบียบของทางราชการกำหนด ซึ่งอาจแตกต่างกันตามประเภทข้อมูล",
      "การให้บริการเว็บไซต์อาจเกี่ยวข้องกับผู้ให้บริการโครงสร้างพื้นฐานและระบบวิเคราะห์ที่วิทยาลัยใช้งาน เช่น Cloudflare, Vercel และ Google ทั้งนี้ การส่งต่อหรือเปิดเผยข้อมูลจะดำเนินการเท่าที่จำเป็นเพื่อการให้บริการหรือตามที่กฎหมายกำหนด และผู้ให้บริการบางรายอาจประมวลผลข้อมูลผ่านระบบในต่างประเทศ"
    ]
  },
  {
    id: "rights",
    number: "๕",
    heading: "สิทธิของเจ้าของข้อมูลและช่องทางติดต่อ",
    paragraphs: [
      "เจ้าของข้อมูลส่วนบุคคลสามารถใช้สิทธิตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. ๒๕๖๒ ภายใต้หลักเกณฑ์และข้อยกเว้นที่กฎหมายกำหนด เช่น การขอเข้าถึงหรือแก้ไขข้อมูล การคัดค้านหรือขอให้ลบข้อมูล และการถอนความยินยอมในกรณีที่มีการประมวลผลโดยอาศัยความยินยอม",
      "ผู้ประสงค์สอบถามหรือใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคลสามารถติดต่อวิทยาลัยผ่านหน้าติดต่อของเว็บไซต์ โดยวิทยาลัยอาจตรวจสอบข้อมูลประกอบคำขอเท่าที่จำเป็น และจะทบทวนประกาศเมื่อมีการเปลี่ยนแปลงการให้บริการหรือข้อกำหนดที่เกี่ยวข้อง"
    ]
  }
];

const cookieSections: readonly NoticeSection[] = [
  {
    id: "scope",
    number: "๑",
    heading: "ความหมายและวัตถุประสงค์",
    paragraphs: [
      "เว็บไซต์วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ดใช้คุกกี้และเทคโนโลยีจัดเก็บข้อมูลในเบราว์เซอร์ เพื่อสนับสนุนการทำงานของเว็บไซต์ การรักษาความปลอดภัย และการวิเคราะห์ประสิทธิภาพการให้บริการตามความจำเป็น",
      "คุกกี้เป็นข้อมูลที่เว็บไซต์หรือบริการที่เกี่ยวข้องจัดเก็บไว้ในเบราว์เซอร์ ส่วนพื้นที่จัดเก็บข้อมูลภายในเบราว์เซอร์เป็นเทคโนโลยีอีกประเภทหนึ่ง ซึ่งอาจใช้เพื่อจดจำการตั้งค่าหรือข้อมูลเกี่ยวกับการใช้งานเว็บไซต์"
    ]
  },
  {
    id: "categories",
    number: "๒",
    heading: "ประเภทของคุกกี้ที่ใช้",
    paragraphs: [
      "เว็บไซต์แบ่งคุกกี้และเทคโนโลยีที่เกี่ยวข้องตามวัตถุประสงค์การใช้งานออกเป็นสองประเภท ดังนี้"
    ]
  },
  {
    id: "providers",
    number: "๓",
    heading: "บริการจากผู้ให้บริการภายนอก",
    paragraphs: [
      "เมื่อผู้ใช้บริการให้ความยินยอมสำหรับการวิเคราะห์การใช้งาน เว็บไซต์อาจเปิดใช้เครื่องมือวิเคราะห์ของ Google และ Vercel รวมถึงระบบสถิติผู้เข้าชมของวิทยาลัย เพื่อประกอบการปรับปรุงเว็บไซต์ โดยผู้ให้บริการแต่ละรายอาจมีระยะเวลาจัดเก็บข้อมูลและข้อกำหนดของตนเอง",
      "การเปิดดูสื่อหรือเว็บไซต์ภายนอกผ่านลิงก์หรือเนื้อหาที่ฝังจากบุคคลภายนอกอาจอยู่ภายใต้นโยบายของผู้ให้บริการนั้น จึงควรศึกษาข้อกำหนดของบริการที่เลือกใช้งานเพิ่มเติม"
    ]
  },
  {
    id: "consent",
    number: "๔",
    heading: "การให้และการถอนความยินยอม",
    paragraphs: [
      "ผู้ใช้บริการสามารถเลือกยอมรับ ปฏิเสธ หรือกำหนดการใช้งานคุกกี้เพื่อการวิเคราะห์ผ่านระบบแจ้งการใช้คุกกี้ของเว็บไซต์ และสามารถเปลี่ยนแปลงหรือถอนความยินยอมได้ทุกเมื่อผ่านเมนู “ตั้งค่าคุกกี้” ที่ส่วนท้ายเว็บไซต์ ทั้งนี้ การปฏิเสธคุกกี้ที่ไม่จำเป็นไม่กระทบต่อการอ่านข้อมูลข่าวสารสาธารณะ",
      "เว็บไซต์บันทึกตัวเลือกความยินยอมไว้ในเบราว์เซอร์เป็นระยะเวลาไม่เกิน ๑๘๐ วัน เมื่อถอนความยินยอม ระบบจะหยุดการทำงานของเครื่องมือวิเคราะห์ที่เว็บไซต์ควบคุม และลบข้อมูลสถิติบางส่วนที่จัดเก็บไว้ในเบราว์เซอร์ ส่วนคุกกี้ของผู้ให้บริการภายนอกอาจต้องจัดการผ่านการตั้งค่าเบราว์เซอร์"
    ]
  },
  {
    id: "contact",
    number: "๕",
    heading: "การติดต่อและการเปลี่ยนแปลงนโยบาย",
    paragraphs: [
      "วิทยาลัยอาจปรับปรุงนโยบายฉบับนี้เมื่อมีการเปลี่ยนแปลงรูปแบบการให้บริการหรือเทคโนโลยีที่ใช้ โดยเผยแพร่ข้อความฉบับปรับปรุงผ่านเว็บไซต์ ผู้ใช้บริการสามารถสอบถามรายละเอียดเพิ่มเติมได้ที่หน้าติดต่อของวิทยาลัย"
    ]
  }
];

const cookieCategories = [
  {
    category: "คุกกี้ที่จำเป็น",
    purpose: "สนับสนุนการทำงานพื้นฐาน จดจำตัวเลือกการตั้งค่า และรักษาความปลอดภัยของการเข้าสู่ระบบเจ้าหน้าที่",
    consent: "ไม่ต้องขอความยินยอมสำหรับการทำงานที่จำเป็น"
  },
  {
    category: "คุกกี้เพื่อการวิเคราะห์",
    purpose: "จัดทำสถิติการเข้าชมและประเมินประสิทธิภาพเว็บไซต์ โดยไม่จำเป็นต่อการอ่านข่าวสารและประกาศ",
    consent: "เปิดใช้งานเมื่อผู้ใช้บริการยินยอม"
  }
] as const;

function CookieCategoryTable() {
  return (
    <TableContainer
      sx={{
        mt: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        maxWidth: "100%",
        overflowX: "auto"
      }}
    >
      <Table size="small" aria-label="ประเภทคุกกี้และการให้ความยินยอม" sx={{ minWidth: 520 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ fontWeight: 700 }}>ประเภท</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>วัตถุประสงค์</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>การใช้งาน</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cookieCategories.map((item) => (
            <TableRow key={item.category}>
              <TableCell sx={{ fontWeight: 600, verticalAlign: "top" }}>{item.category}</TableCell>
              <TableCell sx={{ lineHeight: 1.75, verticalAlign: "top" }}>{item.purpose}</TableCell>
              <TableCell sx={{ lineHeight: 1.75, verticalAlign: "top" }}>{item.consent}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function NoticeSectionBlock({ section, isCookie }: { section: NoticeSection; isCookie: boolean }) {
  return (
    <Box
      component="section"
      id={section.id}
      aria-labelledby={"notice-heading-" + section.id}
      sx={{ scrollMarginTop: 100 }}
    >
      <Typography
        component="h2"
        id={"notice-heading-" + section.id}
        sx={{
          color: "text.primary",
          fontSize: { xs: "1.05rem", md: "1.16rem" },
          fontWeight: 800,
          lineHeight: 1.55,
          mb: 1.25
        }}
      >
        ข้อ {section.number} {section.heading}
      </Typography>
      <Stack spacing={1.35}>
        {section.paragraphs.map((paragraph) => (
          <Typography key={paragraph} component="p" variant="body1" sx={{ lineHeight: 1.9, color: "text.primary" }}>
            {paragraph}
          </Typography>
        ))}
        {section.items && (
          <Box component="ol" sx={{ m: 0, pl: { xs: 3, md: 4 }, "& li + li": { mt: 1.1 } }}>
            {section.items.map((item) => (
              <Typography key={item} component="li" variant="body1" sx={{ lineHeight: 1.9, pl: 0.5 }}>
                {item}
              </Typography>
            ))}
          </Box>
        )}
        {isCookie && section.id === "categories" && <CookieCategoryTable />}
      </Stack>
    </Box>
  );
}

function LegalNoticePage({ kind }: { kind: "privacy" | "cookies" }) {
  const isPrivacy = kind === "privacy";
  const title = isPrivacy ? "ประกาศเกี่ยวกับความเป็นส่วนตัวในการใช้เว็บไซต์" : "นโยบายการใช้คุกกี้";
  const englishTitle = isPrivacy ? "Privacy Notice" : "Cookie Policy";
  const introduction = isPrivacy
    ? "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ดจัดทำประกาศฉบับนี้ เพื่อแจ้งให้ผู้ใช้บริการทราบถึงการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลเฉพาะที่เกี่ยวข้องกับการใช้บริการเว็บไซต์ โดยยึดหลักความจำเป็น ความโปร่งใส และการคุ้มครองสิทธิของเจ้าของข้อมูลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. ๒๕๖๒"
    : "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ดจัดทำนโยบายฉบับนี้ เพื่อแจ้งวัตถุประสงค์และแนวทางการใช้คุกกี้ ตลอดจนสิทธิในการเลือกตั้งค่าคุกกี้ของผู้ใช้บริการเว็บไซต์ โดยคำนึงถึงความจำเป็นในการให้บริการและการคุ้มครองข้อมูลส่วนบุคคล";
  const canonicalPath = isPrivacy ? "/privacy-policy" : "/cookie-policy";
  const sections = isPrivacy ? privacySections : cookieSections;

  return (
    <PublicSiteShell title={title} description={englishTitle} canonicalPath={canonicalPath} hidePageHeader>
      <Box component="article" aria-labelledby="legal-notice-title" sx={{ maxWidth: 880, mx: "auto" }}>
        <Box
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: { xs: 1, md: 2 },
            py: { xs: 3, sm: 4, md: 5 },
            px: { xs: 2.25, sm: 4, md: 6 }
          }}
        >
          <Stack spacing={{ xs: 3, md: 3.5 }}>
            <Box component="header" sx={{ textAlign: "center" }}>
              <Typography component="p" sx={{ fontWeight: 700, color: "primary.dark", mb: 1 }}>
                วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด
              </Typography>
              <Typography
                id="legal-notice-title"
                component="h1"
                sx={{ fontSize: { xs: "1.45rem", sm: "1.75rem", md: "1.95rem" }, lineHeight: 1.45, fontWeight: 800 }}
              >
                {title}
              </Typography>
              <Typography component="p" sx={{ color: "text.secondary", fontSize: "0.88rem", mt: 0.75 }}>
                {englishTitle} · www.rcat.ac.th
              </Typography>
            </Box>

            <Divider />

            <Typography component="p" variant="body1" sx={{ lineHeight: 1.9, color: "text.primary" }}>
              {introduction}
            </Typography>

            <Box component="nav" aria-label="สารบัญประกาศ" sx={{ bgcolor: "action.hover", borderRadius: 1, p: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>สารบัญ</Typography>
              <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 3 }}>
                {sections.map((section) => (
                  <Typography key={section.id} component="li" variant="body2" sx={{ lineHeight: 1.75 }}>
                    <Link href={"#" + section.id} underline="hover" color="text.primary">
                      {section.heading}
                    </Link>
                  </Typography>
                ))}
              </Stack>
            </Box>

            {sections.map((section) => (
              <NoticeSectionBlock key={section.id} section={section} isCookie={!isPrivacy} />
            ))}

            <Divider />

            <Box component="footer" sx={{ color: "text.secondary" }}>
              <Typography variant="body2" sx={{ lineHeight: 1.85 }}>
                ประกาศฉบับนี้จัดทำสำหรับการให้บริการเว็บไซต์ของวิทยาลัย โดยอ้างอิงหลักการตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. ๒๕๖๒ และแนวทางการแจ้งข้อมูลของหน่วยงานภาครัฐ
              </Typography>
              <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: "wrap", mt: 1.5 }}>
                <Link href={isPrivacy ? "/cookie-policy" : "/privacy-policy"} underline="hover" variant="body2">
                  {isPrivacy ? "นโยบายการใช้คุกกี้" : "ประกาศเกี่ยวกับความเป็นส่วนตัว"}
                </Link>
                <Link href="/contact" underline="hover" variant="body2">
                  ติดต่อวิทยาลัย
                </Link>
                <Link
                  href="https://gppc.pdpc.or.th/"
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  variant="body2"
                >
                  ข้อมูลเกี่ยวกับกฎหมายคุ้มครองข้อมูลส่วนบุคคล
                </Link>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>
    </PublicSiteShell>
  );
}

export function PublicPrivacyPolicyPage() {
  return <LegalNoticePage kind="privacy" />;
}

export function PublicCookiePolicyPage() {
  return <LegalNoticePage kind="cookies" />;
}
