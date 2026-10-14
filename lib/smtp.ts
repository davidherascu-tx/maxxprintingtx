import "server-only";

// A small SMTP client: SSL (port 465) or STARTTLS (587), AUTH PLAIN/LOGIN, one message per
// connection. It runs on Cloudflare Workers (cloudflare:sockets) and in Node for `next dev`
// (node:tls). Both modules are imported at runtime through a variable, so neither Next's
// bundler nor OpenNext's tries to bundle them for the wrong platform.

export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string };
export type Address = { name?: string; email: string };
export type Message = { from: Address; to: string; replyTo?: string; subject: string; text: string; html: string };

type Conn = {
  write(data: string): Promise<void>;
  read(): Promise<string>; // the next chunk of text from the server
  upgrade(): Promise<Conn>; // STARTTLS
  close(): void;
};

const TIMEOUT_MS = 20_000;
const onWorkers = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

// Runtime-only imports: a variable keeps bundlers from resolving them at build time.
const runtimeImport = (spec: string) => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ spec);

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Mail server timed out (${what})`)), TIMEOUT_MS);
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}

async function connectWorkers(cfg: SmtpConfig): Promise<Conn> {
  const { connect } = await runtimeImport("cloudflare:sockets");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrap = (socket: any): Conn => {
    const reader = socket.readable.getReader();
    const writer = socket.writable.getWriter();
    const dec = new TextDecoder();
    return {
      write: (data) => writer.write(new TextEncoder().encode(data)),
      read: async () => {
        const { value, done } = await reader.read();
        if (done) throw new Error("Mail server closed the connection");
        return dec.decode(value);
      },
      upgrade: async () => {
        reader.releaseLock();
        writer.releaseLock();
        return wrap(socket.startTls());
      },
      close: () => void socket.close().catch(() => {}),
    };
  };
  return wrap(connect({ hostname: cfg.host, port: cfg.port }, { secureTransport: cfg.secure ? "on" : "starttls", allowHalfOpen: false }));
}

async function connectNode(cfg: SmtpConfig): Promise<Conn> {
  const tls = await runtimeImport("node:tls");
  const net = await runtimeImport("node:net");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrap = (socket: any): Conn => {
    const chunks: string[] = [];
    let waiting: ((s: string) => void) | null = null;
    let failed: Error | null = null;
    let fail: ((e: Error) => void) | null = null;
    // Decode here rather than with setEncoding, which would also break a later STARTTLS upgrade.
    socket.on("data", (buf: Uint8Array) => {
      const d = new TextDecoder().decode(buf);
      if (waiting) {
        waiting(d);
        waiting = null;
      } else chunks.push(d);
    });
    socket.on("error", (e: Error) => ((failed = e), fail?.(e)));
    socket.on("close", () => ((failed ??= new Error("Mail server closed the connection")), fail?.(failed)));
    return {
      write: (data) => new Promise((res, rej) => socket.write(data, (e?: Error) => (e ? rej(e) : res()))),
      read: () =>
        chunks.length
          ? Promise.resolve(chunks.shift()!)
          : failed
            ? Promise.reject(failed)
            : new Promise((res, rej) => ((waiting = res), (fail = rej))),
      upgrade: () =>
        new Promise((res, rej) => {
          socket.removeAllListeners("data");
          const secured = tls.connect({ socket, servername: cfg.host }, () => res(wrap(secured)));
          secured.once("error", rej);
        }),
      close: () => socket.end(),
    };
  };
  return new Promise((res, rej) => {
    const socket = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => res(wrap(socket)))
      : net.connect({ host: cfg.host, port: cfg.port }, () => res(wrap(socket)));
    socket.once("error", rej);
  });
}

/** One SMTP conversation: read replies (multi-line aware) and check their codes. */
class Session {
  private buffer = "";
  private conn: Conn;
  constructor(conn: Conn) {
    this.conn = conn;
  }

  async reply(): Promise<{ code: number; text: string }> {
    for (;;) {
      // A complete reply ends with a line "NNN text" (a dash after the code means more lines follow).
      const lines = this.buffer.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) {
          const text = lines.slice(0, i + 1).join("\n");
          this.buffer = lines.slice(i + 1).join("\r\n");
          return { code: Number(lines[i].slice(0, 3)), text };
        }
      }
      this.buffer += await withTimeout(this.conn.read(), "waiting for a reply");
    }
  }

  async expect(codes: number[], what: string) {
    const r = await this.reply();
    if (!codes.includes(r.code)) throw new Error(`${what}: ${r.text.replace(/\n/g, " ")}`);
    return r;
  }

  async command(line: string, codes: number[], what = line.split(" ")[0]) {
    await this.conn.write(`${line}\r\n`);
    return this.expect(codes, what);
  }

  async upgrade() {
    this.conn = await this.conn.upgrade();
    this.buffer = "";
  }

  close() {
    this.conn.close();
  }
}

// --- Message formatting -----------------------------------------------------------------

const utf8Base64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
/** Base64 in 76-character lines (RFC 2045). Base64 never contains ".", so no dot-stuffing is needed. */
const base64Lines = (s: string) => utf8Base64(s).replace(/.{1,76}/g, "$&\r\n");
/** A header value, encoded only when it isn't plain ASCII. */
const headerText = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8Base64(s)}?=`);
const formatAddress = (a: Address) => (a.name ? `${headerText(`"${a.name.replace(/["\\]/g, "")}"`)} <${a.email}>` : a.email);
/** Refuse addresses that could inject extra SMTP commands or headers. */
const safeAddress = (email: string) => {
  if (!/^[^\s<>()\r\n,;:"]+@[^\s<>()\r\n,;:"]+$/.test(email)) throw new Error(`Invalid email address: ${email}`);
  return email;
};

