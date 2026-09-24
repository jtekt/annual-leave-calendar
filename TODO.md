# TODO

## Make CI tests independent of the shared production services

The `test` job in `.gitlab-ci.yml` only runs MongoDB as a container. Everything else the tests need is a live, shared service:

| Variable | Service |
|---|---|
| `LOGIN_URL` (`https://employees-api.jtektrnd.net/v3/auth/login`) | employee manager: the tests log in with `TEST_USER_USERNAME` / `TEST_USER_PASSWORD` to get a token |
| `IDENTIFICATION_URL` (`https://employees-api.jtektrnd.net/v3/users/self`) | employee manager: the app's auth middleware (`auth.ts`) identifies the user through it |
| `GROUP_MANAGER_API_URL` (`https://groups-api.jtektrnd.net`) | group manager: group members (`services/members.ts`), with the hard-coded `TEST_GROUP_ID` |
| `WORKPLACE_MANAGER_API_URL` (`https://workplaces-api.jtektrnd.net`) | workplace manager: workplace employees (`services/members.ts`), with the hard-coded `TEST_WORKPLACE_ID` |

These used to be the legacy NodePort URLs on `10.115.1.100`; they now point at the services' Ingress hosts, but the tests still depend on the live services.

Problems with this:

- The pipeline fails whenever the runner cannot reach those services, or when one of them is down or being redeployed.
- The tests depend on real accounts and data (a real user's credentials, a specific group and workplace ID) that can change or disappear.
- Test runs can read, and possibly write, data in a shared environment.

Options to evaluate:

1. **Run the dependencies as containers in the test job**, on the `tdd` network next to MongoDB, like `group-manager-back-end`, `workplace_manager` and `shinsei_manager` already do with Neo4j and a user manager. Seed the test user, group and workplace at startup instead of relying on existing IDs.
2. **Mock the external HTTP calls in the tests** (e.g. with `nock`), so the tests only need MongoDB. Login and identification can be replaced by a test token accepted by a mocked identification endpoint.
3. A mix: containers for the auth service, mocks for group and workplace lookups.

`zaitaku_calendar` has the same dependency and should get the same fix.
