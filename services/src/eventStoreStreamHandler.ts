import * as AWSRaw from 'aws-sdk';
import * as XRay from 'aws-xray-sdk-core';
import { v4 as uuid } from 'uuid';
import { DynamoDBStreamHandler } from "aws-lambda";

const AWS = XRay.captureAWS(AWSRaw);

const sns = new AWS.SNS();

export const handler: DynamoDBStreamHandler = async (event) => {
    const topicArn = process.env.TOPIC_ARN;

    for (const record of event.Records) {

        if (record.eventName !== 'INSERT') {
            continue;
        }

        const event = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        // Clean out the Dynamodb stuff
        Object.keys(event).forEach(key => {
            if (key.endsWith('pkey') || key.endsWith('skey')) {
                delete event[key];
            }
        });

        const { streamId, eventId } = event;

        await sns.publish({
            TopicArn: topicArn,
            Message: JSON.stringify(event),
            MessageAttributes: {
                streamId: {
                    DataType: 'String',
                    StringValue: streamId
                }
            },
            MessageDeduplicationId: `${streamId}-${eventId}-EventStore`,
            MessageGroupId: `${streamId}-EventStore`
        }).promise();
    }
}