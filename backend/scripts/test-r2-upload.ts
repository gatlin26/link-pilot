/**
 * @file test-r2-upload.ts
 * @description R2 上传诊断脚本
 * @author git.username
 * @date 2025-12-20
 */

import { storageConfig } from '@/storage/config/storage-config';
import { s3mini } from 's3mini';

async function testR2Upload() {
  console.log('=== R2 配置诊断 ===\n');

  // 1. 检查配置
  console.log('1. 检查环境变量配置:');
  console.log({
    region: storageConfig.region,
    endpoint: storageConfig.endpoint,
    bucketName: storageConfig.bucketName,
    publicUrl: storageConfig.publicUrl,
    hasAccessKey: !!storageConfig.accessKeyId,
    hasSecretKey: !!storageConfig.secretAccessKey,
  });
  console.log('\n');

  // 2. 检查配置问题
  const issues: string[] = [];

  if (!storageConfig.region) issues.push('❌ STORAGE_REGION 未配置');
  if (!storageConfig.endpoint) issues.push('❌ STORAGE_ENDPOINT 未配置');
  if (!storageConfig.bucketName) issues.push('❌ STORAGE_BUCKET_NAME 未配置');
  if (!storageConfig.accessKeyId)
    issues.push('❌ STORAGE_ACCESS_KEY_ID 未配置');
  if (!storageConfig.secretAccessKey)
    issues.push('❌ STORAGE_SECRET_ACCESS_KEY 未配置');

  if (storageConfig.publicUrl && !storageConfig.publicUrl.startsWith('http')) {
    issues.push('⚠️  STORAGE_PUBLIC_URL 应该包含协议前缀 (https://)');
  }

  if (issues.length > 0) {
    console.log('2. 配置问题:');
    issues.forEach((issue) => console.log(issue));
    console.log('\n');
  } else {
    console.log('2. ✅ 基础配置检查通过\n');
  }

  // 3. 测试 S3 连接
  console.log('3. 测试 S3 连接:');

  try {
    // 为 R2 构造正确的 endpoint
    // R2 endpoint 应该是: https://{accountId}.r2.cloudflarestorage.com/{bucket}
    const endpointWithBucket = `${storageConfig.endpoint?.replace(/\/$/, '')}/${storageConfig.bucketName}`;

    console.log('   使用的 endpoint:', endpointWithBucket);

    const s3 = new s3mini({
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
      endpoint: endpointWithBucket,
      region: storageConfig.region,
    });

    // 测试上传一个小文件
    const testKey = `test/diagnostic-${Date.now()}.txt`;
    const testContent = `R2 诊断测试 - ${new Date().toISOString()}`;

    console.log('   上传测试文件:', testKey);

    const response = await s3.putObject(testKey, testContent, 'text/plain');

    if (response.ok) {
      console.log('   ✅ 上传成功!');
      console.log('   响应状态:', response.status, response.statusText);

      // 构造访问 URL
      const url = storageConfig.publicUrl
        ? `https://${storageConfig.publicUrl}/${testKey}`
        : `${storageConfig.endpoint}/${storageConfig.bucketName}/${testKey}`;
      console.log('   文件 URL:', url);

      // 尝试删除测试文件
      console.log('   清理测试文件...');
      await s3.deleteObject(testKey);
      console.log('   ✅ 清理完成');
    } else {
      console.log('   ❌ 上传失败');
      console.log('   状态码:', response.status);
      console.log('   状态文本:', response.statusText);

      // 尝试读取错误响应
      try {
        const errorText = await response.text();
        console.log('   错误详情:', errorText);
      } catch (e) {
        console.log('   无法读取错误响应');
      }

      // 打印响应头
      console.log('   响应头:');
      response.headers.forEach((value, key) => {
        console.log(`     ${key}: ${value}`);
      });
    }
  } catch (error) {
    console.log('   ❌ 连接失败');
    console.error('   错误:', error);
  }

  console.log('\n=== 诊断完成 ===');
}

testR2Upload().catch(console.error);
