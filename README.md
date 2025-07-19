# WLink Bridge

This service acts as a bridge between Evolution API and GoHighLevel. The integration requires several environment variables, including `EVOLUTION_CONSOLE_URL` to point to the Evolution API console and `INSTANCE_TOKEN` to validate incoming webhooks. See `.env.example` for the complete list.

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
