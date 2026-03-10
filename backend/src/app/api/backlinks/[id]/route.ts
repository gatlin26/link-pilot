import { auth } from '@/lib/auth';
import { getDb } from '@/db/index';
import { backlinks } from '@/db/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';

const updateBacklinkSchema = z.object({
	url: z.string().url().optional(),
	domain: z.string().optional(),
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

// GET /api/backlinks/:id - 获取单个外链
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

		const backlink = await db.query.backlinks.findFirst({
			where: and(
				eq(backlinks.id, params.id),
				eq(backlinks.userId, userId)
			),
		});

		if (!backlink) {
			return NextResponse.json(
				{ success: false, error: 'Backlink not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			data: backlink,
		});
	} catch (error) {
		console.error('Get backlink error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// PUT /api/backlinks/:id - 更新外链
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
		const updateData = updateBacklinkSchema.parse(body);

		const db = await getDb();

		// 检查外链是否存在且属于当前用户
		const existingBacklink = await db.query.backlinks.findFirst({
			where: and(
				eq(backlinks.id, params.id),
				eq(backlinks.userId, userId)
			),
		});

		if (!existingBacklink) {
			return NextResponse.json(
				{ success: false, error: 'Backlink not found' },
				{ status: 404 }
			);
		}

		// 更新外链
		await db
			.update(backlinks)
			.set({
				...updateData,
				updatedAt: new Date(),
			})
			.where(eq(backlinks.id, params.id));

		// 获取更新后的数据
		const updatedBacklink = await db.query.backlinks.findFirst({
			where: eq(backlinks.id, params.id),
		});

		return NextResponse.json({
			success: true,
			data: updatedBacklink,
		});
	} catch (error) {
		console.error('Update backlink error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// DELETE /api/backlinks/:id - 删除外链
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

		// 检查外链是否存在且属于当前用户
		const existingBacklink = await db.query.backlinks.findFirst({
			where: and(
				eq(backlinks.id, params.id),
				eq(backlinks.userId, userId)
			),
		});

		if (!existingBacklink) {
			return NextResponse.json(
				{ success: false, error: 'Backlink not found' },
				{ status: 404 }
			);
		}

		// 删除外链（会级联删除相关的submissions）
		await db
			.delete(backlinks)
			.where(eq(backlinks.id, params.id));

		return NextResponse.json({
			success: true,
			data: { id: params.id },
		});
	} catch (error) {
		console.error('Delete backlink error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
