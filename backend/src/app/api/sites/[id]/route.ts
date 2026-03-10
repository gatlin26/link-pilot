import { auth } from '@/lib/auth';
import { getDb } from '@/db/index';
import { sites } from '@/db/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';

const updateSiteSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	url: z.string().url().optional(),
	domain: z.string().optional(),
	email: z.string().email().optional(),
	type: z.string().optional(),
	description: z.string().optional(),
	keywords: z.string().optional(),
	comments: z.string().optional(),
	metadata: z.string().optional(),
	enabled: z.boolean().optional(),
});

// GET /api/sites/:id - 获取单个站点
export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
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
		const db = await getDb();

		const site = await db.query.sites.findFirst({
			where: and(
				eq(sites.id, params.id),
				eq(sites.userId, userId)
			),
		});

		if (!site) {
			return NextResponse.json(
				{ success: false, error: 'Site not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			data: site,
		});
	} catch (error) {
		console.error('Get site error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// PUT /api/sites/:id - 更新站点
export async function PUT(
	request: Request,
	{ params }: { params: { id: string } }
) {
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
		const updateData = updateSiteSchema.parse(body);

		const db = await getDb();

		// 检查站点是否存在且属于当前用户
		const existingSite = await db.query.sites.findFirst({
			where: and(
				eq(sites.id, params.id),
				eq(sites.userId, userId)
			),
		});

		if (!existingSite) {
			return NextResponse.json(
				{ success: false, error: 'Site not found' },
				{ status: 404 }
			);
		}

		// 更新站点
		await db
			.update(sites)
			.set({
				...updateData,
				updatedAt: new Date(),
			})
			.where(eq(sites.id, params.id));

		// 获取更新后的数据
		const updatedSite = await db.query.sites.findFirst({
			where: eq(sites.id, params.id),
		});

		return NextResponse.json({
			success: true,
			data: updatedSite,
		});
	} catch (error) {
		console.error('Update site error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// DELETE /api/sites/:id - 删除站点
export async function DELETE(
	request: Request,
	{ params }: { params: { id: string } }
) {
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
		const db = await getDb();

		// 检查站点是否存在且属于当前用户
		const existingSite = await db.query.sites.findFirst({
			where: and(
				eq(sites.id, params.id),
				eq(sites.userId, userId)
			),
		});

		if (!existingSite) {
			return NextResponse.json(
				{ success: false, error: 'Site not found' },
				{ status: 404 }
			);
		}

		// 删除站点（会级联删除相关的submissions）
		await db
			.delete(sites)
			.where(eq(sites.id, params.id));

		return NextResponse.json({
			success: true,
			data: { id: params.id },
		});
	} catch (error) {
		console.error('Delete site error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
