import {
  Facebook,
  Instagram,
  MapPin,
  Music2,
  Package,
  PhoneCall,
  ShoppingBag,
} from "lucide-react";

const BACKGROUND_SRC = "https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/imagenes/descarga.jpeg";
const LOGO_SRC = "https://gzvtuenpwndodnetnmzi.supabase.co/storage/v1/object/public/imagenes/StreetWear.png.jpg";

const LINKS = {
  whatsapp: "https://wa.me/59177434023?text=Hola,%20quiero%20más%20información%20sobre%20sus%20productos.",
  catalogoProductos: "https://catalogo-sigma-one.vercel.app/bo",
  catalogoInsumos: "https://catalogo-sigma-one.vercel.app/bo/insumos",
  instagram: "https://www.instagram.com/street_wear.urban",
  tiktok: "https://www.tiktok.com/@streetwear930",
  facebook: "https://www.facebook.com/profile.php?id=61584642035749",
  ubicacion: "https://maps.app.goo.gl/c3gssfCFjW7nYrmE6",
  telefono: "+59177434023",
};

const BUTTONS = [
  { key: "instagram", label: "Instagram", icon: Instagram, tone: "instagram" },
  { key: "facebook", label: "Facebook", icon: Facebook, tone: "facebook" },
  { key: "whatsapp", label: "WhatsApp - Consultas y Pedidos", icon: WhatsAppIcon, tone: "whatsapp" },
  { key: "tiktok", label: "TikTok", icon: Music2, tone: "tiktok" },
  { key: "catalogoProductos", label: "Catalogo de Productos", icon: ShoppingBag, tone: "productos" },
  { key: "catalogoInsumos", label: "Catalogo de Insumos", icon: Package, tone: "insumos" },
  { key: "ubicacion", label: "Ubicacion", icon: MapPin, tone: "ubicacion" },
  { key: "telefono", label: "Llamar", icon: PhoneCall, tone: "telefono" },
];

export const metadata = {
  title: "STREET WEAR | Contacto",
  description: "Tarjeta digital de STREET WEAR.",
};

function getActionHref(key) {
  const value = String(LINKS[key] || "").trim();
  if (!value) return "";
  if (key === "telefono" && !value.startsWith("tel:")) {
    return `tel:${value.replace(/[^\d+]/g, "")}`;
  }
  return value;
}

function getIconTone(tone) {
  if (tone === "whatsapp") return "rounded-lg bg-[#20bb13] text-white shadow-[#20bb13]/35";
  if (tone === "instagram") return "bg-[radial-gradient(circle_at_30%_110%,#fdf497_0_18%,#fd5949_38%,#d6249f_62%,#285AEB_100%)] text-white shadow-pink-500/30";
  if (tone === "tiktok") return "bg-black text-white shadow-cyan-400/20 ring-1 ring-white/20";
  if (tone === "facebook") return "bg-[#1877F2] text-white shadow-blue-500/30";
  if (tone === "productos") return "bg-[linear-gradient(135deg,#38bdf8,#f97316)] text-white shadow-sky-500/20";
  if (tone === "insumos") return "bg-[linear-gradient(135deg,#fbbf24,#ef4444)] text-white shadow-amber-500/25";
  if (tone === "ubicacion") return "bg-red-600 text-white shadow-red-500/30";
  if (tone === "telefono") return "bg-green-500 text-white shadow-green-500/30";
  return "bg-transparent text-white ring-1 ring-white/65";
}

function WhatsAppIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13.2 52.4 16 42.1a22.4 22.4 0 1 1 8.2 7.8l-11 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24.2 20.9c.6-1.4 1.3-1.5 2.4-1.5h1.8c.6 0 1.4.2 2 1.5l2 4.8c.4 1 .3 1.8-.3 2.5l-1.5 1.8c-.4.5-.5 1 .1 1.9 1.8 3.1 4.4 5.6 7.6 7.4.8.5 1.4.5 1.9-.1l1.8-2c.6-.7 1.4-.8 2.3-.5l5 2.3c1.3.6 1.4 1.4 1.2 2.3-.4 2.3-2.6 4.8-5.2 5.3-4.1.8-10.4-1.5-15.6-6.7-5.2-5.1-8-11.7-7.2-15.7.3-1.5 1-2.6 1.7-3.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ContactButton({ item }) {
  const href = getActionHref(item.key);
  const Icon = item.icon;
  const disabled = !href;

  return (
    <a
      href={href || undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      className={`group flex min-h-[3.05rem] w-full items-center gap-3 rounded-xl border border-white/10 bg-[linear-gradient(90deg,rgba(32,32,32,0.95),rgba(18,18,18,0.98))] px-3 py-2.5 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_10px_24px_rgba(0,0,0,0.42)] backdrop-blur-md transition duration-300 ${
        disabled
          ? "pointer-events-none"
          : "hover:-translate-y-0.5 hover:border-white/25 hover:bg-[linear-gradient(90deg,rgba(50,50,50,0.96),rgba(28,28,28,0.99))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_14px_30px_rgba(0,0,0,0.5)] active:scale-[0.99]"
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-lg ${getIconTone(item.tone)}`}>
        <Icon className="h-5 w-5" strokeWidth={2.35} />
      </span>
      <span className="flex-1 text-[13px] font-semibold leading-tight text-white drop-shadow">{item.label}</span>
    </a>
  );
}

export default function ContactoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030303] px-4 py-5 text-white">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-75 blur-[1px]"
        style={{ backgroundImage: `url('${BACKGROUND_SRC}')` }}
      />
      <div className="absolute inset-0 bg-black/48" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,0,0.82)_0%,rgba(220,38,38,0.54)_14%,rgba(127,29,29,0.28)_30%,rgba(0,0,0,0)_48%)]" />
      <div className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/25 blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.72),rgba(0,0,0,0.18)_46%,rgba(0,0,0,0.72))]" />
      <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,1)]" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[24.8rem] items-center justify-center">
        <div className="relative w-full rounded-[2.2rem] border border-white/25 bg-black p-[0.48rem] shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_0_48px_rgba(127,29,29,0.42),0_32px_82px_rgba(0,0,0,0.85)]">
          <div className="absolute left-1/2 top-2 z-20 h-5 w-[7.2rem] -translate-x-1/2 rounded-b-2xl bg-black shadow-[0_1px_0_rgba(255,255,255,0.08)]" />

          <div
            className="relative min-h-[50.2rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-black px-7 pb-7 pt-12 shadow-inner max-[420px]:min-h-[calc(100vh-3.8rem)] max-[420px]:px-5 max-[420px]:pt-10"
          >
            <div className="absolute inset-0 bg-black" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.07),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0)_26%)]" />
            <div className="absolute left-1/2 top-3 z-20 flex h-7 w-28 -translate-x-1/2 items-center justify-center gap-2 rounded-b-2xl bg-black">
              <span className="h-2 w-2 rounded-full bg-zinc-500 shadow-[0_0_8px_rgba(161,161,170,0.65)]" />
              <span className="h-1.5 w-12 rounded-full bg-zinc-600 shadow-[0_0_8px_rgba(161,161,170,0.45)]" />
              <span className="h-2 w-2 rounded-full bg-zinc-700 ring-1 ring-zinc-500/70" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-7 flex h-[8.3rem] w-[8.3rem] items-center justify-center overflow-hidden rounded-[1.55rem] border border-white/25 bg-black shadow-2xl shadow-black/70">
                <img
                  src={LOGO_SRC}
                  alt="Logo STREET WEAR"
                  className="h-full w-full rounded-[1.45rem] object-cover"
                />
              </div>

              <div className="grid w-full gap-[0.55rem]">
                {BUTTONS.map((item) => (
                  <ContactButton key={item.key} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
