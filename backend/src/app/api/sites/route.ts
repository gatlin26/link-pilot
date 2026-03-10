import { auth } from '@/lib/auth';
import { getDb } from '@/db/index';
import { sites } from '@/db/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, and, like, desc } from 'drizzle-orm';

const siteSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(100),
	url: z.string().url(),
	domain: z.string(),
	email: z.string().email(),
	type: z.string().optional(),
	description: z.string().optional(),
	keywords: z.string().optional(),
	comments: z.string(),
	metadata: z.string().optional(),
	enabled: z.boolean().optional(),
});

const createSiteSchema = z.object({
	sites: z.array(siteSchema),
});

// POST /api/sites - 创建/批量同步站点
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
		const { sites: siteList } = createSiteSchema.parse(body);

		const db = await getDb();
		let successCount = 0;
		let failedCount = 0;
		const errors: string[] = [];

		for (const site of siteList) {
			try {
				await db
					.insert(sites)
					.values({
						...site,
						userId,
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: sites.id,
						set: {
							name: site.name,
							url: site.url,
							domain: site.domain,
							email: site.email,
							type: site.type,
							description: site.description,
							keywords: site.keywords,
							comments: site.comments,
							metadata: site.metadata,
							enabled: site.enabled ?? true,
							updatedAt: new Date(),
						},
					});
				successCount++;
			} catch (error) {
				failedCount++;
				errors.push(`${site.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		return NextResponse.json({
			success: true,
			data: {
				total: siteList.length,
				success: successCount,
				failed: failedCount,
				errors: errors.length > 0 ? errors : undefined,
			},
		});
	} catch (error) {
		console.error('Sites sync error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// GET /api/sites - 获取站点列表
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
		
		const enabled = searchParams.get('enabled');
		const type = searchParams.get('type');
		const search = searchParams.get('search');
		const page = parseInt(searchParams.get('page') || '1');
		const limit = parseInt(searchParams.get('limit') || '50');
		const offset = (page - 1) * limit;

		const db = await getDb();
		
		// 构建查询条件
		const conditions = [eq(sites.userId, userId)];
		
		if (enabled !== null) {
			conditions.push(eq(sites.enabled, enabled === 'true'));
		}
		
		if (type) {
			conditions.push(eq(sites.type, type));
		}
		
		if (search) {
			conditions.push(like(sites.name, `%${search}%`));
		}

		// 查询数据
		const items = await db.query.sites.findMany({
			where: and(...conditions),
			orderBy: [desc(sites.createdAt)],
			limit,
			offset,
		});

		// 查询总数
		const totalResult = await db.query.sites.findMany({
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
		console.error('Get sites error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
