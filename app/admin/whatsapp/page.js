"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/SupabaseClient';
import { CONFIG } from '../../../lib/config';

export default function WhatsAppAdminPage() {
  const [catalogo, setCatalogo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('catalogo');
  const [facebookSync, setFacebookSync] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    await Promise.all([
      cargarCatalogo(),
      cargarMensajes(),
      cargarEstadisticas()
    ]);
    setLoading(false);
  };

  const cargarCatalogo = async () => {
    try {
      const response = await fetch('/api/whatsapp/catalogo');
      const data = await response.json();
      setCatalogo(data);
    } catch (error) {
      console.error('Error cargando catálogo:', error);
    }
  };

  const cargarMensajes = async () => {
    try {
      const { data, error } = await supabase
        .from('mensajes_whatsapp')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (!error) {
        setMensajes(data || []);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const response = await fetch('/api/whatsapp/comando?comando=stock');
      const data = await response.json();
      setEstadisticas(data.estadisticas);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // 🔗 Funciones para Facebook Catalog
  const syncToFacebook = async (action, params = {}) => {
    setSyncLoading(true);
    try {
      const response = await fetch('/api/facebook/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params })
      });
      
      const result = await response.json();
      setFacebookSync(result);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error syncing to Facebook:', error);
      alert('❌ Error de conexión');
    } finally {
      setSyncLoading(false);
    }
  };

  const enviarCatalogoWhatsApp = async () => {
    if (!catalogo) return;
    
    const numero = CONFIG.WHATSAPP_BUSINESS;
    const mensaje = catalogo.data.texto_whatsapp;
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto);
    alert('✅ Texto copiado al portapapeles');
  };

  const generarComando = async (comando, parametro = '') => {
    setLoading(true);
    try {
      const url = parametro 
        ? `/api/whatsapp/comando?comando=${comando}&categoria=${parametro}`
        : `/api/whatsapp/comando?comando=${comando}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.texto_whatsapp) {
        copiarTexto(data.texto_whatsapp);
      }
    } catch (error) {
      alert('❌ Error generando comando');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📱 WhatsApp Business Admin
          </h1>
          <p className="text-gray-600">
            Gestiona la integración de WhatsApp con tu catálogo de productos
          </p>
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              <strong>Número WhatsApp Business:</strong> {CONFIG.WHATSAPP_BUSINESS}
            </p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'catalogo', label: '🛍️ Catálogo', icon: '🛍️' },
                { id: 'comandos', label: '⚡ Comandos', icon: '⚡' },
                { id: 'mensajes', label: '💬 Mensajes', icon: '💬' },
                { id: 'facebook', label: '📘 Facebook', icon: '📘' },
                { id: 'config', label: '⚙️ Configuración', icon: '⚙️' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Pestaña Catálogo */}
            {activeTab === 'catalogo' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Catálogo WhatsApp</h2>
                  <div className="space-x-2">
                    <button
                      onClick={cargarCatalogo}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      🔄 Actualizar
                    </button>
                    <button
                      onClick={enviarCatalogoWhatsApp}
                      disabled={!catalogo}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      📱 Enviar por WhatsApp
                    </button>
                  </div>
                </div>

                {catalogo && (
                  <div className="space-y-6">
                    {/* Estadísticas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-blue-600 text-2xl font-bold">
                          {catalogo.total_productos}
                        </div>
                        <div className="text-blue-800 text-sm">Total Productos</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="text-green-600 text-2xl font-bold">
                          {catalogo.productos_con_promocion}
                        </div>
                        <div className="text-green-800 text-sm">Con Promoción</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-purple-600 text-2xl font-bold">
                          {catalogo.total_categorias}
                        </div>
                        <div className="text-purple-800 text-sm">Categorías</div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <div className="text-yellow-600 text-2xl font-bold">
                          {new Date().toLocaleDateString()}
                        </div>
                        <div className="text-yellow-800 text-sm">Última Actualización</div>
                      </div>
                    </div>

                    {/* Texto del catálogo */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Texto del Catálogo WhatsApp
                        </h3>
                        <button
                          onClick={() => copiarTexto(catalogo.data.texto_whatsapp)}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                        >
                          📋 Copiar
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto bg-white p-4 rounded border">
                        {catalogo.data.texto_whatsapp}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pestaña Comandos */}
            {activeTab === 'comandos' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Comandos Rápidos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { comando: 'catalogo', label: '🛍️ Catálogo Completo', desc: 'Generar catálogo completo de productos' },
                    { comando: 'promociones', label: '🔥 Solo Promociones', desc: 'Solo productos con descuentos' },
                    { comando: 'categorias', label: '📂 Lista de Categorías', desc: 'Todas las categorías disponibles' },
                    { comando: 'stock', label: '📊 Reporte de Stock', desc: 'Estado actual del inventario' }
                  ].map(item => (
                    <div key={item.comando} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <h3 className="font-semibold text-gray-800 mb-2">{item.label}</h3>
                      <p className="text-gray-600 text-sm mb-3">{item.desc}</p>
                      <button
                        onClick={() => generarComando(item.comando)}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
                      >
                        Generar y Copiar
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-3">
                    💡 URLs de la API
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Catálogo:</strong> <code>/api/whatsapp/catalogo</code></div>
                    <div><strong>Comandos:</strong> <code>/api/whatsapp/comando?comando=[tipo]</code></div>
                    <div><strong>Webhook:</strong> <code>/api/whatsapp/webhook</code></div>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña Mensajes */}
            {activeTab === 'mensajes' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">Mensajes WhatsApp</h2>
                  <button
                    onClick={cargarMensajes}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    🔄 Actualizar
                  </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {mensajes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      📭 No hay mensajes registrados aún
                    </div>
                  ) : (
                    mensajes.map((mensaje, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        mensaje.tipo === 'recibido' 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-gray-800">
                            {mensaje.tipo === 'recibido' ? '📱' : '🤖'} {mensaje.nombre_contacto}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(mensaje.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-gray-700 text-sm whitespace-pre-wrap">
                          {mensaje.mensaje}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          📞 {mensaje.telefono}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Pestaña Facebook Catalog */}
            {activeTab === 'facebook' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">🔗 Facebook Business Catalog</h2>
                
                {/* Estado de conexión */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-blue-500 text-white rounded-full p-3">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-800">Integración con Facebook Business</h3>
                      <p className="text-blue-600">Sincroniza tu catálogo con Facebook para WhatsApp Business</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">📊 Estado del Catálogo</h4>
                      <div className="space-y-2 text-sm">
                        <div>Catalog ID: <code className="bg-gray-100 px-2 py-1 rounded">113970374931116</code></div>
                        <div>Productos sincronizados: <span className="font-bold text-green-600">{facebookSync?.data?.total_productos || 0}</span></div>
                        <div>Última sincronización: <span className="text-gray-600">Pendiente</span></div>
                      </div>
                    </div>

                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">⚙️ Configuración Requerida</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                          Access Token de Facebook
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                          Catalog ID configurado
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                          Business Manager activo
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Acciones de sincronización */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <button
                    onClick={() => syncToFacebook('sync_all')}
                    disabled={syncLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg disabled:opacity-50 transition"
                  >
                    <div className="text-2xl mb-2">🔄</div>
                    <div className="font-semibold">Sincronizar Todo</div>
                    <div className="text-sm opacity-90">Subir todos los productos</div>
                  </button>

                  <button
                    onClick={() => syncToFacebook('stats')}
                    disabled={syncLoading}
                    className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg disabled:opacity-50 transition"
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <div className="font-semibold">Ver Estadísticas</div>
                    <div className="text-sm opacity-90">Estado del catálogo</div>
                  </button>

                  <button
                    onClick={() => window.open('https://business.facebook.com/', '_blank')}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg transition"
                  >
                    <div className="text-2xl mb-2">🔗</div>
                    <div className="font-semibold">Business Manager</div>
                    <div className="text-sm opacity-90">Abrir Facebook</div>
                  </button>

                  <button
                    onClick={() => window.open('https://developers.facebook.com/docs/marketing-api/catalog/', '_blank')}
                    className="bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-lg transition"
                  >
                    <div className="text-2xl mb-2">📖</div>
                    <div className="font-semibold">Documentación</div>
                    <div className="text-sm opacity-90">Guía de Facebook API</div>
                  </button>
                </div>

                {/* Resultado de sincronización */}
                {facebookSync && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Resultado de Sincronización</h3>
                    <div className="bg-gray-50 border rounded p-4">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(facebookSync, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Instrucciones de configuración */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-4">⚠️ Instrucciones de Configuración</h3>
                  <div className="space-y-4 text-yellow-700">
                    <div>
                      <strong>1. En Facebook Business Manager:</strong>
                      <ul className="list-disc ml-6 mt-2 space-y-1">
                        <li>Ve a &quot;Catálogos&quot; → Tu catálogo creado</li>
                        <li>Clic en &quot;Agregar un píxel o SDK&quot;</li>
                        <li>Selecciona &quot;Conversions API&quot;</li>
                        <li>Copia el Access Token generado</li>
                      </ul>
                    </div>
                    <div>
                      <strong>2. En tu archivo .env.local:</strong>
                      <code className="block bg-yellow-100 p-2 rounded mt-2 text-sm">
                        FACEBOOK_ACCESS_TOKEN=tu_token_aqui<br/>
                        FACEBOOK_CATALOG_ID=113970374931116<br/>
                        FACEBOOK_BUSINESS_ID=1091120766441912
                      </code>
                    </div>
                    <div>
                      <strong>3. Reinicia tu aplicación</strong> para aplicar los cambios.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña Configuración */}
            {activeTab === 'config' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Configuración WhatsApp Business</h2>
                
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4">
                      📋 Pasos para Configurar WhatsApp Business API
                    </h3>
                    <ol className="space-y-2 text-blue-700">
                      <li>1. Crear una aplicación en Facebook Developers</li>
                      <li>2. Configurar WhatsApp Business API</li>
                      <li>3. Obtener el token de acceso</li>
                      <li>4. Configurar el webhook: <code>/api/whatsapp/webhook</code></li>
                      <li>5. Añadir las variables de entorno</li>
                    </ol>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      🔧 Variables de Entorno Requeridas
                    </h3>
                    <div className="space-y-2 text-sm font-mono bg-black text-green-400 p-4 rounded">
                      <div>WHATSAPP_VERIFY_TOKEN=tu_token_verificacion</div>
                      <div>WHATSAPP_ACCESS_TOKEN=tu_token_de_acceso</div>
                      <div>WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id</div>
                      <div>NEXT_PUBLIC_APP_URL=https://tu-dominio.com</div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4">
                      ✅ Estado Actual
                    </h3>
                    <div className="space-y-2">
                      <div>📱 Número Business: {CONFIG.WHATSAPP_BUSINESS}</div>
                      <div>🔗 Webhook URL: {process.env.NEXT_PUBLIC_APP_URL || 'localhost:3001'}/api/whatsapp/webhook</div>
                      <div>📊 API Endpoint: {process.env.NEXT_PUBLIC_APP_URL || 'localhost:3001'}/api/whatsapp/catalogo</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}