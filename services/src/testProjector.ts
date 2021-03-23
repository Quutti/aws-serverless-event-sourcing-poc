import * as AWSRaw from 'aws-sdk';
import * as XRay from 'aws-xray-sdk-core';
import { SQSHandler } from "aws-lambda";

const AWS = XRay.captureAWS(AWSRaw);

const documentClient = new AWS.DynamoDB.DocumentClient();

const resolveLastProcessedEventId = async (streamId) => {
    const projectionStateTableName = process.env.PROJECTION_STATE_TABLE_NAME;

    const { Item: item } = await documentClient.get({
        TableName: projectionStateTableName,
        ConsistentRead: true,
        Key: { pkey: streamId }
    }).promise();

    return (item && typeof item.lastProcessedEventId === 'number')
        ? item.lastProcessedEventId
        : -1;
}

export const handler: SQSHandler = async (event) => {
    const readModelTableName = process.env.READ_MODEL_TABLE_NAME;
    const projectionStateTableName = process.env.PROJECTION_STATE_TABLE_NAME;

    for (const record of event.Records) {
        const snsEventBody = JSON.parse(record.body);
        const event = JSON.parse(snsEventBody.Message);

        const { streamId, eventId, type, data: dataStr } = event;
        const data = JSON.parse(dataStr);

        const lastProcessedEventId = await resolveLastProcessedEventId(streamId);

        const wantedEventId = lastProcessedEventId + 1;

        if (wantedEventId < eventId) {
            // maybe we are replaying events and this just poppd up, return
            // it into queue for later processing by throwing an error.
            throw new Error('This event will be processed in the future');
        } else if (wantedEventId === eventId) {
            // this is the event we are looking for!

            console.log(`Processing an event with type ${type}`);

            if (type === 'ITEM_CREATED') {
                await documentClient.put({
                    TableName: readModelTableName,
                    Item: {
                        pkey: data.itemId,
                        amount: data.amount
                    }
                }).promise();
            } else if (type === 'ITEM_AMOUNT_CHANGED') {
                await documentClient.update({
                    TableName: readModelTableName,
                    Key: {
                        pkey: data.itemId
                    },
                    UpdateExpression: 'SET amount = :amount',
                    ExpressionAttributeValues: {
                        ':amount': data.amount
                    }
                }).promise();
            } else if (type === 'ITEM_DELETED') {
                await documentClient.delete({
                    TableName: readModelTableName,
                    Key: {
                        pkey: data.itemId
                    }
                }).promise();
            } else {
                console.log(`No action for event ${type}`);
            }

            // Update the processed event into projection state
            await documentClient.put({
                TableName: projectionStateTableName,
                Item: {
                    pkey: streamId,
                    lastProcessedEventId: eventId
                }
            }).promise();
        } else {
            // no need for processing as we have already processed this one
            // a.k.a. batch processing protection
            console.log(`Past event ${eventId}, wanted ${wantedEventId}. Skipping.`);
            continue;
        }
    }
}