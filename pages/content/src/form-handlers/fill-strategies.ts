/**
 * 表单填充策略
 * 提供多种填充策略，包括人类输入模拟、原生 setter、React Select 等
 *
 * @author yiangto
 * @date 2026-03-13
 */

/**
 * 延迟函数
 * @param ms - 延迟毫秒数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 填充策略：模拟人类输入
 * 逐字符输入，带随机延迟，触发完整的键盘事件
 *
 * @param element - 输入元素
 * @param value - 要填充的值
 * @returns 是否成功
 */
export async function fillWithHumanTyping(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<boolean> {
  try {
    // 聚焦元素
    element.focus();

    // 清空现有值
    element.value = '';

    // 触发 focus 和初始 input 事件
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // 等待一小段时间
    await delay(50);

    // 逐字符输入
    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      // 触发 keydown 事件
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true,
        }),
      );

      // 设置值
      element.value = value.substring(0, i + 1);

      // 触发 input 事件
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: char,
          inputType: 'insertText',
        }),
      );

      // 触发 keyup 事件
      element.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: char,
          bubbles: true,
        }),
      );

      // 随机延迟 30-50ms，模拟人类输入速度
      await delay(30 + Math.random() * 20);
    }

    // 等待一小段时间
    await delay(50);

    // 触发 change 和 blur 事件
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  } catch (error) {
    console.debug('Human typing 填充失败:', error);
    return false;
  }
}

/**
 * 填充策略：使用原生 setter
 * 直接使用原生的 value setter，绕过框架的拦截
 * 适用于 React、Vue 等框架
 *
 * @param element - 输入元素
 * @param value - 要填充的值
 */
export function fillWithNativeSetter(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  try {
    // 获取原生 setter
    const proto =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    // 使用原生 setter 设置值
    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    // 触发事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) {
    console.error('Native setter 填充失败:', error);
    throw error;
  }
}

/**
 * 填充策略：React Select 组件
 * 特殊处理 React Select 组件，包括打开下拉菜单、查找选项、点击选项
 *
 * @param element - 输入元素
 * @param value - 要填充的值
 * @returns 是否成功
 */
