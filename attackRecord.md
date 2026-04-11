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

_TBD_
