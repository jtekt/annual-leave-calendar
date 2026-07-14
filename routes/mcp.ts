import { Request, Response, Router } from "express"
import { randomUUID } from "node:crypto"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { createMcpServer } from "../controllers/mcp"
import { identificationMiddleware } from "../auth"

const router = Router()

router.post("/", identificationMiddleware(), async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport()

  const server = createMcpServer(res.locals.user)
  await server.connect(transport)

  await transport.handleRequest(req, res, req.body)
})

export default router
