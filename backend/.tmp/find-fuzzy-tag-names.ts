import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const rows = await sql`
    select tt.slug, tt.category, tt.status, coalesce(ttt.name, tt.slug) as name
    from tool_tags tt
    left join tool_tag_translations ttt on tt.slug = ttt.slug and ttt.locale = 'en'
    where lower(coalesce(ttt.name, tt.slug)) like any(array[
      '%drawing%',
      '%free%',
      '%image editing%',
      '%login%',
      '%preview%',
      '%web app%'
    ])
    order by name
  `;

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
})();
