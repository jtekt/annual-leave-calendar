# 年休カレンダー / Annual leave calendar

This is a 年休カレンダー (Annual leave calendar), an application to keep track of the annual leaves of employees.
It consists of a Node.js application which performs CRUD operations on paid leave records in a MongoDB database using the Mongoose ORM.
Those operations are performed via a RESTful API, built using the Express framework.
This application is built in a microservice architecture and this repository only involves the core back-end service.
Authentication, the management of users and their groups are handled by other independent services.
Similarily, the dedicated GUI for this application is developed independently and is the object of its own repository.

## API

| Endpoint                | Method | body/query            | Description                                                    |
| ----------------------- | ------ | --------------------- | -------------------------------------------------------------- |
| /                       | GET    | -                     | Application info                                               |
| /entries/               | GET    | -                     | Gets all the entries                                           |
| /entries/:id            | GET    | -                     | Gets the entry with the provided ID                            |
| /entries/:id            | PUT    | entry properties      | Updates the entry with the provided ID                         |
| /entries/:id            | DELETE | -                     | Deletes the entry with the provided ID                         |
| /allocations/           | GET    | -                     | Gets all the allocations                                       |
| /allocations/:id        | GET    | -                     | Gets the allocation with the provided ID                       |
| /allocations/:id        | PUT    | allocation properties | Updates the allocation with the provided ID                    |
| /allocations/:id        | DELETE | -                     | Deletes the allocation with the provided ID                    |
| /users/:id/entries      | GET    | -                     | Gets the entries of the user with the given ID                 |
| /v2/users/:id/entries   | GET    | -                     | Gets the entries and allocations of the user with the given ID |
| /users/:id/entries      | POST   | {date: DATE}          | Creates an entry for the user with the given ID                |
| /users/:id/allocations  | GET    | -                     | Gets the allocations of the user with the given ID             |
| /users/:id/allocations  | POST   | {year: Number }       | Creates an allocation for the user with the given ID           |
| /groups/:id/entries     | GET    | -                     | Gets the entries of the group with the given ID                |
| /groups/:id/allocations | GET    | -                     | Gets the allocations of the group with the given ID            |

## Environment variables

| variable               | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| AUTHENTICATION_API_URL | URL of the authentication service                      |
| GROUP_MANAGER_API_URL  | URL of the group management service                    |
| MONGODB_URL            | URL of the MongoDB instance                            |
| MONGODB_DB             | Name of the MongoDB DB, defaults to 'nenkyuu_calendar' |
