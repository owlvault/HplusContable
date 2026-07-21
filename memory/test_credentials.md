# Test Credentials - DigiKawsay

## Admin User
- **Email**: admin@digikawsay.app
- **Password**: CalamarDorado9!
- **Status**: Verified (email confirmed in Supabase)

## Supabase Project
- **URL**: https://fitjpyqrecgvlrlpwipn.supabase.co
- **ANON_KEY**: Configured in /app/.env
- **SERVICE_ROLE_KEY**: Required for DDL operations (not stored)

## Default Roles in Database
| Role | Description |
|------|-------------|
| Administrador | Acceso completo a todos los módulos |
| Contador | Acceso a módulos contables, sin administración de usuarios |
| Auxiliar Contable | Puede registrar pero no aprobar transacciones |
| Consulta | Solo lectura |

## Notes
- User was created and verified in Supabase Auth
- All tables created via SQL in Supabase Dashboard
- New tables (2026-07-21): user_roles, role_permissions, user_role_assignments, invoice_templates, bank_statements, bank_statement_lines
