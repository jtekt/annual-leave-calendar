# 年休カレンダー


## API
| Endpoint | Method | body/query | Description
| --- | --- | --- | --- |
| / | GET | - | Application info |
| /entries/ | GET | - | Gets all the entries |
| /entries/:id | GET | - | Gets the entry with the provided ID |
| /entries/:id | PUT | entry properties | Updates the entry with the provided ID |
| /entries/:id | DELETE | - | Deletes the entry with the provided ID |
| /users/:id/entries | GET | - | Gets the entries of the user with the given ID |
| /users/:id/entries | POST | {date: DATE} | Creates an entry for the user with the given ID |
| /groups/:id/entries | GET | - | Gets the entries of the group with the given ID |

Note: all requests must be done with a valid token provided in the authorization header in the following form:

```
Authorization: Bearer YOUR_TOKEN_HERE
```

## Environment variables

| variable | Description
| --- | --- |
| AUTHENTICATION_API_URL | URL of the authentication service |
| GROUP_MANAGER_API_URL | URL of the group management service |
| MONGODB_URL | URL of the MongoDB instance |
| MONGODB_DB | Name of the MongoDB DB, defaults to 'nenkyuu_calendar' |
| NEO4J_USERNAME | Username for the Neo4J instance |
| NEO4J_PASSWORD | Password for the Neo4J instance |
