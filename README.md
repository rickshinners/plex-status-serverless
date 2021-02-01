# plex-status-serverless

## Deployment
### Dev
serverless deploy
### Prod
serverless deploy --stage prod

## Initial Setup
plex-status-serverless uses the AWS Systems Manager Parameter Store for configuration.

It requires the following parameters stored as a SecureString
* PlexUsername
* PlexPassword

It requires the following parameters stored as a String
* PlexStatusPollerClientIdentifier
  * This is a unique string to identify the status client to the plex server. This should just be a unique string like a GUID
* PlexStatusPollerStateBucket
  * The name of the bucket to store the generated plex token. This bucket must exist before serverless is deployed
* PlexStatusPollerTargetMachineIdentifier
  * You can find your machine identifier here https://plex.tv/api/servers?X-Plex-Token=XXXX

Once that's set up, deploy the serverless file.

You'll need to prime the status server with its own Plex Token before the first run. You can generate that by manually running the newly created updateToken lambda.