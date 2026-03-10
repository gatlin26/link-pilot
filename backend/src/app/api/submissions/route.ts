import { auth } from '@/lib/auth';
import { getDb } from '@/db/index';
import { submissions } from '@/db/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { eq, and, desc } from 'drizzle-orm';

const submissionSchema = z.object({
	id: z.string(),
	siteId: z.string(),
	backlinkId: z.string(),
	submittedAt: z.string(),
	submitMode: z.string(),
	commentUsed: z.string(),
	emailUsed: z.string().optional(),
	status: z.string().optional(),
	result: z.string().optional(),
	approvedAt: z.string().optional(),
	liveUrl: z.string().optional(),
	note: z.string().optional(),
	errorMessage: z.string().optional(),
	metadata: z.string().optional(),
});

const createSubmissionSchema = z.object({
	submissions: z.array(submissionSchema),
});

// POST /api/submissions - 创建/批量同步提交记录
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
		const { submissions: submissionList } = createSubmissionSchema.parse(body);

		const db = await getDb();
		let successCount = 0;
		let failedCount = 0;
		const errors: string[] = [];

		for (const submission of submissionList) {
			try {
				await db
					.insert(submissions)
					.values({
						...submission,
						userId,
						submittedAt: new Date(submission.submittedAt),
						approvedAt: submission.approvedAt ? new Date(submission.approvedAt) : null,
						status: submission.status || 'pending',
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.onConflictDoUpdate({
						target: submissions.id,
						set: {
							status: submission.status || 'pending',
							result: submission.result,
							approvedAt: submission.approvedAt ? new Date(submission.approvedAt) : null,
							liveUrl: submission.liveUrl,
							note: submission.note,
							errorMessage: submission.errorMessage,
							metadata: submission.metadata,
							updatedAt: new Date(),
						},
					});
				successCount++;
			} catch (error) {
				failedCount++;
				errors.push(`${submission.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		return NextResponse.json({
			success: true,
			data: {
				total: submissionList.length,
				success: successCount,
				failed: failedCount,
				errors: errors.length > 0 ? errors : undefined,
			},
		});
	} catch (error) {
		console.error('Submissions sync error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}

// GET /api/submissions - 获取提交记录列表
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
		
		const siteId = searchParams.get('siteId');
		const backlinkId = searchParams.get('backlinkId');
		const status = searchParams.get('status');
		const result = searchParams.get('result');
		const page = parseInt(searchParams.get('page') || '1');
		const limit = parseInt(searchParams.get('limit') || '50');
		const offset = (page - 1) * limit;

		const db = await getDb();
		
		// 构建查询条件
		const conditions = [eq(submissions.userId, userId)];
		
		if (siteId) {
			conditions.push(eq(submissions.siteId, siteId));
		}
		
		if (backlinkId) {
			conditions.push(eq(submissions.backlinkId, backlinkId));
		}
		
		if (status) {
			conditions.push(eq(submissions.status, status));
		}
		
		if (result) {
			conditions.push(eq(submissions.result, result));
		}

		// 查询数据
		const items = await db.query.submissions.findMany({
			where: and(...conditions),
			orderBy: [desc(submissions.submittedAt)],
			limit,
			offset,
		});

		// 查询总数
		const totalResult = await db.query.submissions.findMany({
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
		console.error('Get submissions error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			},
			{ status: 500 }
		);
	}
}
