const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let oscillator, noiseBufferSource, gainNode, analyser, filterNode, reverbNode, distortionNode;

// Inicializar el analizador para visualización
analyser = audioContext.createAnalyser();
analyser.fftSize = 256; // Tamaño de la FFT para análisis de frecuencia
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);
const canvas = document.getElementById('waveformCanvas');
const canvasCtx = canvas.getContext('2d');

function drawWaveform() {
  requestAnimationFrame(drawWaveform);
  analyser.getByteTimeDomainData(dataArray); // Obtener datos de la forma de onda
  canvasCtx.fillStyle = '#f9f9f9';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#4CAF50';
  canvasCtx.beginPath();
  const sliceWidth = canvas.width * 1.0 / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * canvas.height / 2;
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();
}

// Función para aplicar reverberación
function applyReverb(audioSource, reverbAmount) {
  const convolver = audioContext.createConvolver();
  const length = audioContext.sampleRate * 2.0; // 2 segundos de reverberación
  const impulseResponse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  const left = impulseResponse.getChannelData(0);
  const right = impulseResponse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
  }

  convolver.buffer = impulseResponse;
  const dryGain = audioContext.createGain();
  const wetGain = audioContext.createGain();

  dryGain.gain.value = 1 - reverbAmount;
  wetGain.gain.value = reverbAmount;

  audioSource.connect(dryGain);
  audioSource.connect(convolver);
  convolver.connect(wetGain);

  dryGain.connect(analyser);
  wetGain.connect(analyser);
  analyser.connect(audioContext.destination);
}

// Función para aplicar distorsión
function applyDistortion(audioSource, distortionAmount) {
  distortionNode = audioContext.createWaveShaper();
  distortionNode.curve = makeDistortionCurve(distortionAmount);
  distortionNode.oversample = '4x';
  audioSource.connect(distortionNode);
  distortionNode.connect(analyser);
  analyser.connect(audioContext.destination);
}

function makeDistortionCurve(amount) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;

  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Función para aplicar envolvente ADSR
function applyADSR(audioSource, attack, decay, sustain, release) {
  const now = audioContext.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(1, now + attack / 1000);
  gainNode.gain.linearRampToValueAtTime(sustain, now + attack / 1000 + decay / 1000);
}

// Función para reproducir un sonido basado en los parámetros del usuario
document.getElementById('playSound').addEventListener('click', () => {
  stopAllSounds();
  const oscillatorType = document.getElementById('oscillatorType').value;
  const frequency = parseFloat(document.getElementById('frequency').value);
  const duration = parseFloat(document.getElementById('duration').value);
  const volume = parseFloat(document.getElementById('volume').value);
  const reverbAmount = parseFloat(document.getElementById('reverb').value);
  const distortionAmount = parseFloat(document.getElementById('distortion').value);
  const attack = parseFloat(document.getElementById('attack').value);
  const decay = parseFloat(document.getElementById('decay').value);
  const sustain = parseFloat(document.getElementById('sustain').value);
  const release = parseFloat(document.getElementById('release').value);
  const loop = document.getElementById('loop').checked;
  const reverse = document.getElementById('reverse').checked;

// Crear el oscilador
if (oscillatorType.startsWith('custom')) {
  oscillator = audioContext.createOscillator();
  let customWave;
  switch(oscillatorType) {
    case 'custom':
      customWave = createCustomOscillator(audioContext);
      break;
    case 'custom2':
      customWave = createSmoothSquareWave(audioContext);
      break;
    case 'custom3':
      customWave = createHarmonicTriangleWave(audioContext);
      break;
    case 'custom4':
      customWave = createRandomWave(audioContext);
      break;
  }
  oscillator.setPeriodicWave(customWave);
} else {
  oscillator = audioContext.createOscillator();
  oscillator.type = oscillatorType;
}

  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

  gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

  // Aplicar filtro al oscilador
  applyFilter(oscillator);

  // Aplicar reverberación
  applyReverb(oscillator, reverbAmount);

  // Aplicar distorsión
  if (distortionAmount > 0) {
    applyDistortion(oscillator, distortionAmount);
  }

  // Aplicar envolvente ADSR
  applyADSR(oscillator, attack, decay, sustain, release);

  oscillator.loop = loop; // Activar o desactivar el loop
  if (reverse) {
    oscillator.detune.setValueAtTime(-1200, audioContext.currentTime); // Invertir reproducción cambiando la afinación
  }

  oscillator.start();
  if (!loop) {
    oscillator.stop(audioContext.currentTime + duration + release / 1000);
  }
  drawWaveform();
});


