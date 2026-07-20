const pg = require('pg');
const fs = require('fs');

const PROJECT_REF = 'fitjpyqrecgvlrlpwipn';

// Intentar conectar - necesitamos la contraseña de la base de datos
const connectionConfig = {
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'test123',
  ssl: { rejectUnauthorized: false }
};

console.log('Intentando conectar a Supabase PostgreSQL...');
console.log('Host:', connectionConfig.host);

const client = new pg.Client(connectionConfig);

async function run() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');
    
    const schemas = [
      { file: '/app/supabase/rpc/user_roles_schema.sql', name: 'User Roles Schema' },
      { file: '/app/supabase/rpc/invoice_templates_schema.sql', name: 'Invoice Templates Schema' },
      { file: '/app/supabase/rpc/bank_reconciliation_schema.sql', name: 'Bank Reconciliation Schema' }
    ];
    
    for (const schema of schemas) {
      console.log(`📄 Ejecutando: ${schema.name}...`);
      const sql = fs.readFileSync(schema.file, 'utf-8');
      await client.query(sql);
      console.log(`✅ ${schema.name}: Completado\n`);
    }
    
    console.log('🎉 Todos los schemas ejecutados correctamente!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('password')) {
      console.log('\n💡 Necesito la contraseña de la base de datos PostgreSQL de Supabase.');
      console.log('   La puedes encontrar en: Supabase Dashboard -> Settings -> Database -> Connection string');
    }
  } finally {
    await client.end();
  }
}

run();
