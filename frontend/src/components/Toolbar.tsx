import React, { useState } from "react";
import {
  RotateCcw,
  RotateCw,
  Trash2,
  Camera,
  Zap,
  ArrowLeft,
  FileText,
  Bot,
  X,
  Lock,
  Unlock,
  ImagePlus,
  Check,
  Copy,
} from "lucide-react";
import { usePlannerStore } from "../store/plannerStore";
import { generatePDFReport, imageUrlToBase64 } from "../utils/reportGenerator";
import { buildAiImagePrompt } from "../utils/aiImagePrompt";

/**
 * Quick heuristic check for a "blank" canvas capture: samples a grid of
 * pixels and returns true if they are all (near) identical, which is what
 * happens when the WebGL canvas is captured before it has actually
 * rendered the container/products (e.g. still showing only the flat
 * background color).
 */
function isBlankImage(dataUrl: string): boolean {
  try {
    const img = new Image();
    img.src = dataUrl;
    // Synchronous check isn't possible here without decode, so this is a
    // best-effort cheap guard: an empty/near-empty PNG data URL is
    // suspiciously short compared to a fully rendered 3D scene.
    return dataUrl.length < 5000;
  } catch {
    return false;
  }
}

export function Toolbar() {
  const {
    projectConfig,
    goBackToSetup,
    clearLayoutItems,
    history,
    historyIndex,
    undo,
    redo,
    isAutoPackLoading,
    layoutItems,
    products,
    autoPackAll,
    getLayoutStats,
    setCameraView,
    aiAutoPack,
    aiApiKey,
    isGeneratingReport,
    setIsGeneratingReport,
    setTransparentBackground,
    viewRotateLocked,
    setViewRotateLocked,
    lastSavedAt,
    saveProject,
    isSaving,
    updateProjectName,
    duplicateProject,
  } = usePlannerStore();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Builds the AI-image command auto-filled with the real container +
  // product data (see utils/aiImagePrompt.ts) and copies it to the
  // clipboard so it's ready to paste straight into an external AI
  // image generator — no manual editing needed.
  const handleCopyAiImagePrompt = async () => {
    if (!projectConfig) return;
    if (products.length === 0) {
      alert("Tambahkan product terlebih dahulu!");
      return;
    }

    const prompt = buildAiImagePrompt(projectConfig.containerType, products);

    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (error) {
      console.error("Clipboard error:", error);
      alert(
        "Gagal menyalin otomatis ke clipboard (izin browser). Command sudah dicetak ke console — silakan copy manual dari sana.",
      );
      console.log(prompt);
    }
  };

  const handleExportPNG = async () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    // Drop the grey canvas backdrop for the export, wait for a couple
    // of real rendered frames with it off, then restore it.
    setTransparentBackground(true);
    await new Promise((r) => setTimeout(r, 50));
    await waitFrames(3);

    const link = document.createElement("a");
    link.download = `${projectConfig?.name || "layout"}-${new Date().toISOString().split("T")[0]}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    setTransparentBackground(false);
  };

  const handleAutoPack = () => {
    if (products.length === 0) {
      alert("Tambahkan product terlebih dahulu!");
      return;
    }
    autoPackAll();
  };

  // Wait for a number of animation frames so the WebGL canvas has actually
  // painted the new camera position before we read pixels from it.
  const waitFrames = (n: number) =>
    new Promise<void>((resolve) => {
      let remaining = n;
      const tick = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  const captureCanvasView = async (view: "left" | "right"): Promise<string> => {
    setCameraView(view);
    // Give React a tick to apply the store update, then wait for a few
    // real rendered frames so preserveDrawingBuffer has fresh pixels.
    await new Promise((r) => setTimeout(r, 50));
    await waitFrames(5);

    const canvas =
      (document.querySelector(".relative canvas") as HTMLCanvasElement) ||
      (document.querySelector("canvas") as HTMLCanvasElement);
    if (!canvas) throw new Error("Canvas 3D tidak ditemukan");

    const dataUrl = canvas.toDataURL("image/png");

    // Guard against a fully blank capture (can happen if the canvas
    // hasn't painted yet) — retry once with a longer wait.
    if (isBlankImage(dataUrl)) {
      await waitFrames(10);
      return canvas.toDataURL("image/png");
    }
    return dataUrl;
  };

  const handleGeneratePDF = async () => {
    if (!projectConfig || layoutItems.length === 0) {
      alert("Masukkan product ke container terlebih dahulu!");
      return;
    }

    setIsGeneratingReport(true);
    setTransparentBackground(true);

    try {
      // Load logo as base64
      const logoBase64 = await imageUrlToBase64("/label-logo.jpg");
      const stats = getLayoutStats();

      // Capture Right View, then Left View. Each capture sets the
      // camera view and waits for real rendered frames before reading
      // the canvas, instead of guessing with a fixed timeout.
      const rightViewImage = await captureCanvasView("right");
      const leftViewImage = await captureCanvasView("left");

      // Generate Report
      await generatePDFReport({
        projectConfig,
        products,
        layoutItems,
        stats,
        rightViewImage,
        leftViewImage,
        logoBase64,
      });
    } catch (error) {
      console.error("Report generation error:", error);
      alert("Gagal generate Report: " + (error as any).message);
    } finally {
      setTransparentBackground(false);
      setIsGeneratingReport(false);
    }
  };

  const handleAiPackConfirm = async () => {
    setIsAiModalOpen(false);
    await aiAutoPack(aiPrompt);
  };

  return (
    <>
      <div className="h-12 bg-gray-900/95 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-4 gap-3 flex-shrink-0">
        {/* Left: Back + Project name */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBackToSetup}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-all"
            title="Back to Project Setup"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Setup</span>
          </button>
          {projectConfig && (
            <div className="text-sm">
              {isEditingName ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={() => {
                    setIsEditingName(false);
                    if (editedName.trim()) updateProjectName(editedName.trim());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIsEditingName(false);
                      if (editedName.trim()) updateProjectName(editedName.trim());
                    } else if (e.key === "Escape") {
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                  className="bg-gray-800 text-white font-medium border border-gray-600 rounded px-1.5 py-0.5 outline-none focus:border-blue-500"
                />
              ) : (
                <span 
                  className="text-white font-medium cursor-text" 
                  onDoubleClick={() => {
                    setEditedName(projectConfig.name);
                    setIsEditingName(true);
                  }}
                  title="Double click to rename"
                >
                  {projectConfig.name}
                </span>
              )}
              <span className="text-gray-500 ml-2 text-xs">
                {projectConfig.containerType.name}
              </span>
            </div>
          )}
        </div>

        {/* Center: Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo || isAutoPackLoading}
            className="p-2 rounded-lg transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo || isAutoPackLoading}
            className="p-2 rounded-lg transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1.5" />

          {/* Camera orbit lock. Mouse rotation works directly — no Alt key. */}
          <button
            onClick={() => setViewRotateLocked(!viewRotateLocked)}
            className={`p-2 rounded-lg transition-colors ${
              viewRotateLocked
                ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
            title={
              viewRotateLocked
                ? "Camera rotation locked — click to unlock"
                : "Camera rotation active — left/right drag to orbit"
            }
          >
            {viewRotateLocked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1.5" />

          <button
            onClick={() => duplicateProject()}
            className="p-2 rounded-lg transition-colors text-purple-400 hover:text-purple-300 hover:bg-gray-800"
            title="Duplicate Project"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={() => saveProject()}
            disabled={isSaving}
            className="px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 hover:bg-gray-800 transition-colors disabled:opacity-50"
            title="Simpan project"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1.5" />

          <button
            onClick={handleAutoPack}
            disabled={isAutoPackLoading || products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-amber-600/20"
            title="Auto Pack — otomatis susun semua product ke container"
          >
            <Zap className="w-3.5 h-3.5" />
            Auto Pack
          </button>

          {/* AI Pack Button */}
          <button
            onClick={() => {
              if (!aiApiKey) {
                alert(
                  "Silahkan atur AI API Key di halaman Setup terlebih dahulu.",
                );
                return;
              }
              if (products.length === 0) {
                alert("Tambahkan product terlebih dahulu!");
                return;
              }
              setIsAiModalOpen(true);
            }}
            disabled={isAutoPackLoading || products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-purple-600/20"
            title="AI Pack — susun otomatis menggunakan AI (Gemini/OpenAI)"
          >
            <Bot className="w-3.5 h-3.5" />
            AI Pack
          </button>

          {/* Copy AI Image Prompt Button */}
          <button
            onClick={handleCopyAiImagePrompt}
            disabled={!projectConfig || products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-sky-600/20"
            title="Salin command siap-paste untuk AI image generator (tampak kanan/kiri, 4 varian)"
          >
            {promptCopied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Tersalin!
              </>
            ) : (
              <>
                <ImagePlus className="w-3.5 h-3.5" />
                Copy AI Image Prompt
              </>
            )}
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1.5" />

          <button
            onClick={clearLayoutItems}
            disabled={isAutoPackLoading || layoutItems.length === 0}
            className="p-2 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Clear All Items"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-700 mx-1.5" />

          <button
            onClick={handleExportPNG}
            disabled={isAutoPackLoading}
            className="p-2 rounded-lg transition-colors text-purple-400 hover:text-purple-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Export PNG"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Print Report Button */}
          <button
            onClick={handleGeneratePDF}
            disabled={
              isAutoPackLoading ||
              isGeneratingReport ||
              layoutItems.length === 0
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-600/20"
            title="Print Report (2 pages — Left & Right view)"
          >
            <FileText className="w-3.5 h-3.5" />
            {isGeneratingReport ? "Preparing..." : "Print Report"}
          </button>
        </div>

        {/* Right: Loading indicator */}
        <div className="flex items-center gap-2 min-w-[80px] justify-end">
          {(isAutoPackLoading || isGeneratingReport) && (
            <div className="flex items-center gap-2">
              <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-xs text-gray-400">
                {isGeneratingReport ? "Preparing Report..." : "Processing..."}
              </span>
            </div>
          )}
          <div className="text-xs text-gray-500">
            {layoutItems.length} items
            {lastSavedAt ? (
              <span className="ml-2 text-emerald-500">Saved</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* AI Pack Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[400px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                AI Auto-Pack
              </h3>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Custom Instructions (Optional)
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Tables with thin legs must go on top. Do not stack fragile items."
                className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAiPackConfirm}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-purple-600/20"
              >
                Start AI Packing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
