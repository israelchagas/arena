// ESC/POS printing via Web Bluetooth for 58mm thermal printers (e.g. AL-3179)
//
// Why this exists: window.print() sends HTML to the OS print queue.
// Thermal printers speak ESC/POS, not HTML → garbled output.
// Web Bluetooth lets us send raw ESC/POS bytes directly, bypassing drivers.

// ── Minimal Web Bluetooth type shims ─────────────────────────────────────────
interface BTCharacteristic {
  properties: { writeWithoutResponse: boolean; write: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValueWithoutResponse(v: any): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValueWithResponse(v: any): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValue(v: any): Promise<void>;
}
interface BTService { getCharacteristic(uuid: string): Promise<BTCharacteristic> }
interface BTServer {
  connected: boolean;
  connect(): Promise<BTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BTService>;
}
interface BTDevice {
  gatt?: BTServer;
  addEventListener(e: 'gattserverdisconnected', cb: () => void): void;
}
declare global {
  interface Navigator { bluetooth?: {
    requestDevice(opts: { acceptAllDevices?: boolean; filters?: { services?: string[] }[]; optionalServices?: string[] }): Promise<BTDevice>;
  }}
}

// ── Service / characteristic UUIDs for common 58mm BLE thermal printers ──────
// The app tries each profile in order until one succeeds.
const PROFILES = [
  // Profile 1 – most common Chinese 58mm printers (AL-3179, etc.)
  { svc: '000018f0-0000-1000-8000-00805f9b34fb', chr: '00002af1-0000-1000-8000-00805f9b34fb' },
  // Profile 2 – PrinterShare-compatible BLE printers
  { svc: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  // Profile 3 – ISSC BLE UART (another common variant)
  { svc: '49535343-fe7d-4ae5-8fa9-9fafd205e455', chr: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
];

// ── Public types ──────────────────────────────────────────────────────────────

export interface PrintInfo {
  token: string;
  nome: string;
  sexo: 'M' | 'F';
  dataNasc: string;     // YYYY-MM-DD
  faixa?: string;
  peso?: number;
  categoria?: string;
  associacao?: string;
  eventoNome: string;
}

// ── Main class ────────────────────────────────────────────────────────────────

export class BluetoothPrinter {
  private device: BTDevice | null = null;
  private char: BTCharacteristic | null = null;
  private _onDisconnect: (() => void) | null = null;

  /** True only when GATT is connected and the write characteristic is ready */
  get isConnected(): boolean {
    return !!(this.device?.gatt?.connected && this.char);
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  /**
   * Opens the browser's Bluetooth device picker and connects.
   * The user selects the printer manually — no need to know its MAC address.
   */
  async connect(onDisconnect?: () => void): Promise<void> {
    if (!BluetoothPrinter.isSupported()) throw new Error('Web Bluetooth não suportado. Use Chrome no Android ou Desktop.');

    const device = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: PROFILES.map(p => p.svc),
    });

    this._onDisconnect = onDisconnect ?? null;
    device.addEventListener('gattserverdisconnected', () => {
      this.char = null;
      this._onDisconnect?.();
    });

    const server = await device.gatt!.connect();
    this.device = device;

    for (const { svc, chr } of PROFILES) {
      try {
        const service = await server.getPrimaryService(svc);
        this.char = await service.getCharacteristic(chr);
        return;
      } catch { /* try next profile */ }
    }

    device.gatt?.connect(); // leave connected for disconnect
    this.device = null;
    throw new Error('Perfil de impressão não encontrado. Verifique se a impressora AL-3179 está ligada e próxima.');
  }

  disconnect(): void {
    this.device?.gatt?.disconnect();
    this.device = null;
    this.char = null;
  }

  async printCredencial(info: PrintInfo): Promise<void> {
    if (!this.char) throw new Error('Impressora não conectada');
    await this._sendRaw(buildCommands(info));
  }

  /** Send arbitrary ESC/POS bytes, chunked to avoid BLE MTU overflows */
  private async _sendRaw(data: Uint8Array): Promise<void> {
    const CHUNK = 128;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await this._writeChunk(chunk);
      if (i + CHUNK < data.length) await sleep(30);
    }
  }

  private async _writeChunk(chunk: Uint8Array): Promise<void> {
    const c = this.char!;
    try {
      if (c.properties.writeWithoutResponse) {
        await c.writeValueWithoutResponse(chunk);
      } else {
        await c.writeValueWithResponse(chunk);
      }
    } catch {
      await c.writeValue(chunk); // deprecated fallback
    }
  }
}

// ── ESC/POS command builders ──────────────────────────────────────────────────

const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
const enc = new TextEncoder();

function b(...n: number[]): Uint8Array { return new Uint8Array(n); }

function cat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of parts) { out.set(a, off); off += a.length; }
  return out;
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

