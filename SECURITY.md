# Security Policy / 安全政策

Please report security or privacy issues through a private GitHub security advisory. Do not include personal trip records in a public issue.

请通过 GitHub 私密 Security Advisory 报告安全或隐私问题。不要在公开 Issue 中包含个人旅行记录。

Road Trip is a static client-side application. Treat map tiles, routing services, geolocation, shared navigation links, model APIs, and future data integrations as external trust boundaries.

Road Trip 是静态客户端应用。地图瓦片、路线服务、设备定位、共享导航链接、模型 API 以及未来的数据集成都应视为外部信任边界。

API tokens must remain user-supplied and ephemeral. Never commit tokens, put them in a TripPlan, or persist them in browser storage.

API Token 必须由用户提供并保持临时状态。切勿提交 Token、把它写入 TripPlan，或将其持久化到浏览器存储。
