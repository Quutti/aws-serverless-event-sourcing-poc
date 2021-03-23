#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsServerlessEventSourcingPocStack } from '../lib/aws-serverless-event-sourcing-poc-stack';
import * as dotenv from 'dotenv';

dotenv.config();

const isTruthyString = (str: string = ''): boolean =>
    typeof str === 'string' && ['true', '1'].includes(str.toLocaleLowerCase());

const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error('API_KEY environment variable is required');
}

const stackName = process.env.STACK_NAME;
const tracingEnabled = isTruthyString(process.env.TRACING);

const app = new cdk.App();
new AwsServerlessEventSourcingPocStack(app, 'AwsServerlessEventSourcingPocStack', {
    apiKey,
    stackName,
    tracing: tracingEnabled
});

