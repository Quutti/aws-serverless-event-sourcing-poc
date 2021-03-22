import * as AWS from "aws-sdk";

const dynamoDbClient = new AWS.DynamoDB.DocumentClient();

const ADD_EVENT_LOG_CONTEXT = 'AddEventToEventStore';

export const addToEventStore = async (streamId: string, type: string, data: { [key: string]: any }) => {
    const tableName = process.env.EVENT_STORE_TABLE_NAME;

    if (!tableName) {
        throw new Error('No EVENT_STORE_TABLE_NAME environment variable defined!');
    }

    console.time(ADD_EVENT_LOG_CONTEXT);
    let writeSucceed = false;
    let retryCount = 0;
    try {
        while (!writeSucceed) {

            // Resolve a next event id for this stream
            const queryResult = await dynamoDbClient.query({
                TableName: tableName,
                KeyConditionExpression: 'pkey = :pkey',
                ExpressionAttributeValues: {
                    ':pkey': streamId
                },
                Limit: 1,
                ScanIndexForward: false
            }).promise();

            const lastItem = queryResult.Items[0] || null;
            const nextEventId = lastItem ? lastItem.eventId + 1 : 0;
            const timeStamp = new Date().toJSON();

            try {
                await dynamoDbClient.put({
                    TableName: tableName,
                    Item: {
                        pkey: streamId,
                        skey: nextEventId,

                        g01pkey: streamId,
                        g01skey: timeStamp,

                        eventId: nextEventId,
                        timeStamp,
                        streamId,
                        type: type.toUpperCase(),
                        data: JSON.stringify(data)
                    },
                    ConditionExpression: 'attribute_not_exists(skey) and attribute_not_exists(pkey)',
                }).promise();

                writeSucceed = true;
            } catch (e) {
                // Re-try always if conditional check fails!
                if (e.Code === 'ConditionalCheckFailed') {
                    console.log(ADD_EVENT_LOG_CONTEXT, `Retry ${++retryCount}`);
                } else {
                    throw e;
                }
            }
        }
    } finally {
        console.timeEnd(ADD_EVENT_LOG_CONTEXT);
    }
}


export default addToEventStore;