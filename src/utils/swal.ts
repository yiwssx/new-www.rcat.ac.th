import type { SweetAlertIcon, SweetAlertOptions, SweetAlertResult } from "sweetalert2";

type SwalStatic = typeof import("sweetalert2").default;
type AppSwalInstance = ReturnType<SwalStatic["mixin"]>;
type FireArgs = [SweetAlertOptions] | [string, string?, SweetAlertIcon?];

interface LazyAppSwal {
  fire(options: SweetAlertOptions): Promise<SweetAlertResult>;
  fire(title: string, html?: string, icon?: SweetAlertIcon): Promise<SweetAlertResult>;
  close(): Promise<void>;
  showLoading(): Promise<void>;
}

const defaultBlockingLoadingText = "กรุณารอสักครู่ อย่าปิดหน้านี้";

let appSwalPromise: Promise<AppSwalInstance> | null = null;

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
    const swal = await getAppSwal();
    swal.close();
  },
  async showLoading() {
    const swal = await getAppSwal();
    swal.showLoading();
  }
};

export function getSwalErrorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function showBlockingLoading(title: string, text = defaultBlockingLoadingText) {
  void appSwal.fire({
    title,
    text,
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      void appSwal.showLoading();
    }
  });
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
