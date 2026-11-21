# Counterfolk 电商工作区实施方案

> 基线提交 48413e6。GitNexus 1.6.12 返回 Repository not indexed，本次使用工作区源码验证，未执行 PDG 查询。渠道来自同期工作区的《智能硬件消费者购买路径与渠道图谱》。

> 工作区证据版本 2，基线 48413e694fbb13b64e2b6900963ee92df9129e3b，状态摘要 af5a52fd203714011ef67b072b597eb96941476c72d3ed990c67c3a849e57803。

## 1. 目标

做出一个持续运行的虚拟消费市场。研究者可以打开两类电商、浏览商品并体验下单，走访现有 3D 线下门店，查看 100 位固定居民逐日的行为。上传后自动生成营销素材并上架。新商品从后续模拟日参与同类竞争，曝光和订单可追溯至居民及触点。

## 2. 当前行为

[verified · 源码] `src/simulation.js` 的 `simulate` 以配置生成单次 A/B 人群，`encounterDays` 为每个渠道保留首次接触，计算结束时返回抽样居民。新版工作区需要持久居民与交易历史。

[verified · 源码] `src/app.js` 的 `route` 管理现有导航，`persist` 保存最近实验和校准配置。3D 门店入口沿用既有视图。规则 A/B 回放继续可用。

## 3. 相关架构

[verified · 源码] `server/model-routes.js` 的 `createModelRoutes` 已提供本机同源模型接口及并发、请求大小防护。商品运营复用提供商配置，扩展独立的结构化结果协议。浏览器保存世界、素材和事件，默认启动命令为 `npm run dev`。

## 4. 依赖与影响

[source-derived] 原有模拟引擎负责单次 A/B 与校准。新增运行时通过同一页面的导航接入，并持有自己的 IndexedDB 版本、居民、虚拟预算、产品和媒体。电商预览的购物车与居民订单各有入口，购物预览动作只影响预览购物车。

## 5. 状态约束

- [inferred] 世界初始化时一次性创建 100 个身份。每次推进从已提交的世界状态生成后续日的事件，按修订号阻止多标签页覆盖。
- [inferred] 上传照片、营销结构和 A+ 图准备完成后提交上架与素材记录。视频可异步补齐，商品详情展示状态和可下载文件。
- [inferred] 新商品次日获得候选资格。目录曝光、详情访问、比较、加购、付款与退款都需要对应的事件，居民可能转到竞品、延迟购买或退出。

## 6. 产品与工程变更

| 模块 | 交付 | 行为 |
| --- | --- | --- |
| 电商工作区 | 两个原创货架原型 | 国际货架和中国自营风格各自提供搜索、推荐、列表、商品详情、店铺与履约、购物车和虚拟结账。界面使用 Counterfolk 自有品牌和设计。 |
| 线下工作区 | 复用 3D 门店 | 保留可进入门店的街区入口及时间回放。本期商品投放、目录交易和产品统计以电商为主。 |
| 常驻居民 | 100 个固定身份 | 按市场、语言和购买背景分配。查看最近一天或历史、生活活动、搜索词、发现入口、浏览商品和下单记录。 |
| 商品上架 | 上传表单和媒体处理 | 上传图片、填写名称、规格、类别、定价、受众与上架渠道。模型可生成三张 A+ 图的文案和布局、三幕短视频脚本及种草文案。用上传图渲染 PNG 和短视频。模型不可用时界面显示模板素材来源。 |
| 实验报告 | 每商品的事件聚合 | 点击商品查看当日及累计资格人数、唯一曝光、详情、比较、加购、买家、订单、退款、净收入和按渠道的路径。单列买家除以资格人数与买家除以曝光人数。 |

## 7. 实现顺序

1. 定义目录、平台、居民、按日事件与商品指标接口，构建可重放的模拟日。
2. 建立国际和中国电商，接通搜索、详情、购物车、虚拟订单及媒体。
3. 接通上传、AI 结构化素材、图片与短视频渲染，事务提交发布和媒体，并接入历史与报告。
4. 纳入已有工作区导航，验证刷新、多标签页、媒体失败、平台切换和真实转化口径。

## 8. 验证

用种子运行连续日与分批日对比，检查 100 个身份稳定、发布日之前无该商品流量、并非全员曝光、跨平台路径、结账退款去重和分母口径。模型测试用同源桩验证事实约束、无密钥输出和无效结果检测。浏览器手动上架带图商品，确认 A+ PNG、短视频、文案、两端详情、居民历史、日更和刷新都可用。运行 `npm test`。

## 9. 风险

写入竞争由 IndexedDB 事务保护。模型无连接或响应失败时保留可发布的本地模板及失败状态。素材只基于上传图和用户声明，视频支持受浏览器编码能力约束。居民购买和转化属于合成实验，小样本统计可用于筛查问题，现实效果沿用独立真人试点检验。

## 10. 文件

`index.html` 与 `src/app.js` 接入视图。`src/living-world.js` 实现状态转移。`src/commerce-store.js` 保存状态和媒体。`src/marketplace-view.js` 渲染电商原型。`src/commerce-workspace.js` 管理居民、商品和推进。`src/product-media.js` 渲染素材。模型扩展落在现有 `server/model-*.js`。

## 11. 实现上下文

