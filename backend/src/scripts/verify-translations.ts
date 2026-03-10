import '../lib/env-loader';
import { db } from '@/db';
import { toolTags, toolTagTranslations } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function verifyTranslations() {
	console.log('=== 验证标签翻译完整性 ===\n');

	const tags = (await db.select().from(toolTags)) as any[];

	console.log(`总标签数: ${tags.length}\n`);

	let completeCount = 0;
	let incompleteCount = 0;
	const incompleteList: string[] = [];

	for (const tag of tags) {
		const translations = (await db
			.select()
			.from(toolTagTranslations)
			.where(eq(toolTagTranslations.slug, tag.slug))) as any[];

		const enTranslation = translations.find((t) => t.locale === 'en');
		const zhTranslation = translations.find((t) => t.locale === 'zh');

		const hasCompleteEn = enTranslation?.name && enTranslation?.description;
		const hasCompleteZh = zhTranslation?.name && zhTranslation?.description;

		if (hasCompleteEn && hasCompleteZh) {
			completeCount++;
		} else {
			incompleteCount++;
			incompleteList.push(
				`${tag.slug}: EN=${hasCompleteEn ? '✓' : '✗'}, ZH=${hasCompleteZh ? '✓' : '✗'}`
			);
		}
	}

	console.log('完整翻译 (EN+ZH):', completeCount);
	console.log('不完整翻译:', incompleteCount);

	if (incompleteList.length > 0) {
		console.log('\n不完整的标签:');
		incompleteList.slice(0, 20).forEach((item) => console.log(`  - ${item}`));
		if (incompleteList.length > 20) {
			console.log(`  ... 还有 ${incompleteList.length - 20} 个`);
		}
	}

	process.exit(0);
}

verifyTranslations().catch(console.error);
