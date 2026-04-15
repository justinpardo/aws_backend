import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const TABLE = process.env.DYNAMODB_FITBIT_TABLE ?? 'epigenesis-fitbit-tokens';

export interface FitbitTokens {
  uid: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  fitbitUserId: string;
}

export async function getFitbitTokens(uid: string): Promise<FitbitTokens | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE,
      Key: marshall({ uid }),
    })
  );
  if (!result.Item) return null;
  return unmarshall(result.Item) as FitbitTokens;
}

export async function saveFitbitTokens(tokens: FitbitTokens): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: marshall(tokens),
    })
  );
}

export async function deleteFitbitTokens(uid: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: marshall({ uid }),
    })
  );
}
