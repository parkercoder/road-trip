# Privacy Guidelines / 隐私指南

Road-trip itineraries can expose sensitive information even when the application has no accounts or server-side storage.

即使应用没有账户系统或服务端存储，自驾行程仍可能暴露敏感信息。

## Do not commit or publish / 请勿提交或公开

- Reservation, booking, order, invoice, or itinerary numbers / 预订、订单、发票或行程编号
- Confirmation letters, screenshots, PDFs, or guest-portal links / 确认函、截图、PDF 或住客门户链接
- Names, personal email addresses, phone numbers, or payment details / 姓名、个人邮箱、电话号码或付款信息
- Exact live or historical device-location logs / 精确的实时或历史设备位置记录
- Private API keys or access tokens / 私有 API Key 或访问 Token
- Future home-away dates tied to an identifiable person / 与可识别个人相关联的未来离家日期

Public examples should use completed trips, fictional data, or coarse locations. Review every file, including images and generated exports, before publishing.

公开示例应使用已经结束的旅行、虚构数据或模糊位置。发布前应检查所有文件，包括图片与自动生成的导出文件。

## Local autosave / 本地自动保存

Trip Builder autosaves the current draft to browser local storage. It does not upload the draft to a project-owned server. Anyone with access to the same browser profile may be able to open it, so use **保存 Plan** for deliberate backups and clear or replace the draft on shared devices.

Trip Builder 会把当前草稿自动保存到浏览器本地存储，不会上传到项目自有服务器。能够访问同一浏览器配置的人可能也能打开该草稿，因此请使用 **保存 Plan** 进行有意识的备份，并在共享设备上清除或替换草稿。

## AI planner / AI 规划器

The optional AI planner uses a user-supplied model endpoint, model ID, and API token. The token remains in the page's password input and is never added to local storage or TripPlan. The travel brief and follow-up answers are sent directly to the selected provider, whose retention and privacy policies apply. Do not include booking confirmations, payment data, API keys, or unnecessary personal identifiers in the brief.

可选 AI 规划器使用用户提供的模型接口、模型 ID 和 API Token。Token 只存在于页面密码输入框中，不会写入本地存储或 TripPlan。旅行描述和追问答案会直接发送给所选服务商，并受其数据保留与隐私政策约束。请勿在描述中加入预订确认、付款信息、API Key 或不必要的个人标识。

## Routing providers / 路线服务商

When Trip Builder generates an actual route, it sends ordered route-anchor coordinates—but not the AI token or private booking fields—to the configured routing provider. That provider's logging, retention, and acceptable-use policies apply. Self-host or replace the provider adapter when public routing requests are unsuitable.

Trip Builder 生成实际路线时，会把有序路线锚点坐标发送给所配置的路线服务商，但不会发送 AI Token 或私人预订字段。服务商自身的日志、数据保留和使用政策仍然适用。如果不适合使用公共路线请求，请自托管服务或替换 provider adapter。

## Device location / 设备位置

Device geolocation is requested only after the user presses the location control. The static application does not transmit that position to a project-owned server, but map providers and external navigation links have their own privacy policies.

只有用户按下定位控件后，应用才会请求设备位置。静态应用不会把位置发送到项目自有服务器，但地图服务商与外部导航链接仍受各自隐私政策约束。