export async function fillReactSelect(element: HTMLInputElement, value: string): Promise<boolean> {
  try {
    console.debug(`React Select: 尝试填充值 "${value}"`);

    // 第一步：查找并填充隐藏的 input
    const selectContainer = element.closest('.select, .select__container, [class*="select"]');
    if (selectContainer) {
      const hiddenInput = selectContainer.querySelector<HTMLInputElement>(
        'input[type="hidden"], input[aria-hidden="true"], input[tabindex="-1"]:not([role])',
      );

      if (hiddenInput && hiddenInput !== element) {
        console.debug('React Select: 找到隐藏 input，直接设置值');

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(hiddenInput, value);
        } else {
          hiddenInput.value = value;
        }

        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 第二步：聚焦并打开下拉菜单
    element.focus();

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await delay(50);

    // 尝试点击 control 容器
    const controlContainer = element.closest('[class*="control"]');
    if (controlContainer) {
      controlContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    }

    await delay(200);

    // 第三步：查找下拉菜单
    let menuEl: Element | null = null;

    // 通过 aria-controls 查找
    const listboxId = element.getAttribute('aria-controls');
    if (listboxId) {
      menuEl = document.getElementById(listboxId);
    }

    // 通过 class 查找
    if (!menuEl) {
      menuEl = document.querySelector(
        '[class*="menu"]:not([class*="menu-"]), [class*="-menu"], .select__menu',
      );
    }

    console.debug(`React Select: 菜单${menuEl ? '已找到' : '未找到'}`);

    // 第四步：查找选项
    let options: NodeListOf<HTMLElement> | HTMLElement[] = [];

    if (menuEl) {
      options = menuEl.querySelectorAll<HTMLElement>('[class*="option"], [role="option"]');
    } else {
      options = document.querySelectorAll<HTMLElement>(
        '[class*="select__option"], [id*="react-select"][id*="option"]',
      );
    }

    console.debug(`React Select: 找到 ${options.length} 个选项`);

    // 第五步：匹配选项
    const normalizedValue = value.toLowerCase().trim();
    let matchedOption: HTMLElement | null = null;

    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const optionText = option.textContent?.toLowerCase().trim() || '';
      console.debug(`React Select: 检查选项 "${optionText}"`);

      // 精确匹配
      if (optionText === normalizedValue) {
        matchedOption = option;
        break;
      }

      // 部分匹配（作为备选）
      if (!matchedOption && optionText.includes(normalizedValue)) {
        matchedOption = option;
      }
    }

    // 第六步：点击匹配的选项
    if (matchedOption) {
      console.debug(`React Select: 点击匹配的选项 "${matchedOption.textContent}"`);
      matchedOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await delay(50);
      matchedOption.click();
      return true;
    }

    // 第七步：如果没有直接匹配，尝试输入过滤
    console.debug('React Select: 没有直接匹配，尝试输入过滤');

    element.value = '';
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: '',
        inputType: 'deleteContentBackward',
      }),
    );

    // 逐字符输入
    for (const char of value) {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      element.value += char;
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: char,
          inputType: 'insertText',
        }),
      );
      await delay(30);
    }

    await delay(200);

    // 查找过滤后的选项
    const filteredOptions = document.querySelectorAll<HTMLElement>(
      '[class*="select__option"], [id*="react-select"][id*="option"], [role="option"]',
    );

    console.debug(`React Select: 找到 ${filteredOptions.length} 个过滤后的选项`);

    if (filteredOptions.length > 0) {
      const firstOption = filteredOptions[0];
      console.debug(`React Select: 点击第一个过滤选项 "${firstOption.textContent}"`);
      firstOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await delay(50);
      firstOption.click();
      return true;
    }

    // 第八步：最后尝试按 Enter 键
    element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      }),
    );

    console.debug('React Select: 按下 Enter 键作为最后尝试');
    return true;
  } catch (error) {
    console.error('React Select 填充失败:', error);
    return false;
  }
}

/**
 * 填充策略：标准 select 元素
 * 通过值或文本匹配选项
 *
 * @param element - select 元素
 * @param value - 要填充的值
 * @returns 是否成功
 */
export function fillSelectElement(element: HTMLSelectElement, value: string): boolean {
  try {
    const normalizedValue = value.toLowerCase();
    let matched = false;

    // 遍历所有选项
    for (const option of Array.from(element.options)) {
      // 尝试匹配 value 或 text
      if (
        option.value.toLowerCase() === normalizedValue ||
        option.text.toLowerCase() === normalizedValue
      ) {
        option.selected = true;
        matched = true;
        break;
      }
    }

    // 如果没有匹配，直接设置值
    if (!matched) {
      console.warn(
        `Select 元素 ${element.name || element.id || '(unnamed)'} 没有匹配的选项 "${value}"，直接设置值`,
      );
      element.value = value;
    }

    // 触发事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  } catch (error) {
    console.error('Select 元素填充失败:', error);
    return false;
  }
}

/**
 * 检测是否为 React Select 组件
 *
 * @param element - 输入元素
 * @returns 是否为 React Select
 */
export function isReactSelect(element: HTMLInputElement): boolean {
  // 检查 role 属性
  if (element.getAttribute('role') === 'combobox') {
    return true;
  }

  // 检查父容器的 class
  const container = element.closest('[class*="select"]');
  if (container) {
    const className = container.className;
    if (
      typeof className === 'string' &&
      (className.includes('react-select') ||
        className.includes('select__') ||
        className.includes('-select'))
    ) {
      return true;
    }
  }

  // 检查 aria-autocomplete
  if (element.getAttribute('aria-autocomplete') === 'list') {
    return true;
  }

  return false;
}
