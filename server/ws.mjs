// A minimal WebSocket server side (RFC 6455): enough for one viewer connection that gets
// JPEG frames (binary) and status (text) and sends small JSON messages (text). No
// extensions, no fragmentation on send; incoming fragmented messages are reassembled.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Completes the handshake on an 'upgrade' request; returns a socket wrapper or null. */
export function acceptWebSocket(req, socket, head) {
	const key = req.headers['sec-websocket-key'];
	if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
		socket.destroy();
		return null;
	}
	const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
	socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
	socket.setNoDelay(true);
	return new WebSocketConnection(socket, head);
}

class WebSocketConnection {
	constructor(socket, head) {
		this.socket = socket;
		this.open = true;
		this.handlers = { message: [], close: [] };
		this.buf = head?.length ? Buffer.from(head) : Buffer.alloc(0);
		this.parts = [];
		socket.on('data', (d) => {
			this.buf = Buffer.concat([this.buf, d]);
			this.parse();
		});
		const closed = () => {
			if (!this.open) return;
			this.open = false;
			for (const h of this.handlers.close) h();
		};
		socket.on('close', closed);
		socket.on('error', closed);
		if (this.buf.length) setImmediate(() => this.parse());
	}

	on(event, handler) {
		this.handlers[event].push(handler);
	}

	/** Bytes queued and not yet sent: the viewer is slower than the frames. */
	get backlog() {
		return this.socket.writableLength;
	}

	parse() {
		while (this.buf.length >= 2) {
			const b0 = this.buf[0];
			const b1 = this.buf[1];
			let len = b1 & 0x7f;
			let off = 2;
			if (len === 126) {
				if (this.buf.length < 4) return;
				len = this.buf.readUInt16BE(2);
				off = 4;
			} else if (len === 127) {
				if (this.buf.length < 10) return;
				len = Number(this.buf.readBigUInt64BE(2));
				off = 10;
			}
			const masked = (b1 & 0x80) !== 0;
			const need = off + (masked ? 4 : 0) + len;
			if (len > 4 << 20) return this.close(1009);
			if (this.buf.length < need) return;
			let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
			if (masked) {
				const mask = this.buf.subarray(off, off + 4);
				payload = Buffer.from(payload);
				for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
			}
			this.buf = this.buf.subarray(need);
			const fin = (b0 & 0x80) !== 0;
			const op = b0 & 0x0f;
			if (op === 0x8) return this.close(1000);
			if (op === 0x9) {
				this.frame(0xa, payload);
				continue;
			}
			if (op === 0xa) continue;
			if (op === 0x1 || op === 0x2 || op === 0x0) {
				this.parts.push(payload);
				if (!fin) continue;
				const data = Buffer.concat(this.parts);
				this.parts = [];
				for (const h of this.handlers.message) h(data.toString('utf8'));
			}
		}
	}

	frame(op, payload) {
		if (!this.open) return;
		const len = payload.length;
		const header = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
		if (len >= 126) {
			header[0] = 0x80 | op;
			if (len < 65536) {
				header[1] = 126;
				header.writeUInt16BE(len, 2);
			} else {
				header[1] = 127;
				header.writeBigUInt64BE(BigInt(len), 2);
			}
		}
		this.socket.write(Buffer.concat([header, payload]));
	}

	sendText(obj) {
		this.frame(0x1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)));
	}

	sendBinary(buf) {
		this.frame(0x2, buf);
	}

	close(code = 1000) {
		if (!this.open) return;
		const p = Buffer.alloc(2);
		p.writeUInt16BE(code);
		this.frame(0x8, p);
		this.socket.end();
		this.open = false;
		for (const h of this.handlers.close) h();
	}
}
