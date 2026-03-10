'use client';

import { createToolSubmitProCheckout } from '@/actions/tools/create-tool-submit-pro-checkout';
import type { submitToolAction } from '@/actions/tools/submit-tool';
import { verifyBacklinkAction } from '@/actions/tools/verify-backlink';
import { ImageUploader } from '@/components/admin/image-uploader';
import { LogoUploader } from '@/components/admin/logo-uploader';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { BacklinkExampleBlock } from '@/components/tools/backlink-example-block';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { websiteConfig } from '@/config/website';
import { TOOL_ERROR_CODES } from '@/constants/tool-errors';
import { authClient } from '@/lib/auth-client';
import { getBaseUrl } from '@/lib/urls/urls';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Rocket,
  Send,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

function prodUrlField(requiredMsg: string, invalidMsg: string) {
  return z.string().superRefine((val, ctx) => {
    if (!isProd) return;
    if (!val || val.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMsg });
    } else if (!z.string().url().safeParse(val).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: invalidMsg });
    }
  });
}

const formSchema = z.object({
  name: z.string().min(2, 'Tool name must be at least 2 characters'),
  url: z.string().url('Please enter a valid URL'),
  iconUrl: prodUrlField('Logo is required', 'Please upload a valid logo'),
  thumbnailUrl: prodUrlField(
    'Screenshot is required',
    'Please upload a valid screenshot'
  ),
  imageUrl: prodUrlField(
    'Screenshot is required',
    'Please upload a valid screenshot'
  ),
  backlinkVerified: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export type SubmitPlan = 'free' | 'pro';

export interface ToolSubmitFormProps {
  action: typeof submitToolAction;
  /** 当前所选套餐：免费需反链（示例在 FREE 卡片下内联展示），专业版暂为稍后上线 */
  plan?: SubmitPlan;
  /** 是否隐藏表单底部的提交按钮（当使用外部按钮时） */
  hideSubmitButton?: boolean;
  /** 表单引用，用于外部触发提交 */
  formRef?: React.RefObject<HTMLFormElement | null>;
}

const STORAGE_KEY = 'tool_submit_form_data';

function getServerErrorMessage(
  serverError: unknown,
  duplicateToolNameMessage: string
) {
  const rawMessage =
    typeof serverError === 'string'
      ? serverError
      : (serverError as { error?: string })?.error || 'An error occurred';
  return rawMessage === TOOL_ERROR_CODES.duplicateToolName
    ? duplicateToolNameMessage
    : rawMessage;
}

export function ToolSubmitForm({
  action,
  plan,
  hideSubmitButton = false,
  formRef,
}: ToolSubmitFormProps) {
  const { data: session, isPending: isLoadingSession } =
    authClient.useSession();
  const currentUser = session?.user;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('ToolsPage.submit.form');
  const tPlans = useTranslations('ToolsPage.submit.plans');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submittedToolName, setSubmittedToolName] = useState('');
  const pendingFormDataRef = useRef<FormData | null>(null);
  const hasRestoredDataRef = useRef(false);

  // 确保只在客户端渲染，避免 hydration 不匹配
  useEffect(() => {
    setMounted(true);
  }, []);

  // 获取站点名称和域名作为示例
  const siteName = websiteConfig.metadata.name || 'BuildWay';
  const baseUrl = getBaseUrl();

  // Dialog 状态：自动验证失败后弹出
  const [showBacklinkDialog, setShowBacklinkDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<FormData | null>(
    null
  );
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [dialogVerifying, setDialogVerifying] = useState(false);
  const [dialogVerifyError, setDialogVerifyError] = useState<string | null>(
    null
  );

  // Dialog 内"验证外链"按钮
  const handleDialogVerify = async () => {
    if (!pendingSubmitData) return;
    setDialogVerifying(true);
    setDialogVerifyError(null);
    try {
      const result = await verifyBacklinkAction(pendingSubmitData.url);
      setDialogVerifying(false);
      if (result.success && result.verified) {
        setShowBacklinkDialog(false);
        execute({ ...pendingSubmitData, backlinkVerified: true });
        setPendingSubmitData(null);
      } else {
        setDialogVerifyError(
          result.error || t('backlinkVerification.notFound')
        );
      }
    } catch {
      setDialogVerifying(false);
      setDialogVerifyError(t('backlinkVerification.error'));
    }
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      url: '',
      iconUrl: '',
      thumbnailUrl: '',
      imageUrl: '',
      backlinkVerified: false,
    },
  });

  const {
    execute: executeProCheckout,
    result: proCheckoutResult,
    status: proCheckoutStatus,
  } = useAction(createToolSubmitProCheckout, {
    onSuccess: ({ data }) => {
      if (data && 'success' in data && data.success && data.data?.url) {
        window.location.href = data.data.url;
      }
    },
  });

  const { execute, result, status } = useAction(action, {
    onSuccess: ({ data }) => {
      if (data && 'success' in data && data.success) {
        const toolName = form.getValues('name');
        setSubmittedToolName(toolName);
        setIsSubmitSuccess(true);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        pendingFormDataRef.current = null;
      }
    },
  });

  // 从 localStorage 恢复表单数据（页面加载时）
  useEffect(() => {
    if (typeof window === 'undefined' || hasRestoredDataRef.current) return;

    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      // 验证数据不为空且是有效的 JSON 字符串
      if (savedData && savedData.trim() !== '') {
        const parsedData = JSON.parse(savedData) as FormData;
        // 验证解析后的数据是对象
        if (parsedData && typeof parsedData === 'object') {
          form.reset(parsedData);
          hasRestoredDataRef.current = true;
          // 清除已恢复的数据
          localStorage.removeItem(STORAGE_KEY);
        } else {
          // 数据格式无效，清除它
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to restore form data:', error);
      // 解析失败时清除无效数据，避免下次再次出错
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [form]);

  // 监听登录状态变化，登录成功后恢复表单数据
  useEffect(() => {
    if (currentUser && pendingFormDataRef.current && !isLoadingSession) {
      // 用户已登录，且有待恢复的数据
      const data = pendingFormDataRef.current;
      // 恢复表单数据
      form.reset(data);
      // 清除保存的数据和待提交数据引用
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      pendingFormDataRef.current = null;
      setIsLoginModalOpen(false);
    }
  }, [currentUser, isLoadingSession, form]);

  // 提交时检查登录状态，Free 计划自动验证外链
  const handleSubmit = async (data: FormData) => {
    if (!currentUser) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      pendingFormDataRef.current = data;
      setIsLoginModalOpen(true);
      return;
    }
    if (plan === 'pro') {
      executeProCheckout(data);
      return;
    }
    // Free：提交前自动验证外链
    setAutoVerifying(true);
    try {
      const result = await verifyBacklinkAction(data.url);
      setAutoVerifying(false);
      if (result.success && result.verified) {
        // 验证通过，直接提交
        execute({ ...data, backlinkVerified: true });
      } else {
        // 未检测到外链，弹出 Dialog
        setPendingSubmitData(data);
        setDialogVerifyError(null);
        setShowBacklinkDialog(true);
      }
    } catch {
      setAutoVerifying(false);
      // 网络异常也弹出 Dialog 让用户手动验证
      setPendingSubmitData(data);
      setDialogVerifyError(null);
      setShowBacklinkDialog(true);
    }
  };

  // 处理错误消息（free 提交 & pro checkout）
  useEffect(() => {
    if (result?.serverError) {
      form.setError('root', {
        message: getServerErrorMessage(
          result.serverError,
          t('errors.duplicateToolName')
        ),
      });
    }
  }, [result?.serverError, form, t]);

  useEffect(() => {
    if (proCheckoutResult?.data && !proCheckoutResult.data.success) {
      const err = (proCheckoutResult.data as { error?: string }).error || '';
      form.setError('root', {
        message: getServerErrorMessage(err, t('errors.duplicateToolName')),
      });
    }
  }, [proCheckoutResult, form, t]);

  // 处理继续提交
  const handleContinueSubmit = () => {
    setIsSubmitSuccess(false);
    setSubmittedToolName('');
    form.reset();
  };

  // 处理查看提交记录
  const handleViewSubmissions = () => {
    router.push('/settings/submissions');
  };

  // 如果提交成功，显示成功页面
  if (isSubmitSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center py-12 px-6">
          {/* 成功图标 */}
          <div className="mb-8 rounded-full bg-green-100 dark:bg-green-900/30 p-6">
            <CheckCircle2 className="size-16 text-green-600 dark:text-green-400" />
          </div>

          {/* 成功标题 */}
          <h2 className="text-3xl font-bold text-center mb-4">
            {t('success.title')}
          </h2>

          {/* 成功消息 */}
          <p className="text-center text-muted-foreground mb-2 max-w-md">
            {result?.data && 'message' in result.data
              ? result.data.message
              : t('success.message')}
          </p>

          {/* 提交的工具名称 */}
          {submittedToolName && (
            <p className="text-center text-lg font-semibold mb-8 text-primary">
              {submittedToolName}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-4">
            <Button
              onClick={handleContinueSubmit}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="mr-2 size-4" />
              {t('success.continueSubmit')}
            </Button>
            <Button
              onClick={handleViewSubmissions}
              className="flex-1 bg-gradient-to-r from-[#0052ff] to-[#3d8bff] hover:opacity-90"
            >
              {t('success.viewSubmissions')}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>

          {/* 提示信息 */}
          <div className="mt-8 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 max-w-md">
            <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
              {t('success.reviewNote')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
        >
          {/* Tool Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('toolName')} *</FormLabel>
                <FormControl>
                  <Input placeholder={`e.g., ${siteName}`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tool URL */}
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('toolUrl')} *</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder={`e.g., ${baseUrl}`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Logo Upload */}
          <FormField
            control={form.control}
            name="iconUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('logo.label')} *</FormLabel>
                <FormControl>
                  <LogoUploader
                    value={field.value || null}
                    onChange={(url) => field.onChange(url || '')}
                    disabled={status === 'executing'}
                  />
                </FormControl>
                <FormDescription>{t('logo.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Screenshot Upload */}
          <FormField
            control={form.control}
            name="thumbnailUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('screenshot.label')} *</FormLabel>
                <FormControl>
                  <ImageUploader
                    value={field.value || null}
                    onChange={(url) => {
                      // 同时设置 thumbnailUrl 和 imageUrl
                      field.onChange(url || '');
                      form.setValue('imageUrl', url || '');
                    }}
                    disabled={status === 'executing'}
                    folder="screenshots"
                  />
                </FormControl>
                <FormDescription>{t('screenshot.description')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Backlink Verification Dialog */}
          <Dialog
            open={showBacklinkDialog}
            onOpenChange={setShowBacklinkDialog}
          >
            <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-xl">
              <DialogHeader className="shrink-0">
                <DialogTitle>{t('backlinkVerification.title')}</DialogTitle>
                <DialogDescription>
                  {t('backlinkVerification.description')}
                </DialogDescription>
              </DialogHeader>

              <div className="min-w-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {/* 步骤说明 */}
                <div className="space-y-2">
                  {(
                    [
                      t('backlinkVerification.description'),
                      t('backlinkVerification.dialogAutoVerifyFailed'),
                    ] as string[]
                  ).map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        {i + 1}
                      </span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 示例代码 */}
                <BacklinkExampleBlock />

                {/* 错误提示 — 仅有错误时显示 */}
                {dialogVerifyError && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/50 dark:bg-red-950/20">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400" />
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {dialogVerifyError}
                    </p>
                  </div>
                )}

                {/* 验证按钮 */}
                <Button
                  type="button"
                  className="w-full"
                  disabled={dialogVerifying}
                  onClick={handleDialogVerify}
                >
                  {dialogVerifying ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t('backlinkVerification.verifying')}
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 size-4" />
                      {t('backlinkVerification.verifyButton')}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Submit Result - Success */}
          {result?.data && 'success' in result.data && result.data.success && (
            <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 shadow-lg">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-green-100 dark:bg-green-800/30 p-3">
                  <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-green-800 dark:text-green-200">
                    {t('success.title')}
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {result.data.message || t('success.message')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {form.formState.errors.root?.message && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
              {form.formState.errors.root.message}
            </div>
          )}

          {result?.validationErrors && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
              {t('errors.checkForm')}
            </div>
          )}

          {/* 未登录提示 - 只在客户端挂载后显示，避免 hydration 不匹配 */}
          {mounted && !currentUser && (
            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <Lock className="size-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {t('loginRequired.description')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button：按套餐显示不同 CTA */}
          {!hideSubmitButton && (
            <div className="space-y-2">
              {plan === 'pro' ? (
                <>
                  <Button
                    type="submit"
                    disabled={proCheckoutStatus === 'executing'}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90"
                  >
                    {proCheckoutStatus === 'executing' ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t('submitting')}
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 size-4" />
                        {tPlans('pro.cta')}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="submit"
                    disabled={status === 'executing' || autoVerifying}
                    className={
                      plan === 'free'
                        ? 'w-full border-2 border-violet-500/50 bg-background text-violet-700 hover:bg-violet-50 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-900/30'
                        : 'w-full bg-gradient-to-r from-[#0052ff] to-[#3d8bff] hover:opacity-90'
                    }
                  >
                    {autoVerifying ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t('backlinkVerification.checkingBacklink')}
                      </>
                    ) : status === 'executing' ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t('submitting')}
                      </>
                    ) : plan === 'free' ? (
                      <>
                        <Send className="mr-2 size-4" />
                        {tPlans('free.cta')}
                      </>
                    ) : (
                      t('submitButton')
                    )}
                  </Button>
                </>
              )}
              {/* 登录弹窗 - 只在客户端挂载后显示，避免 hydration 不匹配 */}
              {mounted && !currentUser && (
                <LoginWrapper
                  mode="modal"
                  callbackUrl={pathname}
                  open={isLoginModalOpen}
                  onOpenChange={setIsLoginModalOpen}
                >
                  <div style={{ display: 'none' }} />
                </LoginWrapper>
              )}
            </div>
          )}
          {/* 登录弹窗 - 当隐藏提交按钮时仍需显示 */}
          {hideSubmitButton && mounted && !currentUser && (
            <LoginWrapper
              mode="modal"
              callbackUrl={pathname}
              open={isLoginModalOpen}
              onOpenChange={setIsLoginModalOpen}
            >
              <div style={{ display: 'none' }} />
            </LoginWrapper>
          )}
        </form>
      </Form>
    </div>
  );
}
