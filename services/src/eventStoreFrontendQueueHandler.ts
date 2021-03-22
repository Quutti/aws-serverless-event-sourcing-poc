import { SQSHandler } from "aws-lambda";
import addToEventStore from './addToEventStore';

export const handler: SQSHandler = async (event) => {
    for (const record of event.Records) {
        const { data, streamId, type } = JSON.parse(record.body);
        await addToEventStore(streamId, type, data);
    }
}