// Función Onda customizada
function createCustomOscillator(audioContext, type = 'custom') {
  const real = new Float32Array([0, 0.5, 0, 0.25, 0]); // Coeficientes reales
  const imag = new Float32Array([0, 0, 0.5, 0, 0.25]); // Coeficientes imaginarios

  // Crear una tabla de ondas personalizada
  const waveTable = audioContext.createPeriodicWave(real, imag);

  // Crear el oscilador
  const oscillator = audioContext.createOscillator();
  oscillator.setPeriodicWave(waveTable); // Aplicar la tabla de ondas
  return oscillator;
}

// Función para crear una onda suave cuadrada
function createSmoothSquareWave(audioContext, type = 'custom2') {
  const real = new Float32Array([0, 0.5, 0, 0.25, 0]);
  const imag = new Float32Array([0, 0, 0.5, 0, 0.25]);
  return audioContext.createPeriodicWave(real, imag);
}

// Función para crear una onda triangular harmónica
function createHarmonicTriangleWave(audioContext, type = 'custom3') {
  const real = new Float32Array([0, 0, 0.3, 0, 0.1]);
  const imag = new Float32Array([0, 0.5, 0, 0.25, 0]);
  return audioContext.createPeriodicWave(real, imag);
}

// Función para crear una onda aleatoria
function createRandomWave(audioContext, type = 'custom4') {
  const real = new Float32Array(8);
  const imag = new Float32Array(8);
  for (let i = 0; i < real.length; i++) {
    real[i] = Math.random() * 2 - 1; // Valores entre -1 y 1
    imag[i] = Math.random() * 2 - 1; // Valores entre -1 y 1
  }
  return audioContext.createPeriodicWave(real, imag);
}

// Función para generar ruido blanco
document.getElementById('generateNoise').addEventListener('click', () => {
  stopAllSounds();
  const duration = parseFloat(document.getElementById('duration').value);
  const volume = parseFloat(document.getElementById('volume').value);
  const bufferSize = audioContext.sampleRate * duration; // Tamaño del buffer
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1; // Valores aleatorios entre -1 y 1
  }
  noiseBufferSource = audioContext.createBufferSource();
  noiseBufferSource.buffer = noiseBuffer;
  gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

  // Aplicar filtro al ruido
  applyFilter(noiseBufferSource);

  // Aplicar reverberación
  const reverbAmount = parseFloat(document.getElementById('reverb').value);
  applyReverb(noiseBufferSource, reverbAmount);

  // Aplicar distorsión
  const distortionAmount = parseFloat(document.getElementById('distortion').value);
  if (distortionAmount > 0) {
    applyDistortion(noiseBufferSource, distortionAmount);
  }

  noiseBufferSource.loop = document.getElementById('loop').checked; // Activar o desactivar el loop

  noiseBufferSource.start();
  if (!noiseBufferSource.loop) {
    noiseBufferSource.stop(audioContext.currentTime + duration);
  }
  drawWaveform();
});

