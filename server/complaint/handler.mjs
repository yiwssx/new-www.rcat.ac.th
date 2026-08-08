import process from "node:process";

const MAX_REQUEST_BODY_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 3;
const UPSTREAM_TIMEOUT_MS = 20_000;
const ALLOWED_SUBJECTS = new Set([
  "การเรียนการสอน",
  "ครู/บุคลากร",
  "อาคารสถานที่",
  "ระบบไอที",
  "การเงิน/พัสดุ",
  "อื่น ๆ"
]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const EXTENSION_BY_MIME = new Map([
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
  ["image/gif", new Set(["gif"])],
  ["image/webp", new Set(["webp"])],
  ["application/pdf", new Set(["pdf"])]
]);

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function getHeader(request, name) {
  const value = request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "") : typeof value === "string" ? value : "";
}

function isSameOriginRequest(request) {
  const origin = getHeader(request, "origin");
  if (!origin) return true;

  const host = getHeader(request, "x-forwarded-host") || getHeader(request, "host");
  const protocol = getHeader(request, "x-forwarded-proto");

  try {
    const parsed = new URL(origin);
    return (
      Boolean(host) &&
      parsed.host.toLowerCase() === host.toLowerCase() &&
      (!protocol || parsed.protocol === `${protocol}:`)
    );
  } catch {
    return false;
  }
}

function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  return Buffer.from(JSON.stringify(body));
}

async function readRequestBody(request) {
  if (request.body !== undefined) {
    const body = bodyToBuffer(request.body);
    if (body.length > MAX_REQUEST_BODY_BYTES) throw new RangeError("request body is too large");
    return body;
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_REQUEST_BODY_BYTES) throw new RangeError("request body is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function readComplaintEndpoint(env) {
  const value = String(env.COMPLAINT_API_URI || env.VITE_COMPLAINT_API_URI || "").trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const validPath = /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !validPath || url.search || url.hash) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isBase64(value) {
  return (
    typeof value === "string" && value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

function hasExpectedMagic(buffer, mimeType) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg")
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png")
    return (
      buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  if (mimeType === "image/gif") return buffer.subarray(0, 4).toString("ascii") === "GIF8";
  if (mimeType === "image/webp")
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  return false;
}

function validateAttachment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("ไฟล์แนบไม่ถูกต้อง");

  const fileName = normalizeString(value.fileName, 180);
  const mimeType = normalizeString(value.mimeType, 80).toLowerCase();
  const data = typeof value.data === "string" ? value.data.trim() : "";

  if (!fileName || !ALLOWED_MIME_TYPES.has(mimeType) || !isBase64(data)) {
    throw new TypeError("ไฟล์แนบไม่ถูกต้อง");
  }

  const extension = fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
  if (!EXTENSION_BY_MIME.get(mimeType)?.has(extension)) throw new TypeError(`ชนิดไฟล์ ${fileName} ไม่ตรงกับนามสกุล`);

  const buffer = Buffer.from(data, "base64");
  if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) throw new RangeError(`ไฟล์ ${fileName} ใหญ่เกินกำหนด`);
  if (!hasExpectedMagic(buffer, mimeType)) throw new TypeError(`เนื้อหาไฟล์ ${fileName} ไม่ตรงกับชนิดไฟล์`);

  return { fileName, mimeType, data, byteLength: buffer.length };
}

function validatePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("ข้อมูลร้องเรียนไม่ถูกต้อง");

  const subject = normalizeString(value.subject, 80);
  const name = normalizeString(value.name, 160);
  const email = normalizeString(value.email, 254);
  const phone = normalizeString(value.phone, 20).replace(/\D/g, "");
  const complaint = normalizeString(value.complaint, 10_000);
  const ua = normalizeString(value.ua, 512);
  const rawFiles = Array.isArray(value.files) ? value.files : [];

  if (!ALLOWED_SUBJECTS.has(subject)) throw new TypeError("กรุณาเลือกหัวข้อที่ถูกต้อง");
  if (name.length < 2) throw new TypeError("กรอกชื่อให้ครบ");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new TypeError("อีเมลไม่ถูกต้อง");
  if (!/^\d{9,10}$/.test(phone)) throw new TypeError("เบอร์โทรไม่ถูกต้อง");
  if (complaint.length < 5) throw new TypeError("รายละเอียดสั้นเกินไป");
  if (rawFiles.length > MAX_FILES) throw new RangeError(`แนบได้ไม่เกิน ${MAX_FILES} ไฟล์`);

  let totalBytes = 0;
  const files = rawFiles.map((file) => {
    const attachment = validateAttachment(file);
    totalBytes += attachment.byteLength;
    if (totalBytes > MAX_TOTAL_FILE_BYTES) throw new RangeError("ขนาดไฟล์รวมเกิน 5MB");
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      data: attachment.data
    };
  });

  return { subject, name, email, phone, complaint, ua, files };
}

export async function handleComplaintRequest(request, response, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const method = String(request.method || "GET").toUpperCase();

  if (method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, message: "Method Not Allowed" });
    return;
  }

  if (!isSameOriginRequest(request)) {
    sendJson(response, 403, { ok: false, message: "Origin ไม่ถูกต้อง" });
    return;
  }

  const endpoint = readComplaintEndpoint(env);
  if (!endpoint) {
    sendJson(response, 503, { ok: false, message: "ระบบรับเรื่องร้องเรียนยังไม่ได้ตั้งค่า" });
    return;
  }

  let payload;
  try {
    const body = await readRequestBody(request);
    if (!body.length) throw new TypeError("ข้อมูลร้องเรียนไม่ถูกต้อง");
    payload = validatePayload(JSON.parse(body.toString("utf8")));
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    sendJson(response, status, {
      ok: false,
      message: error instanceof Error ? error.message : "ข้อมูลร้องเรียนไม่ถูกต้อง"
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal
    });

    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      sendJson(response, 502, { ok: false, message: "ระบบปลายทางตอบกลับไม่ถูกต้อง" });
      return;
    }

    if (!upstream.ok || !parsed || typeof parsed !== "object" || parsed.ok !== true) {
      sendJson(response, 502, {
        ok: false,
        message: typeof parsed?.message === "string" ? parsed.message.slice(0, 240) : "ระบบปลายทางขัดข้อง"
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      message: typeof parsed.message === "string" ? parsed.message.slice(0, 240) : "ส่งสำเร็จ"
    });
  } catch (error) {
    const aborted = error && typeof error === "object" && error.name === "AbortError";
    sendJson(response, aborted ? 504 : 502, {
      ok: false,
      message: aborted ? "ระบบปลายทางใช้เวลาตอบกลับนานเกินไป" : "ไม่สามารถติดต่อระบบปลายทางได้"
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
