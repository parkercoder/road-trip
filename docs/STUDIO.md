# Trip Builder / 行程构建器

Trip Builder is the browser editor for creating a complete TripPlan without writing JSON. It is a static page, requires no account, and saves the current draft in the browser.

Trip Builder 是无需编写 JSON 即可创建完整 TripPlan 的浏览器编辑器。它是静态页面，无需账户，并会把当前草稿保存在浏览器中。

## Plan with your own AI model / 使用自己的 AI 模型规划

1. Describe the trip in natural language. / 用自然语言描述旅行。
2. Choose a model service and a model ID available to your account. / 选择模型服务和账户可用的模型 ID。
3. Enter your API token and confirm the automatically selected endpoint, or choose a custom compatible endpoint. / 输入 API Token，并确认自动选择的接口地址；也可以选择自定义兼容接口。
4. Press **分析需求并规划**. The model may ask up to three critical follow-up questions. / 点击 **分析需求并规划**。模型最多会追问三个关键问题。
5. Trip Builder validates the returned TripPlan, generates mode-specific route geometry and turn-by-turn steps, recalculates distance and duration through the routing provider, and runs deterministic feasibility rules. / Trip Builder 会校验返回的 TripPlan，生成与出行方式对应的路线和逐向指引，通过路线服务重新计算距离与时长，并执行确定性可行性规则。

The model interprets intent and proposes a TripPlan. It is not the source of truth for road time, EV range, route continuity, or lodging cadence. Blocking findings remain visible beside the map and can be corrected in the manual editor.

模型负责理解意图并提出 TripPlan，但不是道路时间、电动车续航、路线连续性或住宿频率的事实来源。阻断问题会显示在地图旁，并可在手动编辑器中修正。

The API token exists only in the password field for the lifetime of the page. It is not placed in local storage, TripPlan, logs, or saved files. A public static build is intended for personal BYOK use. A shared or production deployment should put model calls behind a controlled backend proxy.

API Token 仅在页面生命周期内存在于密码输入框，不会写入本地存储、TripPlan、日志或保存文件。公开静态版本适合个人 BYOK 使用；共享或生产部署应通过受控后端代理调用模型。

The model-service selector configures the matching endpoint and provides curated model IDs for OpenAI, Anthropic Claude, Google Gemini, DeepSeek, xAI, Mistral AI, and OpenRouter. Every provider also allows a custom model ID because account availability and catalogs change independently. Curated IDs were checked against provider documentation on 2026-07-19; the user's provider account remains the final authority.

模型服务选择器会配置对应接口，并提供 OpenAI、Anthropic Claude、Google Gemini、DeepSeek、xAI、Mistral AI 与 OpenRouter 的常用模型 ID。由于不同账户和模型目录会独立变化，每个服务商也允许自定义模型 ID。预设 ID 已于 2026-07-19 对照服务商文档检查；最终可用性仍以用户账户为准。

Models and compatible providers vary in JSON reliability and browser CORS policy. Trip Builder reports provider errors without replacing the current draft.

不同模型与兼容服务商在 JSON 稳定性和浏览器 CORS 政策方面有所差异。Trip Builder 会报告服务错误，但不会覆盖当前草稿。

## Start a new trip / 创建新行程

1. Serve the project over HTTP and open `http://localhost:8765/studio.html`. / 通过 HTTP 提供项目，并打开 `http://localhost:8765/studio.html`。
2. Press **新建** to reset to a valid one-day starter trip. / 点击 **新建**，重置为有效的一日初始行程。
3. Set the trip name, language, timezone, travelers, and transport constraints. Primary modes include car, campervan, RV, motorcycle, airplane, bicycle, and walking. / 设置行程名称、语言、时区、旅行者和交通约束。主要方式包括汽车、露营车、房车、摩托车、飞机、自行车和步行。
4. Rename the starter origin and destination and enter an address. After typing pauses briefly, Trip Builder geocodes it and synchronizes latitude and longitude. Use **地址定位** to retry immediately or **地图取点** to confirm or correct the result. / 重命名初始起点与终点并输入地址。停止输入片刻后，Trip Builder 会进行地理编码并同步经纬度。使用 **地址定位** 可立即重试，使用 **地图取点** 可确认或修正结果。

AI-proposed coordinates are marked as unverified. Editing an address marks previous coordinates as stale until geocoding succeeds or the user confirms a map position. A failed lookup never silently overwrites old coordinates; it creates a visible feasibility finding.

AI 提议的坐标会标记为未经验证。修改地址后，旧坐标会被标记为过期，直到地理编码成功或用户在地图上确认位置。查询失败不会静默覆盖旧坐标，而是产生可见的可行性问题。

`每隔几天住酒店` is an optional hotel-cadence constraint, not a lodging-coverage field. Leave it blank for a planned camping block; explicit campground stays remain valid accommodation. Consecutive non-hotel nights are reported as one grouped reminder.

`每隔几天住酒店` 是可选的酒店频率约束，并不表示住宿是否完整。计划连续露营时可留空；明确设置的营地仍是有效住宿。连续非酒店夜晚会合并为一条提醒。

The status badge and validation panel update after every edit. Invalid drafts are autosaved, but preview and save remain disabled until required references and coordinates are valid.

状态徽章与校验面板会在每次编辑后更新。无效草稿仍会自动保存，但在必要引用和坐标有效之前，预览和保存功能将保持禁用。

## Build the route / 构建路线

