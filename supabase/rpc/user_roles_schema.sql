-- Script SQL para crear el sistema de roles y permisos
-- Ejecutar en Supabase Dashboard -> SQL Editor

-- Tabla de roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de permisos por módulo
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    can_read BOOLEAN DEFAULT false,
    can_write BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, module)
);

-- Tabla de asignación de roles a usuarios
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Insertar roles por defecto
INSERT INTO user_roles (name, description, is_system_role) VALUES
    ('Administrador', 'Acceso completo a todos los módulos', true),
    ('Contador', 'Acceso completo a módulos contables, sin administración de usuarios', true),
    ('Auxiliar Contable', 'Puede registrar pero no aprobar transacciones', true),
    ('Consulta', 'Solo puede ver información, sin modificar', true)
ON CONFLICT (name) DO NOTHING;

-- Permisos para Administrador (todos)
INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT r.id, m.module, true, true, true, true
FROM user_roles r
CROSS JOIN (VALUES 
    ('dashboard'), ('puc'), ('terceros'), ('facturas'), ('cartera'), 
    ('tesoreria'), ('asientos'), ('comprobantes'), ('reportes'), ('cierre'),
    ('configuracion'), ('usuarios')
) AS m(module)
WHERE r.name = 'Administrador'
ON CONFLICT (role_id, module) DO NOTHING;

-- Permisos para Contador
INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT r.id, m.module, m.can_read, m.can_write, m.can_delete, m.can_approve
FROM user_roles r
CROSS JOIN (VALUES 
    ('dashboard', true, false, false, false),
    ('puc', true, true, true, true),
    ('terceros', true, true, true, true),
    ('facturas', true, true, true, true),
    ('cartera', true, true, true, true),
    ('tesoreria', true, true, true, true),
    ('asientos', true, true, true, true),
    ('comprobantes', true, true, true, true),
    ('reportes', true, false, false, false),
    ('cierre', true, true, false, true),
    ('configuracion', true, true, false, false),
    ('usuarios', false, false, false, false)
) AS m(module, can_read, can_write, can_delete, can_approve)
WHERE r.name = 'Contador'
ON CONFLICT (role_id, module) DO NOTHING;

-- Permisos para Auxiliar Contable
INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT r.id, m.module, m.can_read, m.can_write, m.can_delete, m.can_approve
FROM user_roles r
CROSS JOIN (VALUES 
    ('dashboard', true, false, false, false),
    ('puc', true, false, false, false),
    ('terceros', true, true, false, false),
    ('facturas', true, true, false, false),
    ('cartera', true, true, false, false),
    ('tesoreria', true, true, false, false),
    ('asientos', true, true, false, false),
    ('comprobantes', true, true, false, false),
    ('reportes', true, false, false, false),
    ('cierre', true, false, false, false),
    ('configuracion', false, false, false, false),
    ('usuarios', false, false, false, false)
) AS m(module, can_read, can_write, can_delete, can_approve)
WHERE r.name = 'Auxiliar Contable'
ON CONFLICT (role_id, module) DO NOTHING;

-- Permisos para Consulta (solo lectura)
INSERT INTO role_permissions (role_id, module, can_read, can_write, can_delete, can_approve)
SELECT r.id, m.module, true, false, false, false
FROM user_roles r
CROSS JOIN (VALUES 
    ('dashboard'), ('puc'), ('terceros'), ('facturas'), ('cartera'), 
    ('tesoreria'), ('asientos'), ('comprobantes'), ('reportes'), ('cierre')
) AS m(module)
WHERE r.name = 'Consulta'
ON CONFLICT (role_id, module) DO NOTHING;

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_id ON user_role_assignments(role_id);

-- Función para obtener permisos de un usuario
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    module VARCHAR(50),
    can_read BOOLEAN,
    can_write BOOLEAN,
    can_delete BOOLEAN,
    can_approve BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        rp.module,
        bool_or(rp.can_read) as can_read,
        bool_or(rp.can_write) as can_write,
        bool_or(rp.can_delete) as can_delete,
        bool_or(rp.can_approve) as can_approve
    FROM user_role_assignments ura
    JOIN role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = p_user_id
    GROUP BY rp.module;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
