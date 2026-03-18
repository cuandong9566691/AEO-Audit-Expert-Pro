document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith('chrome://')) return;

    const runAudit = () => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const badWords = ["登录", "广告", "个性化", "推荐服务", "注册", "权限", "Cookie"];
                const isBad = (t) => badWords.some(w => t.includes(w));

                // 深度提取函数
                const getBestText = (txt) => {
                    if (!txt || isBad(txt)) return null;
                    let c = txt.trim().replace(/\s+/g, ' ');
                    if (c.length < 30) return null;
                    let end = c.indexOf('。', 80);
                    return end !== -1 ? c.substring(0, end + 1) : c.substring(0, 100) + "...";
                };

                // 1. 尝试从不同层级获取正文
                const container = document.querySelector('article') || document.querySelector('main') || document.body;
                let paragraphs = Array.from(container.querySelectorAll('p, div'))
                                     .map(p => p.innerText.trim())
                                     .filter(t => t.length > 40 && !isBad(t));

                // 2. 如果正文被锁，尝试抓取 Meta 描述作为保底
                const metaDesc = document.querySelector('meta[name="description"]')?.content;
                const pageTitle = document.title;

                let sections = [];
                if (paragraphs.length >= 2) {
                    sections = paragraphs.slice(0, 3).map((p, i) => ({
                        t: `核心解析 ${i+1}`,
                        c: getBestText(p)
                    })).filter(s => s.c !== null);
                }

                // 3. 保底逻辑：如果实在没内容，强行用 Meta 信息填补，显得专业
                if (sections.length === 0 && metaDesc) {
                    sections.push({ t: "页面主旨", c: getBestText(metaDesc) || metaDesc });
                    sections.push({ t: "站点标题", c: pageTitle });
                }

                return {
                    chars: document.body.innerText.length,
                    hasSchema: document.querySelectorAll('script[type="application/ld+json"]').length > 0,
                    hasData: /[\d.%]{2,}/.test(document.body.innerText),
                    sections: sections,
                    // 判断是否真的被锁（没正文但有登录字样）
                    isLocked: paragraphs.length < 2 && document.body.innerText.includes("登录")
                };
            }
        }, (results) => {
            if (!results || !results[0].result) return;
            const res = results[0].result;
            
            // 评分逻辑
            let score = res.isLocked ? 40 : 55;
            if (res.hasSchema) score += 30;
            if (res.hasData) score += 15;
            score = Math.min(score, 100);

            let rank, color, speed;
            if (score >= 90) { rank = "极高💎"; color = "#2ecc71"; speed = 300; }
            else if (score >= 70) { rank = "优秀⭐"; color = "#3498db"; speed = 450; }
            else if (score >= 60) { rank = "普通"; color = "#f1c40f"; speed = 650; }
            else { rank = "差"; color = "#95a5a6"; speed = 900; }

            document.getElementById('score').innerText = score;
            document.getElementById('score').style.color = color;
            document.getElementById('quality-rank').innerText = rank;
            document.getElementById('quality-rank').style.color = color;
            document.getElementById('read-time').innerText = `${Math.round((res.chars / speed) * 60) || 10} 秒`;

            // 警告框控制
            const warnBox = document.getElementById('warning-box');
            warnBox.style.display = res.isLocked ? 'block' : 'none';

            const outline = document.getElementById('content-outline');
            if (res.sections && res.sections.length > 0) {
                outline.innerHTML = res.sections.map(s => 
                    `<div class="item-box"><strong>📍 ${s.t}</strong><br><span style="color:#555;">${s.c}</span></div>`
                ).join('');
            } else {
                outline.innerHTML = `<div style="text-align:center; padding:20px; color:#999; font-size:12px;">
                    此页面内容受限<br>请登录后重新审计</div>`;
            }
        });
    };

    runAudit();

    document.getElementById('vip-scan').addEventListener('click', () => {
        alert("💎 VIP 深度审计功能：\n\n1. 自动识别并绕过登录墙内容提取\n2. 针对 AEO 的 JSON-LD 修复建议\n3. 导出包含 SEO 建议的专业报告\n\n正在内测中，敬请期待！");
    });
});