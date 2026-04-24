# t2i_museum Jimeng Collector 设计文档

## 1. 背景

`t2i_museum` 的目标不是单纯存图，而是围绕 `AIGC 图片素材 <-> 绘画风格 <-> 风格含义解释` 建立一个持续增长的知识库，服务于：

- 系统性积累高质量文生图案例
- 系统性积累绘画风格关键词
- 让相近风格词自动归类，而不是越收越乱
- 后续以 museum 站点的形式浏览、检索、学习这些案例

当前第一优先级不是把展示站点做漂亮，而是尽快打通 `即梦详情页 -> 自动入馆` 的采集闭环，让样例库可以尽早开始积累。

---

## 2. 本阶段目标

本阶段聚焦一个明确子项目：

`Jimeng 图片详情页 Chrome 插件 + 本地 Collector + 自动风格分析 + SQLite 入馆`

### 目标

- 在即梦 `work-detail` 图片详情页注入 `COLLECT` 按钮
- 点击后自动采集作品原始信息
- 自动下载图片到本地缓存
- 自动调用在线模型抽取风格词
- 自动做风格别名归一化
- 自动写入本地 SQLite

### 非目标

- 暂不支持即梦列表页批量采集
- 暂不支持多来源站点统一采集
- 暂不优先做复杂后台管理系统
- 暂不优先做完整 museum 视觉精修

---

## 3. 已确认的产品约束

- 采集优先级：`Chrome 插件优先`
- 页面范围：`仅即梦图片详情页`
- 入馆方式：`全自动入馆`
- 存储：`本地 SQLite + 本地图片缓存`
- 风格分析：`在线模型优先`
- 登录假设：`依赖你本机已登录的即梦 Chrome 会话`

这些约束决定了第一版应采用本地优先、单机优先、闭环优先的方案，而不是一开始就引入远程服务或通用平台设计。

---

## 4. 方案概览

### 推荐方案

采用：

`DOM 采集优先 + 本地服务厚逻辑 + museum 前端只读`

原因：

- 即梦详情页已验证可直接从 DOM 读取核心字段
- `prompt`、主图 URL、作者、日期、模型、比例、动作区都在详情页中可见
- 主图是可立即下载的签名 `webp` 地址，适合本地落盘缓存
- 第一版无需先反向分析站内内部 API，即可打通闭环

### 核心职责拆分

#### Chrome 插件

只负责：

- 详情页 UI 注入
- 从当前 DOM 读取原始数据
- 调用本地 collector

不负责：

- 风格分析
- SQLite 写入
- 图片持久化

#### 本地 Collector 服务

负责：

- 接收采集请求
- 幂等去重
- 原始记录落库
- 图片下载与缓存
- 在线模型分析
- 风格归一化
- 建立作品与风格关系

#### Museum 前端

本阶段只需要消费 collector 已整理好的数据，后续做只读展示即可。

---

## 5. 真实页面勘察结论

基于对即梦详情页的 CDP 勘察，已确认：

- 详情页 URL 形态为：`/ai-tool/work-detail/<workId>?workDetailType=Image&itemType=9`
- 页面中存在明确 `图片提示词` 区块
- prompt 文本可直接读取
- 右侧操作区存在稳定动作容器，可作为 `COLLECT` 注入锚点
- 页面主图为真实 `img` 元素，具备可下载的签名资源 URL

本项目当前生成的可视化架构图：

- [系统架构总览](../../architecture/t2i-museum-current-system-architecture.html)
- [自动入馆流程与核心数据模型](../../architecture/t2i-museum-ingestion-flow-and-catalog-model.html)

---

## 6. 系统架构

推荐采用：

`插件薄 + 本地服务厚 + 数据分层清晰`

### 运行链路

`即梦详情页 -> Chrome 插件 COLLECT -> 本地 collector -> 下载图片 -> LLM 风格分析 -> alias 归一化 -> SQLite 入馆 -> museum 展示`

### 设计原则

- `KISS`：第一版只覆盖即梦详情页
- `YAGNI`：不提前建设通用多站点平台
- `SRP`：插件只采集，本地服务只做处理和持久化，前端只读展示
- `DRY`：风格归一化和 alias 逻辑统一在 collector，不在多个层重复实现

---

## 7. 数据模型

第一版建议的核心表：

### `works`

保存原始采集事实。

关键字段：

- `source_site`
- `source_work_id`
- `source_url`
- `author_name`
- `published_at`
- `prompt_raw`
- `model_label`
- `aspect_ratio`
- `image_source_url`
- `image_local_path`
- `image_sha256`
- `width`
- `height`
- `ingest_status`
- `ingest_error`

约束：

- `source_site + source_work_id` 唯一

### `styles`

保存规范化后的风格实体。

关键字段：

- `slug`
- `name`
- `term_type`
- `status`
- `short_description`
- `visual_traits`
- `prompt_hints`
- `hero_work_id`

建议状态：

- `active`
- `candidate`
- `merged`
- `ignored`

### `style_aliases`

保存风格别名和归一化映射。

关键字段：

- `style_id`
- `alias_name`
- `alias_norm`
- `source`
- `confidence`

### `work_styles`

保存作品与风格的多对多关系。

关键字段：

