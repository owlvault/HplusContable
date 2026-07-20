const fs = require('fs');

const PROJECT_REF = 'fitjpyqrecgvlrlpwipn';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdGpweXFyZWNndmxybHB3aXBuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDUwNzcwOCwiZXhwIjoyMTAwMDgzNzA4fQ.CgHJy2EReulob8qn5D0TtbhaxFtS9es5IYR23weVLqk';

async function executeSQL(sql, name) {
  console.log(`\n📄 Ejecutando: ${name}...`);
  
  // Usar la Supabase SQL API (Management API v1)
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  
  if (res.ok) {
    console.log(`✅ ${name}: Ejecutado correctamente`);
    return true;
  } else {
    console.log(`Response: ${text}`);
    return false;
  }
}

async function run() {
  const schemas = [
    { file: '/app/supabase/rpc/user_roles_schema.sql', name: 'User Roles Schema' },
    { file: '/app/supabase/rpc/invoice_templates_schema.sql', name: 'Invoice Templates Schema' },
    { file: '/app/supabase/rpc/bank_reconciliation_schema.sql', name: 'Bank Reconciliation Schema' }
  ];
  
  for (const schema of schemas) {
    const sql = fs.readFileSync(schema.file, 'utf-8');
    await executeSQL(sql, schema.name);
  }
}

run().catch(console.error);
