import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const rows = await sql`
    select slug, name, tags
    from tools
    where tags::jsonb ?| array['drawing-aid','no-login-required','real-time-preview']
    limit 20
  `;

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
})();
