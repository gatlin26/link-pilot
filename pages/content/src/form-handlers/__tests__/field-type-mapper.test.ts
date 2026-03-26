import { describe, expect, it } from 'vitest';
import { mapFieldPurposeToLinkPilot } from '../../utils/field-type-mapper';
import type { FieldMetadata } from '../../types/field-analyzer';

function createMetadata(overrides: Partial<FieldMetadata> = {}): FieldMetadata {
  return {
    id: null,
    name: null,
    className: null,
    type: 'textarea',
    fieldType: 'textarea',
    placeholder: null,
    autocomplete: null,
    required: false,
    disabled: false,
    readonly: false,
    maxLength: null,
    labelTag: null,
    labelData: null,
    labelAria: null,
    labelLeft: null,
    labelTop: null,
    helperText: null,
    rect: new DOMRect(),
    currentValue: '',
    isVisible: true,
    isTopElement: true,
    isInteractive: true,
    fieldPurpose: 'unknown',
    ...overrides,
  };
}

describe('mapFieldPurposeToLinkPilot', () => {
  it('should keep textarea mapped to comment even if purpose looks like email', () => {
    const metadata = createMetadata({
      labelTop: 'Your email address will not be published.',
      name: 'comment',
    });

    expect(mapFieldPurposeToLinkPilot('email', metadata)).toBe('comment');
  });
});
