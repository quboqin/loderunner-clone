export class SoundManager {
  private static instance: SoundManager;
  private scene: Phaser.Scene;
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private musicVolume = 0.7;
  private sfxVolume = 0.8;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static getInstance(scene: Phaser.Scene): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager(scene);
    } else {
      // Always ensure we use the latest scene for sound context
      SoundManager.instance.scene = scene;
    }
    return SoundManager.instance;
  }

  // Initialize all game sounds
  initializeSounds(): void {
    // Load sound effects
    this.sounds.set('dig', this.scene.sound.add('dig', { volume: this.sfxVolume }));
    this.sounds.set('getGold', this.scene.sound.add('getGold', { volume: this.sfxVolume }));
    this.sounds.set('dead', this.scene.sound.add('dead', { volume: this.sfxVolume }));
    this.sounds.set('pass', this.scene.sound.add('pass', { volume: this.sfxVolume }));
    this.sounds.set('fall', this.scene.sound.add('fall', { volume: this.sfxVolume }));

    // Load level completion music
    this.sounds.set('goldFinish1', this.scene.sound.add('goldFinish1', { volume: this.musicVolume }));
    this.sounds.set('goldFinish2', this.scene.sound.add('goldFinish2', { volume: this.musicVolume }));
    this.sounds.set('goldFinish3', this.scene.sound.add('goldFinish3', { volume: this.musicVolume }));
  }

  // Play sound effect
  playSFX(soundKey: string): void {
    const sound = this.sounds.get(soundKey);
    if (sound && !sound.isPlaying) {
      sound.play();
    }
  }

  // Play level completion music (random selection)
  playLevelComplete(): void {
    const completionSounds = ['goldFinish1', 'goldFinish2', 'goldFinish3'];
    const randomSound = completionSounds[Math.floor(Math.random() * completionSounds.length)];
    this.playSFX(randomSound);
  }

  // Stop all sounds
  stopAll(): void {
    this.sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
  }

  // Set volume levels
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound, key) => {
      if (!key.startsWith('goldFinish') && 'setVolume' in sound) {
        (sound as any).setVolume(this.sfxVolume);
      }
    });
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound, key) => {
      if (key.startsWith('goldFinish') && 'setVolume' in sound) {
        (sound as any).setVolume(this.musicVolume);
      }
    });
  }

  // Get current volume levels
  getSFXVolume(): number {
    return this.sfxVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }
}