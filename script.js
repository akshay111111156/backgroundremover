const uploadInput = document.getElementById('fileElem');
const previewImg = document.getElementById('preview');
const resultImg = document.getElementById('result');
const downloadLink = document.getElementById('download');
const sampleImages = document.querySelectorAll('.sample');
const previewResultSection = document.getElementById('preview-result-section');
const processedImageSection = document.getElementById('processed-image-section');
const backgroundControls = document.getElementById('background-controls');
const bgUploadInput = document.getElementById('bgUpload');
const backgroundImage = document.getElementById('background-image');
const bgChoices = document.querySelectorAll('.bg-choice');

const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const resetBtn = document.getElementById('reset-btn');

const historyList = document.getElementById('history-list');
const backgroundHistory = document.getElementById('background-history');
const clearHistoryBtn = document.getElementById('clear-history-btn');

let historyImages = [];

previewResultSection.style.display = 'none';
processedImageSection.style.display = 'none';
backgroundControls.style.display = 'none';
backgroundImage.style.display = 'none';
backgroundHistory.style.display = 'none'; // Hide history on page load

let undoStack = [];
let redoStack = [];

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function createCombinedImage(fgSrc = resultImg.src, bgSrc = backgroundImage.src) {
  if (!fgSrc) return null;

  const fgImage = await loadImage(fgSrc);
  if (!fgImage) return null;

  let bgImageToUse = null;
  if (bgSrc && backgroundImage.style.display !== 'none') {
    bgImageToUse = await loadImage(bgSrc);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = fgImage.width;
  canvas.height = fgImage.height;

  if (bgImageToUse) {
    ctx.drawImage(bgImageToUse, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(fgImage, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob(blob => {
      const combinedUrl = URL.createObjectURL(blob);
      resolve(combinedUrl);
    }, 'image/png');
  });
}

async function createCombinedImageWithColor(color, fgSrc = resultImg.src) {
  if (!fgSrc) return null;

  const fgImage = await loadImage(fgSrc);
  if (!fgImage) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = fgImage.width;
  canvas.height = fgImage.height;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(fgImage, 0, 0, canvas.width, canvas.height);

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const combinedUrl = URL.createObjectURL(blob);
      resolve(combinedUrl);
    }, 'image/png');
  });
}

function addToHistory(src) {
  if (!src) return;
  if (historyImages.includes(src)) return;

  historyImages.push(src);
  backgroundHistory.style.display = 'block';

  const thumb = document.createElement('img');
  thumb.src = src;
  thumb.className = 'bg-choice';
  thumb.title = 'Click to restore this image';

  thumb.addEventListener('click', async () => {
    previewResultSection.style.display = 'flex';
    processedImageSection.style.display = 'block';
    backgroundControls.style.display = 'block';
    backgroundImage.style.display = 'none';

    resultImg.src = src;
    downloadLink.href = src;

    backgroundImage.src = '';
    backgroundImage.style.display = 'none';

    updateButtonsState();
  });

  historyList.appendChild(thumb);
}

async function setBackground(src) {
  if (!src) return;

  if (backgroundImage.src && backgroundImage.src !== src) {
    undoStack.push(backgroundImage.src);
    redoStack = [];
  }

  backgroundImage.src = src;
  backgroundImage.style.display = 'block';

  const combinedImageSrc = await createCombinedImage();
  if (combinedImageSrc) {
    addToHistory(combinedImageSrc);
  } else {
    addToHistory(src);
  }

  updateButtonsState();
}

async function setColorBackground(color) {
  if (!color) return;

  backgroundImage.src = "";
  backgroundImage.style.display = "none";

  const combinedImageSrc = await createCombinedImageWithColor(color);
  if (combinedImageSrc) {
    resultImg.src = combinedImageSrc;
    downloadLink.href = combinedImageSrc;
    addToHistory(combinedImageSrc);

    processedImageSection.style.display = 'block';
    previewResultSection.style.display = 'flex';
    backgroundControls.style.display = 'block';
  }

  updateButtonsState();
}

function updateButtonsState() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
  resetBtn.disabled = !backgroundImage.src;
}

