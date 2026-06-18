const CARD_WIDTH = 1024;
const CARD_HEIGHT = 1536;
const STORAGE_KEY = "tradingCardMakerState";
const IMAGE_KEY = "tradingCardMakerImage";

const rarityMap = {
  N: { label: "N", file: "normal.png", color: "#7d8790" },
  R: { label: "R", file: "rare.png", color: "#287ac2" },
  SR: { label: "SR", file: "super-rare.png", color: "#a83ba7" },
  SSR: { label: "SSR", file: "super-special-rare.png", color: "#d58a16" },
  UR: { label: "UR", file: "ultra-rare.png", color: "#c82424" }
};

const defaults = {
  imageScale: "1",
  imageX: "0",
  imageY: "0",
  cardName: "エレキュート",
  rarity: "SSR",
  cardType: "character",
  attribute: "雷",
  cardNo: "No.001",
  hp: "3200",
  atk: "1800",
  def: "1400",
  spd: "900",
  normalSkillName: "スパークショット",
  normalSkillPower: "120",
  normalSkillText: "雷の弾を放ち、相手単体にダメージを与える。",
  specialName: "帯電フィールド",
  specialText: "自分のATKを上げ、次の通常技の威力を強化する。",
  cost: "4",
  description: "小さな体に強い電気をためこむ、元気いっぱいのカード。"
};

const canvas = document.querySelector("#cardCanvas");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#cardForm");
const upload = document.querySelector("#imageUpload");
const downloadButton = document.querySelector("#downloadButton");
const resetButton = document.querySelector("#resetButton");

let state = { ...defaults, ...loadState() };
let characterImage = null;
let templateImage = null;
let templateKey = "";
let dragStart = null;

init();

function init() {
  fillForm();
  restoreImage();
  loadTemplate().then(drawCard);
  form.addEventListener("input", handleFormChange);
  form.addEventListener("change", handleFormChange);
  upload.addEventListener("change", handleImageUpload);
  downloadButton.addEventListener("click", downloadPng);
  resetButton.addEventListener("click", resetAll);
  canvas.addEventListener("pointerdown", startImageDrag);
  canvas.addEventListener("pointermove", moveImageDrag);
  canvas.addEventListener("pointerup", endImageDrag);
  canvas.addEventListener("pointercancel", endImageDrag);
}

function handleFormChange() {
  const previousTemplateKey = getTemplateKey();
  state = { ...state, ...Object.fromEntries(new FormData(form).entries()) };
  saveState();

  if (previousTemplateKey !== getTemplateKey()) {
    loadTemplate().then(drawCard);
    return;
  }

  drawCard();
}

function fillForm() {
  Object.entries(state).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Preview should keep working even when browser storage is full.
  }
}

function restoreImage() {
  const dataUrl = localStorage.getItem(IMAGE_KEY);
  if (!dataUrl) return;
  loadImage(dataUrl).then((img) => {
    characterImage = img;
    drawCard();
  });
}

function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    try {
      localStorage.setItem(IMAGE_KEY, dataUrl);
    } catch {
      console.warn("Uploaded image is too large to save in localStorage.");
    }
    loadImage(dataUrl).then((img) => {
      characterImage = img;
      drawCard();
    });
  };
  reader.readAsDataURL(file);
}

function getTemplateKey() {
  return `${state.cardType}-${state.rarity}`;
}

async function loadTemplate() {
  const rarity = rarityMap[state.rarity] || rarityMap.N;
  templateKey = getTemplateKey();
  templateImage = null;

  const paths = [
    `./assets/templates/${state.cardType}/${rarity.file}`,
    `./assets/templates/${rarity.file}`
  ];

  for (const path of paths) {
    try {
      templateImage = await loadImage(path);
      return;
    } catch {
      templateImage = null;
    }
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCard() {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawBase();
  drawCharacterImage();
  drawTemplateOverlay();
  drawTextLayer();
}

function drawBase() {
  const rarity = rarityMap[state.rarity] || rarityMap.N;
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, "#fff9df");
  gradient.addColorStop(0.45, "#dfc08a");
  gradient.addColorStop(1, rarity.color);
  ctx.fillStyle = gradient;
  roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 44);
  ctx.fill();

  ctx.fillStyle = "#28180e";
  roundRect(34, 34, CARD_WIDTH - 68, CARD_HEIGHT - 68, 36);
  ctx.fill();

  ctx.fillStyle = "#f8e7b8";
  roundRect(58, 58, CARD_WIDTH - 116, CARD_HEIGHT - 116, 28);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let i = -CARD_HEIGHT; i < CARD_WIDTH; i += 72) {
    ctx.fillStyle = i % 144 === 0 ? "#ffffff" : rarity.color;
    ctx.fillRect(i, 0, 26, CARD_HEIGHT * 1.5);
  }
  ctx.restore();
}

