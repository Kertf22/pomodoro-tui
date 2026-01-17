import type { PomodoroState, JamParticipant, JamConnectionState } from '../types';

// Re-export for convenience
export type { JamConnectionState, JamParticipant } from '../types';

export interface JamSession {
  code: string;
  hostId: string;
  participants: JamParticipant[];
  createdAt: number;
}

export type JamMessageType =
  | 'join'
  | 'leave'
  | 'state-sync'
  | 'control'
  | 'participant-update'
  | 'transfer-host'
  | 'error';

export interface JamMessageBase {
  type: JamMessageType;
  senderId: string;
  timestamp: number;
}

export interface JamJoinMessage extends JamMessageBase {
  type: 'join';
  name: string;
  isHost: boolean;
}

export interface JamLeaveMessage extends JamMessageBase {
  type: 'leave';
}

export interface JamStateSyncMessage extends JamMessageBase {
  type: 'state-sync';
  state: PomodoroState;
}

export type JamControlAction = 'start' | 'pause' | 'reset' | 'skip';

export interface JamControlMessage extends JamMessageBase {
  type: 'control';
  action: JamControlAction;
}

export interface JamParticipantUpdateMessage extends JamMessageBase {
  type: 'participant-update';
  participants: JamParticipant[];
}

export interface JamErrorMessage extends JamMessageBase {
  type: 'error';
  message: string;
}

export interface JamTransferHostMessage extends JamMessageBase {
  type: 'transfer-host';
  newHostId: string;
}

export type JamMessage =
  | JamJoinMessage
  | JamLeaveMessage
  | JamStateSyncMessage
  | JamControlMessage
  | JamParticipantUpdateMessage
  | JamTransferHostMessage
  | JamErrorMessage;
