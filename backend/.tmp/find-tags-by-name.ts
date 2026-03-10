import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const rows = await sql`
    select tt.slug, tt.category, ttt.name
    from tool_tags tt
    left join tool_tag_translations ttt on tt.slug = ttt.slug and ttt.locale = 'en'
    where lower(coalesce(ttt.name, tt.slug)) in (
      'drawing aid', 'free', 'image editing', 'no login required', 'real-time preview', 'web app'
    )
    order by ttt.name
  `;

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
})();
