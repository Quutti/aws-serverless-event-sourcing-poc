import { APIGatewayProxyHandler } from "aws-lambda";
import * as AWS from 'aws-sdk';
import { v4 as uuid } from 'uuid';

const sqs = new AWS.SQS();

export const handler: APIGatewayProxyHandler = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body as string);
    } catch (e) {
        return { body: '', statusCode: 400 }
    }

    const { streamId, fromEventId } = body;

    const streamIdNotOk = typeof streamId !== 'string';
    const fromEventIdNotOk = typeof fromEventId !== 'number';

    if (streamIdNotOk || fromEventIdNotOk) {
        return { body: '', statusCode: 400 }
    }

    const messageUniqueId = uuid();

    await sqs.sendMessage({
        QueueUrl: process.env.REPLAY_REQUEST_QUEUE_URL as string,
        MessageBody: JSON.stringify({
            replay: {
                streamId,
                fromEventId,
                target: {
                    sqs: {
                        queueUrl: process.env.TEST_PROJECTOR_QUEUE_URL as string
                    }
                }
            }
        }),
        MessageGroupId: messageUniqueId,
        MessageDeduplicationId: messageUniqueId
    }).promise();

    return { body: '', statusCode: 204 }
}