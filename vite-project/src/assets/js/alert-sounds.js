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