```json
{
  "implementation_context": {
    "task_summary": "电商工作区、100 位持久居民、素材生成和商品测试",
    "acceptance_criteria": [
      "两种电商有可完成的虚拟购物流程",
      "100 个长期身份与逐日记录",
      "上传并展示真实可播放素材",
      "按商品和平台聚合实验事件"
    ],
    "evidence_provenance": {
      "schema_version": 2,
      "head_commit": "48413e694fbb13b64e2b6900963ee92df9129e3b",
      "generated_plan_path": "docs/plans/2026-11-21-gitnexus-plan-living-commerce-workspace.md",
      "global_dirty_digest": {
        "algorithm": "sha256",
        "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
        "value": "af5a52fd203714011ef67b072b597eb96941476c72d3ed990c67c3a849e57803"
      },
      "cited_path_manifest": [
        {
          "path": "docs/SMART_HARDWARE_SALES_PATHS.md",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:4cad899bb03b065e52f04ebe14f0b1bcfa03aecdcc17cb042921cfd4cff23f3f"
        },
        {
          "path": "index.html",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:08cf3d5eb0328c1ee7d101b83eeeb41e0e6302e26e64c2b8b2284e5b9b12daa5",
          "index_digest": "sha256:08cf3d5eb0328c1ee7d101b83eeeb41e0e6302e26e64c2b8b2284e5b9b12daa5",
          "worktree_digest": "sha256:08cf3d5eb0328c1ee7d101b83eeeb41e0e6302e26e64c2b8b2284e5b9b12daa5",
          "untracked_digest": "absent"
        },
        {
          "path": "package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1b34b9bbc8981d68670f21af75bd5f36d4d197703c2daef010ed8e17a1be76c7",
          "index_digest": "sha256:1b34b9bbc8981d68670f21af75bd5f36d4d197703c2daef010ed8e17a1be76c7",
          "worktree_digest": "sha256:1b34b9bbc8981d68670f21af75bd5f36d4d197703c2daef010ed8e17a1be76c7",
          "untracked_digest": "absent"
        },
        {
          "path": "server/model-routes.js",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:e10781d2cdad63c44350336f3c372a0dbce37c4c93fb0ee189b603e3da677af2",
          "index_digest": "sha256:e10781d2cdad63c44350336f3c372a0dbce37c4c93fb0ee189b603e3da677af2",
          "worktree_digest": "sha256:117869f3ac761fe3378f210f6d355ff31d76c78e111584bb1936ea720c5d6d50",
          "untracked_digest": "absent"
        },
        {
          "path": "src/app.js",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7a57d7c133c07dcfed6448552e0af3b51ae77257fae97b7614b0831063797ae6",
          "index_digest": "sha256:7a57d7c133c07dcfed6448552e0af3b51ae77257fae97b7614b0831063797ae6",
          "worktree_digest": "sha256:7a57d7c133c07dcfed6448552e0af3b51ae77257fae97b7614b0831063797ae6",
          "untracked_digest": "absent"
        },
        {
          "path": "src/simulation.js",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8ae5d6eed1d663e9964a2c1ea86303e7a4a0b1c9ece4cc330db2cf3ce11f3c16",
          "index_digest": "sha256:8ae5d6eed1d663e9964a2c1ea86303e7a4a0b1c9ece4cc330db2cf3ce11f3c16",
          "worktree_digest": "sha256:8ae5d6eed1d663e9964a2c1ea86303e7a4a0b1c9ece4cc330db2cf3ce11f3c16",
          "untracked_digest": "absent"
        }
      ]
    },
    "primary_symbols": [
      {
        "symbol": "route",
        "file": "src/app.js",
        "role": "顶层导航"
      },
      {
        "symbol": "simulate",
        "file": "src/simulation.js",
        "role": "原实验基线"
      },
      {
        "symbol": "createModelRoutes",
        "file": "server/model-routes.js",
        "role": "模型服务入口"
      }
    ],
    "related_symbols": [],
    "execution_path": [
      "初始化世界",
      "上架与生成素材",
      "推进模拟日",
      "查看居民和商品结果"
    ],
    "pdg_constraints": [],
    "architectural_patterns": [],
    "files_to_modify": [
      {
        "file": "src/commerce-workspace.js",
        "symbols": [],
        "intended_change": "持久世界与页面操作"
      },
      {
        "file": "src/living-world.js",
        "symbols": [],
        "intended_change": "确定性逐日实验"
      }
    ],
    "tests": [
      {
        "file": "test/living-world.test.js",
        "scenarios": [
          "身份稳定与跨日回放",
          "商品从发布日起参与",
          "累计计数与路径聚合一致"
        ]
      }
    ],
    "verification_commands": [
      "npm test",
      "npm run dev"
    ],
    "risks": [
      "浏览器编码支持",
      "标签页写入竞争",
      "模型可用性"
    ],
    "assumptions": [
      "100 位有长期身份的合成居民",
      "以模拟日推进"
    ],
    "open_questions": [],
    "avoid": [
      "沿用模拟交易与独立视觉设计",
      "禁止真实支付或超出授权的素材传播"
    ]
  }
}
```

## 12. 假设与边界

[assumed] 「实际用户」指拥有长期身份的 100 位合成 Agent。天数采用模拟时间，用户在工作区可推进一次或连续推进。商品发布只改变虚拟货架，结账使用虚拟预算。两种市场用独立设计呈现各自的购物流程。

## 13. 验收标准

两种电商可逛、可查、可模拟结账。100 位身份可点击且刷新保持历史。商品上传后两个选定货架出现新商品，素材可查看和下载。推进日历后商品统计与居民事件对得上，模拟、手动预览与真人付款数据分别记录。
