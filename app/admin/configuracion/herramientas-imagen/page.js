"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  Gift,
  ImagePlus,
  Loader2,
  Palette,
  RotateCcw,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Upload,
} from "lucide-react";

const BG_SWATCHES = ["#000000", "#ffffff", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];
const DOT_SHAPES = [
  { id: "circle", label: "Circulo" },
  { id: "line", label: "Linea" },
];
const DPI_OPTIONS = [300, 450, 600];

const DEFAULT_CONTROLS = {
  foreground: "#000000",
  background: "#ffffff",
  allowForeground: true,
  dotShape: "circle",
  dotSize: 10,
  dotAngle: 45,
  printWidth: 250,
  productWidth: 560,
  dpi: 300,
  blur: 0,
  gamma: 1,
  gradient: 0.3,
  contrast: 1,
  brightness: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawContain(ctx, image, width, height) {
  const padding = Math.round(Math.min(width, height) * 0.06);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const scale = Math.min(usableWidth / image.width, usableHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  const parsed = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function prepareCanvas(canvas, image, controls) {
  const maxSide = 1400;
  const ratio = image.width / image.height || 1;
  const width = image.width >= image.height ? maxSide : Math.round(maxSide * ratio);
  const height = image.height > image.width ? maxSide : Math.round(maxSide / ratio);
  canvas.width = Math.max(500, width);
  canvas.height = Math.max(500, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = controls.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = Number(controls.blur || 0) > 0 ? `blur(${Number(controls.blur || 0)}px)` : "none";
  drawContain(ctx, image, canvas.width, canvas.height);
  ctx.filter = "none";
  return ctx;
}

function applyToneControls(imageData, width, controls) {
  const data = imageData.data;
  const gamma = Math.max(0.2, Number(controls.gamma || 1));
  const contrast = Number(controls.contrast || 1);
  const brightness = Number(controls.brightness || 0) * 255;
  const gradient = Number(controls.gradient || 0);

  for (let i = 0; i < data.length; i += 4) {
    const x = ((i / 4) % width) / width;
    const gradientLift = (x - 0.5) * gradient * 60;
    data[i] = clamp((Math.pow(data[i] / 255, 1 / gamma) * 255 - 128) * contrast + 128 + brightness + gradientLift, 0, 255);
    data[i + 1] = clamp((Math.pow(data[i + 1] / 255, 1 / gamma) * 255 - 128) * contrast + 128 + brightness + gradientLift, 0, 255);
    data[i + 2] = clamp((Math.pow(data[i + 2] / 255, 1 / gamma) * 255 - 128) * contrast + 128 + brightness + gradientLift, 0, 255);
  }
}

function applyHalftone(ctx, canvas, controls) {
  const width = canvas.width;
  const height = canvas.height;
  const source = ctx.getImageData(0, 0, width, height);
  applyToneControls(source, width, controls);

  const foreground = hexToRgb(controls.allowForeground ? controls.foreground : "#000000");
  const step = Math.max(4, Number(controls.dotSize || 10));
  const angle = (Number(controls.dotAngle || 0) * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = controls.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = `rgb(${foreground.r}, ${foreground.g}, ${foreground.b})`;

  for (let y = -step; y < height + step; y += step) {
    for (let x = -step; x < width + step; x += step) {
      const rx = Math.cos(angle) * (x - cx) - Math.sin(angle) * (y - cy) + cx;
      const ry = Math.sin(angle) * (x - cx) + Math.cos(angle) * (y - cy) + cy;
      const px = clamp(Math.round(rx), 0, width - 1);
      const py = clamp(Math.round(ry), 0, height - 1);
      const idx = (py * width + px) * 4;
      const alpha = source.data[idx + 3] / 255;
      if (alpha <= 0.01) continue;
      const luma = 0.2126 * source.data[idx] + 0.7152 * source.data[idx + 1] + 0.0722 * source.data[idx + 2];
      const size = clamp((1 - luma / 255) * step * 0.88, 0.3, step * 0.86);

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;
      if (controls.dotShape === "line") {
        ctx.fillRect(-size * 0.55, -step * 0.12, size * 1.1, step * 0.24);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function downloadDataUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export default function HerramientasImagenPage() {
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const [sourceImage, setSourceImage] = useState("");
  const [resultImage, setResultImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [processing, setProcessing] = useState(false);
  const [openSections, setOpenSections] = useState({
    color: true,
    pattern: true,
    size: true,
    preprocess: true,
    tone: true,
  });

  const updateControl = (field, value) => {
    setControls((current) => ({ ...current, [field]: value }));
  };

  const toggleSection = (section) => {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const processImage = useCallback(async () => {
    if (!sourceImage || !canvasRef.current) return;
    setProcessing(true);
    try {
      const image = await loadImage(sourceImage);
      const canvas = canvasRef.current;
      const ctx = prepareCanvas(canvas, image, controls);
      applyHalftone(ctx, canvas, controls);
      setResultImage(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  }, [sourceImage, controls]);

  useEffect(() => {
    processImage();
  }, [processImage]);

  const handleFile = async (file) => {
    if (!file || !file.type?.startsWith("image/")) return;
    setFileName(file.name);
    setResultImage("");
    setSourceImage(await readFileAsDataUrl(file));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  const resetAll = () => {
    setSourceImage("");
    setResultImage("");
    setFileName("");
    setControls(DEFAULT_CONTROLS);
    if (fileRef.current) fileRef.current.value = "";
  };

  const exportImage = () => {
    if (!canvasRef.current || !resultImage) return;
    const source = canvasRef.current;
    const scale = controls.dpi === 600 ? 2 : controls.dpi === 450 ? 1.5 : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = controls.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const name = fileName ? fileName.replace(/\.[^.]+$/, "") : "imagen";
    downloadDataUrl(canvas.toDataURL("image/png"), `${name}-semitonos-${controls.dpi}dpi.png`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <canvas ref={canvasRef} className="hidden" />

      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-4">
          <button className="text-2xl leading-none" title="Volver" type="button">‹</button>
          <div className="flex items-center gap-2 text-xl font-black">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-600 text-sm text-white">SW</span>
            Studio
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <Upload className="h-4 w-4" />
            Subir
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="hidden rounded-md bg-orange-100 px-3 py-2 text-sm font-bold text-orange-950 sm:inline-flex">
            <Trophy className="mr-2 h-4 w-4" />
            Concurso
          </button>
          <button type="button" className="hidden rounded-md bg-orange-50 px-3 py-2 text-sm font-bold text-orange-600 sm:inline-flex">
            <Gift className="mr-2 h-4 w-4" />
            Gana creditos
          </button>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-black text-slate-400">•</span>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 lg:grid-cols-[64px_292px_minmax(0,1fr)_320px]">
        <nav className="hidden border-r border-slate-200 bg-white lg:block">
          <div className="grid gap-3 py-4">
            <button type="button" className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-orange-50 text-orange-600" title="IA">
              <Sparkles className="h-5 w-5" />
              <span className="text-[9px] font-bold">AI</span>
            </button>
            <button type="button" className="mx-auto grid h-14 w-14 place-items-center rounded-xl text-slate-400 hover:bg-slate-50" title="Bosquejo">
              <Shirt className="h-5 w-5" />
              <span className="text-[9px] font-bold">Bosquejo</span>
            </button>
          </div>
        </nav>

        <aside className="border-r border-slate-200 bg-white p-4">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-600" />
              <h1 className="text-sm font-black uppercase tracking-[0.16em]">Generador de IA</h1>
              <span className="rounded-full border border-orange-300 px-2 py-0.5 text-[10px] font-black text-orange-600">Mejora</span>
            </div>
            <ChevronDown className="h-4 w-4 rotate-90 text-slate-400" />
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Inmediato</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe la imagen que deseas generar..."
              rows={7}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 outline-none focus:border-orange-300"
            />
          </label>

          <div className="mt-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Color de fondo</p>
            <div className="flex flex-wrap gap-2">
              {BG_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateControl("background", color)}
                  className={`h-8 w-8 rounded-md border ${controls.background === color ? "ring-2 ring-slate-900 ring-offset-2" : "border-slate-200"}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <input
                type="color"
                value={controls.background}
                onChange={(event) => updateControl("background", event.target.value)}
                className="h-8 w-8 rounded-md border border-dashed border-slate-300 bg-white p-1"
                title="Elegir color"
              />
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              <span>Imagenes de referencia</span>
              <span>0/4</span>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-slate-300 text-2xl text-slate-400 hover:border-orange-300 hover:text-orange-600"
              title="Agregar imagen"
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={!sourceImage}
            onClick={processImage}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-400 enabled:bg-slate-900 enabled:text-white"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar
            <span className="rounded bg-orange-200 px-2 py-0.5 text-[10px] text-orange-950">Gratis 3/3</span>
          </button>
        </aside>

        <main className="grid bg-[#e5e5e5] p-6 lg:p-10">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <div className="mx-auto grid w-full max-w-2xl place-items-center">
            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="relative grid aspect-[0.86/1] w-full max-w-[340px] cursor-pointer place-items-center rounded-[28px] border-2 border-dashed border-white bg-white text-center shadow-sm"
            >
              {resultImage ? (
                <img src={resultImage} alt="Resultado en semitonos" className="h-full w-full rounded-[26px] object-contain p-4" />
              ) : sourceImage ? (
                <img src={sourceImage} alt="Imagen original" className="h-full w-full rounded-[26px] object-contain p-4 opacity-70" />
              ) : (
                <div className="px-8">
                  <div className="mx-auto mb-7 grid h-20 w-20 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                    <Upload className="h-9 w-9" />
                  </div>
                  <p className="text-2xl font-semibold text-slate-900">Arrastra la imagen aqui</p>
                  <p className="mt-3 text-base font-semibold text-slate-400">o haga clic para navegar</p>
                  <p className="mt-8 text-sm font-semibold text-slate-400">Tu primera guia comienza despues de la carga.</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="border-l border-slate-200 bg-white">
          <div className="sticky top-0 max-h-[calc(100vh-64px)] overflow-y-auto p-3">
            <button
              type="button"
              onClick={resetAll}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>

            <Section title="Color" open={openSections.color} onToggle={() => toggleSection("color")}>
              <ColorInput label="Color impactante" value={controls.foreground} enabled={controls.allowForeground} onToggle={(value) => updateControl("allowForeground", value)} onChange={(value) => updateControl("foreground", value)} />
              <ColorInput label="Color de fondo" value={controls.background} onChange={(value) => updateControl("background", value)} />
            </Section>

            <Section title="Patron de semitonos" open={openSections.pattern} onToggle={() => toggleSection("pattern")}>
              <p className="mb-2 text-sm font-semibold text-slate-600">Forma de punto</p>
              <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                {DOT_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => updateControl("dotShape", shape.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-black ${controls.dotShape === shape.id ? "bg-slate-900 text-white" : "text-slate-500"}`}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
              <RangeInput label="Tamano del punto" suffix="pixeles" value={controls.dotSize} min={4} max={28} step={0.5} onChange={(value) => updateControl("dotSize", value)} />
              <RangeInput label="Angulo del punto" suffix="°" value={controls.dotAngle} min={0} max={90} step={1} onChange={(value) => updateControl("dotAngle", value)} />
            </Section>

            <Section title="Configuracion de tamano" open={openSections.size} onToggle={() => toggleSection("size")}>
              <RangeInput label="Ancho de impresion" suffix="mm" value={controls.printWidth} min={80} max={420} step={1} onChange={(value) => updateControl("printWidth", value)} />
              <p className="mb-3 text-xs font-semibold text-slate-400">La altura se adapta automaticamente a la relacion de aspecto de la imagen.</p>
              <RangeInput label="Ancho del producto" suffix="mm" value={controls.productWidth} min={120} max={900} step={1} onChange={(value) => updateControl("productWidth", value)} />
              <p className="mb-3 text-xs font-semibold text-slate-400">Cambia la escala del producto de fondo solo en la vista previa.</p>
              <p className="mb-2 text-sm font-semibold text-slate-600">Exportar DPI</p>
              <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                {DPI_OPTIONS.map((dpi) => (
                  <button
                    key={dpi}
                    type="button"
                    onClick={() => updateControl("dpi", dpi)}
                    className={`rounded-lg px-3 py-2 text-sm font-black ${controls.dpi === dpi ? "bg-slate-900 text-white" : "text-slate-500"}`}
                  >
                    {dpi}
                  </button>
                ))}
              </div>
            </Section>

            <p className="my-4 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              <ChevronDown className="h-4 w-4" />
              Avanzado
            </p>

            <Section title="Preprocesamiento" open={openSections.preprocess} onToggle={() => toggleSection("preprocess")}>
              <RangeInput label="Difuminar" suffix="pixeles" value={controls.blur} min={0} max={10} step={0.1} onChange={(value) => updateControl("blur", value)} />
              <RangeInput label="Gama" value={controls.gamma} min={0.4} max={2.2} step={0.05} onChange={(value) => updateControl("gamma", value)} />
            </Section>

            <Section title="Equilibrio tonal" open={openSections.tone} onToggle={() => toggleSection("tone")}>
              <RangeInput label="Intensidad del gradiente" value={controls.gradient} min={0} max={1} step={0.01} onChange={(value) => updateControl("gradient", value)} />
              <RangeInput label="Contraste" value={controls.contrast} min={0.4} max={2} step={0.05} onChange={(value) => updateControl("contrast", value)} />
              <RangeInput label="Brillo" value={controls.brightness} min={-0.6} max={0.6} step={0.01} onChange={(value) => updateControl("brightness", value)} />
            </Section>

            <div className="sticky bottom-0 mt-3 space-y-3 border-t border-slate-200 bg-white pt-3">
              <button type="button" className="w-full rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-orange-600">
                Comprar materiales
              </button>
              <button
                type="button"
                disabled={!resultImage}
                onClick={exportImage}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
              >
                <Download className="h-4 w-4" />
                Exportar
                <span className="rounded bg-orange-200 px-2 py-0.5 text-[10px] text-orange-950">Gratis 10/10</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, open, onToggle, children }) {
  return (
    <section className="mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] text-slate-900"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </section>
  );
}

function ColorInput({ label, value, enabled, onToggle, onChange }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        {typeof enabled === "boolean" && (
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} className="accent-orange-500" />
            Permitir
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-6 w-6 rounded border-0 bg-transparent p-0" />
          <input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-mono font-semibold outline-none" />
        </label>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-400" title="Selector de color">
          <Palette className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RangeInput({ label, value, min, max, step, suffix = "", onChange }) {
  const display = Number(value).toFixed(step < 1 ? 2 : 1).replace(/\.0$/, "");
  return (
    <label className="mb-4 block">
      <span className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>{label}</span>
        <span className="text-slate-500">{display}{suffix ? ` ${suffix}` : ""}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-slate-950"
      />
    </label>
  );
}
