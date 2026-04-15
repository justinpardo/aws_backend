import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const TABLE = process.env.DYNAMODB_WORKOUTS_TABLE ?? 'epigenesis-workouts';

export interface WorkoutEntry {
  uid: string;
  loggedAt: string;
  name: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: number;
    weight?: number;
    weightUnit?: 'lbs' | 'kgs';
    durationSeconds?: number;
  }>;
  notes?: string;
}

export async function getWorkouts(uid: string): Promise<WorkoutEntry[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'uid = :uid',
      ExpressionAttributeValues: marshall({ ':uid': uid }),
      ScanIndexForward: false,
    })
  );
  return (result.Items ?? []).map((item) => unmarshall(item) as WorkoutEntry);
}

export async function addWorkout(entry: WorkoutEntry): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: marshall(entry),
    })
  );
}

export async function deleteWorkout(uid: string, loggedAt: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: marshall({ uid, loggedAt }),
    })
  );
}
