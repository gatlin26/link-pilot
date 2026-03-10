import { auth } from '@/lib/auth';
import { getDb } from '@/db/index';
import { backlinks } from '@/db/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, and, like, desc } from 'drizzle-orm';

const backlinkSchema = z.object({
	id: z.string(),
	url: z.string().url(),
	domain: z.string(),
	title: z.string().optional(),
	type: z.string().optional(),
	category: z.string().optional(),
	dr: z.number().optional(),
	traffic: z.number().optional(),
	quality: z.string().optional(),
	tags: z.string().optional(),
	targetAudience: z.string().optional(),
	note: z.string().optional(),
	status: z.string().optional(),
	flagged: z.boolean().optional(),
	metadata: z.string().optional(),
});

const createBacklinkSchema = z.object({
	backlinks: z.array(backlinkSchema),
});

// POST /api/backlinks - 创建/批量同步外链
export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json(
				{ success: false, error: 'Unauthorized' },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const body = await request.json();
		const { backlinks: backlinkList } = createBacklinkSchema.parse(body);

		const db = await getDb();
		let successCount = 0;
		let failedCount = 0;
		const errors: string[] = [];

		for (const backlink of backlinkList) {
			try {
				await db
					.insert(backlinks)
					.values({
						...backlink,
						userId,
						status: backlink.status || 'active',
						flagged: backlink.flagged ?? false,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: backlinks.id,
						set: {
							url: backlink.url,
							domain: backlink.domain,
							title: backlink.title,
							type: backlink.type,
							category: backlink.category,
							dr: backlink.dr,
							traffic: backlink.traffic,
							quality: backlink.quality,
							tags: backlink.tags,
							targetAudience: backlink.targetAudience,
							note: backlink.note,
							status: backlink.status || 'active',
							flagged: backlink.flagged ?? false,
							metadata: backlink.metadata,
							updatedAt: new Date(),
						},
					});
				successCount++;
			} catch (error) {
				failedCount++;
				errors.push(`${backlink.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		return NextResponse.json({
			success: true,
			data: {
				total: backlinkList.length,
				success: successCount,
				failed: failedCount,
				errors: errors.length > 0 ? errors : undefined,
			},
		});
	} catch (error) {
		console.error('Backlinks sync error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// GET /api/backlinks - 获取外链列表
export async function GET(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json(
				{ success: false, error: 'Unauthorized' },
				{ status: 401 }
			);
		}

		const userId = session.user.id;
		const { searchParams } = new URL(request.url);
		
		const type = searchParams.get('type');
		const category = searchParams.get('category');
		const quality = searchParams.get('quality');
		const status = searchParams.get('status');
		const flagged = searchParams.get('flagged');
		const search = searchParams.get('search');
		const page = parseInt(searchParams.get('page') || '1');
		const limit = parseInt(searchParams.get('limit') || '50');
		const offset = (page - 1) * limit;

		const db = await getDb();
		
		// 构建查询条件
		const conditions = [eq(backlinks.userId, userId)];
		
		if (type) {
			conditions.push(eq(backlinks.type, type));
		}
		
		if (category) {
			conditions.push(eq(backlinks.category, category));
		}
		
		if (quality) {
			conditions.push(eq(backlinks.quality, quality));
		}
		
		if (status) {
			conditions.push(eq(backlinks.status, status));
		}
		
		if (flagged !== null) {
			conditions.push(eq(backlinks.flagged, flagged === 'true'));
		}
		
		if (search) {
			conditions.push(like(backlinks.domain, `%${search}%`));
		}

		// 查询数据
		const items = await db.query.backlinks.findMany({
			where: and(...conditions),
			orderBy: [desc(backlinks.createdAt)],
			limit,
			offset,
		});

		// 查询总数
		const totalResult = await db.query.backlinks.findMany({
			where: and(...conditions),
		});
		const total = totalResult.length;

		return NextResponse.json({
			success: true,
			data: {
				items,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error('Get backlinks error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
