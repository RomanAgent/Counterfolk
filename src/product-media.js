const palettes = {
  hero: { top: '#182035', bottom: '#323b61', accent: '#b8cafd', paper: '#f6f8fc' },
  feature: { top: '#183a38', bottom: '#24534d', accent: '#bff4da', paper: '#f0f8f3' },
  usage: { top: '#472d36', bottom: '#724853', accent: '#ffe0c8', paper: '#fff7ef' },
};
const font = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

function clip(value, limit) {
  const chars = Array.from(String(value ?? '').trim());
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : chars.join('');
}

export function templateMarketing(product) {
  const facts = product.features;
  const intro = clip(product.description || facts[0] || product.name, 110);
  const detail = clip(facts.slice(0, 3).join(' · ') || product.name, 110);
  return {
    source: 'template',
    assets: {
      aPlus: [
        { headline: clip(product.name, 38), body: intro, layout: 'hero', factRefs: facts.length ? [0] : [] },
        { headline: '规格与亮点', body: detail, layout: 'feature', factRefs: facts.slice(0, 3).map((_, index) => index) },
        { headline: '选购前先确认', body: '看看规格、兼容条件与到手价，再选择适合自己的方案。', layout: 'usage', factRefs: [] },
      ],
      video: { title: clip(product.name, 38), scenes: [
        { caption: clip(product.name, 32), durationSeconds: 5, layout: 'hero' },
        { caption: clip(facts[0] || '查看商品细节', 32), durationSeconds: 5, layout: 'feature' },
        { caption: '查看规格与配送条件', durationSeconds: 5, layout: 'usage' },
      ] },
      social: {
        title: clip(`选购笔记 · ${product.name}`, 38),
        body: clip(`${intro}\n\n我会先看 ${detail}，再确认兼容性、到手价和配送条件。`, 280),
        hashtags: ['智能硬件', '选购指南'],
      },
    },
  };
}

function canvas(width, height) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  return surface;
}

function blobFromCanvas(surface) {
  return new Promise((resolve, reject) => surface.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('图片渲染失败。'));
  }, 'image/png'));
}

function round(context, x, y, width, height, radius, fill) {
  context.fillStyle = fill;
  context.beginPath();
  if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius);
  else context.rect(x, y, width, height);
  context.fill();
}

function lines(context, text, width, limit) {
  const output = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (character === '\n' || (line && context.measureText(line + character).width > width)) {
      output.push(line.trimEnd());
      line = '';
    }
    if (character !== '\n') line += character;
  }
  if (line) output.push(line.trim());
  if (output.length > limit) {
    const kept = output.slice(0, limit);
    let end = kept[limit - 1];
    while (context.measureText(end + '…').width > width && end) end = Array.from(end).slice(0, -1).join('');
    kept[limit - 1] = end + '…';
    return kept;
  }
  return output;
}

function write(context, text, { x, y, width, size, lead, maxLines = 3, color, weight = 600 }) {
  context.font = `${weight} ${size}px ${font}`;
  context.textBaseline = 'top';
  context.fillStyle = color;
  const wrapped = lines(context, text, width, maxLines);
  wrapped.forEach((line, index) => context.fillText(line, x, y + index * lead));
  return y + wrapped.length * lead;
}

function imageIn(context, image, x, y, width, height, scale = 1) {
  const ratio = Math.min(width / image.width, height / image.height) * scale;
  const w = image.width * ratio;
  const h = image.height * ratio;
  context.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function backdrop(context, scheme, width, height) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, scheme.top);
  gradient.addColorStop(1, scheme.bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#ffffff19';
  context.lineWidth = 2;
  for (const offset of [0, 34, 68]) {
    context.beginPath();
    context.arc(width * .85, height * .22, width * .38 + offset, 0, Math.PI * 2);
    context.stroke();
  }
}

function pictureFrame(context, image, x, y, width, height, color, scale = 1) {
  round(context, x, y, width, height, 30, color);
  context.save();
  context.beginPath();
  context.rect(x + 14, y + 14, width - 28, height - 28);
  context.clip();
  imageIn(context, image, x + 24, y + 24, width - 48, height - 48, scale);
  context.restore();
}

function panelFor(product, panel, image) {
  const surface = canvas(1240, 760);
  const context = surface.getContext('2d');
  const scheme = palettes[panel.layout] ?? palettes.hero;
  backdrop(context, scheme, surface.width, surface.height);
  const leftPhoto = panel.layout === 'feature';
  const textX = leftPhoto ? 675 : 62;
  pictureFrame(context, image, leftPhoto ? 60 : 650, 70, 525, 620, scheme.paper);
  write(context, clip(product.brand || product.name, 26), {
    x: textX, y: 133, width: 490, size: 24, lead: 29, maxLines: 1, color: scheme.accent, weight: 670,
  });
  const y = write(context, panel.headline, { x: textX, y: 189, width: 485, size: 57, lead: 69, color: '#fff', maxLines: 3, weight: 750 });
  write(context, panel.body, { x: textX, y: y + 26, width: 480, size: 30, lead: 45, color: '#f2f5ff', maxLines: 5, weight: 480 });
  round(context, textX, 645, 110, 5, 3, scheme.accent);
  return blobFromCanvas(surface);
}

