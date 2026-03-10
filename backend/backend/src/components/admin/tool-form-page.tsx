'use client';

import { approveAndPublishAction } from '@/actions/tools/approve-submission';
import { createToolAction } from '@/actions/tools/create-tool';
import { getSubmissionDetailAction } from '@/actions/tools/get-submission-detail';
import { getToolDetailAction } from '@/actions/tools/get-tool-detail';
import { updateToolAction } from '@/actions/tools/update-tool';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon, Loader2 } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type ToolData, ToolFormContent } from './tool-form-content';
import type { ToolFormData, ToolFormMode } from './tool-form-types';

interface SubmissionData {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: string;
  submitterEmail: string | null;
  iconUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
}

export function ToolFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolId = searchParams.get('id');

  const [mode, setMode] = useState<ToolFormMode>('create');
  const [toolData, setToolData] = useState<ToolData | null>(null);
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  // 获取工具详情
  const { execute: fetchToolDetail } = useAction(getToolDetailAction, {
    onSuccess: ({ data }) => {
      if (data?.success && data.data) {
        // data.data.translations 已经是 Record<locale, {title, description, introduction}>
        setToolData(data.data as ToolData);
        if (data.data.status === 'pending') {
          setSubmissionData({
            id: data.data.id,
            name: data.data.name,
            url: data.data.url,
            slug: data.data.slug,
            status: data.data.status,
            submitterEmail: data.data.submitterEmail || null,
            iconUrl: data.data.iconUrl || null,
            thumbnailUrl: data.data.thumbnailUrl || null,
            imageUrl: data.data.imageUrl || null,
          });
          setMode('approve');
        } else {
          setMode('edit');
        }
        setIsLoading(false);
      } else if (data && !data.success) {
        queueMicrotask(() => {
          toast.error(data.error || '获取工具详情失败');
        });
        setIsLoading(false);
      }
    },
    onError: () => {
      queueMicrotask(() => {
        toast.error('获取工具详情失败');
      });
      setIsLoading(false);
    },
  });

  // 创建工具
  const { execute: createTool, status: createStatus } = useAction(
    createToolAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          queueMicrotask(() => {
            toast.success('工具创建成功');
          });
          router.push('/admin/tools');
        } else if (data && !data.success) {
          queueMicrotask(() => {
            toast.error(data.error || '创建失败');
          });
        }
      },
      onError: () => {
        queueMicrotask(() => {
          toast.error('创建失败');
        });
      },
    }
  );

  // 更新工具
  const { execute: updateTool, status: updateStatus } = useAction(
    updateToolAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          queueMicrotask(() => {
            toast.success('工具更新成功');
          });
          router.push('/admin/tools');
        } else if (data && !data.success) {
          queueMicrotask(() => {
            toast.error(data.error || '更新失败');
          });
        }
      },
      onError: () => {
        queueMicrotask(() => {
          toast.error('更新失败');
        });
      },
    }
  );

  // 审批并发布
  const { execute: approveAndPublish, status: approveStatus } = useAction(
    approveAndPublishAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          queueMicrotask(() => {
            toast.success('工具已审批并发布');
          });
          router.push('/admin/submissions');
        } else if (data && !data.success) {
          queueMicrotask(() => {
            toast.error(data.error || '审批失败');
          });
        }
      },
      onError: () => {
        queueMicrotask(() => {
          toast.error('审批失败');
        });
      },
    }
  );

  // 根据 URL 参数加载数据
  useEffect(() => {
    if (toolId) {
      // 编辑或审批模式（根据工具状态判断）
      setIsLoading(true);
      fetchToolDetail({ toolId });
    } else {
      // 创建模式
      setMode('create');
    }
  }, [toolId, fetchToolDetail]);

  const handleSubmit = (data: ToolFormData) => {
    if (mode === 'approve' && toolId) {
      approveAndPublish({
        toolId,
        ...data,
      });
    } else if (mode === 'edit' && toolId) {
      updateTool({
        toolId,
        ...data,
      });
    } else {
      createTool(data);
    }
  };

  const handleCancel = () => {
    if (mode === 'approve') {
      router.push('/admin/submissions');
    } else {
      router.push('/admin/tools');
    }
  };

  const isSaving =
    createStatus === 'executing' ||
    updateStatus === 'executing' ||
    approveStatus === 'executing';

  const getPageTitle = () => {
    switch (mode) {
      case 'create':
        return '创建新工具';
      case 'edit':
        return `编辑工具${toolData?.name ? `: ${toolData.name}` : ''}`;
      case 'approve':
        return `审批工具${submissionData?.name ? `: ${submissionData.name}` : ''}`;
    }
  };

  const getPageDescription = () => {
    switch (mode) {
      case 'create':
        return '填写工具信息并生成多语言内容';
      case 'edit':
        return '编辑工具信息和多语言内容';
      case 'approve':
        return '编辑工具信息并生成多语言内容，确认后发布到工具目录';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      {/* 页面头部 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="mb-4"
        >
          <ArrowLeftIcon className="size-4 mr-2" />
          返回
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{getPageTitle()}</h1>
        <p className="text-muted-foreground mt-2">{getPageDescription()}</p>
      </div>

      {/* 表单内容 */}
      <ToolFormContent
        mode={mode}
        tool={toolData}
        submission={submissionData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSaving={isSaving}
      />
    </div>
  );
}
