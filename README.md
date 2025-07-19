# WLink Bridge

This service acts as a bridge between Evolution API and GoHighLevel. The integration requires several environment variables, including `EVOLUTION_CONSOLE_URL` to point to the Evolution API console and `EVOLUTION_WEBHOOK_SECRET` to secure incoming webhooks. See `.env.example` for the complete list.

## Webhook Secret

`EVOLUTION_WEBHOOK_SECRET` must match the secret configured for your webhook in the Evolution console. This value is used to verify that webhook requests truly originate from Evolution.

Example configuration:

```dotenv
# .env
EVOLUTION_WEBHOOK_SECRET="my-webhook-secret"
```

In Evolution API settings, configure the webhook secret to the same value:

```text
Webhook secret: my-webhook-secret
```


All instance IDs are stored as strings to match the Prisma schema. Helper
functions convert any numeric IDs to strings before database queries are
performed. When connecting a new Evolution instance you must provide the
`instanceId` along with the API token. The service validates these
credentials against Evolution before persisting the instance.


## Development

Install dependencies before building or running tests:

```bash
npm install
npm run build
npm test
```
