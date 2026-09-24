import { Router } from "express"
import { connected } from "../db"

// Probes for Kubernetes: /live only tells that the process responds,
// /ready also requires the database connection
const router = Router()

router.get("/live", (req, res) => {
  res.send({ status: "ok" })
})

router.get("/ready", (req, res) => {
  if (!(connected() === 1)) res.status(503).send({ status: "unavailable" })
  else res.send({ status: "ok" })
})

export default router
