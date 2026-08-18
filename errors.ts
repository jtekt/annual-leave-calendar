// 404
export class NotFoundError extends Error {
  constructor(resource: string, id: string | number) {
    super(`${resource} '${id}' was not found`)
    this.name = new.target.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// 400
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// 401
export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message)
    this.name = new.target.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// 403
export class ForbiddenError extends Error {
  constructor(resource: string, message: string = "Forbidden") {
    super(`${resource}: ${message}`)
    this.name = new.target.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
