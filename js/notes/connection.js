import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import {
  PROTOCOL,
  base64,
  unbase64,
  awarenessPacket,
} from '../../../services/note-board/shared.js';

export const REMOTE = Symbol('notes-network');
export class NoteConnection {
  constructor(doc, { endpoint, room, key, onStatus, WebSocketImpl = WebSocket }) {
    this.doc = doc;
    this.endpoint = endpoint;
    this.room = room;
    this.key = key;
    this.onStatus = onStatus;
    this.WebSocketImpl = WebSocketImpl;
    this.awareness = new Awareness(doc);
    this.sequence = 0;
    this.acknowledged = -1;
    this.revision = 0;
    this.state = 'disconnected';
    this.paused = false;
    this.failed = false;
    this.ready = false;
    this.buffer = [];
    this.sent = 0;
    this.received = 0;
    this.retryDelay = 500;
    this.epoch = 0;
    this.onUpdate = (update, origin) => {
      if (origin === REMOTE) return;
      this.sequence++;
      this.buffer.push(update);
      clearTimeout(this.batchTimer);
      this.batchTimer = setTimeout(() => this.flush(), 120);
      this.emit();
    };
    doc.on('update', this.onUpdate);
    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      if (origin === REMOTE || ![...added, ...updated, ...removed].includes(doc.clientID)) return;
      clearTimeout(this.presenceTimer);
      this.presenceTimer = setTimeout(() => this.presence(), 100);
    });
    this.awareness.on('change', () => this.emit());
  }
  emit() {
    this.onStatus?.({
      state: this.state,
      sequence: this.sequence,
      acknowledged: this.acknowledged,
      pending: this.acknowledged < this.sequence,
      revision: this.revision,
      peers: [...this.awareness.getStates()]
        .filter(([id]) => id !== this.doc.clientID)
        .map(([, state]) => state.user)
        .filter(Boolean),
      sent: this.sent,
      received: this.received,
      error: this.error || '',
    });
  }
  send(message) {
    if (this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify(message));
    this.sent++;
    return true;
  }
  connect() {
    if (this.socket && [0, 1].includes(this.socket.readyState)) return;
    this.paused = false;
    this.failed = false;
    this.error = '';
    clearTimeout(this.retryTimer);
    this.state = 'connecting';
    this.ready = false;
    this.acknowledged = -1;
    const epoch = ++this.epoch;
    this.emit();
    const socket = new this.WebSocketImpl(`${this.endpoint}/${this.room}`, [
      PROTOCOL,
      `cap-${this.key}`,
    ]);
    this.socket = socket;
    socket.onopen = () => {
      if (epoch !== this.epoch) return;
      this.retryDelay = 500;
      this.lastPong = Date.now();
      this.send({
        type: 'hello',
        clientId: this.doc.clientID,
        vector: base64(Y.encodeStateVector(this.doc)),
      });
      this.heartbeat = setInterval(() => {
        if (Date.now() - this.lastPong > 45000) socket.close();
        else socket.send('ping');
      }, 20000);
      this.handshakeTimer = setTimeout(() => {
        if (!this.ready) socket.close();
      }, 15000);
    };
    socket.onmessage = (event) => {
      if (epoch !== this.epoch) return;
      if (event.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      try {
        if (typeof event.data !== 'string' || event.data.length > 400000) throw new Error();
        const message = JSON.parse(event.data);
        this.received++;
        if (message.type === 'welcome') {
          clearTimeout(this.handshakeTimer);
          Y.applyUpdate(this.doc, unbase64(message.update), REMOTE);
          this.revision = message.revision;
          this.buffer = [];
          this.ready = true;
          this.send({
            type: 'commit',
            sequence: this.sequence,
            update: base64(Y.encodeStateAsUpdate(this.doc, unbase64(message.vector))),
          });
          for (const peer of message.peers)
            applyAwarenessUpdate(
              this.awareness,
              awarenessPacket(peer.clientId, peer.clock, peer.state),
              REMOTE
            );
          const own = this.awareness.getLocalState();
          this.awareness.setLocalState(own);
          this.awareness.setLocalState(own);
          this.presence();
        } else if (message.type === 'ack') {
          if (
            !Number.isInteger(message.sequence) ||
            message.sequence < 0 ||
            message.sequence > this.sequence
          )
            throw new Error();
          this.acknowledged = Math.max(this.acknowledged, message.sequence);
          this.revision = message.revision;
          this.state = 'connected';
          this.flush();
        } else if (message.type === 'update') {
          Y.applyUpdate(this.doc, unbase64(message.update), REMOTE);
          this.revision = message.revision;
        } else if (message.type === 'presence')
          applyAwarenessUpdate(
            this.awareness,
            awarenessPacket(message.clientId, message.clock, message.state),
            REMOTE
          );
        else if (message.type === 'error') {
          this.error = message.message;
          this.failed = true;
          this.state = 'blocked';
          socket.close();
        } else throw new Error();
        this.emit();
      } catch {
        this.error = '服务器响应无效，同步已暂停；请先导出本机内容。';
        this.failed = true;
        this.state = 'blocked';
        socket.close();
        this.emit();
      }
    };
    socket.onerror = () => {
      /* close drives bounded reconnect; no content is discarded. */
    };
    socket.onclose = () => {
      if (epoch !== this.epoch) return;
      clearInterval(this.heartbeat);
      clearTimeout(this.handshakeTimer);
      this.ready = false;
      removeAwarenessStates(
        this.awareness,
        [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID),
        REMOTE
      );
      this.state = this.failed ? 'blocked' : this.paused ? 'paused' : 'disconnected';
      this.emit();
      if (!this.paused && !this.failed) {
        this.retryTimer = setTimeout(() => this.connect(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 10000);
      }
    };
  }
  flush() {
    if (!this.ready || this.socket?.readyState !== 1 || !this.buffer.length) return;
    const update = Y.mergeUpdates(this.buffer);
    this.buffer = [];
    this.send({ type: 'commit', sequence: this.sequence, update: base64(update) });
    this.emit();
  }
  presence() {
    if (!this.ready) return;
    this.send({
      type: 'presence',
      clock: this.awareness.meta.get(this.doc.clientID)?.clock || 0,
      state: this.awareness.getLocalState(),
    });
  }
  disconnect() {
    this.paused = true;
    this.epoch++;
    clearTimeout(this.retryTimer);
    clearTimeout(this.batchTimer);
    clearTimeout(this.handshakeTimer);
    clearInterval(this.heartbeat);
    this.ready = false;
    this.socket?.close(1000, 'User paused connection');
    this.state = 'paused';
    removeAwarenessStates(
      this.awareness,
      [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID),
      REMOTE
    );
    this.emit();
  }
  destroy() {
    this.disconnect();
    clearTimeout(this.presenceTimer);
    this.awareness.destroy();
    this.doc.off('update', this.onUpdate);
  }
}
