import { METRICS, REGIONS } from './simulation.js';
import { LAND_GRID } from './world-data.js';

const number = new Intl.NumberFormat('zh-CN');
const percentage = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
const font = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
const accent = '#a48aff';
const comparison = '#d3c3ff';
const cityLabels = {
  us: [-10, -12], br: [-10, 17], gb: [-10, -13], de: [11, 16],
  jp: [11, -10], cn: [-10, -12], in: [-11, 16], au: [-10, 18],
};
const metricNames = Object.fromEntries(METRICS.map(({ id, name }) => [id, name]));

function observeCanvas(canvas, draw) {
  const context = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let ratio = 0;

  function resize() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height && nextRatio === ratio)) return;
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    draw(width, height, ratio);
  }

  const observer = new ResizeObserver(resize);
  if (context) observer.observe(canvas);
  window.addEventListener('resize', resize);
  return {
    context,
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    },
  };
}

function circle(context, x, y, radius) {
  context.moveTo(x + radius, y);
  context.arc(x, y, radius, 0, 2 * Math.PI);
}

function seededNoise(seed) {
  const fraction = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return fraction - Math.floor(fraction);
}

function localPoint(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

export function createWorldMap(canvas, { onRegionChange = () => {} } = {}) {
  const background = document.createElement('canvas');
  const geography = background.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const input = new AbortController();
  const listeners = { signal: input.signal };
  let width = 0;
  let height = 0;
  let ratio = 1;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let visible = false;
  let frame = 0;
  let lastDraw = 0;
  let regionCounts = {};
  let selectedRegion = null;
  let hoveredRegion = null;
  let markers = [];
  let drag = null;
  canvas.style.touchAction = 'pan-y pinch-zoom';

  const surface = observeCanvas(canvas, (nextWidth, nextHeight, nextRatio) => {
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    background.width = Math.round(width * ratio);
    background.height = Math.round(height * ratio);
    redraw();
  });
  const { context } = surface;

  function project(longitude, latitude) {
    const padding = width < 500 ? 12 : 25;
    const scaleX = (width - padding * 2) / 360;
    const scaleY = Math.min((height - 36) / 146, scaleX * (width < 500 ? 1.4 : 1.16));
    return {
      x: width / 2 + longitude * scaleX * zoom + panX,
      y: height / 2 - (latitude - 12) * scaleY * zoom + panY,
    };
  }

  function drawGeography() {
    geography.setTransform(ratio, 0, 0, ratio, 0, 0);
    geography.clearRect(0, 0, width, height);
    const haze = geography.createRadialGradient(width * 0.55, height * 0.45, 8, width * 0.53, height * 0.45, width * 0.53);
    haze.addColorStop(0, '#211b38');
    haze.addColorStop(0.62, '#17172a');
    haze.addColorStop(1, '#131421');
    geography.fillStyle = haze;
    geography.fillRect(0, 0, width, height);

    const graticule = (start, end) => {
      geography.moveTo(start.x, start.y);
      geography.lineTo(end.x, end.y);
    };
    geography.beginPath();
    for (let longitude = -150; longitude <= 150; longitude += 30) {
      graticule(project(longitude, 82), project(longitude, -58));
    }
    for (let latitude = -45; latitude <= 75; latitude += 15) {
      graticule(project(-179, latitude), project(179, latitude));
    }
    geography.strokeStyle = '#9583d216';
    geography.lineWidth = 1;
    geography.stroke();

    const dotRadius = clamp((width / 1000) * zoom, 0.62, 1.7);
    const lands = [new Path2D(), new Path2D(), new Path2D()];
    for (let row = 0; row < LAND_GRID.rows.length; row++) {
      const latitude = LAND_GRID.north - row * LAND_GRID.step;
      const spans = LAND_GRID.rows[row];
      for (let index = 0; index < spans.length; index += 2) {
        for (let column = spans[index]; column <= spans[index + 1]; column++) {
          const longitude = LAND_GRID.west + column * LAND_GRID.step;
          const { x, y } = project(longitude, latitude);
          if (x < -3 || y < -3 || x > width + 3 || y > height + 3) continue;
          const shade = Math.floor(seededNoise(row * 181 + column) * lands.length);
          circle(lands[shade], x, y, dotRadius);
        }
      }
    }
    for (const [index, color] of ['#7160a674', '#9982ce83', '#b098df98'].entries()) {
      geography.fillStyle = color;
      geography.fill(lands[index]);
    }
  }

  function refreshMarkers() {
    markers = REGIONS.filter(({ id }) => regionCounts[id] > 0).map((region) => ({
      ...region,
      count: regionCounts[region.id],
      ...project(region.longitude, region.latitude),
    }));
    const selection = markers.find(({ id }) => id === selectedRegion);
    const availability = markers.length ? `${markers.length} 个市场` : '当前没有模拟结果';
    canvas.setAttribute('aria-label', `模拟世界地图，${availability}${selection ? `，已选 ${selection.city}` : ''}。使用加减键缩放，放大后用方向键移动，按 Esc 重置。`);
  }

  function drawMarker(marker, time, maxCount, setLabel) {
    const { x, y, id, city, count } = marker;
    const active = id === selectedRegion || id === hoveredRegion;
    const muted = selectedRegion && id !== selectedRegion && id !== hoveredRegion;
    const markerSize = 3.1 + 2.25 * Math.sqrt(count / maxCount);
    const phase = time === undefined ? 0.26 : ((time + seededNoise(x) * 2000) % 2700) / 2700;
    context.save();
    context.globalAlpha = muted ? 0.45 : 1;

    if (setLabel) {
      let [offsetX, offsetY] = cityLabels[id] ?? [11, -11];
      context.font = `${active ? '650' : '500'} ${width < 480 ? 10 : 11}px ${font}`;
      const labelWidth = context.measureText(city).width;
      if (x + offsetX + labelWidth > width - 4 && offsetX > 0) offsetX *= -1;
      if (x + offsetX - labelWidth < 4 && offsetX < 0) offsetX *= -1;
      if (y + offsetY < 10 || y + offsetY > height - 10) offsetY *= -1;
      context.textAlign = offsetX < 0 ? 'right' : 'left';
      context.textBaseline = 'middle';
      context.strokeStyle = '#131322';
      context.lineWidth = 3;
      context.strokeText(city, x + offsetX, y + offsetY);
      context.fillStyle = active ? '#f6f2ff' : '#c3b7e2';
      context.fillText(city, x + offsetX, y + offsetY);
      context.restore();
      return;
    }

    const glow = context.createRadialGradient(x, y, markerSize * 0.7, x, y, markerSize * 5.7);
    glow.addColorStop(0, '#9c76ff88');
    glow.addColorStop(0.29, '#8b61ff38');
    glow.addColorStop(1, '#8b61ff00');
    context.fillStyle = glow;
    context.fillRect(x - markerSize * 6, y - markerSize * 6, markerSize * 12, markerSize * 12);

    context.beginPath();
    context.strokeStyle = `rgba(173, 143, 255, ${(1 - phase) * (active ? 0.69 : 0.44)})`;
    context.lineWidth = active ? 1.4 : 0.9;
    circle(context, x, y, markerSize + phase * 11 + 2);
    context.stroke();

    context.beginPath();
    for (let i = 0; i < 11; i++) {
      const seed = i + marker.longitude * 3;
      const angle = seededNoise(seed) * Math.PI * 2;
      const distance = markerSize + 6 + Math.sqrt(seededNoise(seed + 1)) * (10 + markerSize);
      circle(context, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.75, i % 4 === 0 ? 1.25 : 0.7);
    }
    context.fillStyle = '#b798ffa8';
    context.fill();

    context.beginPath();
    circle(context, x, y, markerSize);
    context.fillStyle = active ? '#e1cfff' : '#ad89ff';
    context.fill();
    context.beginPath();
    circle(context, x, y, markerSize * 0.39);
    context.fillStyle = '#f4eaff';
    context.fill();
    context.restore();
  }

  function render(time) {
    if (!context || !width || !height) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.drawImage(background, 0, 0, width, height);
    const maxCount = Math.max(1, ...markers.map(({ count }) => count));
    for (const marker of markers) drawMarker(marker, time, maxCount, false);
    for (const marker of markers) drawMarker(marker, time, maxCount, true);
  }

  function animate(time) {
    frame = 0;
    if (time - lastDraw > 32) {
      render(time);
      lastDraw = time;
    }
    syncAnimation();
  }

  function syncAnimation() {
    const running = Boolean(context && markers.length && visible && !document.hidden && !motion.matches);
    if (running && !frame) frame = requestAnimationFrame(animate);
    if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      render();
    }
  }

  function redraw() {
    if (!geography || !width || !height) return;
    drawGeography();
    refreshMarkers();
    render();
  }

  function constrainPan() {
    const limitX = width * (zoom - 1) / 2;
    const limitY = height * (zoom - 1) / 2;
    panX = clamp(panX, -limitX, limitX);
    panY = clamp(panY, -limitY, limitY);
  }

  function zoomBy(multiplier, x = width / 2, y = height / 2) {
    const nextZoom = clamp(zoom * multiplier, 1, 4);
    const factor = nextZoom / zoom;
    panX = x - width / 2 - (x - width / 2 - panX) * factor;
    panY = y - height / 2 - (y - height / 2 - panY) * factor;
    zoom = nextZoom;
    constrainPan();
    canvas.style.cursor = zoom > 1 ? 'grab' : '';
    canvas.style.touchAction = zoom > 1 ? 'none' : 'pan-y pinch-zoom';
    redraw();
  }

  function reset() {
    zoom = 1;
    panX = 0;
    panY = 0;
    canvas.style.cursor = '';
    canvas.style.touchAction = 'pan-y pinch-zoom';
    redraw();
  }

  function markerAt({ x, y }) {
    let closest = null;
    let radius = width < 480 ? 13 : 16;
    for (const marker of markers) {
      const distance = Math.hypot(marker.x - x, marker.y - y);
      if (distance < radius) {
        closest = marker;
        radius = distance;
      }
    }
    return closest;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const point = localPoint(event, canvas);
    drag = { id: event.pointerId, ...point, panX, panY, moved: false };
  }, listeners);
  canvas.addEventListener('pointermove', (event) => {
    const point = localPoint(event, canvas);
    if (drag?.id === event.pointerId && zoom > 1) {
      const dx = point.x - drag.x;
      const dy = point.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) canvas.setPointerCapture(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) {
        drag.moved = true;
        panX = drag.panX + dx;
        panY = drag.panY + dy;
        constrainPan();
        redraw();
        canvas.style.cursor = 'grabbing';
        return;
      }
    }
    const marker = markerAt(point);
    hoveredRegion = marker?.id ?? null;
    canvas.style.cursor = marker ? 'pointer' : zoom > 1 ? 'grab' : '';
    canvas.title = marker ? `${marker.city} · ${number.format(marker.count)} 位居民` : '';
    render();
  }, listeners);
  canvas.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    const marker = !drag.moved && markerAt(localPoint(event, canvas));
    drag = null;
    canvas.style.cursor = marker ? 'pointer' : zoom > 1 ? 'grab' : '';
    if (marker) onRegionChange(marker.id === selectedRegion ? null : marker.id);
  }, listeners);
  canvas.addEventListener('pointercancel', () => {
    drag = null;
  }, listeners);
  canvas.addEventListener('pointerleave', (event) => {
    if (!canvas.hasPointerCapture(event.pointerId)) drag = null;
    hoveredRegion = null;
    canvas.title = '';
    render();
  }, listeners);
  canvas.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const { x, y } = localPoint(event, canvas);
    zoomBy(event.deltaY < 0 ? 1.16 : 1 / 1.16, x, y);
  }, { ...listeners, passive: false });
  canvas.addEventListener('keydown', (event) => {
    const direction = { ArrowUp: [0, 32], ArrowDown: [0, -32], ArrowLeft: [32, 0], ArrowRight: [-32, 0] }[event.key];
    if (event.key === '+' || event.key === '=') zoomBy(1.35);
    else if (event.key === '-') zoomBy(1 / 1.35);
    else if (event.key === 'Escape' || event.key === '0') reset();
    else if (direction && zoom > 1) {
      panX += direction[0];
      panY += direction[1];
      constrainPan();
      redraw();
    } else return;
    event.preventDefault();
  }, listeners);
  document.addEventListener('visibilitychange', syncAnimation, listeners);
  motion.addEventListener('change', syncAnimation, listeners);

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  });
  intersection.observe(canvas);

  return {
    update(next = {}) {
      regionCounts = next.regionCounts ?? regionCounts;
      if (Object.hasOwn(next, 'selectedRegion')) selectedRegion = next.selectedRegion ?? null;
      refreshMarkers();
      render();
      syncAnimation();
    },
    zoomIn() { zoomBy(1.35); },
    zoomOut() { zoomBy(1 / 1.35); },
    reset,
    destroy() {
      cancelAnimationFrame(frame);
      intersection.disconnect();
      input.abort();
      surface.destroy();
    },
  };
}

