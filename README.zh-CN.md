<div align="center">

# handremote

**电脑上的窗口，按手机的尺寸打开。**

按类别查看打开的窗口、小组件、托盘图标和服务器；点一下，那个窗口就按手机屏幕的尺寸重新排版后打开。不是缩小的桌面，而是应用按手机尺寸重新绘制，文字不会变小，可以直接点按和输入。

[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · **简体中文**

</div>

## 和远程桌面的区别

| | 远程桌面 | handremote |
|---|---|---|
| 单位 | 整个桌面 | 一个窗口 |
| 尺寸 | 缩小电脑屏幕 | 窗口按手机尺寸重新排版（关闭后恢复原尺寸） |
| 状态 | 只有像素 | 托盘、监听端口、服务器进程以列表显示 |
| 输入 | 触摸映射成鼠标坐标 | 点按 = 单击，长按 = 右键，拖动 = 滚动，输入框可输入任何文字 |

## 快速开始（Windows 10/11）

```sh
npm install -g github:YangJongWon/handremote
handremote
```

用手机相机扫描终端里的二维码（同一 Wi-Fi）。在电脑上打开 **http://localhost:9100/connect** 可以看到大二维码。第一次需要跳过证书警告。

如果电脑已登录 [Tailscale](https://tailscale.com)，还会显示在外也能用的 `https://<电脑名>.<tailnet>.ts.net:9443`，**只有自己 tailnet 里的设备**能连接。刻意不提供公开链接（Funnel）。

## 手机界面

| 类别 | 内容 | 点按后 |
|---|---|---|
| 窗口 | 任务栏上的窗口，含进程、CPU、内存 | 按手机尺寸打开 |
| 小组件 | 置顶窗口、工具窗口等 | 打开（不能调整大小的窗口按屏幕缩放显示） |
| 托盘 | 通知区域图标（包括隐藏的） | 在电脑上点击，并显示打开的菜单或窗口；长按为右键 |
| 网页应用 | 返回网页的 localhost 端口 | 在手机上打开该应用 |
| 服务器 | 监听端口的进程 | 路径、命令行、启动时间 |
| 安全屏幕 | 装有 SYSTEM 助手时的 UAC 提示或锁屏 | 自动打开 |

查看窗口时：**点按** 单击，**长按** 右键，**单指或双指拖动** 滚动，**✥** 拖动模式，下方 **输入框** 可输入任何文字（空着发送为 Enter），辅助键 Esc、Tab、⌫、Del、Enter、方向键、Ctrl/Alt/Shift/Win、Home、End、PgUp、PgDn、F5。**原始尺寸** 会把窗口恢复原样并缩放显示。

窗口尺寸在改变前记录到 `~/.handremote/restore.json`，关闭时、handremote 退出时，或异常退出后的下次启动时恢复。

## SYSTEM 助手（可选）

要在手机上操作管理员窗口、UAC 提示和锁屏，需要安装一次：

```sh
handremote helper install     # 一次 UAC 批准
handremote helper status
handremote helper uninstall   # 删除任务、文件，并还原策略更改
```

结构与 Chrome 远程桌面的主机相同。不开放网络端口，只通过 SYSTEM 和安装用户才能打开的命名管道、以及只有该用户能读取的密钥与 handremote 通信。运行的文件位于只有管理员能修改的 `%ProgramData%\handremote`。通过 handide 的公开链接打开时不使用助手。

> [!IMPORTANT]
> 装有助手时，持有链接的人可以在锁屏输入 PIN。请像密码一样保管链接（`~/.handremote/token`），用 `handremote --new-token` 可使旧链接失效。

## 与 handide 一起使用

与 [handide](https://github.com/YangJongWon/handide) 在同一台电脑上运行时，handide 菜单会出现 **电脑画面**，通过 handide 的地址和令牌打开。

## 支持范围与已知限制

- 目前仅支持 **Windows 10/11**，macOS 以后再做。
- 部分 GPU 绘制的窗口可能截成黑色，这时改为复制屏幕上可见的部分。
- 输入前会把该窗口调到前台。调不到前台或被其他窗口遮住时，**不会输入到别的窗口**，而是在手机上提示。
- `npm run check` 用自己的记事本，在 Pixel 7 和 iPhone 14 模拟下检查列表、手机尺寸排版、韩文输入、点按和尺寸恢复。SYSTEM 助手的 UAC 和锁屏需在真机上另行确认。

## 许可证

[MIT](LICENSE)
