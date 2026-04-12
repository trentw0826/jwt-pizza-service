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

## Attack 5

| Item           | Result                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Date           | Apr 11, 2026                                                                                                                                                                                                                                                 |
| Classification | Injection                                                                                                                                                                                                                                                    |
| Severity       | 3                                                                                                                                                                                                                                                            |
| Description    | A scripted set of SQL manipulation attempts against `GET /api/franchise` and `GET /api/user` showed malformed pagination payloads could trigger database syntax failures and internal error output. Union payloads did not return injected rows in this run. |
| Evidence       | `limit=-1` and `limit=1 UNION SELECT ...` returned `500` before patch; responses included SQL/stack details (e.g., syntax errors near `UNION` and `OFFSET NaN`).                                                                                             |
| Corrections    | Sanitize and clamp `page`/`limit` values to integers, parameterize LIMIT/OFFSET in SQL queries, and add regression tests for malformed payloads.                                                                                                             |

### Probe Summary (Pre-Patch)

```text
franchise-baseline: 200
franchise-limit-negative: 500
franchise-limit-union-attempt: 500
franchise-page-expression: 500
user-baseline: 200
user-limit-negative: 500
user-limit-union-attempt: 500
user-page-expression: 500
```

### Verification Summary (Post-Patch)

```text
franchise?page=0 OR 1=1&limit=10 -> 200
franchise?limit=1 UNION SELECT ... -> 200
user?page=1 OR 1=1&limit=10 -> 403 (non-admin)
user?limit=1 UNION SELECT ... -> 403 (non-admin)
```
