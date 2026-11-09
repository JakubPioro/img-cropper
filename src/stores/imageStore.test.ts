import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useImageStore } from "./imageStore";
import { validateFiles } from "../utils/fileValidation";
import {
  ProcessingError,
  processImageFile,
  readImageDimensions,
} from "../utils/imagePipeline";

vi.mock("../utils/fileValidation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/fileValidation")>();
  return {
    ...actual,
    validateFiles: vi.fn(),
  };
});

vi.mock("../utils/imagePipeline", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/imagePipeline")>();
  return {
    ...actual,
    processImageFile: vi.fn(),
    readImageDimensions: vi.fn(),
  };
});

vi.mock("../utils/zip", () => ({
  downloadZip: vi.fn(),
}));

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

function makeFile(name: string, type = "image/jpeg"): File {
  const blob = new Blob(["x"], { type }) as Blob & { name: string };
  blob.name = name;
  return blob as File;
}

describe("imageStore", () => {
  const mockValidateFiles = vi.mocked(validateFiles);
  const mockProcessImageFile = vi.mocked(processImageFile);
  const mockReadImageDimensions = vi.mocked(readImageDimensions);

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    let urlCounter = 0;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => `blob:mock-${++urlCounter}`),
      revokeObjectURL: vi.fn(),
    });

    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => `id-${Math.random().toString(16).slice(2, 8)}`),
    });

    mockValidateFiles.mockReturnValue({ accepted: [], rejected: [] });
    mockReadImageDimensions.mockResolvedValue({
      sourceWidth: 1600,
      sourceHeight: 1200,
    });
    mockProcessImageFile.mockResolvedValue({
      blob: new Blob(["out"], { type: "image/jpeg" }),
      outputName: "out.jpg",
      sourceWidth: 1600,
      sourceHeight: 1200,
      autoCropRect: { x: 0, y: 0, width: 1600, height: 1200 },
    });
  });

  it("adds accepted files and creates notifications", async () => {
    const store = useImageStore();
    const accepted = makeFile("photo.jpg");

    mockValidateFiles.mockReturnValue({
      accepted: [accepted],
      rejected: [{ fileName: "bad.gif", reason: "unsupportedFormat" }],
    });

    store.addFiles([accepted]);
    await Promise.resolve();

    expect(store.jobs).toHaveLength(1);
    expect(store.notifications.some((n) => n.level === "success")).toBe(true);
    expect(store.notifications.some((n) => n.level === "warning")).toBe(true);
    const warning = store.notifications.find((n) => n.level === "warning");
    expect(warning?.key).toBe("unsupportedFormat");
    expect(warning?.params?.fileName).toBe("bad.gif");
    expect(store.jobs[0]?.sourceWidth).toBe(1600);
  });

  it("shows info notification when processing without files", async () => {
    const store = useImageStore();

    await store.processAll();

    expect(store.notifications[0]?.key).toBe("noFiles");
  });

  it("processes queued files and marks them as done", async () => {
    const store = useImageStore();
    const accepted = makeFile("photo.jpg");

    mockValidateFiles.mockReturnValue({ accepted: [accepted], rejected: [] });
    store.addFiles([accepted]);

    await store.processAll();

    expect(mockProcessImageFile).toHaveBeenCalledTimes(1);
    expect(store.jobs[0]?.status).toBe("done");
    expect(store.jobs[0]?.outputName).toBe("out.jpg");
    expect(store.notifications[0]?.level).toBe("success");
  });

  it("marks file as error and pushes warning when processing fails", async () => {
    const store = useImageStore();
    const accepted = makeFile("photo.jpg");

    mockValidateFiles.mockReturnValue({ accepted: [accepted], rejected: [] });
    const boom = new Error("Boom");
    mockProcessImageFile.mockRejectedValue(boom);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    store.addFiles([accepted]);

    await store.processAll();

    expect(store.jobs[0]?.status).toBe("error");
    expect(store.jobs[0]?.error).toBe("unknown");
    expect(consoleError).toHaveBeenCalledWith(boom);
    consoleError.mockRestore();
    expect(store.notifications[0]?.level).toBe("warning");
  });

  it("stores the error code when processing throws a ProcessingError", async () => {
    const store = useImageStore();
    const accepted = makeFile("photo.jpg");

    mockValidateFiles.mockReturnValue({ accepted: [accepted], rejected: [] });
    mockProcessImageFile.mockRejectedValue(new ProcessingError("imageEncode"));
    store.addFiles([accepted]);

    await store.processAll();

    expect(store.jobs[0]?.status).toBe("error");
    expect(store.jobs[0]?.error).toBe("imageEncode");
  });

  it("applies prefix to all file names with numbering", () => {
    const store = useImageStore();
    const fileA = makeFile("a.jpg");
    const fileB = makeFile("b.jpg");

    mockValidateFiles.mockReturnValue({
      accepted: [fileA, fileB],
      rejected: [],
    });
    store.addFiles([fileA, fileB]);

    store.applyPrefixToAllNames("sesja");

    expect(store.jobs[0]?.customName).toBe("sesja-001");
    expect(store.jobs[1]?.customName).toBe("sesja-002");
  });

  it("clears all notifications", async () => {
    const store = useImageStore();

    await store.processAll();
    expect(store.notifications.length).toBeGreaterThan(0);

    store.clearNotifications();
    expect(store.notifications).toHaveLength(0);
  });

  it("clears queue and revokes object URLs", () => {
    const store = useImageStore();
    const accepted = makeFile("photo.jpg");

    mockValidateFiles.mockReturnValue({ accepted: [accepted], rejected: [] });
    store.addFiles([accepted]);

    store.jobs[0].outputUrl = "blob:output";
    store.clearAll();

    expect(store.jobs).toHaveLength(0);
    expect(store.notifications[0]?.key).toBe("queueCleared");
    const revoke = globalThis.URL.revokeObjectURL as ReturnType<typeof vi.fn>;
    expect(revoke).toHaveBeenCalled();
  });
});
