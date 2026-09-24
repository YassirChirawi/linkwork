import { EventEmitter } from 'events';

export interface LogEvent {
  time: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'system' | 'human';
  message: string;
}

export const logEmitter = new EventEmitter();

export function emitLog(type: LogEvent['type'], message: string): void {
  const time = new Date().toLocaleTimeString();
  logEmitter.emit('log', { time, type, message });
}
