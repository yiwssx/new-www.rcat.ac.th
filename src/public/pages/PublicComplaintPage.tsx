import { ChangeEvent, FormEvent, useRef, useState } from "react";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";
import PublicSiteShell from "../components/PublicSiteShell";

const MAX_FILE_MB = 1.5;
const MAX_FILES = 3;
const MAX_TOTAL_MB = 5;
const REQUEST_TIMEOUT_MS = 25_000;
const ALLOWED_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

const STATUS_CLASS = {
  idle: "mt-5 min-h-6 text-center text-sm font-semibold text-slate-600",
  loading: "mt-5 min-h-6 text-center text-sm font-semibold text-slate-600",
  error: "mt-5 min-h-6 text-center text-sm font-semibold text-rose-600",
  success: "mt-5 min-h-6 text-center text-sm font-semibold text-emerald-600"
} as const;

type ComplaintField = "subject" | "name" | "email" | "phone" | "complaint" | "files";
type StatusType = keyof typeof STATUS_CLASS;

interface ComplaintAttachment {
  fileName: string;
  data: string;
  mimeType: string;
}

interface ComplaintPayload {
  subject: string;
  name: string;
  email: string;
  phone: string;
  complaint: string;
  ua: string;
  files?: ComplaintAttachment[];
}

interface ComplaintApiResponse {
  ok?: boolean;
  message?: string;
}

class ComplaintFormError extends Error {
  readonly field?: ComplaintField;

  constructor(message: string, field?: ComplaintField) {
    super(message);
    this.name = "ComplaintFormError";
    this.field = field;
  }
}

const sanitize = (value: string) => String(value || "").trim();
const normalizePhone = (value: string) => sanitize(value).replace(/\D/g, "");

function validate(data: ComplaintPayload) {
  if (!data.subject) return new ComplaintFormError("กรุณาเลือกหัวข้อ", "subject");
  if (data.name.length < 2) return new ComplaintFormError("กรอกชื่อให้ครบ", "name");

  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) {
    return new ComplaintFormError("อีเมลไม่ถูกต้อง", "email");
  }

  if (!/^[0-9]{9,10}$/.test(data.phone)) {
    return new ComplaintFormError("เบอร์โทรไม่ถูกต้อง", "phone");
  }

  if (data.complaint.length < 5) {
    return new ComplaintFormError("รายละเอียดสั้นเกินไป", "complaint");
  }

  return null;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new ComplaintFormError("ไม่สามารถอ่านไฟล์แนบได้", "files"));
        return;
      }

      resolve(reader.result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new ComplaintFormError("ไม่สามารถอ่านไฟล์แนบได้", "files"));
    reader.readAsDataURL(file);
  });
}

async function readFiles(list: File[]) {
  if (list.length > MAX_FILES) {
    throw new ComplaintFormError(`แนบได้ไม่เกิน ${MAX_FILES} ไฟล์`, "files");
  }

  let total = 0;
  const results: ComplaintAttachment[] = [];

  for (const file of list) {
    total += file.size;

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      throw new ComplaintFormError(`ไฟล์ ${file.name} ต้องเป็น JPG, PNG, GIF, WEBP หรือ PDF`, "files");
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new ComplaintFormError(`ไฟล์ ${file.name} ใหญ่เกินกำหนด`, "files");
    }

    if (total > MAX_TOTAL_MB * 1024 * 1024) {
      throw new ComplaintFormError("ขนาดไฟล์รวมเกิน 5MB", "files");
    }

    results.push({
      fileName: file.name,
      data: await readFileAsBase64(file),
      mimeType: file.type
    });
  }

  return results;
}

async function submitToApi(data: ComplaintPayload) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/complaint", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    const parsed = (await response.json()) as ComplaintApiResponse;

    if (!response.ok || !parsed.ok) {
      throw new ComplaintFormError(parsed.message || "ระบบขัดข้อง");
    }

    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ComplaintFormError("ระบบใช้เวลาตอบกลับนานเกินไป กรุณาลองใหม่อีกครั้ง");
    }

    if (error instanceof ComplaintFormError) {
      throw error;
    }

    throw new ComplaintFormError("ไม่สามารถส่งเรื่องร้องเรียนได้ กรุณาลองใหม่อีกครั้ง");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const defaultForm = {
  subject: "",
  name: "",
  email: "",
  phone: "",
  complaint: ""
};

