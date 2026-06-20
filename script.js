const CARD_WIDTH = 1024;
const CARD_HEIGHT = 1536;
const STORAGE_KEY = "tradingCardMakerState";
const IMAGE_KEY = "tradingCardMakerImage";
const TEMPLATE_CACHE_VERSION = "20260619";

const rarityMap = {
  N: { label: "N", file: "normal.png", color: "#7d8790" },
  R: { label: "R", file: "rare.png", color: "#287ac2" },
  SR: { label: "SR", file: "super-rare.png", color: "#a83ba7" },
  SSR: { label: "SSR", file: "super-special-rare.png", color: "#d58a16" },
  UR: { label: "UR", file: "ultra-rare.png", color: "#c82424" }
};

const DEBUG_LAYOUT = false;

const TEMPLATE_LAYOUT = {
  character: {
    R: {
      mainImage: { x: 92, y: 190, w: 840, h: 690, radius: 26 },
      cardName: { x: 512, y: 118, maxWidth: 510, fontSize: 48, align: "center", color: "#fff7db", weight: 900 },
      stats: {
        hp: { x: 240, y: 950, maxWidth: 120, fontSize: 38, align: "right", color: "#fff7e0", weight: 900 },
        atk: { x: 308, y: 1013, maxWidth: 120, fontSize: 38, align: "right", color: "#fff7e0", weight: 900 },
        def: { x: 308, y: 1083, maxWidth: 120, fontSize: 38, align: "right", color: "#fff7e0", weight: 900 },
        spd: { x: 308, y: 1153, maxWidth: 120, fontSize: 38, align: "right", color: "#fff7e0", weight: 900 }
      },
      skill1: {
        nameX: 410,
        nameY: 1034,
        nameMaxWidth: 330,
        nameFontSize: 34,
        powerX: 830,
        powerY: 1034,
        powerMaxWidth: 92,
        powerFontSize: 38,
        textX: 360,
        textY: 1080,
        textMaxWidth: 470,
        textHeight: 88,
        textFontSize: 23,
        lineHeight: 29,
        maxLines: 3
      },
      skill2: {
        nameX: 400,
        nameY: 1195,
        nameMaxWidth: 400,
        nameFontSize: 32,
        textX: 360,
        textY: 1240,
        textMaxWidth: 470,
        textHeight: 88,
        textFontSize: 23,
        lineHeight: 29,
        maxLines: 3
      },
      description: { x: 65, y: 1295, maxWidth: 560, height: 112, fontSize: 24, lineHeight: 34, maxLines: 3, color: "#fff8e3", weight: 700 },
      attribute: { x: 893, y: 126, radius: 52, fontSize: 38, color: "#fffdf0", weight: 900 },
      miniCharacter: { x: 855, y: 1325, radius: 120 },
      cost: { x: 932, y: 1145, maxWidth: 64, fontSize: 28, color: "#fffdf0", weight: 900 },
      cardNo: { x: 512, y: 1480, maxWidth: 230, fontSize: 34, align: "center", color: "#2a190f", weight: 900 }
    }
  }
};

const defaults = {
  imageScale: "1",
  imageX: "0",
  imageY: "0",
  cardName: "エレキュート",
  rarity: "R",
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

  const templatePaths = [
    getTemplatePath(state.cardType, rarity.file),
    getTemplatePath("character", rarityMap.R.file)
  ].filter((path, index, paths) => paths.indexOf(path) === index);

  for (const templatePath of templatePaths) {
    const templateUrl = withTemplateCacheBuster(templatePath);

    try {
      console.log(`Loading card template URL: ${templateUrl}`);
      templateImage = await loadImage(templateUrl);
      console.log(`Loaded card template URL: ${templateUrl}`);
      return;
    } catch (error) {
      templateImage = null;
      console.error(`Failed to load card template URL: ${templateUrl}`, error);
    }
  }
}

function getTemplatePath(cardType, rarityFile) {
  const safeCardType = cardType === "item" ? "item" : "character";
  return `assets/templates/${safeCardType}/${rarityFile}`;
}

function withTemplateCacheBuster(path) {
  return `./${path}?v=${TEMPLATE_CACHE_VERSION}`;
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

  if (templateImage) {
    const layout = getTemplateLayout();
    drawCharacterImage({
      imageBox: layout.mainImage,
      drawBackground: false,
      drawPlaceholder: false,
      drawFrame: false
    });
    drawTemplateOverlay();
    drawTemplateTextLayer(layout);
    drawDebugLayout(layout);
    return;
  }

  drawBase();
  drawCharacterImage();
  drawTemplateOverlay();
  drawTextLayer();
}

