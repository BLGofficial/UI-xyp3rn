import { describe, expect, it } from 'vitest';
import { mapJarvisStateToOrbState, ORB_STATE_CONFIG } from '@/lib/voice-orb';

describe('VoiceAssistantOrb state configuration and mapping', () => {
  it('preserves exact idle, listening, thinking, and speaking parameters', () => {
    expect(ORB_STATE_CONFIG.idle.speed).toBe(0);
    expect(ORB_STATE_CONFIG.idle.spinY).toBe(0.22);
    expect(ORB_STATE_CONFIG.listening.speed).toBe(0);
    expect(ORB_STATE_CONFIG.listening.listenW).toBe(1);
    expect(ORB_STATE_CONFIG.thinking.speed).toBe(1.35);
    expect(ORB_STATE_CONFIG.thinking.thinkW).toBe(1);
    expect(ORB_STATE_CONFIG.speaking.speed).toBe(0.75);
    expect(ORB_STATE_CONFIG.speaking.speakW).toBe(1);
  });

  it('maps JarvisVoiceState to VoiceOrbState cleanly', () => {
    expect(mapJarvisStateToOrbState('idle')).toBe('idle');
    expect(mapJarvisStateToOrbState('listening')).toBe('listening');
    expect(mapJarvisStateToOrbState('processing')).toBe('thinking');
    expect(mapJarvisStateToOrbState('speaking')).toBe('speaking');
  });
});
