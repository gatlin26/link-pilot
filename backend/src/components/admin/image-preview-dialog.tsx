'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLinkIcon } from 'lucide-react';
import Image from 'next/image';

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title?: string;
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  imageUrl,
  title = '图片预览',
}: ImagePreviewDialogProps) {
  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
