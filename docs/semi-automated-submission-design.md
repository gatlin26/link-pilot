# 半自动化提交功能设计方案

## 背景

当前系统已实现：
- ✅ 外链采集（手动/自动）
- ✅ 外链审核（转化到外链库）
- ✅ 表单检测和自动填充
- ✅ 提交队列核心逻辑

**缺失环节**：外链库 → 提交队列 → 执行提交的完整流程

## 设计原则

1. **实时生成 FillData**：队列中只存 website_profile_id，提交前实时生成评论
2. **必须关联网站**：每个提交任务必须绑定一个 WebsiteProfile
3. **人机协作**：机器负责打开页面和填充，人类负责点击提交

## 核心数据结构变更

### SubmissionTask（修改）

```typescript
interface SubmissionTask {
  id: string;
  backlinkId: string;
  url: string;
  domain: string;
  // 关键：存储 website_profile_id 而不是 FillData
  websiteProfileId: string;
  // 存储评论生成所需的上下文
  context: {
    backlinkNote?: string;
    backlinkKeywords?: string[];
  };
  status: SubmissionTaskStatus;
  // ...其他字段
}
```

## 流程设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        半自动化提交流程                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 选择外链                    2. 选择网站资料                      │
│     ↓                              ↓                                │
│  ┌──────────────┐            ┌──────────────┐                      │
│  │ backlinks    │───点击───►│ Website      │                      │
│  │ tab          │"加入队列"  │ Profile      │                      │
│  └──────────────┘            │ Selector     │                      │
│                              └──────────────┘                      │
│                                     │                               │
│                                     ▼                               │
│  3. 生成任务                    4. 加入队列                          │
│     ↓                              ↓                                │
│  ┌──────────────┐            ┌──────────────┐                      │
│  │ 生成评论     │────────────►│ Submission   │                      │
│  │ 候选列表     │            │ Queue        │                      │
│  └──────────────┘            └──────────────┘                      │
│                                                                     │
│  5. 提交面板                    6. 执行提交                          │
│     ↓                              ↓                                │
│  ┌──────────────┐            ┌──────────────┐                      │
│  │ Submission   │──开始提交──►│ 打开页面     │                      │
│  │ Panel        │            │ 检测表单     │                      │
│  │              │◄───────────│ 实时生成评论 │                      │
│  │              │  提交完成   │ 填充表单     │                      │
│  └──────────────┘            │ 等待用户确认 │                      │
│                              └──────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 关键实现点

### 1. 实时生成 FillData

在 `submission-handler.ts` 中修改：

```typescript
async function handleFillAndWait(data: {
  backlinkId: string;
  websiteProfileId: string;
  context: SubmissionContext;
}): Promise<...> {
  // 1. 获取 WebsiteProfile
  const profile = await websiteProfileStorage.getById(data.websiteProfileId);

  // 2. 获取页面状态
  const pageState = await getPageState();

  // 3. 实时生成评论
  const comments = buildCommentCandidates(profile, pageState, {
    note: data.context.backlinkNote,
    keywords: data.context.backlinkKeywords,
  });

  // 4. 构建 FillData
  const fillData: FillData = {
    name: profile.author_name || profile.name,
    email: profile.author_email || profile.email,
    website: profile.url,
    comment: comments[0], // 使用第一个候选
  };

  // 5. 填充表单
  return await autoFillService.fill(...);
}
```

### 2. 后台消息处理器

在 `chrome-extension/src/background/` 新建 `submission-queue-manager.ts`：

```typescript
import { SubmissionQueue } from './submission-queue';

const submissionQueue = new SubmissionQueue();

// 添加到队列
messageRouter.register('ADD_TO_SUBMISSION_QUEUE', (message, sender, sendResponse) => {
  const { backlinkIds, websiteProfileId } = message.payload;
  // ...实现逻辑
});

// 获取队列状态
messageRouter.register('GET_SUBMISSION_QUEUE_STATUS', ...);

// 控制队列
messageRouter.register('START_SUBMISSION_QUEUE', ...);
messageRouter.register('PAUSE_SUBMISSION_QUEUE', ...);
messageRouter.register('STOP_SUBMISSION_QUEUE', ...);
```

