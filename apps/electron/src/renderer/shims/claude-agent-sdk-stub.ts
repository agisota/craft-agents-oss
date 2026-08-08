/** Renderer must not load the real Claude Agent SDK (Node shebang entry). */
export const tool = (..._a: unknown[]) => ({})
export const createSdkMcpServer = (..._a: unknown[]) => ({})
export const query = async function* () {}
export default { tool, createSdkMcpServer, query }
