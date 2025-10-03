-- 🔒 POLÍTICAS DE SEGURIDAD CRÍTICAS CORREGIDAS
-- Ejecutar en Supabase SQL Editor

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

-- 2. POLÍTICA SEGURA: Solo ver SU PROPIO perfil
CREATE POLICY "Users can only view their own profile" ON perfiles
FOR SELECT USING (auth.uid() = id);

-- 3. POLÍTICA SEGURA: Solo crear SU PROPIO perfil
CREATE POLICY "Users can only create their own profile" ON perfiles  
FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. POLÍTICA SEGURA: Solo actualizar SU PROPIO perfil (usuarios normales)
CREATE POLICY "Users can only update their own profile" ON perfiles
FOR UPDATE USING (
  auth.uid() = id AND 
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol != 'admin'
  )
) 
WITH CHECK (
  auth.uid() = id AND 
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

-- 8. SEGURIDAD EN CARRITOS: Solo ver SUS propios carritos
DROP POLICY IF EXISTS "Enable all actions for authenticated users" ON carritos_pendientes;
DROP POLICY IF EXISTS "Users can only access their own carts" ON carritos_pendientes;

CREATE POLICY "Users can only access their own carts" ON carritos_pendientes
FOR ALL USING (auth.uid() = usuario_id);

-- 9. SEGURIDAD EN VENTAS: Solo admins pueden ver todas las ventas
DROP POLICY IF EXISTS "Admins can view all sales" ON ventas;
DROP POLICY IF EXISTS "Users can view their own sales" ON ventas;

CREATE POLICY "Admins can view all sales" ON ventas
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM perfiles p 
    WHERE p.id = auth.uid() AND p.rol = 'admin'
  )
);

-- 10. USUARIOS pueden ver solo SUS propias ventas
CREATE POLICY "Users can view their own sales" ON ventas
FOR SELECT USING (auth.uid() = usuario_id);

-- 11. HABILITAR RLS en todas las tablas críticas
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carritos_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

COMMIT;