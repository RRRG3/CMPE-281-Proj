// Alert Sound System - Different sounds for different severity levels

class AlertSoundManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
  }

  // Initialize audio context (required for modern browsers)
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Play sound based on severity
  playAlertSound(severity) {
    if (!this.enabled) return;
    
    this.init();
    
    switch(severity) {
      case 'critical':
        this.playCriticalSound();
        break;
      case 'high':
        this.playHighSound();
        break;
      case 'medium':
        this.playMediumSound();
        break;
      case 'low':
        this.playLowSound();
        break;
      default:
        this.playMediumSound();
    }
  }

  // Critical: Urgent alarm (high pitch, rapid beeps)
  playCriticalSound() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Play 3 rapid high-pitched beeps
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 1200; // High pitch
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, now + i * 0.2);
      gainNode.gain.linearRampToValueAtTime(0.3, now + i * 0.2 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.15);
      
      oscillator.start(now + i * 0.2);
      oscillator.stop(now + i * 0.2 + 0.15);
    }
  }

  // High: Warning sound (medium pitch, 2 beeps)
  playHighSound() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Play 2 medium-pitched beeps
    for (let i = 0; i < 2; i++) {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800; // Medium-high pitch
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, now + i * 0.3);
      gainNode.gain.linearRampToValueAtTime(0.25, now + i * 0.3 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.3 + 0.2);
      
      oscillator.start(now + i * 0.3);
      oscillator.stop(now + i * 0.3 + 0.2);
    }
  }

  // Medium: Notification sound (single beep)
  playMediumSound() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 600; // Medium pitch
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }

  // Low: Soft notification (gentle tone)
  playLowSound() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 400; // Lower pitch
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  // === Specific Alert Sounds ===

  // Glass Break: High pitched noise burst
  playGlassBreak() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Create noise buffer
    const bufferSize = ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Filter to make it sound like glass
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noise.start(now);
  }

  // Smoke Alarm: T3 Pattern (Beep-Beep-Beep... Pause)
  playSmokeAlarm() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const freq = 3200; // Smoke alarms are very high pitched (~3kHz)

    for(let i=0; i<3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'square'; // Harsh sound
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = now + (i * 0.6); // 0.5s on, 0.5s off approx
      gain.gain.setValueAtTime(0.5, startTime);
      gain.gain.setValueAtTime(0, startTime + 0.4);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    }
  }

  // Dog Bark: Low frequency noise burst (simulated)
  playDogBark() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Create noise
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Lowpass filter for "woof" sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(100, now + 0.2); // Pitch drop
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.8, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noise.start(now);
    
    // Add a second "woof" slightly later
    setTimeout(() => {
        const now2 = ctx.currentTime;
        const noise2 = ctx.createBufferSource();
        noise2.buffer = buffer;
        const filter2 = ctx.createBiquadFilter();
        filter2.type = 'lowpass';
        filter2.frequency.setValueAtTime(450, now2);
        filter2.frequency.linearRampToValueAtTime(120, now2 + 0.2);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0.6, now2);
        gain2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.2);
        
        noise2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(ctx.destination);
        noise2.start(now2);
    }, 300);
  }

  // Fall Detected: Rapid descending slide
  playFallDetected() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4); // Slide down
    
    osc.type = 'sawtooth';
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Door Open: Ding-Dong
  playDoorOpen() {
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Ding (High)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 800;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    osc1.start(now);
    osc1.stop(now + 1.0);
    
    // Dong (Low)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 600;
    osc2.type = 'sine';
    const start2 = now + 0.6;
    gain2.gain.setValueAtTime(0, start2);
    gain2.gain.linearRampToValueAtTime(0.3, start2 + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, start2 + 1.5);
    osc2.start(start2);
    osc2.stop(start2 + 1.5);
  }

  // Play sound by alert type name
  playForType(type) {
    if (!this.enabled) return;
    this.init();
    
    console.log('[Sound] Playing sound for type:', type);

    switch(type) {
        case 'glass_break':
            this.playGlassBreak();
            break;
        case 'smoke_alarm':
            this.playSmokeAlarm();
            break;
        case 'dog_bark':
            this.playDogBark();
            break;
        case 'fall':
            this.playFallDetected();
            break;
        case 'door_open':
            this.playDoorOpen();
            break;
        case 'no_motion':
        case 'unusual_noise':
            this.playMediumSound(); // Generic
            break;
        default:
            this.playLowSound();
    }
  }

  // Toggle sound on/off
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Mute sounds
  mute() {
    this.enabled = false;
  }

  // Unmute sounds
  unmute() {
    this.enabled = true;
  }
}

// Create singleton instance
const alertSounds = new AlertSoundManager();

export default alertSounds;
