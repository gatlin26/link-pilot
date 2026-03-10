/**
 * 设置管理员 API
 * POST /api/admin/set-admin
 * Body: { email: string, secret: string }
 */

import { getDb } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// 安全密钥，放在环境变量中
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-secret-key';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, secret } = body;

    // 验证密钥
    if (secret !== ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Invalid secret key' },
        { status: 403 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = await getDb();

    // 查找用户
    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = users[0];

    // 如果已经是 admin
    if (targetUser.role === 'admin') {
      return NextResponse.json({
        success: true,
        message: 'User is already an admin',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: targetUser.role,
        },
      });
    }

    // 更新为 admin
    await db
      .update(user)
      .set({
        role: 'admin',
        updatedAt: new Date(),
      })
      .where(eq(user.id, targetUser.id));

    return NextResponse.json({
      success: true,
      message: 'User has been set as admin',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: 'admin',
      },
    });
  } catch (error) {
    console.error('Set admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
