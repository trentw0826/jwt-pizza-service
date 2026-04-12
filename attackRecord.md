## Attack 1

| Item           | Result                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| Date           | Apr 11, 2026                                                             |
| Classification | Authentication Failures                                                  |
| Severity       | 4                                                                        |
| Description    | Unchanged default credentials were used to access admin account          |
| Images         | ![Default credential POST returns 200](./images/default-credentials.png) |
| Corrections    | Update default passwords                                                 |

## Attack 2

| Item           | Result                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | Apr 11, 2026                                                                                                                           |
| Classification | Injection                                                                                                                              |
| Severity       | 4                                                                                                                                      |
| Description    | SQL injection successfully overwrote all emails in the database, making all accounts unusable. Could be used to execute arbitrary SQL. |
| Images         | ![Malicious injection](./images/malicious-injection.png) ![Unusable accounts](./images/unusable-account.png)                           |
| Corrections    | Sanitize inputs when handling the `PUT /api/user/:userId` endpoint.                                                                    |

## Attack 3

| Item           | Result                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Date           | Apr 11, 2026                                                                                             |
| Classification | Security Misconfiguration                                                                                |
| Severity       | 3                                                                                                        |
| Description    | API error responses exposed internal stack traces, revealing file paths and server internals.            |
| Images         | ![User-facing stack trace](./images/user-facing-stack-trace.png)                                         |
| Corrections    | Update global error handler to return sanitized errors in production and hide stack traces from clients. |

## Attack 4

| Item           | Result                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | Apr 11, 2026                                                                                                                                                     |
| Classification | Security Misconfiguration                                                                                                                                        |
| Severity       | 3                                                                                                                                                                |
| Description    | The endpoint at 'GET /api/user' does not properly filter down users by role, only by authentication token. Retrieved a list of all users using basic login token |
| Images         | ![User-facing stack trace](./images/user-enumeration-script.png)                                                                                                 |
| Corrections    | Add an explicit admin authorization check to the endpoint, returning 403 without proper permissions                                                              |
