import { AttributeType, BillingMode, ITable, Table } from "@aws-cdk/aws-dynamodb";
import { Function, Runtime } from "@aws-cdk/aws-lambda";
import { SqsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { Construct, Duration } from "@aws-cdk/core";
import { codeDirectory } from "../code";
import BaseProjector, { BaseProjectorProps } from "./base-projector";

export type TestProjectorProps = BaseProjectorProps;

export default class TestProjector extends BaseProjector {

    public readModelTable: ITable;

    constructor(scope: Construct, id: string, props: TestProjectorProps) {
        super(scope, id, props);

        this.readModelTable = new Table(this, 'ReadModelTable', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'pkey',
                type: AttributeType.STRING
            }
        });

        const func = new Function(this, 'ProjectorFunction', {
            code: codeDirectory,
            handler: 'testProjector.handler',
            runtime: Runtime.NODEJS_14_X,
            environment: {
                PROJECTION_STATE_TABLE_NAME: this.projectionTable.tableName,
                READ_MODEL_TABLE_NAME: this.readModelTable.tableName
            },
            timeout: Duration.seconds(30)
        });

        this.projectionTable.grant(func, 'dynamodb:GetItem', 'dynamodb:PutItem');
        this.readModelTable.grant(func, 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem');

        func.addEventSource(
            new SqsEventSource(this.projectionQueue)
        );

    }


}