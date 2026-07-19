# TripPlan V1 / TripPlan V1 规范

TripPlan is the portable source of truth for a Road Trip plan. Trip Builder writes it, the planner enriches it, and Traveler renders it. Existing `trip-spec` module and schema filenames remain stable implementation identifiers for V1 compatibility.

TripPlan 是 Road Trip 计划的可移植事实来源。Trip Builder 负责写入，规划器负责补充，Traveler 负责呈现。为保持 V1 兼容性，现有 `trip-spec` 模块和 Schema 文件名继续作为稳定的实现标识。

## Design goals / 设计目标

- Friendly to visual editors, AI assistants, and hand-authored files / 适合可视化编辑器、AI 助手和手工编写文件
- Provider-neutral place, route, lodging, and activity data / 地点、路线、住宿和活动数据不绑定服务商
- Stable enough to archive after a trip / 足够稳定，可在旅行结束后长期归档
- Explicit distinction between required route anchors and optional stops / 明确区分必经路线锚点与可选停靠
- No reservation identifiers, payment data, API keys, or live location history / 不包含预订标识、付款数据、API Key 或实时位置历史
- No expiring weather, wildfire, air-quality, or road-closure snapshots / 不包含会过期的天气、山火、空气质量或封路快照

## Data boundaries / 数据边界

TripPlan contains durable travel facts. TripPlan 包含长期有效的旅行事实：

- Trip dates and endpoints / 行程日期与端点
- Traveler and transport constraints / 旅行者与交通约束
- Driving, lodging, route, and activity preferences / 驾驶、住宿、路线和活动偏好
- Places, addresses, and coordinates / 地点、地址与坐标
- Daily route anchors, optional stops, activities, and overnight stays / 每日路线锚点、可选停靠、活动和过夜安排
- Rebuildable route metadata / 可重建的路线元数据

Temporary operational information belongs in separate runtime sources. 临时运行信息应放在独立数据源中：

```text
tripplan.json           Durable TripPlan / 长期 TripPlan
generated.routeData     Rebuildable route geometry and steps / 可重建路线与步骤
generated/routes.json   Optional legacy external geometry / 可选旧版外部路线
runtime/alerts.json     Expiring weather, wildfire, and closure data / 临时预警
private/local.json      Private booking details; never committed / 私人预订信息，禁止提交
```

Traveler may merge these sources in memory, but it must remain usable when runtime and private files are absent.

Traveler 可以在内存中合并这些数据源，但在缺少运行时或私人文件时仍必须可用。

The browser Traveler can select any same-origin TripPlan with `?trip=path/to/tripplan.json`; legacy `*.trip.json` files remain supported. Trip Builder normally embeds regenerated geometry in `generated.routeData`; `generated.routeDataFile` remains available for larger prebuilt trips. When route data is absent, stale, unavailable, or belongs to another `trip.id`, Traveler keeps working with straight anchor lines and shows a route-data notice.

浏览器版 Traveler 可通过 `?trip=path/to/tripplan.json` 选择任意同源 TripPlan；旧版 `*.trip.json` 仍受支持。Trip Builder 通常把重建后的路线嵌入 `generated.routeData`，较大的预生成行程仍可使用 `generated.routeDataFile`。当路线数据缺失、过期、不可用或属于其他 `trip.id` 时，Traveler 会用锚点直线继续工作并显示提示。

## Route semantics / 路线语义

`anchorPlaceIds` changes the traveled route. Use it only for: `anchorPlaceIds` 会改变实际路线，只应用于：

- Daily origin and destination / 每日出发地与目的地
- Required charging or fuel stops / 必需的充电或加油点
- Ferry terminals / 轮渡码头
- A place the traveler explicitly requires the route to pass through / 旅行者明确要求经过的地点

`optionalStopPlaceIds` and `activities` appear on the map and cards without forcing a detour. A planner may suggest a detour after comparing its cost, but it must not silently promote an optional stop to an anchor.

`optionalStopPlaceIds` 与 `activities` 会显示在地图和卡片中，但不会强制绕路。规划器可在比较绕路成本后提出建议，但不能静默把可选停靠升级为锚点。

A ferry crossing is represented by two consecutive `ferry-terminal` anchors. Traveler draws that pair as a ferry leg; the road-route generator ends the road segment at the first terminal and resumes at the second.

轮渡由两个连续的 `ferry-terminal` 锚点表示。Traveler 将该对绘制为轮渡段；道路路线生成器在第一个码头结束道路段，并从第二个码头继续。

