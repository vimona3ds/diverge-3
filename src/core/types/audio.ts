import { IPixelDataExtractor } from './visual';

export interface IAudioNode {
  id: string;
  node: AudioNode;
  params: Record<string, AudioParam>;
  connect: (target: IAudioNode) => void;
  disconnect: (target?: IAudioNode) => void;
  dispose: () => void;
}

export interface IAudioProcessor {
  id: string;
  name: string;
  createNode: (audioContext: AudioContext, params: any) => IAudioNode;
  updateParams: (node: IAudioNode, params: any) => void;
}

export interface IAudioWorkletProcessor {
  id: string;
  name: string;
  processorPath: string;
  initialize: (audioContext: AudioContext) => Promise<void>;
  createNode: (audioContext: AudioContext, params: any) => AudioWorkletNode;
}

export interface ISamplePlayer {
  id: string;
  buffer: AudioBuffer;
  play: (options: {
    time?: number,
    offset?: number,
    duration?: number,
    playbackRate?: number,
    loop?: boolean
  }) => AudioBufferSourceNode;
  stop: (time?: number) => void;
}

export interface IVisualAudioBridge {
  id: string;
  connect: (extractor: IPixelDataExtractor, audioParams: AudioParam[]) => void;
  process: (time: number, deltaTime: number) => void;
  dispose: () => void;
} 