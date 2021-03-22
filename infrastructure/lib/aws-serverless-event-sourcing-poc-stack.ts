import * as cdk from '@aws-cdk/core';
import { ApiKey, EndpointType, LambdaIntegration, RestApi, UsagePlan } from '@aws-cdk/aws-apigateway';
import { AttributeType, BillingMode, StreamViewType, Table } from '@aws-cdk/aws-dynamodb';
import { Code, Function, Runtime } from '@aws-cdk/aws-lambda';
import { join } from 'path';
import EventStore from './event-store';
import { codeDirectory } from './code';
import TestProjector from './projectors/test-projector';

export type AwsServerlessEventSourcingPocStackProps = cdk.StackProps & {
    apiKey?: string;
}

export class AwsServerlessEventSourcingPocStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props?: AwsServerlessEventSourcingPocStackProps) {
        super(scope, id, props);

        const apiKeyValue = props?.apiKey;
        const usesApiKey: boolean = !!apiKeyValue;

        const eventStore = new EventStore(this, 'EventStore');

        const addEventFunction = new Function(this, 'AddEvent', {
            code: codeDirectory,
            handler: 'addEvent.handler',
            runtime: Runtime.NODEJS_14_X,
            memorySize: 512
        });

        eventStore.prepareFunctionForEventStoreQueue(addEventFunction);

        const api = new RestApi(this, 'ApiGateway', {
            endpointConfiguration: {
                types: [EndpointType.REGIONAL]
            }
        });

        if (usesApiKey) {

            const apiKey = new ApiKey(this, 'ApiKey', {
                value: apiKeyValue
            });

            api.addUsagePlan('UsagePlan', {
                apiKey,
                apiStages: [{
                    api,
                    stage: api.deploymentStage
                }]
            });
        }

        const addEventResource = api.root.addResource('addEvent');
        addEventResource.addMethod('POST', new LambdaIntegration(addEventFunction), {
            apiKeyRequired: usesApiKey
        });

        const testProjector = new TestProjector(this, 'TestProjector', {
            eventStore,
            streamIds: ['eb724435-02cb-4c68-9d7a-4b6471c5a810']
        });

        const listTestItemsFunction = new Function(this, 'ListTestItems', {
            code: codeDirectory,
            handler: 'listTestItems.handler',
            runtime: Runtime.NODEJS_14_X,
            memorySize: 512,
            environment: {
                READ_MODEL_TABLE_NAME: testProjector.readModelTable.tableName
            }
        });

        testProjector.readModelTable.grant(listTestItemsFunction, 'dynamodb:Scan');

        const listTestItemsResource = api.root.addResource('listTestItems');
        listTestItemsResource.addMethod('GET', new LambdaIntegration(listTestItemsFunction), {
            apiKeyRequired: usesApiKey
        });

    }



}
