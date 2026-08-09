from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one marker, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


# Drive resumable progress uses bytes confirmed by the bridge.
path = Path("src/features/cms-media/mediaBridgeClient.test.ts")
text = path.read_text()
old = '''    const requests: BridgeRequest[] = [];
    const createUploadKey = vi.fn(() => TEST_UPLOAD_KEY);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {'''
new = '''    const requests: BridgeRequest[] = [];
    const createUploadKey = vi.fn(() => TEST_UPLOAD_KEY);
    const onProgress = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {'''
if text.count(old) != 1:
    raise SystemExit(f"bridge setup marker mismatch: {text.count(old)}")
text = text.replace(old, new, 1)
old = '''    await expect(
      saveMediaAssetToBridge(createFileInput(bytes.toString("base64")), createRecoveryOptions(createUploadKey))
    ).resolves.toEqual(uploadedAsset);'''
new = '''    await expect(
      saveMediaAssetToBridge(createFileInput(bytes.toString("base64")), {
        ...createRecoveryOptions(createUploadKey),
        onProgress
      })
    ).resolves.toEqual(uploadedAsset);'''
if text.count(old) != 1:
    raise SystemExit(f"bridge call marker mismatch: {text.count(old)}")
text = text.replace(old, new, 1)
old = '''    expect(JSON.stringify(requests)).not.toContain("fileBase64");
  });'''
new = '''    expect(JSON.stringify(requests)).not.toContain("fileBase64");
    expect(onProgress.mock.calls.map(([progress]) => progress.uploadedBytes)).toEqual([
      0,
      MEDIA_UPLOAD_CHUNK_BYTES,
      bytes.length
    ]);
    expect(onProgress.mock.calls.at(-1)?.[0]).toEqual({
      uploadedBytes: bytes.length,
      totalBytes: bytes.length,
      percent: 100
    });
  });'''
if text.count(old) != 1:
    raise SystemExit(f"bridge assertions marker mismatch: {text.count(old)}")
path.write_text(text.replace(old, new, 1))


# Main Media Library: progress and duplicate-preparation guard.
path = Path("src/admin/pages/MediaPage.test.tsx")
text = path.read_text()
replace_old = '    filesMock.readFileAsBase64.mockClear();'
replace_new = '''    filesMock.readFileAsBase64.mockReset();
    filesMock.readFileAsBase64.mockResolvedValue("aW1hZ2UtY29udGVudA==");'''
if text.count(replace_old) != 1:
    raise SystemExit(f"MediaPage reset marker mismatch: {text.count(replace_old)}")
text = text.replace(replace_old, replace_new, 1)
start = text.index('  it("shows clear upload pending feedback while the upload is in progress"')
end = text.index('\n  it("shows a clear upload success modal after upload finishes"', start)
replacement = '''  it("shows exact byte progress while the upload is in progress", async () => {
    const upload = deferred<MediaAsset>();
    mediaMock.saveMediaAsset.mockImplementation((_input, options) => {
      options?.onProgress?.({ uploadedBytes: 5, totalBytes: 10, percent: 50 });
      return upload.promise;
    });
    await openUploadConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "อัปโหลด" }));

    await waitFor(() => expect(mediaMock.saveMediaAsset).toHaveBeenCalledTimes(1));
    expect(screen.getByText("กำลังอัปโหลดไฟล์ไปยัง Drive และบันทึกข้อมูล")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("5 B / 10 B")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "ความคืบหน้าการอัปโหลด 50%" })).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    expect(screen.getByRole("button", { name: "กำลังอัปโหลด 50%" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "กลับ" })).toBeDisabled();
    expect(findSwalCall((options) => options.title === "กำลังอัปโหลดสื่อ")).toBeUndefined();
  }, 15_000);

  it("blocks duplicate upload clicks while the file is still being prepared", async () => {
    const fileRead = deferred<string>();
    filesMock.readFileAsBase64.mockReturnValue(fileRead.promise);
    await openUploadConfirmation();

    const uploadButton = screen.getByRole("button", { name: "อัปโหลด" });
    fireEvent.click(uploadButton);
    fireEvent.click(uploadButton);

    expect(filesMock.readFileAsBase64).toHaveBeenCalledTimes(1);
    expect(mediaMock.saveMediaAsset).not.toHaveBeenCalled();
    expect(screen.getByText("กำลังเตรียมไฟล์สำหรับอัปโหลด")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "กำลังเตรียมไฟล์" })).toBeDisabled();

    await act(async () => {
      fileRead.resolve("aW1hZ2UtY29udGVudA==");
    });

    await waitFor(() => expect(mediaMock.saveMediaAsset).toHaveBeenCalledTimes(1));
    expect(filesMock.readFileAsBase64).toHaveBeenCalledTimes(1);
  });
'''
text = text[:start] + replacement + text[end:]
path.write_text(text)


