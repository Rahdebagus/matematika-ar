/**
 * Bunyi klik dan musik latar (kontrak docs/03-modules.md).
 *
 * Bunyi klik dibangkitkan langsung dengan WebAudio, bukan dimuat dari berkas:
 * satu blip pendek tidak sepadan dengan tambahan unduhan, dan aplikasi jadi
 * punya umpan balik suara tanpa menunggu aset apa pun.
 *
 * Musik latar tetap butuh berkas — panggil `playMusic()` setelah berkasnya
 * ada di `public/audio/`.
 *
 * AudioContext sengaja dibuat malas: browser menolak audio yang dimulai
 * sebelum ada interaksi pengguna.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private music: HTMLAudioElement | null = null;
  private musicVolume = 0.4;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  playClick(): void {
    if (this.muted) return;

    const context = this.ensureContext();
    if (!context) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.06);

    // Envelope cepat supaya terdengar seperti "tik", bukan nada.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }

  playMusic(url: string): void {
    this.stopMusic();

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = this.muted ? 0 : this.musicVolume;
    // Browser boleh menolak autoplay; itu bukan kondisi error.
    void audio.play().catch(() => undefined);
    this.music = audio;
  }

  stopMusic(): void {
    this.music?.pause();
    this.music = null;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.min(1, Math.max(0, volume));
    if (this.music && !this.muted) this.music.volume = this.musicVolume;
  }

  /** @returns kondisi bisu setelah ditogel. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.music) this.music.volume = this.muted ? 0 : this.musicVolume;
    return this.muted;
  }

  dispose(): void {
    this.stopMusic();
    void this.context?.close();
    this.context = null;
  }

  private ensureContext(): AudioContext | null {
    this.context ??= new AudioContext();
    // Sesudah tab tidak aktif, context bisa tersuspensi lagi.
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }
}
