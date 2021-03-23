import * as AWSRaw from 'aws-sdk';
import * as XRay from 'aws-xray-sdk-core';
import { APIGatewayProxyHandler } from "aws-lambda";

const AWS = XRay.captureAWS(AWSRaw);
const documentClient = new AWS.DynamoDB.DocumentClient();

export const handler: APIGatewayProxyHandler = async (event) => {

    const { Items: items } = await documentClient.scan({
        TableName: process.env.READ_MODEL_TABLE_NAME
    }).promise();

    const fixedItems = (items || []).map(item => ({
        itemId: item.pkey,
        amount: item.amount
    }));

    const body = { items: fixedItems };

    return {
        body: JSON.stringify(body),
        statusCode: 200
    }
}