# Epigenesis AWS Backend

Express.js API deployed to AWS Lambda via SAM. Handles meal logging, workout logging, Fitbit OAuth + sync, sleep data, and profile photo uploads. All endpoints require a valid Firebase ID token.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Deploying to AWS Lambda](#deploying-to-aws-lambda)
- [Making Changes](#making-changes)
- [Project Structure](#project-structure)

---

## Features

- **Meal logging** — create, list, and delete meal entries per user stored in DynamoDB
- **Workout logging** — create, list, and delete workout entries per user stored in DynamoDB
- **Fitbit OAuth** — exchange authorization code for tokens, store in DynamoDB, auto-refresh on expiry
- **Fitbit sync** — pull today's activities and nutrition from Fitbit API and write to the meals/workouts tables
- **Fitbit sleep** — fetch last night's sleep data (duration, efficiency, stages) for the dashboard
- **Profile photo upload** — generate pre-signed S3 URLs for direct client-to-S3 photo uploads
- **Firebase token verification** — all routes protected by a `firebaseAuth` middleware that validates Bearer tokens via Firebase Admin SDK

---

## Architecture

```
Mobile App
    │
    │  Bearer: Firebase ID Token
    ▼
API Gateway (AWS)
    │
    ▼
Lambda Function (epigenesis-aws-backend)
    │
    ├── /meals          → DynamoDB (epigenesis-meals)
    ├── /workouts       → DynamoDB (epigenesis-workouts)
    ├── /fitbit/*       → DynamoDB (epigenesis-fitbit-tokens) + Fitbit API
    └── /upload/*       → S3 (epigenesis-profile-photos)
```

---

## Prerequisites

- Node.js 18+
- AWS CLI configured: `aws configure`
- AWS SAM CLI: [Install guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- A Firebase project with a service account key
- The following DynamoDB tables already created in `us-east-1`:
  - `epigenesis-meals` — partition key: `uid` (String), sort key: `loggedAt` (String)
  - `epigenesis-workouts` — partition key: `uid` (String), sort key: `loggedAt` (String)
  - `epigenesis-fitbit-tokens` — partition key: `uid` (String)
- S3 bucket `epigenesis-profile-photos` already created
- A Fitbit app registered at [dev.fitbit.com](https://dev.fitbit.com) with the correct redirect URI

---

## Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

```env
PORT=3002

# Firebase service account — base64-encode the JSON file:
# base64 -i serviceAccountKey.json | tr -d '\n'
FIREBASE_SERVICE_ACCOUNT=<base64-encoded service account JSON>

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your IAM key>
AWS_SECRET_ACCESS_KEY=<your IAM secret>

DYNAMODB_MEALS_TABLE=epigenesis-meals
DYNAMODB_WORKOUTS_TABLE=epigenesis-workouts
DYNAMODB_FITBIT_TABLE=epigenesis-fitbit-tokens
S3_BUCKET=epigenesis-profile-photos

FITBIT_CLIENT_ID=<your Fitbit app client ID>
FITBIT_CLIENT_SECRET=<your Fitbit app client secret>
FITBIT_REDIRECT_URI=http://localhost:3002/fitbit/callback
```

> **In production (Lambda):** Environment variables are sourced from AWS SSM Parameter Store. See [Deploying to AWS Lambda](#deploying-to-aws-lambda).

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the development server (hot reload)
npm run dev
```

The server starts on `http://localhost:3002`. Set `EXPO_PUBLIC_BACKEND_URL=http://localhost:3002` in the mobile app's `.env`.

---

## API Reference

All endpoints require the header:
```
Authorization: Bearer <Firebase ID Token>
```

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok" }` |

### Meals

| Method | Path | Description |
|---|---|---|
| `GET` | `/meals` | Get all meals for the authenticated user |
| `POST` | `/meals` | Log a new meal |
| `DELETE` | `/meals/:loggedAt` | Delete a meal by its timestamp |

**POST /meals body:**
```json
{
  "mealName": "Lunch",
  "items": ["Chicken", "Rice"],
  "calories": 650,
  "protein": 45,
  "carbs": 70,
  "fat": 12,
  "notes": "optional"
}
```

### Workouts

| Method | Path | Description |
|---|---|---|
| `GET` | `/workouts` | Get all workouts for the authenticated user |
| `POST` | `/workouts` | Log a new workout |
| `DELETE` | `/workouts/:loggedAt` | Delete a workout by its timestamp |

**POST /workouts body:**
```json
{
  "name": "Push Day",
  "exercises": [
    { "name": "Bench Press", "sets": [{ "reps": 8, "weight": 135, "weightUnit": "lbs" }] }
  ],
  "notes": "optional"
}
```

### Fitbit

| Method | Path | Description |
|---|---|---|
| `GET` | `/fitbit/status` | Check if user has connected Fitbit |
| `POST` | `/fitbit/connect` | Exchange OAuth code for tokens (called by mobile after redirect) |
| `GET` | `/fitbit/callback` | OAuth redirect handler (called directly by Fitbit) |
| `GET` | `/fitbit/sync-workouts?date=YYYY-MM-DD` | Sync Fitbit activities to workouts table |
| `GET` | `/fitbit/sync-meals?date=YYYY-MM-DD` | Sync Fitbit nutrition to meals table |
| `GET` | `/fitbit/sleep?date=YYYY-MM-DD` | Fetch sleep data for a given date |

### Upload

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload/profile-photo` | Returns a pre-signed S3 URL for direct photo upload |

---

## Deploying to AWS Lambda

### First-time setup

Before deploying, store secrets in AWS SSM Parameter Store:

```bash
# Base64-encode your Firebase service account JSON
ENCODED=$(base64 -i serviceAccountKey.json | tr -d '\n')

aws ssm put-parameter \
  --name "/epigenesis/FIREBASE_SERVICE_ACCOUNT" \
  --value "$ENCODED" \
  --type SecureString \
  --region us-east-1

aws ssm put-parameter \
  --name "/epigenesis/FITBIT_CLIENT_ID" \
  --value "your_fitbit_client_id" \
  --type String \
  --region us-east-1

aws ssm put-parameter \
  --name "/epigenesis/FITBIT_CLIENT_SECRET" \
  --value "your_fitbit_client_secret" \
  --type SecureString \
  --region us-east-1

aws ssm put-parameter \
  --name "/epigenesis/FITBIT_REDIRECT_URI" \
  --value "https://your-production-url/fitbit/callback" \
  --type String \
  --region us-east-1
```

### Deploy

```bash
# Build TypeScript and deploy via SAM
npm run deploy
```

This runs `tsc` then `sam deploy`. SAM will:
1. Package the `dist/` output and upload it to S3
2. Create/update the CloudFormation stack `epigenesis-aws-backend`
3. Print the API Gateway URL when complete:

```
Outputs:
  AwsBackendUrl: https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
```

Copy this URL and set it as `EXPO_PUBLIC_BACKEND_URL` in the mobile app's production `.env`.

### Subsequent deploys

```bash
npm run deploy
```

That's it — the same command handles all future deploys.

### Checking logs

```bash
sam logs -n epigenesis-aws-backend --region us-east-1 --tail
```

---

## Making Changes

### Adding a new route

1. Create `src/routes/your-route.ts`
2. Register it in `src/app.ts`:
   ```ts
   import yourRoutes from './routes/your-route';
   app.use('/your-path', yourRoutes);
   ```
3. Add any new DynamoDB tables to `template.yaml` under `Resources` and add a `DynamoDBCrudPolicy` under the function's `Policies`
4. Run `npm run deploy`

### Adding a new DynamoDB table

In `template.yaml`, add a policy under `AwsBackendFunction`:
```yaml
- DynamoDBCrudPolicy:
    TableName: your-new-table
```
Then add the table name as an environment variable under `Globals.Function.Environment.Variables`.

### Updating SSM parameters

```bash
aws ssm put-parameter \
  --name "/epigenesis/YOUR_PARAM" \
  --value "new_value" \
  --type SecureString \
  --overwrite \
  --region us-east-1
```

Then redeploy so Lambda picks up the new value.

---

## Project Structure

```
aws_backend/
├── src/
│   ├── app.ts                    # Express app setup and route registration
│   ├── lambda.ts                 # Lambda handler (wraps Express via serverless-express)
│   ├── middleware/
│   │   └── firebaseAuth.ts       # Validates Firebase ID token, attaches uid to req
│   ├── routes/
│   │   ├── meals.ts              # GET, POST, DELETE /meals
│   │   ├── workouts.ts           # GET, POST, DELETE /workouts
│   │   ├── fitbit.ts             # Fitbit OAuth, sync, sleep endpoints
│   │   └── upload.ts             # Pre-signed S3 URL generation
│   ├── db/
│   │   ├── mealsStore.ts         # DynamoDB read/write for epigenesis-meals
│   │   ├── workoutsStore.ts      # DynamoDB read/write for epigenesis-workouts
│   │   └── fitbitStore.ts        # DynamoDB read/write for epigenesis-fitbit-tokens
│   └── services/
│       ├── firebaseAdmin.ts      # Firebase Admin SDK initialisation
│       ├── fitbitApiClient.ts    # Fitbit REST API calls (activities, meals, sleep)
│       └── fitbitTokenRefresh.ts # Auto-refresh expired Fitbit access tokens
├── template.yaml                 # SAM template — Lambda function, API Gateway, IAM policies
├── samconfig.toml                # SAM deploy defaults (stack name, region, S3)
├── tsconfig.json
├── package.json
└── .env.example
```
