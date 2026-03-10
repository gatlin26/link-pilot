import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const rows = await sql`
    select distinct tag.value as tag
    from tools t,
    lateral jsonb_array_elements_text(coalesce(t.tags, '[]')::jsonb) as tag(value)
    where lower(tag.value) like any(array[
      '%drawing%',
      '%free%',
      '%image%',
      '%login%',
      '%preview%',
      '%web%'
    ])
    order by tag.value
    limit 200
  `;

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
})();
