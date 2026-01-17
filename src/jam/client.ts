import { DEFAULT_JAM_SERVER, JAM_CONFIG } from './config';
import type { JamMessage, JamParticipant, JamConnectionState } from './types';

export interface JamClientOptions {
  server?: string;
  sessionCode: string;
  participantId: string;
  participantName: string;
  isHost: boolean;
  onMessage: (message: JamMessage) => void;
  onConnectionChange: (state: JamConnectionState) => void;
  onParticipantsUpdate: (participants: JamParticipant[]) => void;
}

export class JamClient {
  private socket: WebSocket | null = null;
  private options: JamClientOptions;
  private connectionState: JamConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: JamClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    let server = this.options.server || DEFAULT_JAM_SERVER;

    // Strip protocol if present
    server = server.replace(/^https?:\/\//, '');

    // Build WebSocket URL for PartyKit
    // PartyKit URL format: wss://<project>.<user>.partykit.dev/party/<room>
    const wsUrl = `wss://${server}/party/${this.options.sessionCode}?_pk=${this.options.participantId}&name=${encodeURIComponent(this.options.participantName)}&isHost=${this.options.isHost}`;

    this.setConnectionState('connecting');

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');

        // Send join message
        this.send({
          type: 'join',
          senderId: this.options.participantId,
          timestamp: Date.now(),
          name: this.options.participantName,
          isHost: this.options.isHost,
        });
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as JamMessage;
          this.options.onMessage(message);

          // Handle participant updates
          if (message.type === 'participant-update') {
            this.options.onParticipantsUpdate(message.participants);
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      this.socket.onclose = () => {
        this.handleDisconnect();
      };

      this.socket.onerror = () => {
        // Error will be followed by close event
      };
    } catch (err) {
      this.setConnectionState('error');
      throw err;
    }
  }

  private handleDisconnect(): void {
    if (this.connectionState === 'disconnected') return;

    if (this.reconnectAttempts < JAM_CONFIG.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = JAM_CONFIG.reconnectDelayBase * Math.pow(2, this.reconnectAttempts - 1);
      this.setConnectionState('connecting');

      this.reconnectTimer = setTimeout(() => {
        if (this.connectionState !== 'disconnected') {
          this.connect().catch(() => {
            this.setConnectionState('error');
          });
        }
      }, delay);
    } else {
      this.setConnectionState('error');
    }
  }

  private setConnectionState(state: JamConnectionState): void {
    this.connectionState = state;
    this.options.onConnectionChange(state);
  }

  send(message: JamMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setConnectionState('disconnected');

    if (this.socket) {
      // Send leave message before disconnecting
      if (this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: 'leave',
          senderId: this.options.participantId,
          timestamp: Date.now(),
        });
      }

      this.socket.close();
      this.socket = null;
    }
  }

  getConnectionState(): JamConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}
