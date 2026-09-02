import type { SweetAlertIcon, SweetAlertOptions, SweetAlertResult } from "sweetalert2";

type SwalStatic = typeof import("sweetalert2").default;
type AppSwalInstance = ReturnType<SwalStatic["mixin"]>;
type FireArgs = [SweetAlertOptions] | [string, string?, SweetAlertIcon?];
type BlockingLoadingState = {
  title: string;
  text: string;
};

interface LazyAppSwal {
  fire(options: SweetAlertOptions): Promise<SweetAlertResult>;
  fire(title: string, html?: string, icon?: SweetAlertIcon): Promise<SweetAlertResult>;
  close(): Promise<void>;
  showLoading(): Promise<void>;
  update(options: SweetAlertOptions): Promise<void>;
}

const defaultBlockingLoadingText = "กรุณารอสักครู่ อย่าปิดหน้านี้";
const blockingProgressPattern = /^(\d{1,3})%\s*[•-]\s*(.+)$/u;

let appSwalPromise: Promise<AppSwalInstance> | null = null;
let latestBlockingLoading: BlockingLoadingState | null = null;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character] ?? character
  );
}

function renderBlockingProgress(text: string) {
  const match = text.match(blockingProgressPattern);

  if (!match) {
    return undefined;
  }

  const percent = Math.min(100, Math.max(0, Number(match[1]) || 0));
  const message = escapeHtml(match[2]);

  return [
    '<div id="rcat-blocking-progress" style="text-align:left">',
    '<div style="display:flex;gap:12px;justify-content:space-between;align-items:baseline;margin-bottom:10px">',
    `<span id="rcat-blocking-progress-message">${message}</span>`,
    `<strong id="rcat-blocking-progress-percent" style="font-variant-numeric:tabular-nums;white-space:nowrap">${percent}%</strong>`,
    "</div>",
    `<progress id="rcat-blocking-progress-bar" value="${percent}" max="100" role="progressbar" aria-label="ความคืบหน้าการบันทึกเนื้อหา" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" style="width:100%;height:14px"></progress>`,
    '<div style="font-size:0.8rem;opacity:0.72;margin-top:10px">กรุณารอจนกว่าการบันทึกและการเตรียมภาพย่อจะเสร็จสิ้น</div>',
    "</div>"
  ].join("");
}

function createBlockingLoadingOptions(state: BlockingLoadingState): SweetAlertOptions {
  const progressHtml = renderBlockingProgress(state.text);

  return {
    title: state.title,
    text: state.text,
    ...(progressHtml ? { html: progressHtml } : {}),
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false
  };
}

async function getAppSwal() {
  if (!appSwalPromise) {
    appSwalPromise = Promise.all([import("sweetalert2"), import("sweetalert2/dist/sweetalert2.min.css")]).then(
      ([{ default: Swal }]) =>
        Swal.mixin({
          confirmButtonColor: "#2c7a3f",
          cancelButtonColor: "#7a5900",
          reverseButtons: true
        })
    );
  }

  return appSwalPromise;
}

export const appSwal: LazyAppSwal = {
  async fire(...args: FireArgs) {
    const swal = await getAppSwal();

    if (typeof args[0] === "string") {
      return swal.fire(args[0], args[1], args[2]);
    }

    return swal.fire(args[0]);
  },
  async close() {
    latestBlockingLoading = null;
    const swal = await getAppSwal();
    swal.close();
  },
  async showLoading() {
    const swal = await getAppSwal();
    swal.showLoading();
  },
  async update(options: SweetAlertOptions) {
    const swal = await getAppSwal();
    swal.update(options);
  }
};

export function getSwalErrorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function showBlockingLoading(title: string, text = defaultBlockingLoadingText) {
  const state = { title, text };
  latestBlockingLoading = state;

  void appSwal.fire({
    ...createBlockingLoadingOptions(state),
    didOpen: () => {
      void appSwal.showLoading();

      const latest = latestBlockingLoading;
      if (latest) {
        void appSwal.update(createBlockingLoadingOptions(latest));
      }
    }
  });
}

export function updateBlockingLoading(title: string, text: string) {
  const state = { title, text };
  latestBlockingLoading = state;
  void appSwal.update(createBlockingLoadingOptions(state));
}

export async function showSuccessResult(title: string, text?: string) {
  await appSwal.fire({
    icon: "success",
    title,
    ...(text ? { text } : {}),
    confirmButtonText: "ตกลง"
  });
}

export async function showErrorResult(title: string, error: unknown, fallback: string) {
  await appSwal.fire({
    icon: "error",
    title,
    text: getSwalErrorText(error, fallback),
    confirmButtonText: "ตกลง"
  });
}
