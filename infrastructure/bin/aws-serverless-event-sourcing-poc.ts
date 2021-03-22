#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsServerlessEventSourcingPocStack } from '../lib/aws-serverless-event-sourcing-poc-stack';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.API_KEY;
const stackName = process.env.STACK_NAME;

const app = new cdk.App();
new AwsServerlessEventSourcingPocStack(app, 'AwsServerlessEventSourcingPocStack', {
    apiKey,
    stackName
});