# Quick Upload: optional progress callback contract + duplicate guard.
path = Path("src/admin/components/ContentEditorDialog.test.tsx")
text = path.read_text()
text = text.replace(
    'import type { MediaAssetInput } from "../../features/cms-media";',
    'import type { MediaAssetInput, MediaUploadOptions } from "../../features/cms-media";',
    1,
)
text = text.replace(
    '    onUploadMedia?: (input: MediaAssetInput) => Promise<MediaAsset>;',
    '    onUploadMedia?: (input: MediaAssetInput, options?: MediaUploadOptions) => Promise<MediaAsset>;',
    1,
)
old = '''      expect(onUploadMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "annual-report",
          type: "document",
          owner: "editor",
          fileName: "annual-report.pdf",
          mimeType: "application/pdf",
          fileBase64: "cGRmLWNvbnRlbnQ="
        })
      )'''
new = '''      expect(onUploadMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "annual-report",
          type: "document",
          owner: "editor",
          fileName: "annual-report.pdf",
          mimeType: "application/pdf",
          fileBase64: "cGRmLWNvbnRlbnQ="
        }),
        expect.objectContaining({ onProgress: expect.any(Function) })
      )'''
if text.count(old) != 1:
    raise SystemExit(f"ContentEditor normal upload marker mismatch: {text.count(old)}")
text = text.replace(old, new, 1)
marker = '''    expect(filesMock.readFileAsBase64).toHaveBeenCalledWith(file);
  });

  it("generates a complete Thai slug'''
insertion = '''    expect(filesMock.readFileAsBase64).toHaveBeenCalledWith(file);
  });

  it("shows progress and blocks duplicate quick-upload clicks during file preparation", async () => {
    const uploadedPdf: MediaAsset = {
      id: "pdf-progress-1",
      name: "large-report",
      type: "document",
      size: "10 B",
      owner: "editor",
      driveUrl: "https://drive.google.com/file/d/pdf-progress-1/view",
      previewUrl: "https://drive.google.com/file/d/pdf-progress-1/preview",
      updatedAt: "2026-08-09T00:00:00.000Z"
    };
    let resolveRead!: (value: string) => void;
    const readPromise = new Promise<string>((resolve) => {
      resolveRead = resolve;
    });
    filesMock.readFileAsBase64.mockReturnValue(readPromise);
    const onUploadMedia = vi.fn(async (_input: MediaAssetInput, options?: MediaUploadOptions) => {
      options?.onProgress?.({ uploadedBytes: 6, totalBytes: 10, percent: 60 });
      return uploadedPdf;
    });
    renderEditor(createContentItem({ template: "standard", owner: "editor" }), { onUploadMedia });
    const fileInput = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["0123456789"], "large-report.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    const uploadButton = screen.getByRole("button", { name: "อัปโหลดและแนบ" });
    fireEvent.click(uploadButton);
    fireEvent.click(uploadButton);

    expect(filesMock.readFileAsBase64).toHaveBeenCalledTimes(1);
    expect(onUploadMedia).not.toHaveBeenCalled();
    expect(screen.getByText("กำลังเตรียมไฟล์สำหรับอัปโหลด")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "กำลังเตรียมไฟล์" })).toBeDisabled();

    await act(async () => {
      resolveRead("MDEyMzQ1Njc4OQ==");
    });

    await waitFor(() => expect(onUploadMedia).toHaveBeenCalledTimes(1));
    expect(filesMock.readFileAsBase64).toHaveBeenCalledTimes(1);
  });

  it("generates a complete Thai slug'''
if text.count(marker) != 1:
    raise SystemExit(f"ContentEditor insertion marker mismatch: {text.count(marker)}")
path.write_text(text.replace(marker, insertion, 1))
