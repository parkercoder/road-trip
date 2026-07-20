# Road Trip / 公路旅行

**English:** Road Trip is a mobile-first, full-screen planning and travel map for long-distance journeys. Trip Builder creates and edits a portable plan, while Traveler keeps the map visible beside swipeable itinerary cards.

**中文：** Road Trip 是一款移动优先的全屏长途旅行规划与导航地图。Trip Builder 用于创建和编辑可移植的旅行计划，Traveler 则让地图与可滑动的行程卡片始终触手可及。

The included cross-Canada demo contains public route and place information only. Booking confirmations and personal data are deliberately excluded.

仓库内置的横穿加拿大示例只包含公开路线和地点信息，并明确排除预订确认与个人数据。

The product is built around **TripPlan V1**: one portable JSON plan that can be created manually or with an AI assistant, saved locally, and rendered by Traveler.

产品以 **TripPlan V1** 为核心：这是一份可移植的 JSON 旅行计划，可由用户手动创建或通过 AI 助手生成，保存到本地后由 Traveler 呈现。

## Features / 功能

- Visual Trip Builder for creating and editing trips without writing JSON / 无需编写 JSON 的可视化 Trip Builder
- BYOK AI planner that converts a natural-language brief and up to three follow-up answers into a TripPlan / 使用用户自备 API Token 的 AI 规划器，可将自然语言需求和最多三个追问答案转换为 TripPlan
- User-selected model provider, model ID, endpoint, and API token; tokens are never persisted / 由用户选择模型服务、模型 ID、接口地址和 API Token；Token 永不持久化
- Browser-local autosave, Plan import/save, validation, and one-click Trip Preview / 浏览器本地自动保存、Plan 导入与保存、结构校验及一键 Trip Preview
- Deterministic checks for route continuity, daily travel limits, EV range gaps, and lodging cadence / 针对路线连续性、每日移动上限、电动车续航缺口和住宿频率的确定性检查
- Address geocoding, map coordinate picking, ordered route anchors, and optional activities / 地址地理编码、地图取点、有序路线锚点和可选活动
- Mode-aware routing: roads for driving, mapped paths and trails for walking or cycling, and direct lines for flights / 按出行方式生成路线：驾驶贴合公路，步行与骑行贴合已映射道路或步道，飞行采用直线连接
- Automatic airport-to-airport flight legs with independently routed ground transfers / 自动识别机场之间的飞行段，并分别计算前后地面接驳路线
- Mixed driving and hiking days for trailheads and backcountry camps / 支持前往登山口和偏远营地的驾驶与徒步混合行程
- Collapsible turn-by-turn directions on Traveler day cards / Traveler 每日卡片中的可折叠逐向指引
- OpenStreetMap, CARTO, and Esri basemap fallback / OpenStreetMap、CARTO 与 Esri 底图逐瓦片回退
- Campground, hotel, charging, ferry, attraction, and hazard markers / 营地、酒店、充电、轮渡、景点和风险标记
- Device location, navigation sharing, weather warnings, and wildfire alerts / 设备定位、导航分享、天气预警和山火提醒
- No framework, build step, account, or map API key required / 无需前端框架、构建步骤、账户或地图 API Key

## Quick Start / 快速开始

Route and Plan data are loaded with `fetch`, so serve the directory over HTTP instead of opening the HTML files directly.

路线和 Plan 数据通过 `fetch` 加载，因此请使用 HTTP 服务访问项目，不要直接双击打开 HTML 文件。

```bash
cd road-trip
python3 -m http.server 8765
```

- Trip Builder / 行程创建：`http://localhost:8765`（根地址默认进入 Builder / the root opens Builder by default）
- Traveler demo / Traveler 示例：`http://localhost:8765/traveler.html`

To open another same-origin TripPlan without changing the application, pass its path in the URL. 如需打开同源的其他 TripPlan，可在 URL 中传入文件路径：

```text
http://localhost:8765/?trip=examples%2Flakes-and-pines.trip.json
```

## Customize a Trip / 创建和修改行程

Use the visual [`studio.html`](studio.html). Describe a trip for AI-assisted planning with your own model and API token, or use the complete manual editor. Trip Builder autosaves locally, supports addresses and map-based coordinate picking, imports and saves Plan files, checks feasibility, and opens the current draft in Trip Preview. See the [Trip Builder guide / Trip Builder 指南](docs/STUDIO.md).

请使用可视化页面 [`studio.html`](studio.html)。你可以用自己的模型与 API Token 描述旅行并让 AI 辅助规划，也可以完全手动编辑。Trip Builder 会在本地自动保存，支持地址和地图取点、导入与保存 Plan、可行性检查，并可在 Trip Preview 中打开当前草稿。详见 [Trip Builder 指南 / Trip Builder guide](docs/STUDIO.md)。