export async function prepareProductImages(file, product, marketing) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('请上传不超过 8 MB 的 PNG、JPEG 或 WebP 图片。');
  }
  let image;
  try { image = await createImageBitmap(file); } catch { throw new Error('无法读取商品图片，请换一张图片。'); }
  try {
    if (image.width < 64 || image.height < 64 || image.width * image.height > 32_000_000) {
      throw new Error('商品图每边至少 64 像素，总像素数请控制在 3200 万以内。');
    }
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const heroCanvas = canvas(Math.round(image.width * scale), Math.round(image.height * scale));
    heroCanvas.getContext('2d').drawImage(image, 0, 0, heroCanvas.width, heroCanvas.height);
    const [hero, ...aPlus] = await Promise.all([
      blobFromCanvas(heroCanvas), ...marketing.assets.aPlus.map((panel) => panelFor(product, panel, image)),
    ]);
    return { hero, aPlus };
  } finally {
    image.close();
  }
}

function drawVideo(context, surface, product, scene, image, seconds, duration) {
  const scheme = palettes[scene.layout] ?? palettes.hero;
  backdrop(context, scheme, surface.width, surface.height);
  const photoScale = .93 + Math.min(1, seconds / scene.durationSeconds) * .09;
  pictureFrame(context, image, 62, 246, 596, 620, scheme.paper, photoScale);
  write(context, clip(product.brand || product.name, 24), {
    x: 62, y: 115, width: 590, size: 29, lead: 40, maxLines: 1, color: scheme.accent, weight: 720,
  });
  write(context, scene.caption, { x: 62, y: 944, width: 592, size: 55, lead: 68, color: '#fff', weight: 750 });
  round(context, 62, 1171, 596, 8, 4, '#ffffff3d');
  round(context, 62, 1171, Math.max(2, 596 * duration), 8, 4, scheme.accent);
}

export async function recordProductVideo(hero, product, marketing, onProgress = () => {}) {
  const surface = canvas(720, 1280);
  if (typeof MediaRecorder === 'undefined' || typeof surface.captureStream !== 'function') {
    throw new Error('这个浏览器暂不支持导出视频，仍可查看视频分镜。');
  }
  const image = await createImageBitmap(hero);
  const context = surface.getContext('2d', { alpha: false });
  const scenes = marketing.assets.video.scenes;
  const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  let stream;
  try {
    drawVideo(context, surface, product, scenes[0], image, 0, 0);
    stream = surface.captureStream(24);
    const formats = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mimeType = formats.find((type) => MediaRecorder.isTypeSupported(type));
    const options = { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1_800_000 };
    const recorder = new MediaRecorder(stream, options);

    return await new Promise((resolve, reject) => {
      const chunks = [];
      let timer;
      let watchdog;
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      recorder.onerror = () => {
        clearInterval(timer);
        clearTimeout(watchdog);
        reject(new Error('视频编码失败，可重新生成。'));
      };
      recorder.onstop = () => {
        clearInterval(timer);
        clearTimeout(watchdog);
        const output = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
        if (output.size > 1000) resolve(output);
        else reject(new Error('没有捕获到视频帧，可保持页面打开后重试。'));
      };
      recorder.start();
      const start = performance.now();
      let lastProgress = -1;
      timer = setInterval(() => {
        const elapsed = Math.min((performance.now() - start) / 1000, total);
        let cut = 0;
        const playhead = Math.min(elapsed, total - .001);
        const scene = scenes.find((item) => {
          if (playhead < cut + item.durationSeconds) return true;
          cut += item.durationSeconds;
          return false;
        }) ?? scenes.at(-1);
        drawVideo(context, surface, product, scene, image, Math.max(0, playhead - cut), elapsed / total);
        const progress = Math.floor(elapsed);
        if (progress !== lastProgress) onProgress(progress / total);
        lastProgress = progress;
        if (elapsed >= total && recorder.state !== 'inactive') recorder.stop();
      }, 1000 / 24);
      watchdog = setTimeout(() => {
        clearInterval(timer);
        reject(new Error('视频生成超时，可保持页面打开后重试。'));
        if (recorder.state !== 'inactive') recorder.stop();
      }, (total + 15) * 1000);
    });
  } finally {
    image.close();
    stream?.getTracks().forEach((track) => track.stop());
  }
}
