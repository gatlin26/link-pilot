'use client';

import { AiEditorSection } from '@/components/landing/ai-editor-section';
import { useEditorPresetStore } from '@/stores/editor-preset-store';
import { useSearchParams } from 'next/navigation';
import { use, useEffect, useRef } from 'react';

export default function AppProjectWorkspacePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const prompt = searchParams.get('prompt');
  const feature = searchParams.get('feature'); // text-to-image, text-to-video

  const { setPreset } = useEditorPresetStore();
  const initialized = useRef(false);

  // Auto-fill prompt when entering from Marketing Page
  useEffect(() => {
    if (!initialized.current && prompt) {
      // We use the existing preset store to hydrate the editor state
      // This is a cleaner way than prop drilling if AiEditorSection consumes it
      setPreset({
        prompt: prompt,
        model: 'flux-pro', // Default or derived from feature
        imageUrl: '',
      });
      initialized.current = true;
    }
  }, [prompt, setPreset]);

  // If feature is 'text-to-video' (future), we could render a VideoEditor component here
  // For MVP, we default to the Image Editor

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Workspace Header (Optional - usually minimal in Studio) */}
      <div className="h-14 border-b flex items-center px-6 justify-between bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Untitled Project</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
            Draft
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Workspace Mode:{' '}
          {feature === 'text-to-video'
            ? 'Video Generation'
            : 'Image Generation'}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 overflow-auto bg-dot-pattern">
        {/* We reuse the AiEditorSection but constrained to the workspace container */}
        {/* Note: In a real app we might strip the landing-page specific styles (backgrounds) from it */}
        <AiEditorSection />
      </div>
    </div>
  );
}
