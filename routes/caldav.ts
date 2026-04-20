import { Router, Request, Response, NextFunction } from "express"
import express from "express"
import { caldavMiddleware } from "../auth"
import {
  handleRoot,
  handlePrincipalPropfind,
  handleCalendarPropfind,
  handleReport,
  handleEventGet,
  handleEventPut,
  handleEventDelete,
  handleEventPropfind,
} from "../controllers/caldav"

const router = Router()

router.use(
  express.text({
    type: ["application/xml", "text/xml", "text/calendar", "text/plain"],
  })
)

router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "OPTIONS") return next()
  res.setHeader("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, REPORT")
  res.setHeader("DAV", "1, 2, 3, calendar-access")
  res.setHeader("MS-Author-Via", "DAV")
  res.status(204).end()
})

router.use(caldavMiddleware())

router.all("/", (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "PROPFIND") return next()
  handleRoot(req, res)
})

router.all(
  "/principals/:user/",
  (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "PROPFIND") return next()
    handlePrincipalPropfind(req, res)
  }
)

router.all(
  "/calendars/:user/",
  (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "PROPFIND") return handleCalendarPropfind(req, res)
    if (req.method === "REPORT") return handleReport(req, res)
    next()
  }
)

router.get("/calendars/:user/:filename", handleEventGet)
router.put("/calendars/:user/:filename", handleEventPut)
router.delete("/calendars/:user/:filename", handleEventDelete)
router.all(
  "/calendars/:user/:filename",
  (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "PROPFIND") return next()
    handleEventPropfind(req, res)
  }
)

export default router
