'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ArrowUp,
  Image as ImageIcon,
  Music,
  Sparkles,
  Video,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export function MarketingHero() {
  const t = useTranslations('LandingPage.hero'); // Assuming we have these or similar keys
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleSubmit = useCallback(
    (type: 'image' | 'video' | 'audio') => {
      if (!prompt.trim()) return;
      setIsProcessing(true);

      // Simulate a brief delay for effect then redirect
      setTimeout(() => {
        // Construct the destination URL for the Generator
        const targetUrl = `/app/image/create?prompt=${encodeURIComponent(prompt)}`;
        const loginUrl = `/login?callbackUrl=${encodeURIComponent(targetUrl)}`;

        router.push(loginUrl);
      }, 600);
    },
    [prompt, router]
  );

  const handleKeyDown = (
    e: React.KeyboardEvent,
    type: 'image' | 'video' | 'audio'
  ) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(type);
    }
  };

  return (
    <section className="relative flex flex-col py-12 lg:py-20 overflow-hidden min-h-[80vh] justify-center">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 flex justify-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm text-primary font-medium">
              {' '}
              #1 AI Creative Studio{' '}
            </span>
          </div>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-serif text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70"
        >
          Unleash Your Creativity <br /> with{' '}
          <span className="text-primary">Evolink AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
        >
          The All-In-One platform for Generative AI. Create stunning images,
          videos, and audio in seconds.
        </motion.p>

        {/* Interactive Tabs Input */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="w-full max-w-2xl mx-auto"
        >
          <Tabs defaultValue="image" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4 h-12 p-1 bg-muted/60 backdrop-blur-sm">
              <TabsTrigger value="image" className="gap-2 text-base">
                <ImageIcon className="size-4" /> Image
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2 text-base">
                <Video className="size-4" /> Video{' '}
                <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 rounded ml-1">
                  Beta
                </span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="gap-2 text-base" disabled>
                <Music className="size-4" /> Audio{' '}
                <span className="text-[10px] uppercase bg-muted text-muted-foreground px-1.5 rounded ml-1">
                  Soon
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content: Image */}
            <TabsContent value="image" className="mt-0 relative group">
              <div className="relative flex items-center gap-2 p-2 bg-background border border-border/50 rounded-2xl shadow-xl shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'image')}
                  placeholder="Describe the image you want to create... (e.g., A cyberpunk cat in neon city)"
                  className="flex-1 min-h-[56px] bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-lg placeholder:text-muted-foreground/50"
                  rows={1}
                />
                <Button
                  onClick={() => handleSubmit('image')}
                  size="icon"
                  className="size-12 rounded-xl shrink-0"
                  disabled={isProcessing || !prompt.trim()}
                >
                  {isProcessing ? (
                    <Sparkles className="size-5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-6" />
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab Content: Video */}
            <TabsContent value="video" className="mt-0 relative group">
              <div className="relative flex items-center gap-2 p-2 bg-background border border-border/50 rounded-2xl shadow-xl shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'video')}
                  placeholder="Describe the video you want to generate... (e.g., A cinematic drone shot of a beach)"
                  className="flex-1 min-h-[56px] bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-lg placeholder:text-muted-foreground/50"
                  rows={1}
                />
                <Button
                  onClick={() => handleSubmit('video')}
                  size="icon"
                  className="size-12 rounded-xl shrink-0 bg-blue-600 hover:bg-blue-700"
                  disabled={isProcessing || !prompt.trim()}
                >
                  {isProcessing ? (
                    <Sparkles className="size-5 animate-spin" />
                  ) : (
                    <ArrowUp className="size-6" />
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="text-sm text-muted-foreground">
              Try suggestions:
            </span>
            {['Cyberpunk City', 'Watercolor Portrait', 'Oil Painting'].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-sm px-2 py-0.5 bg-muted/50 hover:bg-muted rounded-full transition-colors text-foreground/80"
                >
                  {s}
                </button>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
