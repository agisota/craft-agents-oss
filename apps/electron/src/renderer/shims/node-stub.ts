/** Auto-generated Node builtin stub for Electron renderer. */
const fn = (..._a: unknown[]) => undefined
const afn = async (..._a: unknown[]) => undefined
const obj = () => ({ on: () => obj(), once: () => obj(), pipe: fn, write: fn, end: fn, listen: () => obj(), close: fn, kill: fn, stdout: { on: () => obj() }, stderr: { on: () => obj() }, stdin: { write: fn, end: fn } })
const hash = () => { const h: any = { update: () => h, digest: () => "0", setAAD: () => h, setAuthTag: () => h, getAuthTag: () => "" }; return h }

export const Buffer = fn as any
export const EOL = "/"
export const EventEmitter = fn as any
export const PassThrough = fn as any
export const Readable = fn as any
export const Server = (..._a: unknown[]) => obj()
export const Socket = (..._a: unknown[]) => obj()
export const Stream = fn as any
export const TextDecoder = fn as any
export const TextEncoder = fn as any
export const Transform = fn as any
export const URL = fn as any
export const URLSearchParams = fn as any
export const Writable = fn as any
export const access = fn as any
export const accessSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const appendFile = fn as any
export const appendFileSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const arch = () => "arm64"
export const argv = fn as any
export const basename = (...p: any[]) => (typeof p[0]==="string" ? p.filter(Boolean).join("/") : "")
export const chdir = fn as any
export const closeSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const connect = (..._a: unknown[]) => obj()
export const constants: any = new Proxy({}, { get: () => fn })
export const constants_fs: any = new Proxy({}, { get: () => fn })
export const copyFile = fn as any
export const copyFileSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const cpus = fn as any
export const createCipheriv = (..._a: unknown[]) => hash()
export const createConnection = (..._a: unknown[]) => obj()
export const createDecipheriv = (..._a: unknown[]) => hash()
export const createHash = (..._a: unknown[]) => hash()
export const createHmac = (..._a: unknown[]) => hash()
export const createPrivateKey = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const createPublicKey = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const createReadStream = (..._a: unknown[]) => obj()
export const createServer = (..._a: unknown[]) => obj()
export const createWriteStream = (..._a: unknown[]) => obj()
export const cwd = fn as any
export const debuglog = fn as any
export const delimiter = "/"
export const deprecate = fn as any
export const dirname = (...p: any[]) => (typeof p[0]==="string" ? p.filter(Boolean).join("/") : "")
export const endianness = fn as any
export const env = fn as any
export const exec = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const execFile = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const execFileSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const execSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const existsSync = () => false
export const exit = fn as any
export const extname = fn as any
export const fileURLToPath = fn as any
export const fork = (..._a: unknown[]) => obj()
export const format = fn as any
export const freemem = fn as any
export const generateKeyPairSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const get = (..._a: unknown[]) => obj()
export const getRandomValues = fn as any
export const homedir = () => "/"
export const hostname = () => "localhost"
export const inherits = fn as any
export const inspect = fn as any
export const isAbsolute = fn as any
export const join = (...p: any[]) => (typeof p[0]==="string" ? p.filter(Boolean).join("/") : "")
export const lstat = fn as any
export const lstatSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const mkdir = fn as any
export const mkdirSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const mkdtemp = fn as any
export const mkdtempSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const networkInterfaces = fn as any
export const nextTick = fn as any
export const normalize = (...p: any[]) => (typeof p[0]==="string" ? p.filter(Boolean).join("/") : "")
export const open = fn as any
export const openSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const parse = fn as any
export const pathToFileURL = fn as any
export const pbkdf2Sync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const pid = fn as any
export const platform = () => "darwin"
export const posix: any = new Proxy({}, { get: () => fn })
export const ppid = fn as any
export const privateDecrypt = fn as any
export const promises: any = new Proxy({}, { get: () => fn })
export const promisify = fn as any
export const publicEncrypt = fn as any
export const randomBytes = fn as any
export const randomFillSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const randomUUID = fn as any
export const readFile = (..._a: unknown[]) => (_a.length && typeof _a[0]==="string" ? "" : Promise.resolve(""))
export const readFileSync = () => ""
export const readSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const readdir = fn as any
export const readdirSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const realpath = fn as any
export const realpathSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const relative = (...p: any[]) => (typeof p[0]==="string" ? p.filter(Boolean).join("/") : "")
export const release = fn as any
export const rename = fn as any
export const renameSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const request = (..._a: unknown[]) => obj()
export const resolve = (...p: any[]) => (typeof p[0]==="string" ? p.filter(Boolean).join("/") : "")
export const rm = fn as any
export const rmSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const scryptSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const sep = "/"
export const sign = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const spawn = (..._a: unknown[]) => obj()
export const spawnSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const stat = fn as any
export const statSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const title = fn as any
export const tmpdir = () => "/"
export const totalmem = fn as any
export const type = fn as any
export const types: any = new Proxy({}, { get: () => fn })
export const unlink = fn as any
export const unlinkSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const uptime = fn as any
export const userInfo = () => ({ username: "renderer", uid: 0, gid: 0, shell: "", homedir: "/" })
export const verify = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const version = fn as any
export const versions = fn as any
export const win32: any = new Proxy({}, { get: () => fn })
export const writeFile = fn as any
export const writeFileSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export const writeSync = (..._a: unknown[]) => (typeof _a[0]==="number" ? new Uint8Array(_a[0]) : "")
export default {}
