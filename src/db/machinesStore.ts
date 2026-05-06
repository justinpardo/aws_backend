import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const TABLE = process.env.DYNAMODB_MACHINES_TABLE ?? 'epigenesis-machines';

export interface MachineEntry {
  uid: string;
  id: string;
  name: string;
  type: string;
  defaultReps?: number;
  defaultWeight?: number;
  weightUnit?: 'lbs' | 'kgs';
  notes?: string;
  createdAt: string;
}

export async function getMachines(uid: string): Promise<MachineEntry[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'uid = :uid',
      ExpressionAttributeValues: marshall({ ':uid': uid }),
      ScanIndexForward: false,
    })
  );
  return (result.Items ?? []).map((item) => unmarshall(item) as MachineEntry);
}

export async function getMachine(uid: string, id: string): Promise<MachineEntry | null> {
  const result = await client.send(
    new GetItemCommand({
      TableName: TABLE,
      Key: marshall({ uid, id }),
    })
  );
  return result.Item ? (unmarshall(result.Item) as MachineEntry) : null;
}

export async function addMachine(entry: MachineEntry): Promise<void> {
  await client.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: marshall(entry, { removeUndefinedValues: true }),
    })
  );
}

export async function updateMachine(
  uid: string,
  id: string,
  updates: Omit<MachineEntry, 'uid' | 'id' | 'createdAt'>
): Promise<MachineEntry | null> {
  const setExprParts: string[] = [];
  const removeExprParts: string[] = [];
  const exprAttrNames: Record<string, string> = {};
  const exprAttrValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    const nameKey = `#${key}`;
    exprAttrNames[nameKey] = key;
    if (value === undefined || value === null || value === '') {
      removeExprParts.push(nameKey);
    } else {
      const valueKey = `:${key}`;
      setExprParts.push(`${nameKey} = ${valueKey}`);
      exprAttrValues[valueKey] = value;
    }
  }

  const updateExprSegments: string[] = [];
  if (setExprParts.length) updateExprSegments.push(`SET ${setExprParts.join(', ')}`);
  if (removeExprParts.length) updateExprSegments.push(`REMOVE ${removeExprParts.join(', ')}`);

  if (updateExprSegments.length === 0) {
    return getMachine(uid, id);
  }

  const result = await client.send(
    new UpdateItemCommand({
      TableName: TABLE,
      Key: marshall({ uid, id }),
      UpdateExpression: updateExprSegments.join(' '),
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: Object.keys(exprAttrValues).length
        ? marshall(exprAttrValues, { removeUndefinedValues: true })
        : undefined,
      ConditionExpression: 'attribute_exists(uid) AND attribute_exists(id)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes ? (unmarshall(result.Attributes) as MachineEntry) : null;
}

export async function deleteMachine(uid: string, id: string): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: marshall({ uid, id }),
    })
  );
}
