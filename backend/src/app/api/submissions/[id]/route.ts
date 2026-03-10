import { auth } from '@/lib/auth';
import { getDb } from '@/db/index';
import { submissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';

const updateSubmissionSchema = z.object({
	status: z.string().optional(),
	result: z.string().optional(),
	approvedAt: z.string().optional(),
	liveUrl: z.string().optional(),
	note: z.string().optional(),
	errorMessage: z.string().optional(),
	metadata: z.string().optional(),
});

// GET /api/submissions/:id - 获取单个提交记录
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

		const submission = await db.query.submissions.findFirst({
			where: and(
				eq(submissions.id, params.id),
				eq(submissions.userId, userId)
			),
		});

		if (!submission) {
			return NextResponse.json(
				{ success: false, error: 'Submission not found' },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			success: true,
			data: submission,
		});
	} catch (error) {
		console.error('Get submission error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// PUT /api/submissions/:id - 更新提交记录
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
		const updateData = updateSubmissionSchema.parse(body);

		const db = await getDb();

		// 检查提交记录是否存在且属于当前用户
		const existingSubmission = await db.query.submissions.findFirst({
			where: and(
				eq(submissions.id, params.id),
				eq(submissions.userId, userId)
			),
		});

		if (!existingSubmission) {
			return NextResponse.json(
				{ success: false, error: 'Submission not found' },
				{ status: 404 }
			);
		}

		// 更新提交记录
		const updatePayload: any = {
			...updateData,
			updatedAt: new Date(),
		};

		// 处理日期字段
		if (updateData.approvedAt) {
			updatePayload.approvedAt = new Date(updateData.approvedAt);
		}

		await db
			.update(submissions)
			.set(updatePayload)
			.where(eq(submissions.id, params.id));

		// 获取更新后的数据
		const updatedSubmission = await db.query.submissions.findFirst({
			where: eq(submissions.id, params.id),
		});

		return NextResponse.json({
			success: true,
			data: updatedSubmission,
		});
	} catch (error) {
		console.error('Update submission error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
