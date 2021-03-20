#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsServerlessEventSourcingPocStack } from '../lib/aws-serverless-event-sourcing-poc-stack';

const app = new cdk.App();
new AwsServerlessEventSourcingPocStack(app, 'AwsServerlessEventSourcingPocStack');
