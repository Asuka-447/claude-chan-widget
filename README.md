# Claude 娘 · 额度桌宠

住在 Claude Desktop 窗口里的 Q 版 Claude 娘：头顶气泡显示你的 **5 小时额度、重置倒计时和本周额度**，还会跟着 Claude 的工作状态说话、做小动作。

粉丝自制，与 Anthropic 无关。目前只支持 **Windows**。

## 她会做什么

- **额度气泡**：5 小时窗口已用百分比（数字滚动）、重置倒计时、本周已用；过半变黄，超过 80% 变红。
- **跟着 Claude 干活**：思考、读文件、写文件、跑命令、上网、找帮手、等你确认、出错、做完、被打断，各有台词和小动作；回复完成时叮一声、撒小花。
- **只待在 Claude 窗口里**：盖在 Claude 上面，切到别的程序时跟着 Claude 退到后面，最小化时一起消失；移动、缩放 Claude 窗口时她跟着走。
- **拖动**：按住拖，拖动时气泡收起；靠近窗口边缘放手会贴边，在左半边会转身。
- **戳她**：压扁再弹起，叽叽叽或 duang duang。
- **点气泡**：出一张 Claude 娘表情包，再点一下或等几秒变回额度。
- **透明区域可以点穿**，不挡 Claude 的按钮。
- **设置面板**（右键 → 设置…）：声音、台词、表情包、工作状态台词、气泡内容和颜色、大小、开机自启。

## 安装

需要两样东西：**Claude 里的插件**（负责读出额度和工作状态）和**桌宠程序**（负责把 Claude 娘画出来）。

### 1. 装插件

在 Claude Desktop 里：点输入框旁边的 **+** → **插件** → **添加插件市场**，填 `Asuka-447/claude-chan-widget`，然后添加 **usage-bubble**。

或者在终端里的 Claude Code 会话中输入：

```
/plugin install usage-bubble --marketplace Asuka-447/claude-chan-widget
```

在命令行里：

```bash
claude plugin install usage-bubble --marketplace Asuka-447/claude-chan-widget
```

插件本身不显示任何东西，只负责把额度和工作状态交给 Claude 娘。装好以后在 Claude 里发一条消息，她的气泡里就有数字了。

### 2. 运行桌宠

需要 [Node.js](https://nodejs.org/) 18 或更新版本。

```bash
git clone https://github.com/Asuka-447/claude-chan-widget.git
```

```bash
cd claude-chan-widget
```

```bash
npm install
```

如果 npm 提示 `electron` 或 `koffi` 的安装脚本需要批准，再运行：

```bash
npm install-scripts approve electron koffi
```

然后双击 **`启动 Claude 娘.cmd`**，或者：

```bash
npm start
```

想开机自动启动：右键她 → 设置… → 角色 → 开机自动启动。

## 工作原理

- `plugin/`：Claude 插件。每次 Claude 回复时把额度写进 `~/.claude/claude-chan/usage.json`；每次发消息、调用工具、回复结束时把当前状态写进 `status.json`。只写这两个文件，不联网，不需要任何登录信息。
- `main.js`：Electron 主程序。读这两个文件，把 Claude 娘的窗口挂在 Claude 窗口上（用 [koffi](https://koffi.dev/) 调 Windows 接口），透明区域点穿。
- `tools/follow.ps1`：每 0.25 秒找一次 Claude 窗口的位置。
- `widget.js` / `widget.css`：Claude 娘和气泡。
- `settings-page.js`：设置面板。设置存在 `~/.claude/claude-chan/settings.json`。

## 换成你自己的立绘

把透明背景的 PNG 换掉 `assets/claude-chan.png` 就行。宽高比例接近 476×567 效果最好。

## 素材来源

立绘作者 **JerryZRic**（[来源](https://github.com/TreapGoGo/deepseek-whale-girl/issues/36)）；表情包来自 [克劳德大小姐 · Claude-girl](https://github.com/wangxianda941030/Claude-girl)（CC BY-NC 4.0，不得商用）。详见 [CREDITS.md](CREDITS.md)。

## 许可

代码：MIT（见 [LICENSE](LICENSE)）。图片素材不在 MIT 范围内，见 [CREDITS.md](CREDITS.md)。