Create every durable place before assembling the daily plan. Useful place kinds include: 在编排每日计划前先创建所有长期有效的地点，常用类型包括：

- `charging` or `fuel` for required energy stops / `charging` 或 `fuel`：必需的能源补给点
- `ferry-terminal` for each side of a ferry crossing / `ferry-terminal`：轮渡两岸的码头
- `campground`, `hotel`, or `home` for overnight stays / `campground`、`hotel` 或 `home`：过夜地点
- `airport` for flight endpoints / `airport`：航班端点
- `attraction`, `trailhead`, and `lookout` for optional activities / `attraction`、`trailhead` 与 `lookout`：可选活动

For each day / 每一天：

1. Choose the origin and destination. / 选择起点和终点。
2. Add required stops with **＋ 必经点** and keep them in travel order. / 使用 **＋ 必经点** 添加必要停靠，并按移动顺序排列。
3. Represent a ferry with two consecutive `ferry-terminal` places. / 使用两个连续的 `ferry-terminal` 地点表示轮渡。
4. Add sightseeing with **＋ 活动**. Activities appear on the map and cards but do not change the main route. / 使用 **＋ 活动** 添加观光项目。活动会显示在地图与卡片上，但不会改变主路线。
5. Set the stay, optional distance and travel time, and notes. / 设置住宿、可选距离与移动时间，以及备注。

Additional days begin at the previous day's destination. Trip start, end, origin, and destination metadata are synchronized automatically.

新增日期默认从前一天终点出发。行程开始与结束日期、起点与终点元数据会自动同步。

## Save, move, and preview / 保存、迁移与预览

- **Autosave / 自动保存：** Every change is saved to browser local storage. / 每次修改都会保存到浏览器本地存储。
- **保存 Plan：** Downloads a validated portable `*.tripplan.json` file. / 校验后下载可移植的 `*.tripplan.json` 文件。
- **导入 Plan：** Validates and replaces the local draft with a selected TripPlan; legacy `*.trip.json` files remain compatible. / 校验所选 TripPlan 并替换本地草稿；旧版 `*.trip.json` 仍然兼容。
- **Trip Preview：** Opens `index.html?draft=1`, where Traveler renders the same local draft. / 打开 `index.html?draft=1`，由 Traveler 呈现同一份本地草稿。
- **Edit from Traveler / 从 Traveler 编辑：** Press the pencil control to return without losing the draft. / 点击铅笔控件返回 Trip Builder，草稿不会丢失。

Before preview, Trip Builder generates rebuildable inline `generated.routeData` when route data is missing or stale. Driving modes follow the OpenStreetMap car graph; bicycle and walking modes use dedicated graphs so endpoints snap to the nearest routable cycling or walking path, including mapped trails where permitted. Airplane trips remain point-to-point.

预览前，如果路线缺失或过期，Trip Builder 会生成可重建的内联 `generated.routeData`。驾驶方式使用 OpenStreetMap 汽车路网；骑行和步行使用各自路网，使端点吸附到最近的可通行自行车道、步行道路或允许通行的已映射步道。飞机行程保持点到点直线。

Two consecutive airport anchors are automatically treated as a flight leg regardless of the primary mode. Trip Builder skips surface routing for that pair and draws a direct line; ground transfers on either side are routed normally.

无论主要出行方式是什么，两个连续机场锚点都会自动视为飞行段。Trip Builder 不会对该段进行地面路线吸附，而是绘制直线；两端的地面接驳仍正常计算。

Backcountry days may mix modes in one anchor list. Hotel-to-trailhead pairs follow the primary road mode, while trailhead-to-backcountry-camp and consecutive backcountry-camp pairs use the walking trail provider. Traveler displays those segment modes separately.

偏远地区的一天可在同一锚点列表中混合多种方式。酒店到登山口采用主要道路方式；登山口到偏远营地以及连续偏远营地之间采用步行步道服务。Traveler 会分别显示这些路线段的方式。

Changing a transport mode, anchor, address, or coordinate invalidates previous route data. The next preview regenerates geometry, metrics, and turn steps. If only some remote pairs fail, `generated.routeData.unroutedSegments` records them and Traveler displays prominent dashed anchor lines with a warning while keeping successful pairs snapped to their provider graph. Legacy `generated.routeDataFile` files remain supported.

修改交通方式、锚点、地址或坐标都会使旧路线失效。下次预览会重新生成路线、指标与逐向步骤。如果只有部分偏远路段失败，`generated.routeData.unroutedSegments` 会记录这些路段；Traveler 以醒目的虚线和警告显示它们，同时保留其他已成功吸附的路段。旧版 `generated.routeDataFile` 仍受支持。

## Privacy and recovery / 隐私与恢复

Local autosave is convenient but is not a durable backup. Save the Plan before clearing browser data or moving to another device. Avoid putting reservation numbers, payment data, contact details, confirmation links, or precise location history into a TripPlan intended for sharing.

本地自动保存很方便，但不是长期备份。清除浏览器数据或更换设备前请保存 Plan。计划分享的 TripPlan 中不要加入预订编号、付款信息、联系方式、确认链接或精确位置历史。

Generating a route sends only ordered anchor coordinates to the selected routing service. Provider retention and acceptable-use policies apply; private booking details and AI tokens are never included in routing requests.

生成路线只会把有序锚点坐标发送给所选路线服务。服务商的数据保留与可接受使用政策仍然适用；私人预订信息和 AI Token 永远不会进入路线请求。
