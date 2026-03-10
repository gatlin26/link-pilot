/**
 * @file editor-preset-store.ts
 * @description 编辑器预设状态管理 - 用于 Gallery "创建相似" 功能
 * @author git.username
 * @date 2025-12-27
 */

import { create } from 'zustand';

export interface EditorPreset {
  prompt: string;
  model: string;
  imageUrl: string;
}

interface EditorPresetStore {
  preset: EditorPreset | null;
  setPreset: (preset: EditorPreset) => void;
  clearPreset: () => void;
}

export const useEditorPresetStore = create<EditorPresetStore>((set) => ({
  preset: null,
  setPreset: (preset) => set({ preset }),
  clearPreset: () => set({ preset: null }),
}));