`generated.routeData` records the transport mode, route fingerprint, encoded polyline6 geometry, provider distance and duration, and normalized turn-by-turn steps grouped by `dayId`. Car-class modes use a road graph. Bicycle and walking modes use dedicated OpenStreetMap graphs that snap anchors to routable cycling or walking ways, including mapped trails where permitted. Airplane mode has no surface-route segments and is rendered point-to-point. Failed pairs remain in `unroutedSegments` with their mode and endpoint IDs so Traveler can display a dashed fallback and an explicit coordinate or GPX warning.

`generated.routeData` 记录交通方式、路线指纹、polyline6 编码路线、服务商距离与时长，以及按 `dayId` 分组的标准化逐向步骤。汽车类方式使用道路图；自行车和步行使用专用 OpenStreetMap 路网，将锚点吸附到可通行的骑行或步行道路，包括允许通行的已映射步道。飞机方式没有地面路线段，按点到点呈现。失败的端点对会连同方式和端点 ID 保留在 `unroutedSegments` 中，使 Traveler 能以虚线回退并明确提示需要坐标或 GPX 校正。

Two consecutive anchors whose places both use `kind: "airport"` always form an automatic flight leg, even when the primary `vehicle.mode` is a ground mode. That pair is never sent to a surface router; Traveler draws a direct airport-to-airport line. Ground legs before departure or after arrival remain independently routable.

当两个连续锚点的地点都使用 `kind: "airport"` 时，无论主要 `vehicle.mode` 是否为地面方式，都自动构成飞行段。该端点对永远不会发送到地面路线服务；Traveler 会绘制机场到机场的直线。出发前与抵达后的地面路段仍独立计算。

Feasibility checks never interpret flight duration as driving time. On mixed flight days, driving limits apply only to generated surface-route segments. `preferences.lodging.hotelEveryDays` is optional and should exist only when the traveler explicitly requests recurring hotel cadence.

可行性检查绝不会把飞行时间解释为驾驶时间。在混合飞行日中，驾驶上限只作用于已生成的地面路线段。`preferences.lodging.hotelEveryDays` 是可选字段，只有旅行者明确要求定期入住酒店时才应设置。

Route mode may change within a day. When both ends of an anchor pair are backcountry trail places (`kind: "trailhead"`, `tag: "backcountry-access"`, or `tag: "backcountry-campground"`), the route engine uses the walking or trail graph for that pair. Adjacent hotel-to-trailhead transfers keep the primary road mode. Every generated segment records its own `mode`.

同一天内路线方式可以变化。当一对锚点的两端都是偏远步道地点（`kind: "trailhead"`、`tag: "backcountry-access"` 或 `tag: "backcountry-campground"`）时，路线引擎会对该段使用步行或步道路网。相邻的酒店到登山口接驳仍采用主要道路方式。每个生成路段都记录自己的 `mode`。

## Privacy / 隐私

TripPlan may include the selected lodging name, address, and useful amenities. It must not include reservation numbers, confirmation links, contact details, payment records, API tokens, or precise device-location history.

TripPlan 可以包含所选住宿的名称、地址和实用设施，但不得包含预订编号、确认链接、联系方式、付款记录、API Token 或精确设备位置历史。

## Versioning / 版本管理

V1 files use `"schemaVersion": "1.0"`. Minor additions must remain backward-compatible. Breaking field changes require a new major schema and a migration tool.

V1 文件使用 `"schemaVersion": "1.0"`。小幅新增必须保持向后兼容；破坏性字段变更需要新的主版本 Schema 与迁移工具。

The normative schema is [`schemas/trip-spec.v1.schema.json`](../schemas/trip-spec.v1.schema.json). A fictional complete example is available at [`examples/lakes-and-pines.trip.json`](../examples/lakes-and-pines.trip.json).

规范 Schema 位于 [`schemas/trip-spec.v1.schema.json`](../schemas/trip-spec.v1.schema.json)，完整虚构示例位于 [`examples/lakes-and-pines.trip.json`](../examples/lakes-and-pines.trip.json)。

The historical `vehicle` field now describes the primary transport mode and retains its name for V1 compatibility. Its `mode` may be `car`, `campervan`, `rv`, `motorcycle`, `airplane`, `bicycle`, or `walking`. `fuelType` also supports `aviation` and `human`. Mode-specific route providers can enrich the same durable day and place structure.

历史字段 `vehicle` 现在描述主要交通方式，并为保持 V1 兼容性继续沿用该名称。其 `mode` 可为 `car`、`campervan`、`rv`、`motorcycle`、`airplane`、`bicycle` 或 `walking`；`fuelType` 还支持 `aviation` 与 `human`。不同方式的路线服务商可扩充同一套长期有效的每日与地点结构。