function getTemplateLayout() {
  return TEMPLATE_LAYOUT[state.cardType]?.[state.rarity] || TEMPLATE_LAYOUT.character.R;
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

function drawCharacterImage({ imageBox = { x: 96, y: 196, w: 832, h: 694, radius: 26 }, drawBackground = true, drawPlaceholder = true, drawFrame = true } = {}) {
  const radius = imageBox.radius ?? 26;
  ctx.save();
  roundRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, radius);
  ctx.clip();

  if (drawBackground) {
    const bg = ctx.createLinearGradient(96, 196, 928, 890);
    bg.addColorStop(0, "#fff7cf");
    bg.addColorStop(1, "#b58a54");
    ctx.fillStyle = bg;
    ctx.fillRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h);
  }

  if (characterImage) {
    const scale = Number(state.imageScale || 1);
    const fit = Math.max(imageBox.w / characterImage.width, imageBox.h / characterImage.height);
    const drawW = characterImage.width * fit * scale;
    const drawH = characterImage.height * fit * scale;
    const drawX = imageBox.x + imageBox.w / 2 - drawW / 2 + Number(state.imageX || 0);
    const drawY = imageBox.y + imageBox.h / 2 - drawH / 2 + Number(state.imageY || 0);
    ctx.drawImage(characterImage, drawX, drawY, drawW, drawH);
  } else if (drawPlaceholder) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = makeFont(42, 800);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("キャラクター画像", imageBox.x + imageBox.w / 2, imageBox.y + imageBox.h / 2 - 18);
    ctx.font = makeFont(27, 700);
    ctx.fillText("アップロードするとここに表示されます", imageBox.x + imageBox.w / 2, imageBox.y + imageBox.h / 2 + 34);
  }
  ctx.restore();

  if (drawFrame) {
    strokeRoundRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, radius, "#3a2112", 8);
    strokeRoundRect(imageBox.x + 12, imageBox.y + 12, imageBox.w - 24, imageBox.h - 24, 18, "rgba(255,255,255,0.55)", 3);
  }
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

function drawTemplateTextLayer(layout) {
  drawTemplateCardName(layout.cardName);
  drawTemplateStats(layout.stats);
  drawTemplateSkill1(layout.skill1);
  drawTemplateSkill2(layout.skill2);
  drawTemplateDescription(layout.description);
  drawTemplateMiniCharacter(layout.miniCharacter);
  drawTemplateCost(layout.cost);
  drawTemplateCardNo(layout.cardNo);
  drawTemplateAttribute(layout.attribute);
}

function drawTemplateCardName(layout) {
  drawFitText(state.cardName, layout.x, layout.y, layout.maxWidth, layout.fontSize, layout.color, layout.weight, layout.align);
}

function drawTemplateStats(layout) {
  [
    ["hp", state.hp],
    ["atk", state.atk],
    ["def", state.def],
    ["spd", state.spd]
  ].forEach(([key, value]) => {
    const statLayout = layout[key];
    drawFitText(value, statLayout.x, statLayout.y, statLayout.maxWidth, statLayout.fontSize, statLayout.color, statLayout.weight, statLayout.align);
  });
}

function drawTemplateSkill1(layout) {
  drawFitText(state.normalSkillName || "通常技", layout.nameX, layout.nameY, layout.nameMaxWidth, layout.nameFontSize, "#fff8e3", 900, "left");
  drawFitText(state.normalSkillPower || "", layout.powerX, layout.powerY, layout.powerMaxWidth, layout.powerFontSize, "#fff8e3", 900, "center");
  drawWrappedFitText(state.normalSkillText, layout.textX, layout.textY, layout.textMaxWidth, layout.textHeight, layout.lineHeight, layout.maxLines, "#fff8e3", layout.textFontSize, 700);
}

function drawTemplateSkill2(layout) {
  drawFitText(state.specialName || "特殊能力", layout.nameX, layout.nameY, layout.nameMaxWidth, layout.nameFontSize, "#fff8e3", 900, "left");
  drawWrappedFitText(state.specialText, layout.textX, layout.textY, layout.textMaxWidth, layout.textHeight, layout.lineHeight, layout.maxLines, "#fff8e3", layout.textFontSize, 700);
}

function drawTemplateDescription(layout) {
  drawWrappedFitText(state.description, layout.x, layout.y, layout.maxWidth, layout.height, layout.lineHeight, layout.maxLines, layout.color, layout.fontSize, layout.weight);
}

function drawTemplateMiniCharacter(layout) {
  if (!characterImage) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(layout.x, layout.y, layout.radius, 0, Math.PI * 2);
  ctx.clip();

  const diameter = layout.radius * 2;
  const fit = Math.max(diameter / characterImage.width, diameter / characterImage.height);
  const drawW = characterImage.width * fit;
  const drawH = characterImage.height * fit;
  ctx.drawImage(characterImage, layout.x - drawW / 2, layout.y - drawH / 2, drawW, drawH);
  ctx.restore();
}

function drawTemplateCost(layout) {
  drawFitText(state.cost, layout.x, layout.y, layout.maxWidth, layout.fontSize, layout.color, layout.weight, "center");
}

function drawTemplateCardNo(layout) {
  drawFitText(state.cardNo, layout.x, layout.y, layout.maxWidth, layout.fontSize, layout.color, layout.weight, layout.align);
}

