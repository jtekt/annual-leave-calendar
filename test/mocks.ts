/**
 * Mocks the external services the tests depend on (account manager, group
 * manager, workplace manager) with nock, so that the test job only needs MongoDB.
 *
 * Loaded before the test files (mocha --require), hence before the app reads its
 * environment: the URLs below point at hosts that only exist inside nock.
 */
import nock from "nock"

const ACCOUNT_MANAGER = "http://account-manager.test"
const GROUP_MANAGER = "http://group-manager.test"
const WORKPLACE_MANAGER = "http://workplace-manager.test"

export const TEST_JWT = "test-jwt"
export const TEST_USER = {
  _id: "test-user",
  username: "test-user",
  display_name: "Test user",
}
export const TEST_GROUP_ID = "test-group"
export const TEST_WORKPLACE_ID = "test-workplace"

// Overrides any value coming from a local .env: tests must never use real services
Object.assign(process.env, {
  LOGIN_URL: `${ACCOUNT_MANAGER}/v3/auth/login`,
  IDENTIFICATION_URL: `${ACCOUNT_MANAGER}/v3/users/self`,
  GROUP_MANAGER_API_URL: GROUP_MANAGER,
  WORKPLACE_MANAGER_API_URL: WORKPLACE_MANAGER,
  IDENTIFIER_FIELDS: "_id",
  TEST_USER_USERNAME: TEST_USER.username,
  TEST_USER_PASSWORD: "test-password",
  TEST_GROUP_ID,
  TEST_WORKPLACE_ID,
})

// Any request to a host that is not mocked fails; only local connections
// (supertest calling the app) are allowed
nock.disableNetConnect()
nock.enableNetConnect(/^(127\.0\.0\.1|localhost)(:\d+)?$/)

// Account manager: login returns a token, identification accepts only that token
nock(ACCOUNT_MANAGER)
  .persist()
  .post("/v3/auth/login")
  .reply(200, { jwt: TEST_JWT, user: TEST_USER })
  .get("/v3/users/self")
  .reply(function () {
    return this.req.headers.authorization === `Bearer ${TEST_JWT}`
      ? [200, TEST_USER]
      : [401, { message: "Unauthorized" }]
  })

// Group manager: TEST_GROUP_ID contains the test user, other groups do not exist
nock(GROUP_MANAGER)
  .persist()
  .get(`/v3/groups/${TEST_GROUP_ID}/members`)
  .query(true)
  .reply(200, { items: [TEST_USER], count: 1, batch_size: 10000 })
  .get(/^\/v3\/groups\/[^/]+\/members/)
  .query(true)
  .reply(404, { message: "Group not found" })

// Workplace manager: TEST_WORKPLACE_ID employs the test user, other workplaces do not exist
nock(WORKPLACE_MANAGER)
  .persist()
  .get(`/v2/workplaces/${TEST_WORKPLACE_ID}/employees`)
  .query(true)
  .reply(200, [TEST_USER], { "x-total": "1" })
  .get(/^\/v2\/workplaces\/[^/]+\/employees/)
  .query(true)
  .reply(404, { message: "Workplace not found" })
