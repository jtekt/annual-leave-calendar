# 年休カレンダー / Annual leave calendar

[![AWS ECR](https://img.shields.io/badge/AWS%20ECR-annual--leave--calendar-blue)](https://gallery.ecr.aws/jtekt-corporation/annual-leave-calendar)

This is a 年休カレンダー (Annual leave calendar), an application to keep track of the annual leaves of employees.
It consists of a Node.js application which performs CRUD operations on leave entries and yearly leave allocations in a MongoDB database using Mongoose.
Those operations are performed via a RESTful API built with Express, and are also exposed over CalDAV and as an MCP server.
This application is built in a microservice architecture and this repository only involves the core back-end service.
Authentication, the management of users, groups and workplaces are handled by other independent services (user manager, group manager, workplace manager).
The GUIs for this application (`nenkyuu_calendar_front` and `work_status_management`) are developed in their own repositories.

## API

All routes except `/`, `/health` and `/docs` require authentication, checked against `IDENTIFICATION_URL`. The routes below are also served under `/v1`. In routes taking a user ID, use `self` for one's own data.

### Entries

| Endpoint                          | Method       | Body / query                                   | Description                                                   |
| --------------------------------- | ------------ | ---------------------------------------------- | ------------------------------------------------------------- |
| /entries                          | GET          | year, start_date, end_date, user_ids, limit, skip | Gets entries                                               |
| /entries                          | POST         | [{user_id, date}]                              | Creates several entries                                       |
| /entries                          | PUT/PATCH    | [{_id, type}]                                  | Updates the type of several entries                           |
| /entries                          | DELETE       | ids                                            | Deletes several entries                                       |
| /entries/:id                      | GET          | -                                              | Gets the entry with the provided ID                           |
| /entries/:id                      | PUT/PATCH    | entry properties                               | Updates the entry with the provided ID                        |
| /entries/:id                      | DELETE       | -                                              | Deletes the entry with the provided ID                        |
| /users/:id/entries                | GET          | year, start_date, end_date                     | Gets the entries of a user                                    |
| /users/:id/entries                | POST         | date, type, am, pm, taken, refresh, plus_one, reserve | Creates an entry for a user                            |
| /groups/:id/entries               | GET          | year, start_date, end_date, limit, skip        | Gets the entries of the members of a group                    |
| /workplaces/:id/entries           | GET          | year, start_date, end_date, limit, skip        | Gets the entries of the members of a workplace                |
| /v2/users/:id/entries             | GET          | year, start_date, end_date                     | Gets the entries and the allocation of a user for the year   |

`year` defaults to the current year; `start_date` and `end_date` override it. `limit` defaults to 500.

### Allocations

| Endpoint                  | Method    | Body / query           | Description                                        |
| ------------------------- | --------- | ---------------------- | -------------------------------------------------- |
| /allocations              | GET       | year, user_id, limit, skip | Gets allocations                               |
| /allocations/:id          | GET       | -                      | Gets the allocation with the provided ID           |
| /allocations/:id          | PUT/PATCH | allocation properties  | Updates the allocation with the provided ID        |
| /allocations/:id          | DELETE    | -                      | Deletes the allocation with the provided ID        |
| /users/:id/allocations    | GET       | year                   | Gets the allocations of a user                     |
| /users/:id/allocations    | POST      | year, leaves           | Creates an allocation for a user                   |
| /groups/:id/allocations   | GET       | year, limit, skip      | Gets the allocations of the members of a group     |

### CalDAV

`/caldav` serves each user's leave entries as a CalDAV calendar (`/caldav/calendars/:user/`). Clients authenticate with HTTP Basic auth: any username, and a JWT or an API key as the password.

### MCP

`POST /mcp` is an MCP server (Streamable HTTP) with the tools `get_entry`, `list_user_entries`, `create_entry`, `update_entry` and `delete_entry`. It uses the same authentication as the REST API.

### Service

| Endpoint      | Method | Description                                                   |
| ------------- | ------ | ------------------------------------------------------------- |
| /             | GET    | Application info: version, service URLs, DB connection status |
| /health/live  | GET    | Liveness probe: the process responds                          |
| /health/ready | GET    | Readiness probe: 503 until MongoDB is connected               |
| /docs         | GET    | Swagger UI                                                    |

## Environment variables

| Variable                  | Description                                                                                                   | Default          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| APP_PORT                  | Port used by Express                                                                                          | 80               |
| IDENTIFICATION_URL        | URL of the endpoint identifying the current user, e.g. `http://employee-manager/v3/users/self` (required)     |                  |
| IDENTIFIER_FIELDS         | Comma-separated user properties used as the user ID, in order of preference                                   | sub              |
| GROUP_MANAGER_API_URL     | URL of the group manager API                                                                                  |                  |
| WORKPLACE_MANAGER_API_URL | URL of the workplace manager API                                                                              |                  |
| USER_MANAGER_API_URL      | URL of the users endpoint of the user manager, e.g. `http://employee-manager/v3/users`. Required when `RESOLVE_USER_IDENTIFIER=true` | |
| RESOLVE_USER_IDENTIFIER   | When `true`, user IDs in routes that are not the current user's are resolved via `USER_MANAGER_API_URL`       | false            |
| MONGODB_CONNECTION_STRING | Full MongoDB connection string; overrides the variables below                                                 |                  |
| MONGODB_PROTOCOL          | MongoDB protocol                                                                                              | mongodb          |
| MONGODB_HOST              | MongoDB host                                                                                                  | localhost        |
| MONGODB_PORT              | MongoDB port                                                                                                  |                  |
| MONGODB_USERNAME          | MongoDB username                                                                                              |                  |
| MONGODB_PASSWORD          | MongoDB password                                                                                              |                  |
| MONGODB_DB                | Name of the MongoDB database                                                                                  | nenkyuu_calendar |
| MONGODB_OPTIONS           | Options appended to the connection string, e.g. `?authSource=admin`                                          |                  |

The version shown at `/` comes from `APP_VERSION`, set at build time from the git tag (`--build-arg APP_VERSION`).
