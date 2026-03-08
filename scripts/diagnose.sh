#!/bin/bash

echo "=== Link Pilot 功能诊断 ==="
echo ""

echo "1. 检查类型定义导出..."
if grep -q "WebsiteConfig" packages/shared/lib/types/models.ts; then
    echo "✓ WebsiteConfig 类型已定义"
else
    echo "✗ WebsiteConfig 类型未找到"
fi

if grep -q "BacklinkGroup" packages/shared/lib/types/models.ts; then
    echo "✓ BacklinkGroup 类型已定义"
else
    echo "✗ BacklinkGroup 类型未找到"
fi

if grep -q "ExtensionSettings" packages/shared/lib/types/models.ts; then
    echo "✓ ExtensionSettings 类型已定义"
else
    echo "✗ ExtensionSettings 类型未找到"
fi

echo ""
echo "2. 检查存储模块..."
if [ -f "packages/storage/lib/impl/website-config-storage.ts" ]; then
    echo "✓ websiteConfigStorage 文件存在"
else
    echo "✗ websiteConfigStorage 文件不存在"
fi

if [ -f "packages/storage/lib/impl/backlink-group-storage.ts" ]; then
    echo "✓ backlinkGroupStorage 文件存在"
else
    echo "✗ backlinkGroupStorage 文件不存在"
fi

if [ -f "packages/storage/lib/impl/extension-settings-storage.ts" ]; then
    echo "✓ extensionSettingsStorage 文件存在"
else
    echo "✗ extensionSettingsStorage 文件不存在"
fi

if grep -q "website-config-storage" packages/storage/lib/impl/index.ts; then
    echo "✓ websiteConfigStorage 已导出"
else
    echo "✗ websiteConfigStorage 未导出"
fi

echo ""
echo "3. 检查 Options 页面组件..."
if [ -f "pages/options/src/components/WebsiteConfigList.tsx" ]; then
    echo "✓ WebsiteConfigList 组件存在"
else
    echo "✗ WebsiteConfigList 组件不存在"
fi

if [ -f "pages/options/src/components/WebsiteConfigForm.tsx" ]; then
    echo "✓ WebsiteConfigForm 组件存在"
else
    echo "✗ WebsiteConfigForm 组件不存在"
fi

if [ -f "pages/options/src/components/BacklinkManager.tsx" ]; then
    echo "✓ BacklinkManager 组件存在"
else
    echo "✗ BacklinkManager 组件不存在"
fi

if [ -f "pages/options/src/components/ExtensionSettingsPanel.tsx" ]; then
    echo "✓ ExtensionSettingsPanel 组件存在"
else
    echo "✗ ExtensionSettingsPanel 组件不存在"
fi

echo ""
echo "4. 检查 Popup 页面组件..."
if [ -f "pages/popup/src/components/QuickFill.tsx" ]; then
    echo "✓ QuickFill 组件存在"
else
    echo "✗ QuickFill 组件不存在"
fi

if [ -f "pages/popup/src/components/AutoComment.tsx" ]; then
    echo "✓ AutoComment 组件存在"
else
    echo "✗ AutoComment 组件不存在"
fi

echo ""
echo "5. 检查 Hooks..."
if [ -f "pages/options/src/hooks/useWebsiteConfigs.ts" ]; then
    echo "✓ useWebsiteConfigs hook 存在"
else
    echo "✗ useWebsiteConfigs hook 不存在"
fi

if [ -f "pages/options/src/hooks/useBacklinkGroups.ts" ]; then
    echo "✓ useBacklinkGroups hook 存在"
else
    echo "✗ useBacklinkGroups hook 不存在"
fi

echo ""
echo "6. 检查构建输出..."
if [ -d "dist" ]; then
    echo "✓ dist 目录存在"
    if [ -f "dist/options/index.html" ]; then
        echo "✓ Options 页面已构建"
    else
        echo "✗ Options 页面未构建"
    fi
    if [ -f "dist/popup/index.html" ]; then
        echo "✓ Popup 页面已构建"
    else
        echo "✗ Popup 页面未构建"
    fi
else
    echo "✗ dist 目录不存在"
fi

echo ""
echo "=== 诊断完成 ==="