export function formatMessage(m: Message) {
  const boundary = `b_${crypto.randomUUID().replace(/-/g, "")}`;
  const domain = m.from.email.split("@")[1] ?? "localhost";
  return [
    `From: ${formatAddress(m.from)}`,
    `To: ${safeAddress(m.to)}`,
    ...(m.replyTo ? [`Reply-To: ${safeAddress(m.replyTo)}`] : []),
    `Subject: ${headerText(m.subject.replace(/[\r\n]+/g, " "))}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(m.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(m.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

// --- Sending -----------------------------------------------------------------

async function open(cfg: SmtpConfig) {
  const conn = await withTimeout(onWorkers() ? connectWorkers(cfg) : connectNode(cfg), "connecting");
  const s = new Session(conn);
  try {
    await s.expect([220], "Mail server greeting");
    const hello = `EHLO ${cfg.host.split(".").slice(-2).join(".") || "localhost"}`;
    let ehlo = await s.command(hello, [250], "EHLO");
    if (!cfg.secure) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error("The mail server doesn't offer STARTTLS on this port");
      await s.command("STARTTLS", [220]);
      await s.upgrade();
      ehlo = await s.command(hello, [250], "EHLO");
    }
    return { s, ehlo: ehlo.text };
  } catch (e) {
    s.close();
    throw e;
  }
}

async function login(s: Session, ehlo: string, cfg: SmtpConfig) {
  const auth = /AUTH[ =]([^\n]*)/i.exec(ehlo)?.[1].toUpperCase() ?? "";
  if (auth.includes("PLAIN")) {
    await s.command(`AUTH PLAIN ${utf8Base64(`\0${cfg.user}\0${cfg.password}`)}`, [235], "Login (AUTH PLAIN)");
  } else if (auth.includes("LOGIN")) {
    await s.command("AUTH LOGIN", [334], "AUTH LOGIN");
    await s.command(utf8Base64(cfg.user), [334], "Login (username)");
    await s.command(utf8Base64(cfg.password), [235], "Login (password)");
  } else {
    throw new Error("The mail server doesn't offer PLAIN or LOGIN authentication");
  }
}

export async function sendMail(cfg: SmtpConfig, m: Message) {
  const data = formatMessage(m);
  const { s, ehlo } = await open(cfg);
  try {
    await login(s, ehlo, cfg);
    await s.command(`MAIL FROM:<${safeAddress(m.from.email)}>`, [250], "Sender (MAIL FROM)");
    await s.command(`RCPT TO:<${safeAddress(m.to)}>`, [250, 251], "Recipient (RCPT TO)");
    await s.command("DATA", [354]);
    await s.command(`${data}\r\n.`, [250], "Message (DATA)");
    await s.command("QUIT", [221]).catch(() => {});
  } finally {
    s.close();
  }
}

/** Connect and say hello without logging in: checks host, port and SSL. Returns the server's greeting line. */
export async function probe(cfg: Omit<SmtpConfig, "user" | "password">) {
  const { s, ehlo } = await open({ ...cfg, user: "", password: "" });
  await s.command("QUIT", [221]).catch(() => {});
  s.close();
  return ehlo.split("\n")[0];
}

/** Log in and disconnect without sending anything: checks the username and password too. */
export async function verifyLogin(cfg: SmtpConfig) {
  const { s, ehlo } = await open(cfg);
  try {
    await login(s, ehlo, cfg);
    await s.command("QUIT", [221]).catch(() => {});
  } finally {
    s.close();
  }
}
