/**
 * 学习模板提示组件
 * 当检测到用户手动填充表单时，提示用户是否保存模板
 */

import { useState, useEffect } from 'react';
import type { DetectedField } from '../../../content/src/form-handlers/assisted-learning';
import type { FieldType } from '../../../content/src/form-handlers/field-type-inferrer';

export interface LearnTemplatePromptProps {
  /** 是否显示 */
  visible: boolean;
  /** 检测到的字段 */
  detectedFields: DetectedField[];
  /** 保存回调 */
  onSave: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 编辑字段类型回调 */
  onEditField?: (element: HTMLElement, newType: FieldType) => void;
}

/**
 * 字段类型显示名称
 */
const fieldTypeNames: Record<FieldType, string> = {
  name: '姓名',
  email: '邮箱',
  website: '网站',
  comment: '评论',
  submit: '提交按钮',
  unknown: '未知',
};

/**
 * 字段类型选项
 */
const fieldTypeOptions: FieldType[] = ['name', 'email', 'website', 'comment'];

/**
 * 学习模板提示组件
 */
export function LearnTemplatePrompt({
  visible,
  detectedFields,
  onSave,
  onCancel,
  onEditField,
}: LearnTemplatePromptProps) {
  const [show, setShow] = useState(visible);
  const [editingField, setEditingField] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setShow(visible);
  }, [visible]);

  if (!show) return null;

  // 过滤掉提交按钮和未知类型
  const displayFields = detectedFields.filter(
    f => f.inferredType !== 'submit' && f.inferredType !== 'unknown'
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        zIndex: 10001,
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
          }}
        >
          记录此表单
        </h3>
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: '14px',
            color: '#6b7280',
          }}
        >
          检测到您手动填充了表单，是否保存为模板以便下次自动填充？
        </p>
      </div>

      {/* 字段列表 */}
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
          识别到的字段 ({displayFields.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayFields.map((field, index) => (
            <div
              key={index}
              style={{
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {field.selector}
                  </div>
                  <div style={{ fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
                    {field.value.length > 30 ? field.value.substring(0, 30) + '...' : field.value}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        backgroundColor: field.confidence > 0.7 ? '#dbeafe' : '#fef3c7',
                        color: field.confidence > 0.7 ? '#1e40af' : '#92400e',
                        borderRadius: '4px',
                      }}
                    >
                      {fieldTypeNames[field.confirmedType || field.inferredType]}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      置信度: {(field.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {onEditField && (
                  <button
                    onClick={() => setEditingField(editingField === field.element ? null : field.element)}
                    style={{
                      marginLeft: '8px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      color: '#3b82f6',
                      backgroundColor: 'white',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {editingField === field.element ? '取消' : '修改'}
                  </button>
                )}
              </div>

              {/* 编辑字段类型 */}
              {editingField === field.element && onEditField && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                    选择正确的字段类型：
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {fieldTypeOptions.map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          onEditField(field.element, type);
                          setEditingField(null);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          color: type === field.inferredType ? 'white' : '#374151',
                          backgroundColor: type === field.inferredType ? '#3b82f6' : 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        {fieldTypeNames[type]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 提示信息 */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#1e40af',
          }}
        >
          💡 保存后，下次访问相同或相似的表单时将自动填充
        </div>
      </div>

      {/* 按钮 */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={() => {
            setShow(false);
            onCancel();
          }}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            color: '#6b7280',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          不保存
        </button>
        <button
          onClick={() => {
            setShow(false);
            onSave();
          }}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: 'white',
            backgroundColor: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          保存模板
        </button>
      </div>

      {/* 遮罩层 */}
      <div
        onClick={() => {
          setShow(false);
          onCancel();
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: -1,
        }}
      />
    </div>
  );
}
