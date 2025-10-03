-- 🔒 POLÍTICAS DE SEGURIDAD CRÍTICAS CORREGIDAS
-- Ejecutar en Supabase SQL Editor
-- Compatible con esquema real de base de datos

-- 1. ELIMINAR políticas existentes que puedan ser inseguras
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON perfiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON perfiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON perfiles;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON perfiles;
DROP POLICY IF EXISTS "Users can only view their own profile" ON perfiles;
DROP POLICY IF EXISTS "Users can only create their own profile" ON perfiles;
DROP POLICY IF EXISTS "Users can only update their own profile" ON perfiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON perfiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON perfiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON perfiles;
DROP POLICY IF EXISTS "Users can only access their own carts" ON carritos_pendientes;
DROP POLICY IF EXISTS "Admins can view all sales" ON ventas;
DROP POLICY IF EXISTS "Users can view their own sales" ON ventas;

-- 2. POLÍTICA SEGURA: Solo ver SU PROPIO perfil
CREATE POLICY "Users can only view their own profile" ON perfiles
FOR SELECT USING (id = auth.uid());

-- 3. POLÍTICA SEGURA: Solo crear SU PROPIO perfil
CREATE POLICY "Users can only create their own profile" ON perfiles  
FOR INSERT WITH CHECK (id = auth.uid());

-- 4. POLÍTICA SEGURA: Solo actualizar SU PROPIO perfil (usuarios normales)
CREATE POLICY "Users can only update their own profile" ON perfiles
FOR UPDATE USING (
  id = auth.uid() AND 
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol != 'admin'
  )
) 
WITH CHECK (
  id = auth.uid() AND 
  rol = (SELECT rol FROM perfiles WHERE id = auth.uid())
); -- NO puede cambiar su rol

-- 5. POLÍTICA ADMIN: Solo admins pueden ver TODOS los perfiles
CREATE POLICY "Admins can view all profiles" ON perfiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 6. POLÍTICA ADMIN: Solo admins pueden actualizar cualquier perfil
CREATE POLICY "Admins can update any profile" ON perfiles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 7. POLÍTICA ADMIN: Solo admins pueden eliminar perfiles
CREATE POLICY "Admins can delete profiles" ON perfiles
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 8. SEGURIDAD EN CARRITOS: Solo ver SUS propios carritos + permitir carritos anónimos
-- NOTA: usuario_id es TEXT, auth.uid() es UUID, necesitamos conversión
DROP POLICY IF EXISTS "Enable all actions for authenticated users" ON carritos_pendientes;

CREATE POLICY "Users can access their own carts or create anonymous carts" ON carritos_pendientes
FOR ALL USING (
  -- Usuarios autenticados solo pueden ver/modificar sus propios carritos
  (auth.uid() IS NOT NULL AND usuario_id = auth.uid()::text)
  OR
  -- Usuarios no autenticados pueden crear carritos anónimos (usuario_id = NULL)
  (auth.uid() IS NULL AND usuario_id IS NULL)
  OR
  -- Admins pueden ver todos los carritos
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 9. SEGURIDAD EN VENTAS: Solo admins pueden ver todas las ventas
-- NOTA: ventas no tiene usuario_id, solo admins pueden ver ventas
CREATE POLICY "Admins can view all sales" ON ventas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 10. VENTAS_DETALLE: Solo admins pueden ver detalles de ventas
CREATE POLICY "Admins can view sales details" ON ventas_detalle
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 11. PRODUCTOS: Todos pueden VER, solo admins pueden MODIFICAR
CREATE POLICY "Everyone can view products" ON productos
FOR SELECT USING (true);

CREATE POLICY "Admins can insert products" ON productos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can update products" ON productos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can delete products" ON productos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 12. CATEGORÍAS: Todos pueden VER, solo admins pueden MODIFICAR
CREATE POLICY "Everyone can view categories" ON categorias
FOR SELECT USING (true);

CREATE POLICY "Admins can insert categories" ON categorias
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can update categories" ON categorias
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can delete categories" ON categorias
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 13. PROMOCIONES: Todos pueden VER, solo admins pueden MODIFICAR
CREATE POLICY "Everyone can view promotions" ON promociones
FOR SELECT USING (true);

CREATE POLICY "Admins can insert promotions" ON promociones
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can update promotions" ON promociones
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can delete promotions" ON promociones
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 14. PACKS: Todos pueden VER, solo admins pueden MODIFICAR
CREATE POLICY "Everyone can view packs" ON packs
FOR SELECT USING (true);

CREATE POLICY "Admins can insert packs" ON packs
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can update packs" ON packs
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can delete packs" ON packs
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 15. PACK_PRODUCTOS: Todos pueden VER, solo admins pueden MODIFICAR
CREATE POLICY "Everyone can view pack products" ON pack_productos
FOR SELECT USING (true);

CREATE POLICY "Admins can insert pack products" ON pack_productos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can update pack products" ON pack_productos
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can delete pack products" ON pack_productos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 16. PRODUCTO_IMAGENES: Todos pueden VER, solo admins pueden MODIFICAR
CREATE POLICY "Everyone can view product images" ON producto_imagenes
FOR SELECT USING (true);

CREATE POLICY "Admins can insert product images" ON producto_imagenes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can update product images" ON producto_imagenes
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

CREATE POLICY "Admins can delete product images" ON producto_imagenes
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 17. HABILITAR RLS en todas las tablas críticas
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carritos_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_imagenes ENABLE ROW LEVEL SECURITY;

COMMIT;