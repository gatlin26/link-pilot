'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Tag {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category?: string | null;
  color?: string | null;
  icon?: string | null;
}

interface TagSelectorProps {
  selectedTagIds: string[];
  availableTags: Tag[];
  onChange: (tagIds: string[]) => void;
  onCreateTag?: (slug: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TagSelector({
  selectedTagIds,
  availableTags,
  onChange,
  onCreateTag,
  disabled = false,
  placeholder = '选择标签...',
  className,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // 获取已选择的标签
  const selectedTags = (availableTags || []).filter((tag) =>
    selectedTagIds.includes(tag.id)
  );

  // 添加标签
  const handleSelectTag = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        // 移除标签
        onChange(selectedTagIds.filter((id) => id !== tagId));
      } else {
        // 添加标签
        onChange([...selectedTagIds, tagId]);
      }
    },
    [selectedTagIds, onChange]
  );

  // 移除标签
  const handleRemoveTag = useCallback(
    (tagId: string) => {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    },
    [selectedTagIds, onChange]
  );

  // 创建新标签
  const handleCreateTag = useCallback(() => {
    if (searchValue.trim() && onCreateTag) {
      onCreateTag(searchValue.trim());
      setSearchValue('');
      setOpen(false);
    }
  }, [searchValue, onCreateTag]);

  // 按分类分组
  const groupedTags = (availableTags || []).reduce(
    (acc, tag) => {
      const category = tag.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tag);
      return acc;
    },
    {} as Record<string, Tag[]>
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* 已选择的标签 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="gap-1 pr-1"
              style={{
                borderColor: tag.color || undefined,
                color: tag.color || undefined,
              }}
            >
              {tag.icon && <span>{tag.icon}</span>}
              <span>{tag.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={disabled}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* 标签选择器 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="text-muted-foreground">{placeholder}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索标签..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {onCreateTag && searchValue.trim() ? (
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleCreateTag}
                    >
                      <Plus className="mr-2 size-4" />
                      创建标签 "{searchValue}"
                    </Button>
                  </div>
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">
                    未找到标签
                  </div>
                )}
              </CommandEmpty>

              {Object.entries(groupedTags).map(([category, tags]) => (
                <CommandGroup key={category} heading={category}>
                  {tags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <CommandItem
                        key={tag.id}
                        value={`${tag.name} ${tag.slug}`}
                        onSelect={() => handleSelectTag(tag.id)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={cn(
                              'flex size-4 items-center justify-center rounded-sm border',
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-input'
                            )}
                          >
                            {isSelected && <Check className="size-3" />}
                          </div>
                          {tag.icon && <span>{tag.icon}</span>}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span>{tag.name}</span>
                              {tag.color && (
                                <div
                                  className="size-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                            </div>
                            {tag.description && (
                              <div className="text-xs text-muted-foreground">
                                {tag.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