export default function PublicComplaintPage() {
  const [formData, setFormData] = useState(defaultForm);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: "idle", message: "" });

  const subjectRef = useRef<HTMLSelectElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const complaintRef = useRef<HTMLTextAreaElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files || []));
  };

  const focusField = (field?: ComplaintField) => {
    const target =
      field === "subject"
        ? subjectRef.current
        : field === "name"
          ? nameRef.current
          : field === "email"
            ? emailRef.current
            : field === "phone"
              ? phoneRef.current
              : field === "complaint"
                ? complaintRef.current
                : field === "files"
                  ? filesRef.current
                  : null;

    target?.focus();
  };

  const setError = (error: unknown) => {
    const formError = error instanceof ComplaintFormError ? error : new ComplaintFormError("ระบบขัดข้อง");
    setStatus({ type: "error", message: formError.message || "ระบบขัดข้อง" });
    focusField(formError.field);
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setFiles([]);
    if (filesRef.current) filesRef.current.value = "";
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      setStatus({ type: "loading", message: "กำลังส่งข้อมูล..." });

      const data: ComplaintPayload = {
        subject: sanitize(formData.subject),
        name: sanitize(formData.name),
        email: sanitize(formData.email),
        phone: normalizePhone(formData.phone),
        complaint: sanitize(formData.complaint),
        ua: navigator.userAgent
      };

      const issue = validate(data);
      if (issue) throw issue;

      data.files = await readFiles(files);
      const result = await submitToApi(data);

      setStatus({ type: "success", message: result.message || "ส่งสำเร็จ" });
      resetForm();
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  const cardClass = loading
    ? "form-shell rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-300/50 backdrop-blur transition md:p-8 opacity-70 pointer-events-none"
    : "form-shell rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-300/50 backdrop-blur transition md:p-8";

  return (
    <PublicSiteShell
      title="แบบฟอร์มแจ้งเรื่องร้องเรียน"
      description="กรอกข้อมูลให้ครบถ้วน ระบบจะส่งเรื่องให้ผู้ดูแลทันที"
      canonicalPath="/complaint"
    >
      <div className="relative isolate w-full overflow-hidden rounded-3xl bg-slate-100 px-4 py-10 text-slate-800 [font-family:'Sarabun',sans-serif]">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-300/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-60 w-60 rounded-full bg-cyan-300/50 blur-3xl" />

        <div className="relative mx-auto w-full max-w-2xl">
          <section id="formCard" className={cardClass}>
            <div className="mb-8 text-center">
              <PublicResponsiveImage
                source="/rcat-logo-128.png"
                intent="logo"
                alt="RCAT Logo"
                intrinsic
                width={80}
                height={80}
                loadMode="eager"
                bypassPageMediaGate
                className="mx-auto mb-4 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200"
              />
              <p className="text-m font-medium text-slate-500">วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด</p>
              <p className="text-sm font-medium text-slate-500">Roi-et College of Agriculture and Technology</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">แบบฟอร์มแจ้งเรื่องร้องเรียน</h2>
              <p className="mt-1 text-sm text-slate-500">กรอกข้อมูลให้ครบถ้วน ระบบจะส่งเรื่องให้ผู้ดูแลทันที</p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label htmlFor="subject" className="mb-1 block text-sm font-semibold text-slate-700">
                  หัวข้อร้องเรียน
                </label>
                <select
                  ref={subjectRef}
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">-- เลือกหัวข้อที่ร้องเรียน --</option>
                  <option value="การเรียนการสอน">การเรียนการสอน</option>
                  <option value="ครู/บุคลากร">ครู/บุคลากร</option>
                  <option value="อาคารสถานที่">อาคารสถานที่</option>
                  <option value="ระบบไอที">ระบบไอที</option>
                  <option value="การเงิน/พัสดุ">การเงิน/พัสดุ</option>
                  <option value="อื่น ๆ">อื่น ๆ</option>
                </select>
              </div>

              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-semibold text-slate-700">
                  ชื่อ-นามสกุล
                </label>
                <input
                  ref={nameRef}
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="เช่น สมชาย ใจดี"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">
                    อีเมล (ถ้ามี)
                  </label>
                  <input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-slate-700">
                    เบอร์โทร
                  </label>
                  <input
                    ref={phoneRef}
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="08xxxxxxxx"
                    required
                    className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="complaint" className="mb-1 block text-sm font-semibold text-slate-700">
                  รายละเอียดเรื่องร้องเรียน
                </label>
                <textarea
                  ref={complaintRef}
                  id="complaint"
                  name="complaint"
                  rows={4}
                  value={formData.complaint}
                  onChange={handleChange}
                  placeholder="ระบุเหตุการณ์ สถานที่ และรายละเอียดที่เกี่ยวข้อง"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="files" className="mb-1 block text-sm font-semibold text-slate-700">
                  แนบไฟล์ (ภาพ/PDF)
                </label>
                <input
                  ref={filesRef}
                  id="files"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.jpg,.jpeg,.png,.gif,.webp,.pdf"
                  onChange={handleFiles}
                  className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:border-blue-300"
                />
                <p className="mt-1 text-xs text-slate-500">
                  แนบได้สูงสุด 3 ไฟล์ ขนาดรวมไม่เกิน 5MB รองรับ JPG, PNG, GIF, WEBP และ PDF
                </p>
              </div>

              <button
                id="submitBtn"
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-300/40 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
              >
                {loading ? "กำลังส่ง..." : "ส่งเรื่องร้องเรียน"}
              </button>
            </form>

            <div
              id="status"
              className={STATUS_CLASS[status.type]}
              role={status.type === "error" ? "alert" : undefined}
              aria-live="polite"
            >
              {status.message}
            </div>
          </section>
        </div>
      </div>
    </PublicSiteShell>
  );
}
