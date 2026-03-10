/**
 * @file quick-enhance-section.tsx
 * @description 首页快速体验皮肤增强组件
 * @author git.username
 * @date 2025-12-22
 */

'use client';

import { enhanceImage } from '@/actions/enhance-image';
import { ImageUploader } from '@/components/tools/image-uploader';
import { Button } from '@/components/ui/button';
import { useCurrentPlan } from '@/hooks/use-payment';
import { useLocaleRouter } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { Routes } from '@/routes';
import { Download, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/** 默认示例图 */
const DEFAULT_ENHANCED =
  'https://s.editphoto-ai.com/production/ee2a13e8-4fd1-493d-9f09-c1f8ccda6adf.jpg';

export function QuickEnhanceSection() {
  const t = useTranslations('LandingPage.quickEnhance');
  const pathname = usePathname();
  const router = useLocaleRouter();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const userId = session?.user?.id;

  // 获取用户套餐信息，判断是否为付费用户
  const { data: planData } = useCurrentPlan(userId);
  const isPaidUser = planData?.currentPlan && !planData.currentPlan.isFree;

  // 文件大小限制：免费用户 2MB，付费用户 20MB
  const maxFileSizeMB = isPaidUser ? 20 : 2;

  // 状态管理
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEnhance, setPendingEnhance] = useState(false);

  // 固定参数（极简：不暴露参数面板）
  // - Replicate 默认值：upscale=2, face_upsample=true, background_enhance=true, codeformer_fidelity=0.5
  // - 输出默认：1536px 长边 + 质量 85，格式保持 Replicate 输出原样
  const replicateUpscale = 2;
  const replicateFaceUpsample = true;
  const replicateBackgroundEnhance = true;
  const codeformerFidelity = 0.5;
  const outputMaxLongEdge = 1536;
  const outputQuality = 85;

  // 并发保护锁：防止快速双击导致重复扣费
  const processingRef = useRef(false);

  /** 处理图片选择（只做本地预览） */
  const handleUpload = useCallback(
    (file: File) => {
      // 清理之前的预览 URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEnhancedUrl(null);
      setError(null);
    },
    [previewUrl]
  );

  /** 组件卸载时清理 URL 对象 */
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /** 清除上传的图片 */
  const handleClear = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
    setEnhancedUrl(null);
    setError(null);
    setPendingEnhance(false);
  }, [previewUrl]);

  /** 执行增强 */
  const handleEnhance = useCallback(async () => {
    // 未登录，跳转到登录页
    if (!isLoggedIn) {
      setPendingEnhance(true);
      const loginPath = `${Routes.Login}?callbackUrl=${encodeURIComponent(pathname)}`;
      router.push(loginPath);
      return;
    }

    // 并发保护：检查是否正在处理
    if (!uploadedFile || processingRef.current) return;

    // 立即加锁（同步操作，防止并发）
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      // 直接用 FormData 传递 File
      const formData = new FormData();
      formData.append('file', uploadedFile);
      // 目前只开放 skin（收敛入口，减少噪音）
      formData.append('mode', 'skin');

      // Replicate 参数（对齐模型 schema）
      formData.append('upscale', String(replicateUpscale));
      formData.append('face_upsample', String(replicateFaceUpsample));
      formData.append('background_enhance', String(replicateBackgroundEnhance));
      formData.append('codeformer_fidelity', String(codeformerFidelity));

      // 输出参数（缩放/质量控制，格式保持 Replicate 输出原样）
      formData.append('outputMaxLongEdge', String(outputMaxLongEdge));
      formData.append('outputQuality', String(outputQuality));

      // 输入预缩放：控制成本/速度（不放大，只在超大图时缩小）
      formData.append('inputMaxLongEdge', '2048');

      const result = await enhanceImage(formData);

      if (result.success && result.enhancedUrl) {
        // 预加载图片，加载完成后再显示，避免闪烁
        const img = new window.Image();
        img.src = result.enhancedUrl;
        img.onload = () => {
          setEnhancedUrl(result.enhancedUrl || null);
        };
        img.onerror = () => {
          // 加载失败也设置 URL，让用户看到（可能是网络问题）
          setEnhancedUrl(result.enhancedUrl || null);
        };
      } else {
        // 使用错误码翻译，如果有错误码则优先使用，否则使用错误消息或默认错误
        const requiredCredits = 1; // 目前仅 skin 且固定为 1
        const errorMessage = result.errorCode
          ? t(`errors.${result.errorCode}`, {
              required: requiredCredits,
              defaultValue: result.error || t('error'),
            })
          : result.error || t('error');
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Enhancement error:', err);
      setError(t('error'));
    } finally {
      // 确保解锁
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [
    isLoggedIn,
    uploadedFile,
    t,
    pathname,
    router,
    replicateUpscale,
    replicateFaceUpsample,
    replicateBackgroundEnhance,
  ]);

  /**
   * 登录后自动触发增强
   * 注意：必须放在 handleEnhance 定义之后，否则会触发 TDZ：
   * "Cannot access 'handleEnhance' before initialization"
   */
  useEffect(() => {
    if (isLoggedIn && pendingEnhance && uploadedFile) {
      setPendingEnhance(false);
      handleEnhance();
    }
  }, [isLoggedIn, pendingEnhance, uploadedFile, handleEnhance]);

  // 显示增强后的图片（如果有）或默认示例图
  const displayImage = enhancedUrl || DEFAULT_ENHANCED;
  const showUserResult = !!enhancedUrl;

  /** 下载增强后的图片 */
  const handleDownload = useCallback(async () => {
    const imageToDownload = displayImage;
    if (!imageToDownload) return;

    try {
      // 优先尝试 fetch 方式（支持已配置 CORS 的跨域图片）
      const response = await fetch(imageToDownload);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `enhanced-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t('downloadSuccess'));
    } catch (error) {
      console.error('Download error:', error);
      // 降级方案：在新标签页打开
      window.open(imageToDownload, '_blank');
      toast.message(t('downloadFallback'));
    }
  }, [displayImage, t]);

  return (
    <section
      id="quick-enhance"
      className="relative py-20 lg:py-32 overflow-hidden"
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        {/* 标题区域 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">
              {t('badge')}
            </span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* 主内容区域: 35% 左侧 + 65% 右侧 */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid gap-6 lg:gap-8 items-start lg:grid-cols-[35%_65%]"
        >
          {/* 左侧：上传区域 */}
          <div className="space-y-4">
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-foreground mb-4">
                {t('upload.title')}
              </h3>

              <ImageUploader
                onUpload={handleUpload}
                onClear={handleClear}
                previewUrl={previewUrl}
                isProcessing={isProcessing}
                disabled={isProcessing}
                maxSizeMB={maxFileSizeMB}
              />

              {/* 增强按钮 */}
              <div className="mt-4 space-y-3">
                <Button
                  onClick={() => {
                    // 保持按钮"正常可点"的观感：条件不满足时用轻提示引导，而不是置灰
                    if (isProcessing) {
                      toast.message(t('processing'));
                      return;
                    }
                    if (!uploadedFile) {
                      toast.message('请先上传图片');
                      return;
                    }
                    handleEnhance();
                  }}
                  className="w-full h-12 text-base font-semibold"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('processing')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {enhancedUrl ? t('tryAgain') : t('enhance')}
                    </>
                  )}
                </Button>

                {error && (
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* 提示信息 */}
            <p className="text-xs text-muted-foreground text-center px-2">
              {t('hint')}
            </p>
          </div>

          {/* 右侧：增强结果展示 */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/10 to-transparent rounded-3xl blur-xl" />
            <div className="relative bg-card/30 backdrop-blur-sm border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  {t('result.title')}
                </h3>
                <Button
                  onClick={() => {
                    // 保持按钮"正常可点"的观感
                    if (isProcessing) {
                      toast.message(t('processing'));
                      return;
                    }
                    // 允许下载默认示例图或用户生成的图片
                    handleDownload();
                  }}
                  variant="secondary"
                  className="h-9"
                  title={t('download')}
                  disabled={isProcessing}
                >
                  <Download className="size-4" />
                  {t('download')}
                </Button>
              </div>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted/20">
                <Image
                  src={displayImage}
                  alt={showUserResult ? 'Enhanced result' : 'Sample'}
                  fill
                  className="object-contain"
                  /**
                   * 关键：如果不写 sizes，Next/Image 默认按 100vw 计算，
                   * 在 4K 屏会请求到 w=3840，触发 /_next/image 优化超时（你日志里就是这个）。
                   * 这里显式限制最大展示宽度，避免生成超大优化请求。
                   */
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 65vw, 1024px"
                  /**
                   * 用户生成结果来自外部 CDN（s.editphoto-ai.com）。
                   * 为了避免图片优化器（/_next/image）在某些运行时/部署环境下超时导致"图片不显示"，
                   * 对用户结果直接走原图（unoptimized），保证稳定展示。
                   */
                  unoptimized={showUserResult}
                />

                {/* 生成过程动效：覆盖在图片上，直到最终结果展示 */}
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="relative size-14">
                        <div className="absolute inset-0 rounded-full bg-primary/15 blur-md" />
                        <Loader2 className="relative size-14 animate-spin text-primary" />
                      </div>
                      <div className="text-sm text-foreground">
                        {t('processing')}
                      </div>
                      <div className="w-56 overflow-hidden rounded-full bg-muted/40">
                        <motion.div
                          className="h-1.5 w-24 rounded-full bg-primary"
                          initial={{ x: -96 }}
                          animate={{ x: 224 }}
                          transition={{
                            repeat: Number.POSITIVE_INFINITY,
                            duration: 1.2,
                            ease: 'easeInOut',
                          }}
                        />
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
              {!showUserResult && (
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  {t('result.sampleHint')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