function drawCharacterImage() {
  const imageBox = { x: 96, y: 196, w: 832, h: 694 };
  ctx.save();
  roundRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, 26);
  ctx.clip();

  const bg = ctx.createLinearGradient(96, 196, 928, 890);
  bg.addColorStop(0, "#fff7cf");
  bg.addColorStop(1, "#b58a54");
  ctx.fillStyle = bg;
  ctx.fillRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h);

  if (characterImage) {
    const scale = Number(state.imageScale || 1);
    const fit = Math.max(imageBox.w / characterImage.width, imageBox.h / characterImage.height);
    const drawW = characterImage.width * fit * scale;
    const drawH = characterImage.height * fit * scale;
    const drawX = imageBox.x + imageBox.w / 2 - drawW / 2 + Number(state.imageX || 0);
    const drawY = imageBox.y + imageBox.h / 2 - drawH / 2 + Number(state.imageY || 0);
    ctx.drawImage(characterImage, drawX, drawY, drawW, drawH);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = makeFont(42, 800);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("キャラクター画像", imageBox.x + imageBox.w / 2, imageBox.y + imageBox.h / 2 - 18);
    ctx.font = makeFont(27, 700);
    ctx.fillText("アップロードするとここに表示されます", imageBox.x + imageBox.w / 2, imageBox.y + imageBox.h / 2 + 34);
  }
  ctx.restore();

  strokeRoundRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, 26, "#3a2112", 8);
  strokeRoundRect(imageBox.x + 12, imageBox.y + 12, imageBox.w - 24, imageBox.h - 24, 18, "rgba(255,255,255,0.55)", 3);
}

function drawTemplateOverlay() {
  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return;
  }

  const rarity = rarityMap[state.rarity] || rarityMap.N;
  ctx.save();
  ctx.strokeStyle = rarity.color;
  ctx.lineWidth = 16;
  roundRect(72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144, 24);
  ctx.stroke();

  drawPanel(94, 920, 296, 326, "rgba(37, 22, 12, 0.86)");
  drawPanel(410, 920, 420, 158, "rgba(37, 22, 12, 0.86)");
  drawPanel(410, 1096, 420, 150, "rgba(37, 22, 12, 0.86)");
  drawPanel(94, 1264, 640, 150, "rgba(37, 22, 12, 0.86)");
  drawPanel(762, 1234, 168, 178, "rgba(37, 22, 12, 0.86)");
  ctx.restore();
}

function drawTextLayer() {
  drawHeader();
  drawStats();
  drawSkills();
  drawDescription();
  drawMiniAndCost();
  drawCardNo();
}

function drawHeader() {
  const rarity = rarityMap[state.rarity] || rarityMap.N;
  ctx.textBaseline = "middle";

  ctx.fillStyle = rarity.color;
  roundRect(90, 88, 128, 82, 18);
  ctx.fill();
  ctx.fillStyle = "#fff7db";
  ctx.font = makeFont(45, 900);
  ctx.textAlign = "center";
  ctx.fillText(rarity.label, 154, 132);

  ctx.fillStyle = "rgba(46, 26, 13, 0.86)";
  roundRect(248, 88, 528, 82, 18);
  ctx.fill();
  drawFitText(state.cardName, 512, 132, 480, 48, "#fff7db", 900, "center");

  drawAttributeIcon(844, 130, state.attribute);
}

