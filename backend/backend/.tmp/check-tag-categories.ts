import postgres from 'postgres';

(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const rows = await sql`
    select slug, category, status, sort_order
    from tool_tags
    where slug = any(array['ai-image-generator','free','text-to-image','photo-editor','web-app','image-editing','creativity','content-generation','for-designers'])
    order by slug
  `;

  console.log(JSON.stringify(rows, null, 2));
  await sql.end();
})();
