import { handleWebhookEvent } from '@/payment';

/**
 * Creem Webhook 处理端点
 *
 * @author peiwen
 * @date 2025-12-20
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();

    // Debug: 打印所有 headers 帮助定位签名 header
    console.log(
      '[Creem Webhook] Headers:',
      Object.fromEntries(request.headers)
    );

    // 尝试多个可能的签名 header 名称
    const signature =
      request.headers.get('creem-signature') ||
      request.headers.get('x-creem-signature') ||
      request.headers.get('x-webhook-signature') ||
      request.headers.get('signature') ||
      '';

    console.log('[Creem Webhook] Signature:', signature);
    console.log('[Creem Webhook] Body:', body.substring(0, 200));

    await handleWebhookEvent(body, signature);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Creem Webhook] Error:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : 'Webhook processing failed',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
