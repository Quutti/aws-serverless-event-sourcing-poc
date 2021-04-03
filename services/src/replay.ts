import * as XRay from 'aws-xray-sdk-core';
import * as AWSRaw from 'aws-sdk';
import * as crypto from 'crypto';
import { SQSHandler } from "aws-lambda";

const AWS = XRay.captureAWS(AWSRaw);

class ParseBodyError extends Error {
    constructor(message: string = '') {
        super(message);
    }
}

const documentClient = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

const createEventUniqueId = (streamId: string, eventId: number): string =>
    crypto.createHash('sha256')
        .update(`${streamId}-${eventId}`)
        .digest('hex');

const parseEventBody = (eventBody: string) => {
    const body = JSON.parse(eventBody);

    const { replay } = body;
    const { streamId, target, fromEventId } = replay;
    const { sqs } = target;

    if (typeof sqs !== 'object') {
        throw new ParseBodyError('Only target type SQS supported');
    }

    if (typeof streamId !== 'string' || typeof sqs.queueUrl !== 'string') {
        throw new ParseBodyError();
    }

    return {
        streamId,
        fromEventId: parseInt(fromEventId, 10) || 0,
        sqsTargetUrl: sqs.queueUrl
    }
}

export const handler: SQSHandler = async (event) => {

    const firstRecord = event.Records[0];
    const parsed = parseEventBody(firstRecord.body);

    const { fromEventId, sqsTargetUrl, streamId } = parsed;
    const events = [];

    console.log('Initializing the replay...');
    console.log(`Stream ${streamId} position ${fromEventId}`);
    console.log(`Target: ${sqsTargetUrl}`);

    let lastEvaluatedKey: AWS.DynamoDB.DocumentClient.Key = null;
    while (lastEvaluatedKey !== undefined) {
        const result = await documentClient.query({
            TableName: process.env.EVENT_STORE_TABLE_NAME,
            KeyConditionExpression: 'pkey = :p and skey >= :s',
            ExpressionAttributeValues: {
                ':p': streamId,
                ':s': fromEventId
            },
            ExclusiveStartKey: lastEvaluatedKey,
        }).promise();

        if (Array.isArray(result.Items)) {
            events.push(...result.Items);
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
    }

    while (events.length > 0) {
        const batch = events.splice(0, 10);

        console.log(...batch.map(item => item.eventId));

        await sqs.sendMessageBatch({
            QueueUrl: sqsTargetUrl,
            Entries: batch.map(item => ({
                Id: createEventUniqueId(item.streamId, item.eventId),
                MessageBody: JSON.stringify({
                    eventId: item.eventId,
                    streamId: item.streamId,
                    data: item.data,
                    type: item.type
                }),
                MessageDeduplicationId: `${streamId}-${item.eventId}-Replay`,
                MessageGroupId: `${streamId}-Replay`
            })),
        }).promise();
    }
}