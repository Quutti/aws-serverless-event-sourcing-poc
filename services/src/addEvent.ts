import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuid } from 'uuid';

const sqs = new AWS.SQS();

export const handler: APIGatewayProxyHandler = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { body: '', statusCode: 400 }
    }

    const { data, streamId, type } = body;
    const streamIdNotOk = typeof streamId !== 'string';
    const typeNotOk = typeof type !== 'string';
    const dataNotOk = typeof data !== 'object' && !Array.isArray(data);

    if (streamIdNotOk || typeNotOk || dataNotOk) {
        return { body: '', statusCode: 400 }
    }

    await sqs.sendMessage({
        QueueUrl: process.env.EVENT_STORE_QUEUE_URL,
        MessageBody: JSON.stringify({
            data,
            streamId,
            type
        }),
        MessageGroupId: streamId,
        MessageDeduplicationId: uuid()
    }).promise();

    return { body: '', statusCode: 204 }
}