Traveler loads its default public demo from [`data/cross-canada.trip.json`](data/cross-canada.trip.json). Another same-origin JSON Plan can be selected with the `trip` query parameter.

Traveler 默认从 [`data/cross-canada.trip.json`](data/cross-canada.trip.json) 加载公开示例，也可通过 `trip` 查询参数选择其他同源 JSON Plan。

Only origins, destinations, ferry terminals, and required charging or fuel stops should be route anchors. Keep optional attractions as activities so they do not force a detour.

只有起点、终点、轮渡码头以及必需的充电或加油点应成为路线锚点。可选景点应保留为活动，避免强制改变主路线。

New integrations should target [`TripPlan V1`](docs/TRIP-PLAN-V1.md). The canonical JSON Schema retains the compatibility filename [`schemas/trip-spec.v1.schema.json`](schemas/trip-spec.v1.schema.json). A smaller fictional example is available at [`examples/lakes-and-pines.trip.json`](examples/lakes-and-pines.trip.json).

新集成应以 [`TripPlan V1`](docs/TRIP-PLAN-V1.md) 为目标。规范 JSON Schema 为兼容 V1 继续使用文件名 [`schemas/trip-spec.v1.schema.json`](schemas/trip-spec.v1.schema.json)，较小的虚构示例位于 [`examples/lakes-and-pines.trip.json`](examples/lakes-and-pines.trip.json)。

```bash
npm run check:tripplan
npm test
```

Trip Builder regenerates inline route geometry before Trip Preview. The optional build script can regenerate the external route file used by the committed long-distance demo. Trip Builder 会在 Trip Preview 前重新生成内联路线；可选构建脚本可重新生成已提交长途示例使用的外部路线文件。

```bash
npm run build:routes
```

The browser adapter uses public FOSSGIS car, bicycle, and foot OSRM services with a one-request-per-second queue. The script uses the public Project OSRM demo endpoint. Use public services sparingly; production deployments should use a suitable provider or self-hosted routing stack.

浏览器适配器使用 FOSSGIS 公共汽车、骑行和步行 OSRM 服务，并将请求限制为每秒一次；脚本使用 Project OSRM 公共演示接口。请节制使用公共服务，生产部署应选择合适的供应商或自托管路线服务。

## Privacy / 隐私

Never commit reservation numbers, confirmation pages, payment details, personal email addresses, or live location history. See [PRIVACY.md](PRIVACY.md).

切勿提交预订编号、确认页面、付款信息、个人邮箱或实时位置历史。详见 [PRIVACY.md](PRIVACY.md)。

## Project Structure / 项目结构

```text
road-trip/
├── docs/STUDIO.md
├── docs/TRIP-PLAN-V1.md
├── examples/*.trip.json
├── schemas/trip-spec.v1.schema.json
├── data/cross-canada.trip.json
├── data/road-routes.json
├── index.html                 # Default redirect / 默认入口跳转
├── studio.html                # Trip Builder
├── traveler.html              # Traveler
├── src/studio-core.mjs
├── src/studio-app.mjs
├── src/trip-spec.mjs
├── src/traveler-app.mjs
├── scripts/build-road-routes.mjs
├── tests/*.test.mjs
├── vendor/leaflet/
└── .github/
```

`src/trip-spec.mjs` is the shared TripPlan runtime used by Trip Builder, Traveler, validators, tests, and the route builder. Its filename remains stable for V1 compatibility. TripPlan supports inline `generated.routeData` and legacy external `generated.routeDataFile`. Missing, stale, or mismatched geometry falls back visibly to straight anchor lines.

`src/trip-spec.mjs` 是 Trip Builder、Traveler、校验器、测试和路线构建器共同使用的 TripPlan 运行时。为保持 V1 兼容性，其文件名保持不变。TripPlan 同时支持内联 `generated.routeData` 和旧版外部 `generated.routeDataFile`；当路线缺失、过期或不匹配时，界面会明确回退为锚点直线。

## Contributing / 参与贡献

Bug reports, accessibility improvements, map reliability work, and itinerary-data separation are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

欢迎提交错误报告、无障碍改进、地图可靠性优化以及行程数据分离工作。创建 Pull Request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License / 许可证

Road Trip is available under the [MIT License](LICENSE). Leaflet uses its own BSD-2-Clause license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Road Trip 采用 [MIT License](LICENSE)。Leaflet 使用独立的 BSD-2-Clause 许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