function chartRate(row, variant) {
  const outcome = row[variant];
  return outcome?.exposed > 0 && Number.isFinite(outcome.rate) ? outcome.rate : null;
}

function seriesRuns(rows, variant) {
  const runs = [];
  let points = [];
  for (const [index, row] of rows.entries()) {
    const rate = chartRate(row, variant);
    if (rate !== null) points.push({ index, rate });
    if (rate === null && points.length) {
      runs.push(points);
      points = [];
    }
  }
  if (points.length) runs.push(points);
  return runs;
}

export function createTrendChart(canvas) {
  let days = [];
  let metric = 'purchase';
  let variantAName = '方案 A';
  let variantBName = '方案 B';
  let width = 0;
  let height = 0;
  let ratio = 1;
  let active = -1;
  const input = new AbortController();
  const listeners = { signal: input.signal };
  const chart = observeCanvas(canvas, (nextWidth, nextHeight, nextRatio) => {
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    render();
  });
  const { context } = chart;

  function bounds() {
    return { left: 39, right: width - 10, top: 11, bottom: height - 27 };
  }

  function describe(index) {
    const label = `${metricNames[metric] ?? '目标'}转化率，按首次曝光日分组`;
    if (index < 0 || !days[index]) return `${label}。${days.length} 天，使用左右方向键查看单日数据。`;
    const row = days[index];
    const rate = key => chartRate(row, key) === null ? '无曝光' : percentage.format(chartRate(row, key));
    return `${label}。第 ${row.day} 天，${variantAName} ${rate('a')}，${variantBName} ${rate('b')}。`;
  }

  function render() {
    if (!context || !width || !height) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const { left, right, top, bottom } = bounds();
    const topRate = Math.max(0, ...days.flatMap(row => [chartRate(row, 'a') ?? 0, chartRate(row, 'b') ?? 0]));
    const step = [0.0025, 0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25].find(candidate => candidate * 4 > topRate) ?? 0.25;
    const x = index => days.length > 1 ? left + (right - left) * index / (days.length - 1) : (left + right) / 2;
    const y = rate => bottom - (bottom - top) * rate / (step * 4);

    context.font = `11px ${font}`;
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    context.lineWidth = 1;
    for (let index = 0; index <= 4; index++) {
      const heightAt = y(step * index);
      context.beginPath();
      context.moveTo(left, heightAt);
      context.lineTo(right, heightAt);
      context.strokeStyle = index ? '#a897da27' : '#a897da44';
      context.setLineDash(index ? [4, 5] : []);
      context.stroke();
      context.fillStyle = '#a8a1ba';
      context.fillText(percentage.format(step * index), left - 8, heightAt);
    }
    context.setLineDash([]);
    if (!days.length) {
      context.textAlign = 'center';
      context.fillText('运行实验后显示转化趋势', (left + right) / 2, (top + bottom) / 2);
      return;
    }

    const labelCount = Math.min(days.length, width < 460 ? 3 : 6);
    context.textAlign = 'center';
    for (let index = 0; index < labelCount; index++) {
      const dayIndex = labelCount === 1 ? 0 : Math.round(index * (days.length - 1) / (labelCount - 1));
      const labelX = clamp(x(dayIndex), left, right - 12);
      context.fillText(`第 ${days[dayIndex].day} 天`, labelX, bottom + 16);
    }

    const variants = [
      { key: 'a', color: accent, fill: '#9270ff32', dash: [] },
      { key: 'b', color: comparison, fill: '#b499ff18', dash: [5, 4] },
    ];
    for (const { key, color, fill, dash } of variants) {
      const runs = seriesRuns(days, key);
      const gradient = context.createLinearGradient(0, top, 0, bottom);
      gradient.addColorStop(0, fill);
      gradient.addColorStop(1, '#8e71ff02');
      for (const points of runs) {
        if (points.length > 1) {
          context.beginPath();
          context.moveTo(x(points[0].index), bottom);
          for (const point of points) context.lineTo(x(point.index), y(point.rate));
          context.lineTo(x(points.at(-1).index), bottom);
          context.closePath();
          context.fillStyle = gradient;
          context.fill();
        }
        context.beginPath();
        context.moveTo(x(points[0].index), y(points[0].rate));
        for (const point of points.slice(1)) context.lineTo(x(point.index), y(point.rate));
        context.lineWidth = 2;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.strokeStyle = color;
        context.setLineDash(dash);
        context.stroke();
        context.setLineDash([]);
        if (points.length === 1 || days.length <= 14) {
          context.beginPath();
          for (const point of points) circle(context, x(point.index), y(point.rate), 2.35);
          context.fillStyle = color;
          context.fill();
        }
      }
    }

    if (active < 0) return;
    const row = days[active];
    const activeX = x(active);
    context.beginPath();
    context.moveTo(activeX, top);
    context.lineTo(activeX, bottom);
    context.strokeStyle = '#baa4fca6';
    context.lineWidth = 1;
    context.setLineDash([3, 4]);
    context.stroke();
    context.setLineDash([]);
    for (const { key, color } of variants) {
      const rate = chartRate(row, key);
      if (rate === null) continue;
      context.beginPath();
      circle(context, activeX, y(rate), 4);
      context.fillStyle = color;
      context.fill();
    }

    const format = key => chartRate(row, key) === null ? '无曝光' : percentage.format(chartRate(row, key));
    const labels = [`第 ${row.day} 天`, `${variantAName}  ${format('a')}`, `${variantBName}  ${format('b')}`];
    const boxWidth = Math.max(112, ...labels.map(label => context.measureText(label).width + 24));
    const boxX = activeX > width / 2 ? activeX - boxWidth - 10 : activeX + 10;
    const boxY = top + 4;
    context.beginPath();
    context.roundRect(clamp(boxX, 3, Math.max(3, width - boxWidth - 3)), boxY, boxWidth, 65, 7);
    context.fillStyle = '#212036';
    context.fill();
    context.strokeStyle = '#65558c';
    context.stroke();
    context.textAlign = 'left';
    for (const [index, color] of ['#f2ecff', accent, comparison].entries()) {
      context.fillStyle = color;
      context.fillText(labels[index], clamp(boxX, 3, Math.max(3, width - boxWidth - 3)) + 12, boxY + 15 + index * 17);
    }
  }

  function setActive(index) {
    if (index === active) return;
    active = index;
    canvas.setAttribute('aria-label', describe(active));
    render();
  }

  canvas.addEventListener('pointermove', (event) => {
    const { x, y } = localPoint(event, canvas);
    const { left, right, top, bottom } = bounds();
    if (!days.length || x < left - 5 || x > right + 5 || y < top - 5 || y > bottom + 5) {
      setActive(-1);
      return;
    }
    setActive(clamp(Math.round((x - left) / (right - left) * (days.length - 1)), 0, days.length - 1));
  }, listeners);
  canvas.addEventListener('pointerleave', () => setActive(-1), listeners);
  canvas.addEventListener('blur', () => setActive(-1), listeners);
  canvas.addEventListener('keydown', (event) => {
    if (!days.length) return;
    if (event.key === 'ArrowRight') setActive(Math.min(active + 1, days.length - 1));
    else if (event.key === 'ArrowLeft') setActive(Math.max(active - 1, 0));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(days.length - 1);
    else if (event.key === 'Escape') setActive(-1);
    else return;
    event.preventDefault();
  }, listeners);

  return {
    update(next = {}) {
      days = next.days ?? days;
      metric = next.metric ?? metric;
      variantAName = next.variantAName ?? variantAName;
      variantBName = next.variantBName ?? variantBName;
      active = -1;
      canvas.setAttribute('aria-label', describe(active));
      render();
    },
    destroy() {
      input.abort();
      chart.destroy();
    },
  };
}