// Transliterate Portuguese diacritics to ASCII so any codepage works
function ascii(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x00-\x7F]/g, '?');
}

const CMD = {
  init:       b(ESC, 0x40),
  center:     b(ESC, 0x61, 0x01),
  left:       b(ESC, 0x61, 0x00),
  boldOn:     b(ESC, 0x45, 0x01),
  boldOff:    b(ESC, 0x45, 0x00),
  // GS ! byte: upper nibble = width mul-1, lower nibble = height mul-1
  sizeNormal: b(GS, 0x21, 0x00),         // 1×1
  sizeTall:   b(GS, 0x21, 0x01),         // 1×2 (tall — better readability for name)
  feed:       (n = 1) => new Uint8Array(n).fill(LF),
  text:       (s: string) => enc.encode(ascii(s) + '\n'),
  line:       (n = 32) => enc.encode('-'.repeat(n) + '\n'),
  // ESC/POS native QR code (GS ( k)
  qr(token: string, size = 6): Uint8Array {
    const d = enc.encode(token);
    const len = d.length + 3;
    const pL = len & 0xFF, pH = (len >> 8) & 0xFF;
    const store = new Uint8Array(8 + d.length);
    store.set([GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]);
    store.set(d, 8);
    return cat([
      b(GS, 0x28, 0x6B, 4, 0, 0x31, 0x41, 0x32, 0x00),  // model 2
      b(GS, 0x28, 0x6B, 3, 0, 0x31, 0x43, size),          // module size (dots)
      b(GS, 0x28, 0x6B, 3, 0, 0x31, 0x45, 0x31),          // error correction M
      store,                                                // store data
      b(GS, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30),          // print
    ]);
  },
};

function calcAge(dataNasc: string): number {
  const [y, m, d] = dataNasc.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

// Fit a string into `cols` columns, trimming with tilde if too long
function fit(s: string, cols: number): string {
  const a = ascii(s);
  return a.length <= cols ? a : a.slice(0, cols - 1) + '~';
}

function buildCommands(d: PrintInfo): Uint8Array {
  const COLS = 32; // 58mm @ 1× width ≈ 32 ASCII chars per line
  const age = calcAge(d.dataNasc);

  const parts: Uint8Array[] = [
    CMD.init,

    // ── Header ───────────────────────────────────────────
    CMD.center,
    CMD.boldOn,
    CMD.text('ARENA CHECK-IN'),
    CMD.boldOff,
    CMD.text(fit(d.eventoNome, COLS)),
    CMD.line(COLS),

    // ── Athlete name (tall for easy reading) ─────────────
    CMD.boldOn,
    CMD.sizeTall,
    CMD.text(fit(d.nome, COLS)),
    CMD.sizeNormal,
    CMD.boldOff,
  ];

  if (d.categoria)  parts.push(CMD.text(fit(d.categoria, COLS)));
  if (d.associacao) parts.push(CMD.text(fit(d.associacao, COLS)));

  const details = [
    d.sexo === 'M' ? 'Masculino' : 'Feminino',
    `${age} anos`,
    d.peso ? `${d.peso} kg` : null,
  ].filter(Boolean).join(' | ');
  parts.push(CMD.text(fit(details, COLS)));

  if (d.faixa) parts.push(CMD.text(`Faixa: ${d.faixa}`));

  parts.push(
    CMD.line(COLS),

    // ── QR code (centered, size=6 ≈ 42mm) ───────────────
    CMD.center,
    CMD.qr(d.token, 6),

    // ── Short token for visual verification ──────────────
    CMD.text(d.token.slice(0, 8).toUpperCase()),

    // ── Feed to tear-off line ────────────────────────────
    CMD.feed(4),
    // Partial cut (0x41) with feed (0x00 = 0 extra lines)
    // Many mini printers ignore this gracefully if no cutter present
    b(GS, 0x56, 0x42, 0x00),
  );

  return cat(parts);
}