undoBtn.addEventListener('click', () => {
  if (undoStack.length === 0) return;

  const lastSrc = undoStack.pop();
  if (backgroundImage.src) redoStack.push(backgroundImage.src);

  backgroundImage.src = lastSrc;
  backgroundImage.style.display = lastSrc ? 'block' : 'none';

  updateButtonsState();
});

redoBtn.addEventListener('click', () => {
  if (redoStack.length === 0) return;

  const nextSrc = redoStack.pop();
  if (backgroundImage.src) undoStack.push(backgroundImage.src);

  backgroundImage.src = nextSrc;
  backgroundImage.style.display = nextSrc ? 'block' : 'none';

  updateButtonsState();
});

resetBtn.addEventListener('click', () => {
  if (!backgroundImage.src) return;

  undoStack.push(backgroundImage.src);
  backgroundImage.src = "";
  backgroundImage.style.display = "none";
  redoStack = [];
  bgChoices.forEach(i => i.classList.remove('selected'));

  updateButtonsState();
});

uploadInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (file) {
    previewResultSection.style.display = 'flex';
    processedImageSection.style.display = 'none';
    backgroundControls.style.display = 'none';
    backgroundImage.style.display = 'none';

    previewImg.src = URL.createObjectURL(file);
    resultImg.src = "";
    downloadLink.href = "#";

    await removeBackground(file);
    processedImageSection.scrollIntoView({ behavior: 'smooth' });
  }
});

async function removeBackground(file) {
  backgroundImage.style.display = 'none';

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('http://localhost:5000/remove-bg', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Failed to remove background');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    resultImg.src = url;
    downloadLink.href = url;

    processedImageSection.style.display = 'block';
    backgroundControls.style.display = 'block';

    updateButtonsState();
    addToHistory(url);

  } catch (err) {
    console.error(err);
    alert('Background removal failed. Server error.');
  }
}

sampleImages.forEach(img => {
  img.addEventListener('click', () => {
    previewResultSection.style.display = 'flex';
    processedImageSection.style.display = 'none';
    backgroundControls.style.display = 'none';
    backgroundImage.style.display = 'none';

    previewImg.src = img.src;
    resultImg.src = "";
    downloadLink.href = "#";

    previewResultSection.scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => {
      resultImg.src = img.dataset.result;
      downloadLink.href = img.dataset.result;
      processedImageSection.style.display = 'block';
      backgroundControls.style.display = 'block';

      updateButtonsState();
      addToHistory(img.dataset.result);

      processedImageSection.scrollIntoView({ behavior: 'smooth' });
    }, 3000);
  });
});

bgUploadInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const bgUrl = URL.createObjectURL(file);
    setBackground(bgUrl);
  }
});

bgChoices.forEach(item => {
  item.addEventListener('click', () => {
    bgChoices.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');

    const color = item.dataset.color;
    if (color) {
      setColorBackground(color);
    } else {
      setBackground(item.src);
    }
  });
});

updateButtonsState();

downloadLink.addEventListener('click', async (e) => {
  e.preventDefault();

  if (!resultImg.src) {
    alert('No processed image to download!');
    return;
  }

  const combinedImageSrc = await createCombinedImage();
  if (!combinedImageSrc) {
    alert('Failed to generate combined image for download.');
    return;
  }

  const a = document.createElement('a');
  a.href = combinedImageSrc;
  a.download = 'image_with_background.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

const imageTabBtn = document.getElementById('image-tab');
const colorTabBtn = document.getElementById('color-tab');
const backgroundOptions = document.getElementById('background-options');
const colorOptions = document.getElementById('color-options');

imageTabBtn.addEventListener('click', () => {
  backgroundOptions.style.display = 'grid';
  colorOptions.style.display = 'none';
});

colorTabBtn.addEventListener('click', () => {
  backgroundOptions.style.display = 'none';
  colorOptions.style.display = 'grid';
});

clearHistoryBtn.addEventListener('click', () => {
  historyImages = [];
  historyList.innerHTML = '';
  backgroundHistory.style.display = 'none';
});

const getStartedBtn = document.getElementById('get-started-btn');
const welcomePopup = document.getElementById('welcome-popup');

getStartedBtn.addEventListener('click', () => {
  welcomePopup.style.display = 'none';
});
