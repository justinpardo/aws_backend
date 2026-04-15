import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const TABLE = process.env.DYNAMODB_MEALS_TABLE ?? 'epigenesis-meals';

export interface MealEntry {
  uid: string;
  loggedAt: string;
  mealName: string;
  items: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export async function getMeals(uid: string): Promise<MealEntry[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'uid = :uid',
      ExpressionAttributeValues: marshall({ ':uid': uid }),
      ScanIndexForward: false,
    })
  );
  return (result.Items ?? []).map((item) => unmarshall(item) as MealEntry);
}

export async function addMeal(entry: MealEntry): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: marshall(entry),
    })
  );
}

export async function deleteMeal(uid: string, loggedAt: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: marshall({ uid, loggedAt }),
    })
  );
}
