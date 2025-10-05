# Verificación de Variables de Entorno para Supabase

## 🔍 Diagnóstico del Error de Autenticación

El error "Invalid login credentials" puede ser causado por:

1. **Variables de entorno incorrectas**
2. **Políticas RLS mal configuradas**  
3. **Usuario no autenticado correctamente**
4. **Problemas de configuración de Supabase**

## ✅ Pasos para Diagnosticar

### 1. Verificar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gzvtuenpwndodnetnmzi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dnR1ZW5wd25kb2RuZXRubXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDUwODIsImV4cCI6MjA3NDA4MTA4Mn0.94z7ObbDdYydDTLtp5qZxIsB3XqFgGUBTxdP9pcf8z4
```

### 2. Verificar Configuración en Supabase

1. Ve a tu proyecto en Supabase
2. Dirígete a **Settings > API**
3. Verifica que las URLs y keys coincidan

### 3. Verificar Políticas RLS

En el SQL Editor de Supabase, ejecuta:

```sql
-- Verificar que las políticas estén activas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- Verificar que RLS esté habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';
```

### 4. Probar Autenticación Manualmente

En la consola del navegador (F12), ejecuta:

```javascript
// Verificar usuario actual
const { data: { user }, error } = await supabase.auth.getUser();
console.log('Usuario:', user, 'Error:', error);

// Verificar sesión
const { data: { session }, error: sessionError } = await supabase.auth.getSession();
console.log('Sesión:', session, 'Error:', sessionError);
```

## 🚨 Soluciones Comunes

### Si el usuario no está autenticado:
- Cerrar sesión y volver a iniciar sesión
- Limpiar localStorage del navegador
- Verificar que el login funcione correctamente

### Si las políticas fallan:
- Re-ejecutar el SQL de migración
- Verificar que el usuario tenga el UUID correcto en `auth.users`

### Si las variables de entorno están mal:
- Reiniciar el servidor de desarrollo después de cambiar `.env.local`
- Verificar que no haya espacios extra en las variables

## 🛠️ Debugging Mejorado

He agregado un componente `AuthDebug` que mostrará:
- Estado del usuario
- Estado de la sesión  
- Errores específicos
- ID del usuario

Visita `/perfil` y revisa la información de debug para identificar el problema exacto.

## 📞 Próximos Pasos

1. **Revisa la información de debug** en `/perfil`
2. **Copia y pega** cualquier error que aparezca
3. **Verifica** que estés logueado correctamente
4. **Ejecuta** las consultas SQL de verificación

Una vez que tengamos más información específica del error, podremos solucionarlo de manera precisa.