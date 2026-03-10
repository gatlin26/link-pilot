/**
 * @file schema-renderer.tsx
 * @description JSON-LD Schema 渲染组件
 * @author git.username
 * @date 2025-12-27
 */

import type { ReactNode } from 'react';

interface SchemaRendererProps {
  /**
   * JSON-LD schema 对象
   */
  schema: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * JSON-LD Schema 渲染组件
 * 将 schema 对象转换为 script 标签并插入到 HTML 中
 *
 * 使用示例:
 * ```tsx
 * <SchemaRenderer schema={generateOrganizationSchema()} />
 * ```
 */
export function SchemaRenderer({ schema }: SchemaRendererProps): ReactNode {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema),
      }}
      suppressHydrationWarning
    />
  );
}

/**
 * 多个Schema渲染组件
 * 用于渲染多个JSON-LD schemas
 */
export function MultipleSchemaRenderer({
  schemas,
}: {
  schemas: (Record<string, unknown> | undefined)[];
}): ReactNode {
  // 过滤掉 undefined 的 schemas
  const validSchemas = schemas.filter((s) => s !== undefined);

  if (validSchemas.length === 0) {
    return null;
  }

  // 如果只有一个 schema，直接渲染
  if (validSchemas.length === 1) {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(validSchemas[0]),
        }}
        suppressHydrationWarning
      />
    );
  }

  // 使用 @graph 来组合多个 schemas
  const graph = {
    '@context': 'https://schema.org',
    '@graph': validSchemas.map((schema) => {
      // 移除已存在的 @context
      const { '@context': _, ...rest } = schema as Record<string, unknown>;
      return rest;
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graph),
      }}
      suppressHydrationWarning
    />
  );
}
