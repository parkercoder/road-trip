# Contributing / 参与贡献

Thank you for helping improve Road Trip. 感谢你帮助改进 Road Trip。

## Before You Start / 开始之前

1. Check existing issues before opening a new one. / 创建新 Issue 前先检查已有 Issue。
2. Keep changes focused and mobile-first. / 保持改动聚焦，并坚持移动优先。
3. Do not include personal trip records, booking confirmations, API keys, or live location history. / 不要包含个人旅行记录、预订确认、API Key 或实时位置历史。
4. Preserve attribution for map and routing data. / 保留地图与路线数据的署名信息。

## Local Development / 本地开发

```bash
python3 -m http.server 8766
```

Open `http://localhost:8766` and test at phone widths down to 320 px.

打开 `http://localhost:8766`，并测试低至 320 px 的手机屏幕宽度。

Run the shared TripPlan and Trip Builder workflow checks. 运行 TripPlan 与 Trip Builder 的共享工作流检查：

```bash
npm test
npm run check:tripplan
npm run check:privacy
```

## Pull Requests / Pull Request 要求

- Explain the user-facing problem and the chosen solution. / 说明用户遇到的问题以及所采用的解决方案。
- Include before-and-after screenshots for visual changes. / 视觉改动应附修改前后的截图。
- Verify map drag, pinch zoom, marker popups, drawer gestures, and the full-route control. / 验证地图拖动、双指缩放、标记弹窗、抽屉手势和完整路线控件。
- Verify Trip Builder autosave, Plan import/save, map coordinate picking, and draft handoff to Traveler. / 验证 Trip Builder 自动保存、Plan 导入与保存、地图取点，以及草稿交接给 Traveler 的流程。
- Test both light and dark system themes. / 测试系统浅色与深色主题。
- Keep optional attractions out of route anchors. / 不要把可选景点加入路线锚点。
- Update both English and Chinese documentation when behavior or configuration changes. / 行为或配置变化时，同时更新中英文文档。

## Commit Style / 提交风格

Use short, imperative commit messages. 使用简短、祈使语气的提交信息，例如：

```text
Improve tile fallback recovery
Move trip data into JSON
Fix drawer gesture on iOS
```