- `work_id`
- `style_id`
- `evidence_text`
- `confidence`
- `is_primary`
- `source`

### `analysis_runs`

保存每次分析调用，方便追溯和重跑。

关键字段：

- `work_id`
- `provider`
- `model`
- `prompt_version`
- `raw_response`
- `parsed_result_json`
- `status`
- `error_message`

---

## 8. 自动入馆流程

点击 `COLLECT` 后，推荐按以下顺序执行：

### 1. 插件读取详情页原始字段

至少包含：

- `source_work_id`
- `source_url`
- `prompt_raw`
- `image_source_url`
- `author_name`
- `published_at`
- `model_label`
- `aspect_ratio`

### 2. Collector 做幂等检查

- 若 `source_site + source_work_id` 已存在，则返回“已采集”
- 若图片哈希重复，则标记为疑似重复，但不强制拒绝

### 3. 先写原始记录

在 `works` 中写入 `pending` 状态记录。

原则：

`先落原始事实，再做派生分析`

### 4. 立即缓存图片

将主图下载到本地，例如：

`data/cache/originals/jimeng/<workId>.webp`

并回填：

- `image_local_path`
- `image_sha256`
- `width`
- `height`

### 5. 调用在线模型分析 prompt

必须要求模型返回结构化 JSON，而不是自由文本。

### 6. 归一化风格词

归一化顺序：

1. 本地字符串标准化
2. alias 精确命中
3. 近似匹配与 LLM 建议
4. 未命中时创建新 style

### 7. 建立 `work_styles`

把识别出的风格写入作品与风格映射表。

### 8. 补充风格解释

当某个 `style` 尚无解释时，用分析结果补齐说明字段。

### 9. 更新最终状态

将 `works.ingest_status` 更新为：

- `done`
- `partial`
- `failed`

---

## 9. 风格抽取与归一化策略

### 词项分类

prompt 中的词不能一视同仁，建议先分层：

- `artist_style`
- `movement_style`
- `aesthetic_style`
- `medium_rendering`
- `quality_modifier`
- `subject_content`
- `mood_atmosphere`

### 第一版默认升格为风格页的类型

优先保留：

- `artist_style`
- `movement_style`
- `aesthetic_style`
- 部分高价值 `medium_rendering`

不默认升格为风格页：

- `quality_modifier`
- `subject_content`
- `mood_atmosphere`

### 归一化目标

例如：

- `Moebius (Jean Giraud)`
- `Moebius (Jean Giraud)风格`
- `Moebius 风格`

都应归入同一个 canonical style。

原则：

`LLM 负责发现，系统负责收口`

### 动态词库策略

风格词库不是固定字典，而应在采集中持续扩充。

因此系统必须支持：

- 自动新增 `candidate style`
- 后续人工 merge
- 自动生成 alias
- 规则更新后重建历史 `work_styles`

---

## 10. 失败恢复策略

### 输入不完整

若插件未读到 prompt 或主图 URL：

- 直接终止
- 不创建 `works`

### 图片下载失败

- 保留 `works`
- 状态置为 `failed`
- 允许后续重试下载

### LLM 分析失败

- 原始记录保留
- 记录 `analysis_runs`
- 允许后续重新分析

### 重复点击

系统必须幂等：

- 同一 `source_work_id` 不重复入库
- 返回明确的 `already_collected`

---

## 11. 分期实施建议

### Phase 1：可采集

目标：尽快开始收即梦样例。

交付物：

- Chrome 插件 MVP
- 本地 collector API
- SQLite 初始化
- 图片本地缓存
- 在线模型风格分析
- 简单结果查看方式

### Phase 2：可浏览

目标：以 museum 形式查看已入馆作品。

交付物：

- 作品列表页
- 作品详情页
- 风格 tag 跳转
- 风格详情页基础版

### Phase 3：可演化

目标：风格词库越用越准。

交付物：

- style merge / alias 管理
- 低置信度复查
- 历史重建 style links
- 更完整的风格解释与 hero 选择

---

## 12. 第一优先开发结论

Chrome 插件不会排在后面，而是**下一阶段的第一优先级**。

原因：

- 你当前最迫切的目标是尽快开始收即梦样例
- 采集闭环比展示站点更早产生价值
- 只要插件和 collector 闭环打通，就可以开始积累 museum 的核心数据资产

第一批实现建议按以下优先级推进：

1. `P0` Chrome 插件
2. `P0` 本地 collector
3. `P0` SQLite schema + 图片缓存
4. `P0` 在线模型风格分析
5. `P1` museum 基础浏览页
6. `P2` 风格 hero 页与进一步 polish

---

## 13. 风险与边界

### 已知风险

- 即梦页面 DOM 类名未来可能变化
- 签名图片 URL 有时效
- 在线模型输出可能不稳定
- 风格词会持续膨胀，需要后续治理能力

### 当前应对

- 插件逻辑只依赖少量关键锚点
- 图片必须立即缓存本地
- LLM 输出必须约束为 JSON
- 以 `style_aliases + merge + reindex` 控制词库膨胀

---

## 14. 下一步

本设计文档确认后，进入实现计划阶段，重点产出：

- 首批文件结构
- P0 实现任务拆分
- 每一步的测试与验证方式

按当前仓库约束，本次只落文档，不进行 `git commit`。
