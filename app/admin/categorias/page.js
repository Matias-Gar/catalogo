"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/SupabaseClient";
import { showToast } from "../../../components/ui/Toast";

export default function AdminCategorias() {
  const router = useRouter();
  const [categorias, setCategorias] = useState([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editando, setEditando] = useState(null); // id de la categoría en edición
  const [nombreEdit, setNombreEdit] = useState("");

  // Nuevos estados para el panel y productos
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productos, setProductos] = useState([]);

  // Cargar categorías y productos
  useEffect(() => {
    fetchCategorias();
    fetchProductos();
  }, []);

  async function fetchCategorias() {
    const { data, error } = await supabase.from("categorias").select("*");
    if (error) {
      showToast("Error al cargar categorías", "error");
    } else if (data) {
      setCategorias(data);
    }
  }

  // Nueva: cargar productos desde Supabase (ajusta nombres de tabla/columnas si hace falta)
  async function fetchProductos() {
    const { data, error } = await supabase.from("productos").select("*");
    if (error) {
      showToast("Error al cargar productos", "error");
    } else if (data) {
      setProductos(data);
    }
  }

  // Insertar nueva categoría
  async function handleAgregar(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    const { error } = await supabase.from("categorias").insert({ categori: nuevaCategoria });
    if (error) {
      showToast("Error al agregar la categoría", "error");
    } else {
      setNuevaCategoria("");
      fetchCategorias();
      showToast("Categoría agregada con éxito");
    }
  }

  // Eliminar categoría
  async function handleEliminar(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) {
      showToast("Error al eliminar la categoría", "error");
    } else {
      fetchCategorias();
      showToast("Categoría eliminada");
    }
  }

  // Guardar edición
  async function handleGuardarEdit(id) {
    if (!nombreEdit.trim()) return;
    const { error } = await supabase.from("categorias").update({ categori: nombreEdit }).eq("id", id);
    if (error) {
      showToast("Error al guardar la categoría", "error");
    } else {
      setEditando(null);
      setNombreEdit("");
      fetchCategorias();
      showToast("Categoría actualizada");
    }
  }

  // Nuevo: abrir la página dedicada al catálogo (versión robusta)
  function openCatalogPage() {
    const url = (typeof window !== "undefined") ? `${window.location.origin}/admin/productos/catalogo` : "/admin/productos/catalogo";
    try {
      const newWin = (typeof window !== "undefined") && window.open(url, "_blank", "noopener,noreferrer");
      if (!newWin) {
        try { router.push("/admin/productos/catalogo"); } catch (e) { window.location.href = url; }
      }
    } catch (e) {
      try { router.push("/admin/productos/catalogo"); } catch (err) { if (typeof window !== "undefined") window.location.href = url; }
    }
  }

  return (
      <div className="w-full min-h-screen flex">
        {/* Sidebar / Hamburguesa */}
        <aside className={`transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-14'} bg-gray-900 text-gray-100 min-h-screen p-3`}>
          <div className="flex items-center justify-between mb-4">
            <button className="p-2" onClick={() => setSidebarOpen(v => !v)}>
              {/* icono hamburguesa simple */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            {sidebarOpen && <span className="font-bold">Panel Admin</span>}
          </div>

          <nav className="flex flex-col gap-2">
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* navegar a perfiles */ }}>{sidebarOpen ? 'Perfiles' : 'P'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* navegar a pedidos */ }}>{sidebarOpen ? 'Pedidos' : 'D'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* gestionar productos */ }}>{sidebarOpen ? 'Gestión de productos' : 'G'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* inventario */ }}>{sidebarOpen ? 'Control de inventario' : 'I'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* ventas */ }}>{sidebarOpen ? 'Ventas' : 'V'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* categorias */ }}>{sidebarOpen ? 'Categorías' : 'C'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* promociones */ }}>{sidebarOpen ? 'Promociones' : '%'}</button>
            <button className="text-left p-2 rounded hover:bg-gray-800" onClick={() => { /* whatsapp business */ }}>{sidebarOpen ? 'WhatsApp Business' : 'W'}</button>

            <hr className="border-gray-700 my-2" />

            {/* Sidebar: botón que ahora abre la página dedicada */}
            <button
              className="text-left p-2 rounded bg-yellow-700 hover:bg-yellow-800"
              onClick={openCatalogPage}
              title="Abrir página de catálogo"
            >
              {sidebarOpen ? 'Generar Catálogo' : 'Cat'}
            </button>
          </nav>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 py-8 px-4">
          <div className="w-full min-h-screen flex flex-col items-center justify-start py-8 px-2">
            {/* Sección de agregar */}
            <section className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-xl p-6 mb-8 border border-gray-700">
              <h1 className="text-2xl font-bold mb-4 text-gray-100">Agregar Categoría</h1>
              <form onSubmit={handleAgregar} className="flex flex-col sm:flex-row gap-2">
                <input
                  className="flex-1 border border-gray-700 bg-gray-900 text-gray-100 rounded px-3 py-2 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/30"
                  placeholder="Nueva categoría"
                  value={nuevaCategoria}
                  onChange={e => setNuevaCategoria(e.target.value)}
                />
                <button type="submit" className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded font-bold shadow">Agregar</button>
              </form>
            </section>

            {/* Botón rápido para ir a la página del catálogo */}
            <div className="w-full max-w-4xl mb-4 flex flex-col items-end">
              <div className="mb-2">
                <button onClick={openCatalogPage} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded shadow">
                  Abrir Catálogo (Street Wear)
                </button>
              </div>

              {/* Indicador para el usuario */}
              <div className="text-sm text-gray-300">
                Haz clic en "Generar Catálogo" (barra lateral) o en este botón para abrir la vista lista para imprimir/guardar PDF.
                Si no aparece la ventana, permite ventanas emergentes en tu navegador.
              </div>
            </div>

            {/* Sección de listado */}
            <section className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-gray-100">Lista de Categorías</h2>
              <ul className="space-y-2">
                {categorias.map(cat => (
                  <li key={cat.id} className="flex items-center gap-2 bg-gray-900 rounded shadow p-2 border border-gray-700">
                    {editando === cat.id ? (
                      <>
                        <input
                          className="border border-gray-600 bg-gray-800 text-gray-100 rounded px-2 py-1 flex-1 focus:border-blue-500 focus:ring focus:ring-blue-500/30"
                          value={nombreEdit}
                          onChange={e => setNombreEdit(e.target.value)}
                        />
                        <button className="bg-blue-700 hover:bg-blue-800 text-white px-2 py-1 rounded shadow" onClick={() => handleGuardarEdit(cat.id)}>Guardar</button>
                        <button className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded shadow" onClick={() => setEditando(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-gray-100">{cat.categori}</span>
                        <button className="text-gray-400 hover:text-gray-200" onClick={() => { setEditando(cat.id); setNombreEdit(cat.categori); }}>
                          {/* icono editar */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232a8.001 8.001 0 00-10.464 10.464M19.364 4.636a8.001 8.001 0 010 11.314M9.514 15.514a8.001 8.001 0 0011.314 0M4.636 19.364a8.001 8.001 0 010-11.314" /></svg>
                        </button>
                        <button className="text-red-500 hover:text-red-400" onClick={() => handleEliminar(cat.id)}>
                          {/* icono eliminar */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>
  );
}
