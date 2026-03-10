import { db } from '@/db';
import { toolTags } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function checkIsActive() {
  try {
    const allTags = await db
      .select()
      .from(toolTags)
      .where(eq(toolTags.locale, 'en'));

    console.log('\n========================================');
    console.log('检查 is_active 字段值');
    console.log('========================================\n');

    allTags.forEach((tag, index) => {
      console.log(`${index + 1}. ${tag.name}`);
      console.log(`   is_active: ${tag.isActive}`);
      console.log(`   published: ${tag.published}`);
      console.log('');
    });

    const activeCount = allTags.filter((t) => t.isActive).length;
    const publishedCount = allTags.filter((t) => t.published).length;

    console.log(`总数: ${allTags.length}`);
    console.log(`is_active = true: ${activeCount}`);
    console.log(`published = true: ${publishedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkIsActive();