function drawTemplateAttribute(layout) {
  drawAttributeIcon(layout.x, layout.y, state.attribute, layout.radius, layout.fontSize);
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

function drawAttributeIcon(x, y, attribute, radius = 48, maxFontSize = 38) {
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
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#fff4cf";
  ctx.stroke();

  drawFitText(attribute, x, y + 1, radius * 1.45, attribute === "無属性" ? Math.min(24, maxFontSize) : maxFontSize, "#fffdf0", 900, "center");
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

function drawWrappedFitText(text, x, y, maxWidth, maxHeight, lineHeight, maxLines, color, maxSize, weight) {
  let size = maxSize;
  let effectiveLineHeight = lineHeight;
  let lines = [];

  do {
    effectiveLineHeight = Math.max(Math.round(lineHeight * (size / maxSize)), size + 4);
    lines = wrapTextLines(text, maxWidth, size, weight, maxLines);
    if (lines.length * effectiveLineHeight <= maxHeight || size <= 16) break;
    size -= 2;
  } while (size > 16);

  ctx.fillStyle = color;
  ctx.font = makeFont(size, weight);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.slice(0, maxLines).forEach((line, index) => {
    const nextY = y + index * effectiveLineHeight;
    if (nextY + size <= y + maxHeight) {
      ctx.fillText(line, x, nextY);
    }
  });
}

function wrapTextLines(text, maxWidth, size, weight, maxLines) {
  const normalized = String(text || "").replace(/\r/g, "");
  const paragraphs = normalized.split("\n");
  const lines = [];

  ctx.font = makeFont(size, weight);
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
      if (lines.length >= maxLines) return lines;
    }
    lines.push(line);
    if (lines.length >= maxLines) return lines;
  }

  return lines;
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

function drawDebugLayout(layout) {
  if (!DEBUG_LAYOUT) return;

  drawDebugBox(layout.mainImage, "mainImage");
  drawDebugTextGuide(layout.cardName, "cardName");
  Object.entries(layout.stats).forEach(([key, value]) => drawDebugTextGuide(value, key));
  drawDebugTextGuide({ x: layout.skill1.nameX, y: layout.skill1.nameY, maxWidth: layout.skill1.nameMaxWidth, fontSize: layout.skill1.nameFontSize, align: "left" }, "skill1.name");
  drawDebugTextGuide({ x: layout.skill1.powerX, y: layout.skill1.powerY, maxWidth: layout.skill1.powerMaxWidth, fontSize: layout.skill1.powerFontSize, align: "center" }, "skill1.power");
  drawDebugRect(layout.skill1.textX, layout.skill1.textY, layout.skill1.textMaxWidth, layout.skill1.textHeight, "skill1.text");
  drawDebugTextGuide({ x: layout.skill2.nameX, y: layout.skill2.nameY, maxWidth: layout.skill2.nameMaxWidth, fontSize: layout.skill2.nameFontSize, align: "left" }, "skill2.name");
  drawDebugRect(layout.skill2.textX, layout.skill2.textY, layout.skill2.textMaxWidth, layout.skill2.textHeight, "skill2.text");
  drawDebugRect(layout.description.x, layout.description.y, layout.description.maxWidth, layout.description.height, "description");
  drawDebugCircle(layout.attribute.x, layout.attribute.y, layout.attribute.radius, "attribute");
  drawDebugCircle(layout.miniCharacter.x, layout.miniCharacter.y, layout.miniCharacter.radius, "miniCharacter");
  drawDebugTextGuide(layout.cost, "cost");
  drawDebugTextGuide(layout.cardNo, "cardNo");
}

function drawDebugTextGuide(layout, label) {
  const left = layout.align === "right" ? layout.x - layout.maxWidth : layout.align === "center" ? layout.x - layout.maxWidth / 2 : layout.x;
  drawDebugRect(left, layout.y - layout.fontSize / 2, layout.maxWidth, layout.fontSize, label);
  drawDebugPoint(layout.x, layout.y);
}

function drawDebugBox(layout, label) {
  drawDebugRect(layout.x, layout.y, layout.w, layout.h, label);
}

function drawDebugRect(x, y, w, h, label) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
  ctx.fillStyle = "rgba(255, 0, 0, 0.08)";
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
  ctx.font = makeFont(16, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${label} x:${Math.round(x)} y:${Math.round(y)}`, x + 4, y - 4);
  ctx.restore();
}

function drawDebugCircle(x, y, radius, label) {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 128, 255, 0.75)";
  ctx.fillStyle = "rgba(0, 128, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(0, 128, 255, 0.95)";
  ctx.font = makeFont(16, 700);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`${label} x:${Math.round(x)} y:${Math.round(y)}`, x - radius, y - radius - 4);
  ctx.restore();
  drawDebugPoint(x, y);
}

function drawDebugPoint(x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 255, 128, 0.9)";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const imageBox = templateImage ? getTemplateLayout().mainImage : { x: 96, y: 196, w: 832, h: 694 };
  return x >= imageBox.x && x <= imageBox.x + imageBox.w && y >= imageBox.y && y <= imageBox.y + imageBox.h;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
