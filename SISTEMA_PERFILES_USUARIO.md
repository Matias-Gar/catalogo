# Sistema de Perfiles de Usuario

## Descripción

Este sistema permite a los usuarios normales (no administradores) gestionar su perfil personal de forma completamente aislada de las funciones administrativas.

## Características

- ✅ **Aislamiento completo**: Separado de cualquier funcionalidad de administrador
- ✅ **Seguridad RLS**: Solo pueden ver/editar su propio perfil
- ✅ **Campos editables**: Nombre, teléfono, biografía, avatar
- ✅ **Email protegido**: Solo lectura para evitar problemas de autenticación
- ✅ **Interfaz moderna**: Diseño limpio y responsivo
- ✅ **Navegación integrada**: Dropdown con acceso rápido al perfil

## Archivos Creados

### Componentes
- `components/UserProfile.js` - Componente principal para editar perfil
- `components/UserNavigation.js` - Navegación con dropdown de usuario

### Páginas
- `app/perfil/page.js` - Página de perfil para usuarios normales

### Lógica
- `lib/useUserProfile.js` - Hook personalizado para manejo de perfiles

### Base de Datos
- `database/profiles_migration.sql` - Migración SQL para crear la tabla y políticas

## Instalación

### 1. Ejecutar la migración SQL

Ejecuta el archivo `database/profiles_migration.sql` en tu consola de Supabase o cliente SQL:

```sql
-- El archivo contiene toda la estructura necesaria
-- incluyendo tabla, políticas RLS, triggers y funciones
```

### 2. Integrar la navegación

Agrega el componente `UserNavigation` a tu layout principal:

```jsx
import UserNavigation from '../components/UserNavigation';

export default function Layout({ children }) {
  return (
    <div>
      <UserNavigation />
      {children}
    </div>
  );
}
```

### 3. Usar el hook (opcional)

El hook `useUserProfile` está disponible para usar en otros componentes:

```jsx
import { useUserProfile } from '../lib/useUserProfile';

function MiComponente() {
  const { user, profile, loading, updateProfile } = useUserProfile();
  
  // Usar los datos del perfil
  return (
    <div>
      {profile?.full_name || 'Usuario'}
    </div>
  );
}
```

## Rutas

- `/perfil` - Página de perfil para usuarios normales
- `/admin/perfil` - Página de perfil de administrador (existente, sin cambios)

## Seguridad

El sistema implementa Row Level Security (RLS) en Supabase:

- Los usuarios solo pueden ver/editar su propio perfil
- No hay acceso a perfiles de otros usuarios
- Completamente aislado de funciones administrativas

## Campos del Perfil

| Campo | Tipo | Editable | Descripción |
|-------|------|----------|-------------|
| `full_name` | string | ✅ | Nombre completo del usuario |
| `email` | string | ❌ | Email (solo lectura) |
| `phone` | string | ✅ | Número de teléfono |
| `bio` | text | ✅ | Biografía personal |
| `avatar_url` | string | ✅ | URL de imagen de perfil |

## Funcionalidades

### Navegación
- Dropdown con avatar/inicial del nombre
- Acceso rápido al perfil
- Opción de cerrar sesión
- Información del usuario logueado

### Perfil
- Formulario completo de edición
- Previsualización de avatar
- Validación de campos
- Mensajes de éxito/error
- Navegación de regreso

### Automático
- Creación automática de perfil al registrarse
- Actualización de timestamp automática
- Sincronización con autenticación de Supabase

## Personalización

### Estilos
Los componentes usan Tailwind CSS. Puedes personalizar los estilos modificando las clases CSS.

### Campos adicionales
Para agregar campos al perfil:

1. Modifica la tabla en Supabase
2. Actualiza el componente `UserProfile.js`
3. Actualiza el hook `useUserProfile.js`

### Validaciones
Agrega validaciones en el componente `UserProfile.js` antes de enviar los datos.

## Compatibilidad

- ✅ Next.js 13+ (App Router)
- ✅ Supabase Auth
- ✅ Tailwind CSS
- ✅ React 18+