import { Pomodoro } from '../pomodoro';
import type { PomodoroState } from '../types';
import { JamClient } from './client';
import { JAM_CONFIG } from './config';
import { generateSessionCode } from './session-code';
import type { JamMessage, JamParticipant, JamConnectionState, JamControlAction } from './types';

export interface JamManagerOptions {
  pomodoro: Pomodoro;
  isHost: boolean;
  sessionCode?: string; // Required for participants, generated for hosts
  participantName: string;
  server?: string;
  onStateChange?: () => void;
  onParticipantsChange?: (participants: JamParticipant[]) => void;
  onConnectionChange?: (state: JamConnectionState) => void;
  onHostChange?: (isHost: boolean) => void;
}

export class JamManager {
  private client: JamClient | null = null;
  private pomodoro: Pomodoro;
  private options: JamManagerOptions;
  private participantId: string;
  private sessionCode: string;
  private participants: JamParticipant[] = [];
  private connectionState: JamConnectionState = 'disconnected';
  private stateSyncTimer: NodeJS.Timeout | null = null;
  private _isHost: boolean;

  constructor(options: JamManagerOptions) {
    this.options = options;
    this.pomodoro = options.pomodoro;
    this.participantId = this.generateParticipantId();
    this._isHost = options.isHost;

    // Generate code for hosts, use provided code for participants
    this.sessionCode = options.isHost
      ? generateSessionCode()
      : options.sessionCode || '';

    // Set jam mode on pomodoro for participants (they receive state from host)
    if (!options.isHost) {
      this.pomodoro.setJamMode(true);
    }
  }

  private generateParticipantId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  async connect(): Promise<void> {
    this.client = new JamClient({
      server: this.options.server,
      sessionCode: this.sessionCode,
      participantId: this.participantId,
      participantName: this.options.participantName,
      isHost: this.options.isHost,
      onMessage: (message) => this.handleMessage(message),
      onConnectionChange: (state) => this.handleConnectionChange(state),
      onParticipantsUpdate: (participants) => this.handleParticipantsUpdate(participants),
    });

    await this.client.connect();

    // Host starts broadcasting state
    if (this.options.isHost) {
      this.startStateBroadcast();
    }
  }

  private handleMessage(message: JamMessage): void {
    switch (message.type) {
      case 'state-sync':
        // Participants receive state from host
        if (!this._isHost && message.senderId !== this.participantId) {
          const stateMsg = message as JamMessage & { state: PomodoroState };
          this.pomodoro.setState(stateMsg.state);
          this.options.onStateChange?.();
        }
        break;

      case 'control':
        // Participants receive control commands from host
        if (!this._isHost) {
          const controlMsg = message as JamMessage & { action: JamControlAction };
          this.handleControlAction(controlMsg.action);
        }
        break;

      case 'participant-update':
        // Handled in onParticipantsUpdate callback
        break;
    }
  }

  private handleControlAction(action: JamControlAction): void {
    // Control actions are already applied via state sync
    // This is for any immediate UI feedback if needed
    this.options.onStateChange?.();
  }

  private handleConnectionChange(state: JamConnectionState): void {
    this.connectionState = state;
    this.options.onConnectionChange?.(state);
  }

  private handleParticipantsUpdate(participants: JamParticipant[]): void {
    this.participants = participants;

    // Check if current user's host status changed
    const me = participants.find(p => p.id === this.participantId);
    if (me && me.isHost !== this._isHost) {
      const wasHost = this._isHost;
      this._isHost = me.isHost;

      // If we became the host, start broadcasting and disable jam mode
      if (this._isHost && !wasHost) {
        this.pomodoro.setJamMode(false);
        this.startStateBroadcast();
      }

      // Notify UI of host change
      this.options.onHostChange?.(this._isHost);
    }

    this.options.onParticipantsChange?.(participants);
  }

  private startStateBroadcast(): void {
    this.stateSyncTimer = setInterval(() => {
      if (this.client?.isConnected()) {
        this.client.send({
          type: 'state-sync',
          senderId: this.participantId,
          timestamp: Date.now(),
          state: this.pomodoro.getState(),
        } as JamMessage);
      }
    }, JAM_CONFIG.stateSyncInterval);
  }

  // Control methods (only work for host)
  sendControl(action: JamControlAction): void {
    if (!this._isHost || !this.client?.isConnected()) return;

    this.client.send({
      type: 'control',
      senderId: this.participantId,
      timestamp: Date.now(),
      action,
    } as JamMessage);
  }

  // Transfer host to another participant (only works for host)
  transferHost(newHostId: string): void {
    if (!this._isHost || !this.client?.isConnected()) return;
    if (newHostId === this.participantId) return; // Can't transfer to self

    this.client.send({
      type: 'transfer-host',
      senderId: this.participantId,
      timestamp: Date.now(),
      newHostId,
    } as JamMessage);
  }

  // Get list of other participants (non-host) for transfer UI
  getOtherParticipants(): JamParticipant[] {
    return this.participants.filter(p => p.id !== this.participantId);
  }

  getParticipantId(): string {
    return this.participantId;
  }

  disconnect(): void {
    if (this.stateSyncTimer) {
      clearInterval(this.stateSyncTimer);
      this.stateSyncTimer = null;
    }

    this.client?.disconnect();
    this.client = null;
    this.connectionState = 'disconnected';
  }

  // Getters
  getSessionCode(): string {
    return this.sessionCode;
  }

  getParticipants(): JamParticipant[] {
    return this.participants;
  }

  getConnectionState(): JamConnectionState {
    return this.connectionState;
  }

  isHost(): boolean {
    return this._isHost;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}