function drawAttributeIcon(x, y, attribute) {
  const colors = {
    火: "#d33d28",
    水: "#2478d4",
    風: "#31a65a",
    雷: "#d5a91c",
    光: "#e8d36b",
    闇: "#48305f",
    心: "#d85080",
    星: "#4766d5",
    無属性: "#747474"
  };
  ctx.fillStyle = colors[attribute] || colors.無属性;
  ctx.beginPath();
  ctx.arc(x, y, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#fff4cf";
  ctx.stroke();

  ctx.fillStyle = "#fffdf0";
  ctx.font = makeFont(attribute === "無属性" ? 24 : 38, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(attribute, x, y + 1);
}

function drawStats() {
  const stats = [
    ["HP", state.hp],
    ["ATK", state.atk],
    ["DEF", state.def],
    ["SPD", state.spd]
  ];
  ctx.textBaseline = "middle";
  stats.forEach(([label, value], index) => {
    const y = 970 + index * 62;
    ctx.fillStyle = "#f1c85b";
    ctx.font = makeFont(30, 900);
    ctx.textAlign = "left";
    ctx.fillText(label, 126, y);
    drawFitText(value, 354, y, 130, 34, "#fff7e0", 900, "right");
  });
}

function drawSkills() {
  drawSectionTitle(`${state.normalSkillName || "通常技"}　威力 ${state.normalSkillPower || ""}`, 432, 956, 374);
  drawWrappedText(state.normalSkillText, 432, 1000, 368, 31, 3, "#fff8e3", 24);

  drawSectionTitle(state.specialName || "特殊能力", 432, 1132, 374);
  drawWrappedText(state.specialText, 432, 1176, 368, 31, 3, "#fff8e3", 24);
}

function drawSectionTitle(text, x, y, maxWidth) {
  ctx.fillStyle = "#f1c85b";
  ctx.font = makeFont(28, 900);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  drawFitText(text, x, y, maxWidth, 28, "#f1c85b", 900, "left");
}

function drawDescription() {
  drawWrappedText(state.description, 120, 1304, 592, 31, 4, "#fff8e3", 24);
}

function drawMiniAndCost() {
  const mini = { x: 784, y: 1256, w: 124, h: 100 };
  ctx.save();
  roundRect(mini.x, mini.y, mini.w, mini.h, 16);
  ctx.clip();
  ctx.fillStyle = "#d9bd7b";
  ctx.fillRect(mini.x, mini.y, mini.w, mini.h);
  if (characterImage) {
    const fit = Math.max(mini.w / characterImage.width, mini.h / characterImage.height);
    const drawW = characterImage.width * fit;
    const drawH = characterImage.height * fit;
    ctx.drawImage(characterImage, mini.x + mini.w / 2 - drawW / 2, mini.y + mini.h / 2 - drawH / 2, drawW, drawH);
  }
  ctx.restore();
  strokeRoundRect(mini.x, mini.y, mini.w, mini.h, 16, "#f8df95", 4);

  ctx.fillStyle = "#c82424";
  ctx.beginPath();
  ctx.arc(846, 1385, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#fff4cf";
  ctx.stroke();

  ctx.fillStyle = "#fffdf0";
  ctx.font = makeFont(25, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("COST", 846, 1366);
  drawFitText(state.cost, 846, 1400, 58, 34, "#fffdf0", 900, "center");
}

function drawCardNo() {
  ctx.fillStyle = "#2a190f";
  ctx.font = makeFont(28, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(state.cardNo || ""), CARD_WIDTH / 2, 1452);
}

function drawPanel(x, y, w, h, fill) {
  ctx.fillStyle = fill;
  roundRect(x, y, w, h, 18);
  ctx.fill();
  strokeRoundRect(x + 4, y + 4, w - 8, h - 8, 14, "rgba(255,232,164,0.74)", 3);
}

function drawWrappedText(text, x, y, maxWidth, lineHeight, maxLines, color, size) {
  const normalized = String(text || "").replace(/\r/g, "");
  const paragraphs = normalized.split("\n");
  const lines = [];

  ctx.font = makeFont(size, 700);
  for (const paragraph of paragraphs) {
    let line = "";
    for (const char of paragraph) {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    lines.push(line);
  }

  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawFitText(text, x, y, maxWidth, maxSize, color, weight, align) {
  const value = String(text || "");
  let size = maxSize;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  do {
    ctx.font = makeFont(size, weight);
    if (ctx.measureText(value).width <= maxWidth || size <= 16) break;
    size -= 2;
  } while (size > 16);
  ctx.fillText(value, x, y);
}

function makeFont(size, weight) {
  return `${weight} ${size}px "Yu Gothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`;
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function strokeRoundRect(x, y, w, h, r, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  roundRect(x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

function downloadPng() {
  drawCard();
  const link = document.createElement("a");
  const safeName = (state.cardName || "card").replace(/[\\/:*?"<>|]/g, "_");
  link.download = `${safeName}_${state.cardNo || "no"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetAll() {
  if (!confirm("入力内容と保存済み画像をリセットしますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(IMAGE_KEY);
  state = { ...defaults };
  characterImage = null;
  upload.value = "";
  fillForm();
  loadTemplate().then(drawCard);
}

function startImageDrag(event) {
  const point = getCanvasPoint(event);
  if (!point || !isInImageBox(point.x, point.y)) return;

  canvas.setPointerCapture(event.pointerId);
  dragStart = {
    pointerId: event.pointerId,
    x: point.x,
    y: point.y,
    imageX: Number(state.imageX || 0),
    imageY: Number(state.imageY || 0)
  };
}

function moveImageDrag(event) {
  if (!dragStart || dragStart.pointerId !== event.pointerId) return;
  const point = getCanvasPoint(event);
  if (!point) return;

  const nextX = clamp(Math.round(dragStart.imageX + point.x - dragStart.x), -500, 500);
  const nextY = clamp(Math.round(dragStart.imageY + point.y - dragStart.y), -500, 500);
  state.imageX = String(nextX);
  state.imageY = String(nextY);
  form.elements.imageX.value = state.imageX;
  form.elements.imageY.value = state.imageY;
  saveState();
  drawCard();
}

function endImageDrag(event) {
  if (dragStart?.pointerId === event.pointerId) {
    dragStart = null;
  }
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * CARD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * CARD_HEIGHT
  };
}

function isInImageBox(x, y) {
  return x >= 96 && x <= 928 && y >= 196 && y <= 890;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
