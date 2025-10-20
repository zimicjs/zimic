#!/usr/bin/env node
import runCLI from './cli';
import { checkForUpdates } from './updateNotifier';

checkForUpdates();
void runCLI();
