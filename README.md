# 个人主页 & 博客说明

这是禹慧俊的个人主页项目，包含：

- `index.html`：主页（关于、技能、项目、访问信息、评论区）
- `blog.html`：博客页（学习笔记、想法）
- `styles.css`：全站样式
- `script.js`：导航按钮、年份等基础交互
- `个人照片.jpg`：主页头像图片

---

## 一、本地预览项目

在终端中进入项目文件夹：

```bash
cd "/Users/macbook1/Desktop/learning/AI工具"
```

启动本地静态服务器：

```bash
python3 -m http.server 8000
```

在浏览器中访问：

- 主页：`http://localhost:8000/index.html`
- 博客：`http://localhost:8000/blog.html`

停止服务：在终端按 `Ctrl + C`。

也可以直接双击 `index.html` / `blog.html` 用浏览器打开（不过本地服务器更接近线上环境）。

---

## 二、如何给博客页面添加内容

博客内容目前直接写在 `blog.html` 里，使用的是卡片布局。每一篇“文章概要”是一个类似这样的结构：

```html
<article class="card project-card">
  <h3>标题（例如：2026-03-16 · NLP 学习笔记）</h3>
  <p>简单几句话总结这篇内容：学了什么、有什么收获、遇到了什么问题。</p>
</article>
```

### 1. 在博客列表中新增一条记录

1. 打开 `blog.html`。
2. 找到博客主体区域（`<section id="blog">` 内部），里面有一段：

   ```html
   <div class="projects-grid">
     <!-- 多个 <article class="card project-card"> ... -->
   </div>
   ```

3. 在 `projects-grid` 里面复制一份已有的 `<article class="card project-card"> ... </article>`，然后修改：
   - `h3`：改成新文章标题（建议带日期）
   - `p`：写一小段概要介绍

保存后，本地刷新页面就能看到新的卡片。

### 2. 如果想给每篇文章一个独立页面

可以为某一篇文章单独建一个 HTML 文件，例如：

1. 新建 `blog-nlp-notes-2026-03-16.html`，内容可以复制 `blog.html` 的整体结构，只保留一个主内容区域，然后写详细笔记。
2. 在 `blog.html` 这一条文章卡片里，加上一个“阅读全文”的链接：

```html
<article class="card project-card">
  <h3>2026-03-16 · NLP 学习笔记</h3>
  <p>今天主要复习了 Transformer 结构，并尝试实现一个简单的注意力机制。</p>
  <a href="blog-nlp-notes-2026-03-16.html" target="_blank">阅读全文</a>
</article>
```

这样博客页是一个“索引”，每篇文章可以有单独的详情页。

---

## 三、修改主页内容

主页内容主要在 `index.html`：

- 头像：`<img src="个人照片.jpg" alt="..." class="avatar-image" />`
- 自我介绍：Hero 区里的文字（姓名、学校、专业、介绍）
- 技能：`技能` 区域里的列表 `<ul>...</ul>`
- 项目：`项目` 区域的多张 `card`
- 访问信息、评论区：已经预留了 DOM 容器，之后可以接第三方服务（如 Umami / Cloudflare / giscus 等）

修改完后保存，再在浏览器中刷新即可。

---

## 四、推送到 GitHub Pages 更新线上版本

每次在本地修改完文件后，在项目根目录执行：

```bash
cd "/Users/macbook1/Desktop/learning/AI工具"
git add .
git commit -m "update site"
git push
```

等待 GitHub Pages 部署完成（通常 1～3 分钟），线上页面就会自动更新。

---

## 五、后续可以扩展的方向（可选）

- 给博客加“按标签/类别”分组（例如 NLP / 运动仿真 / 杂记）。
- 接入评论系统（giscus / utterances），让别人可以在每篇文章下留言。
- 接入访问统计（Umami / Cloudflare Web Analytics），在 `访问信息` 区块显示访问量和世界地图。

如果你想要把“新增一篇博客”的流程做成更自动的模板（例如只填标题、日期、内容就自动生成结构），可以告诉我你偏好的格式，我可以帮你设计一个简单的“写博客步骤模板”。
