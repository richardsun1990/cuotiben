# 嘟嘟错题本飞牛部署说明

这个版本保留原来的浏览器本地存储，同时新增一个飞牛同步后端。部署后，手机、iPad、电脑访问同一个飞牛地址，就能同步同一套数学错题、英语单词和学习记录。

同时，数学错题页新增 AI 错题讲解。网站默认通过飞牛后端的 `/api/ai/explain` 调用本机 Ollama，避免浏览器直接访问 Ollama 时遇到跨域问题。

## 为什么建议在飞牛上同时托管网页

如果网页继续放在 GitHub Pages：

```text
https://richardsun1990.github.io/cuotiben/
```

浏览器通常会阻止它请求家里局域网里的：

```text
http://飞牛IP:8787
```

这是 HTTPS 页面访问 HTTP 接口的 mixed content 限制。所以家庭自用最稳的方式是：

```text
http://飞牛IP:8787
```

让飞牛同时提供网页和同步 API。

## 回家后一口气部署

1. 在电脑上确认飞牛局域网 IP，例如 `192.168.3.100`。

2. 用 SSH 登录飞牛：

```bash
ssh richard@192.168.3.100
```

3. 准备目录并拉代码：

```bash
mkdir -p ~/docker
cd ~/docker
git clone https://github.com/richardsun1990/cuotiben.git dudu-cuotuiben
cd dudu-cuotuiben
git checkout agent/feiniu-sync
```

如果之前已经拉过：

```bash
cd ~/docker/dudu-cuotuiben
git fetch origin
git checkout agent/feiniu-sync
git pull
```

4. 设置同步口令。建议改成你自己的长一点的口令。如果 Ollama 就安装在这台飞牛机器上，`OLLAMA_URL` 通常保持默认即可：

```bash
cat > .env <<'EOF'
DUDU_SYNC_TOKEN=改成你自己的同步口令
OLLAMA_URL=http://127.0.0.1:11434
DUDU_AI_MODEL=qwen3:1.7b
EOF
```

5. 启动：

```bash
docker compose up -d --build
```

6. 检查服务：

```bash
docker compose ps
curl http://127.0.0.1:8787/health
```

7. 在家里浏览器打开：

```text
http://飞牛IP:8787
```

例如：

```text
http://192.168.3.100:8787
```

## 第一次同步顺序

第一台有完整错题数据的设备：

1. 打开 `http://飞牛IP:8787`
2. 点右上角头像/昵称
3. 找到“飞牛同步”
4. 同步地址可以留空，或者填 `http://飞牛IP:8787`
5. 填同步口令
6. 勾选“启用同步”
7. 点“保存设置”
8. 点“测试连接”
9. 点“同步到飞牛”

第二台设备：

1. 打开同一个地址
2. 进入“飞牛同步”
3. 填同样的同步口令
4. 勾选“启用同步”
5. 点“从飞牛拉取”

之后开启“打开时自动拉取”和“修改后自动同步”，日常使用就会自动同步。

## AI 错题讲解

1. 确认飞牛上 Ollama 已经运行：

```bash
curl http://127.0.0.1:11434/api/tags
```

2. 确认模型已经拉取：

```bash
ollama pull qwen3:1.7b
```

3. 重新构建并启动错题本：

```bash
docker compose up -d --build
```

4. 打开数学错题页，顶部会看到“AI讲解”。每道错题卡片里也会有“AI讲解”按钮。

如果 AI 讲解失败，先看日志：

```bash
docker compose logs -f
```

当前 Docker Compose 使用飞牛的宿主机网络，容器通过 `127.0.0.1:11434` 直接访问 Ollama，避免 `host.docker.internal` 被 Clash fake-ip DNS 解析到 `198.18.x.x`。如果 Ollama 安装在另一台设备上，再把 `.env` 里的 `OLLAMA_URL` 改成那台设备的局域网地址，例如：

```text
OLLAMA_URL=http://192.168.3.110:11434
```

## 常用维护命令

查看日志：

```bash
docker compose logs -f
```

重启：

```bash
docker compose restart
```

停止：

```bash
docker compose down
```

同步数据保存在仓库目录的：

```text
data/sync.json
```

这个文件建议定期备份。
