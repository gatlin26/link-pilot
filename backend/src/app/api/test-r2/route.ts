/**
 * @file route.ts
 * @description R2 上传测试 API
 * @author git.username
 * @date 2025-12-20
 */

import { uploadFile } from '@/storage';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 测试上传一个小文件
    const testContent = `R2 诊断测试 - ${new Date().toISOString()}`;
    const buffer = Buffer.from(testContent, 'utf-8');
    const filename = `diagnostic-${Date.now()}.txt`;

    console.log('开始测试上传...');
    console.log('文件名:', filename);
    console.log('内容长度:', buffer.length);

    const result = await uploadFile(buffer, filename, 'text/plain', 'test');

    return NextResponse.json({
      success: true,
      message: '上传成功',
      url: result.url,
      key: result.key,
    });
  } catch (error) {
    console.error('测试上传失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