// Función para generar una explosión
document.getElementById('generateExplosion').addEventListener('click', () => {
  stopAllSounds();
  const duration = 1.0; // Duración corta para explosiones
  const volume = 0.8; // Volumen alto
  const noiseIntensity = parseFloat(document.getElementById('noiseIntensity').value);
  const pitchShift = parseFloat(document.getElementById('pitchShift').value);
  const delayTime = parseFloat(document.getElementById('delayTime').value);

  // Crear fuente de ruido blanco
  const bufferSize = audioContext.sampleRate * duration;
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * noiseIntensity; // Intensidad del ruido
  }

  noiseBufferSource = audioContext.createBufferSource();
  noiseBufferSource.buffer = noiseBuffer;
  gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

  // Aplicar envolvente ADSR
  applyADSR(noiseBufferSource, 0, 100, 0.1, 300);

  // Aplicar filtro de paso bajo para explosiones
  filterNode = audioContext.createBiquadFilter();
  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(300, audioContext.currentTime); // Frecuencia de corte baja

  // Aplicar distorsión
  distortionNode = audioContext.createWaveShaper();
  distortionNode.curve = makeDistortionCurve(80); // Distorsión alta
  distortionNode.oversample = '4x';

  // Aplicar reverberación
  applyReverb(noiseBufferSource, 0.6); // Reverberación media

  // Aplicar pitch shift
  noiseBufferSource.detune.setValueAtTime(pitchShift, audioContext.currentTime);

  // Conectar nodos
  noiseBufferSource.connect(filterNode);
  filterNode.connect(distortionNode);
  distortionNode.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioContext.destination);

  // Reproducir con delay opcional
  if (delayTime > 0) {
    const delayNode = audioContext.createDelay();
    delayNode.delayTime.setValueAtTime(delayTime, audioContext.currentTime);
    gainNode.connect(delayNode);
    delayNode.connect(analyser);
  }

  noiseBufferSource.start();
  noiseBufferSource.stop(audioContext.currentTime + duration + 0.3);
  drawWaveform();
});

// Función para generar un disparo
document.getElementById('generateGunshot').addEventListener('click', () => {
  stopAllSounds();
  const duration = 0.3; // Duración muy corta para disparos
  const volume = 0.9; // Volumen alto
  const noiseIntensity = parseFloat(document.getElementById('noiseIntensity').value);
  const pitchShift = parseFloat(document.getElementById('pitchShift').value);
  const delayTime = parseFloat(document.getElementById('delayTime').value);

  // Crear fuente de ruido blanco
  const bufferSize = audioContext.sampleRate * duration;
  const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * noiseIntensity; // Intensidad del ruido
  }

  noiseBufferSource = audioContext.createBufferSource();
  noiseBufferSource.buffer = noiseBuffer;
  gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

  // Aplicar envolvente ADSR
  applyADSR(noiseBufferSource, 0, 50, 0.0, 100);

  // Aplicar filtro de paso alto para disparos
  filterNode = audioContext.createBiquadFilter();
  filterNode.type = 'highpass';
  filterNode.frequency.setValueAtTime(1500, audioContext.currentTime); // Frecuencia de corte alta

  // Aplicar distorsión
  distortionNode = audioContext.createWaveShaper();
  distortionNode.curve = makeDistortionCurve(100); // Distorsión máxima
  distortionNode.oversample = '4x';

  // Aplicar reverberación
  applyReverb(noiseBufferSource, 0.3); // Reverberación ligera

  // Aplicar pitch shift
  noiseBufferSource.detune.setValueAtTime(pitchShift, audioContext.currentTime);

  // Conectar nodos
  noiseBufferSource.connect(filterNode);
  filterNode.connect(distortionNode);
  distortionNode.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioContext.destination);

  // Reproducir con delay opcional
  if (delayTime > 0) {
    const delayNode = audioContext.createDelay();
    delayNode.delayTime.setValueAtTime(delayTime, audioContext.currentTime);
    gainNode.connect(delayNode);
    delayNode.connect(analyser);
  }

  noiseBufferSource.start();
  noiseBufferSource.stop(audioContext.currentTime + duration + 0.1);
  drawWaveform();
});