### 3. UI 入口

在 `Popup.tsx` 的 backlinks tab：

```typescript
// 添加批量选择模式
const [selectionMode, setSelectionMode] = useState(false);
const [selectedBacklinks, setSelectedBacklinks] = useState<Set<string>>(new Set());

// 每个外链项添加复选框
{filteredBacklinks.map(backlink => (
  <div key={backlink.id}>
    {selectionMode && (
      <input
        type="checkbox"
        checked={selectedBacklinks.has(backlink.id)}
        onChange={() => toggleSelection(backlink.id)}
      />
    )}
    {/* ...现有内容 */}
  </div>
))}

// 添加操作栏
<div className="batch-actions">
  <button onClick={() => setSelectionMode(true)}>批量选择</button>
  <button
    onClick={() => openWebsiteProfileSelector(selectedBacklinks)}
    disabled={selectedBacklinks.size === 0}
  >
    加入提交队列 ({selectedBacklinks.size})
  </button>
</div>
```

### 4. 网站选择弹窗

新建 `WebsiteProfileSelector` 组件：

```typescript
interface WebsiteProfileSelectorProps {
  backlinkIds: string[];
  onConfirm: (websiteProfileId: string) => void;
  onCancel: () => void;
}

// 显示用户的网站资料列表
// 选择后生成评论预览
// 确认后加入队列
```

## 文件修改清单

### 类型定义
- [ ] `packages/shared/lib/types/models.ts` - 修改 SubmissionTask

### 后台逻辑
- [ ] `chrome-extension/src/background/submission-queue-manager.ts` - 新建
- [ ] `chrome-extension/src/background/index.ts` - 导入管理器

### 表单处理
- [ ] `pages/content/src/form-handlers/submission-handler.ts` - 修改 handleFillAndWait

### UI 组件
- [ ] `pages/popup/src/Popup.tsx` - 添加批量选择功能
- [ ] `pages/popup/src/components/WebsiteProfileSelector.tsx` - 新建
- [ ] `pages/popup/src/components/submission/SubmissionPanel.tsx` - 完善功能

## 补充业务逻辑

### 1. 填表页面添加外链

在 **fill tab** 中，当满足以下条件时显示"添加到外链库"按钮：
- ✅ 表单已检测 (`pageState.form_detected`)
- ✅ 表单已填充 (通过某种状态标记)
- ✅ 当前 URL **不在**外链库中 (`!pageState.backlink_in_current_group`)

```typescript
// 填表动作区域添加
<section className="表单动作">
  ...
  {pageState.form_detected &&
   !pageState.backlink_in_current_group &&
   hasFilledForm && (
    <button onClick={addCurrentPageToBacklinks}>
      添加到外链库
    </button>
  )}
</section>
```

添加时需要收集：
- URL、Domain（自动获取）
- 备注（可选，默认抓取页面描述）
- 关键词（可选，多标签）
- 目标分组（选择）

### 2. 外链智能匹配（后续扩展）

利用外链的标签和描述，实现智能推荐：

```typescript
interface BacklinkMatchingEngine {
  // 根据网站资料推荐合适的外链
  recommendBacklinks(
    websiteProfile: WebsiteProfile,
    availableBacklinks: ManagedBacklink[],
    limit: number
  ): ManagedBacklink[];

  // 计算匹配分数
  calculateMatchScore(
    websiteProfile: WebsiteProfile,
    backlink: ManagedBacklink
  ): number;
}

// 匹配维度：
// - 关键词匹配（websiteProfile.comments 中的关键词 vs backlink.keywords）
// - 行业相关性（基于描述语义分析）
// - 历史转化率（该类型外链的成功率）
// - Domain Rating 匹配
```

## 注意事项

1. **评论预览**：加入队列前展示评论预览，让用户确认
2. **错误处理**：队列执行失败时记录错误原因
3. **速率控制**：保持现有的域名冷却机制
4. **状态同步**：队列状态变化时通知所有 UI 组件
5. **外链去重**：添加外链时检查 URL 是否已存在

---

*文档版本：1.0*
*创建时间：2026-03-12*