// Función para generar un rayo láser con control de agudeza
document.getElementById('generateLaser').addEventListener('click', () => {
  stopAllSounds();
  const duration = 0.3; // Duración corta para el láser
  const volume = 0.7; // Volumen medio-alto
  const baseFrequency = parseFloat(document.getElementById('laserFrequency').value);
  const pitchSweep = parseFloat(document.getElementById('pitchSweep').value);
  const amplitudeModulation = parseFloat(document.getElementById('amplitudeModulation').value);
  const sharpness = parseFloat(document.getElementById('sharpness').value); // Agudeza

  // Crear oscilador principal
  oscillator = audioContext.createOscillator();
  oscillator.type = 'sawtooth'; // Forma de onda aguda
  oscillator.frequency.setValueAtTime(baseFrequency, audioContext.currentTime);

  gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

  // Aplicar envolvente ADSR
  applyADSR(oscillator, 0, 30, 0.0, 100);

  // Aplicar pitch sweep (cambio de tono)
  oscillator.frequency.exponentialRampToValueAtTime(
    baseFrequency + pitchSweep,
    audioContext.currentTime + duration
  );

  // Aplicar modulación de amplitud
  const modulationOscillator = audioContext.createOscillator();
  modulationOscillator.type = 'sine';
  modulationOscillator.frequency.setValueAtTime(amplitudeModulation, audioContext.currentTime);

  const modulationGain = audioContext.createGain();
  modulationGain.gain.setValueAtTime(0.5, audioContext.currentTime);

  modulationOscillator.connect(modulationGain);
  modulationGain.connect(gainNode.gain);

  // Aplicar filtro de paso alto para controlar la agudeza
  filterNode = audioContext.createBiquadFilter();
  filterNode.type = 'highpass';
  filterNode.frequency.setValueAtTime(sharpness, audioContext.currentTime); // Control de agudeza

  // Aplicar distorsión
  distortionNode = audioContext.createWaveShaper();
  distortionNode.curve = makeDistortionCurve(50); // Distorsión media
  distortionNode.oversample = '4x';

  // Aplicar reverberación
  applyReverb(oscillator, 0.2); // Reverberación ligera

  // Conectar nodos
  oscillator.connect(filterNode);
  filterNode.connect(distortionNode);
  distortionNode.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioContext.destination);

  // Iniciar osciladores
  oscillator.start();
  modulationOscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.1);
  modulationOscillator.stop(audioContext.currentTime + duration + 0.1);

  drawWaveform();
});

// Función para generar una onda personalizada
function createCustomWaveFromInput(audioContext) {
  const realInput = document.getElementById('customReal').value;
  const imagInput = document.getElementById('customImag').value;

  const real = new Float32Array(realInput.split(',').map(Number));
  const imag = new Float32Array(imagInput.split(',').map(Number));

  return audioContext.createPeriodicWave(real, imag);
}

// Función para detener todos los sonidos
document.getElementById('stopAll').addEventListener('click', stopAllSounds);

function applyFilter(audioSource) {
  const filterType = document.getElementById('filterType').value;
  const filterFrequency = parseFloat(document.getElementById('filterFrequency').value);
  filterNode = audioContext.createBiquadFilter();
  filterNode.type = filterType;
  filterNode.frequency.setValueAtTime(filterFrequency, audioContext.currentTime);
  audioSource.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioContext.destination);
}

function stopAllSounds() {
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
  }
  if (noiseBufferSource) {
    noiseBufferSource.stop();
    noiseBufferSource.disconnect();
    noiseBufferSource = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
  if (filterNode) {
    filterNode.disconnect();
    filterNode = null;
  }
  if (reverbNode) {
    reverbNode.disconnect();
    reverbNode = null;
  }
  if (distortionNode) {
    distortionNode.disconnect();
    distortionNode = null;
  }
}

// Función para restablecer parámetros por defecto
document.getElementById('resetDefaults').addEventListener('click', () => {
  document.getElementById('oscillatorType').value = 'sine';
  document.getElementById('filterType').value = 'lowpass';
  document.getElementById('filterFrequency').value = '1000';
  document.getElementById('frequency').value = '440';
  document.getElementById('duration').value = '2';
  document.getElementById('volume').value = '0.5';
  document.getElementById('reverb').value = '0';
  document.getElementById('distortion').value = '0';
  document.getElementById('attack').value = '10';
  document.getElementById('decay').value = '200';
  document.getElementById('sustain').value = '0.5';
  document.getElementById('release').value = '300';
  document.getElementById('loop').checked = false;
  document.getElementById('reverse').checked = false;
  document.getElementById('noiseIntensity').value = '0.5';
  document.getElementById('pitchShift').value = '0';
  document.getElementById('delayTime').value = '0';
  document.getElementById('laserFrequency').value = '3000';
  document.getElementById('pitchSweep').value = '-2000';
  document.getElementById('amplitudeModulation').value = '5';
  document.getElementById('sharpness').value = '5000';
});