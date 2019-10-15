'use strict';

import * as vscode from 'vscode';
import { ChildProcess, spawn, execFile } from 'child_process';
import { workspace, WorkspaceFolder, Uri, commands, window, StatusBarItem, StatusBarAlignment, ExtensionContext, TextDocument } from 'vscode';
import { clearTimeout } from 'timers';

const exec = require('child_process').exec;

const STATUS_TOOLTIPS = {
 'CANCEL': 'Click to cancel',
 'PACK': 'Building, please wait...',
 'SUCCESS': 'Extension packed. Check for .vsix in your project\'s root',
 'ERROR': 'An error has occurred',
 'IDLE': 'Pack extension...'
}

const STATUS_ICONS = {
 'SUCCESS': '$(check)',
 'ERROR': '$(alert)',
 'PACK': '$(package)'
}

let statusbar: StatusBarItem;
let vsix = {
 'process': <ChildProcess> null,
 'cancel': <boolean> false,
 'wasCancelled': <boolean> false
}

function setupStatusbar(context: ExtensionContext) {
 statusbar = window.createStatusBarItem(StatusBarAlignment.Left);
 statusIdle();
 context.subscriptions.push(statusbar);
 
 statusbar.show();
}

function statusIdle() {
 statusbar.text = STATUS_ICONS.PACK;
 statusbar.tooltip = STATUS_TOOLTIPS.IDLE;
 statusbar.command = 'extension.buildExtension';
}

function statusSuccess() {
 statusbar.text = `${STATUS_ICONS.SUCCESS} Built`;
 statusbar.tooltip = `${STATUS_ICONS.SUCCESS} ${STATUS_TOOLTIPS.SUCCESS}`;
}

function statusPack() {
 statusbar.text = `${STATUS_ICONS.PACK} Building...`;
 statusbar.tooltip = STATUS_TOOLTIPS.CANCEL;
 statusbar.command = 'extension.abortBuild';
}

function statusError() {
 statusbar.text = `${STATUS_ICONS.ERROR} Error`;
 statusbar.tooltip = STATUS_TOOLTIPS.ERROR;
 statusbar.command = '';
}

function statusTimeout(fn: Function, timeout: number = 2000) {
 fn();

 const timer = setTimeout(() => {
  statusIdle();
 }, timeout);
}

function abortBuild() {
 vsix.cancel = true;
}

function buildExtension() {
 const documentUri: Uri = window.activeTextEditor.document.uri;
 const workFolder: Uri = workspace.getWorkspaceFolder(documentUri).uri;
 const currentFolder: string = workFolder.fsPath;

 statusPack();

 vsix.process = null;
 vsix.cancel = false;
 vsix.wasCancelled = false;

 vsix.process = spawn('cmd.exe', ['/K', '@echo off && vsce package && exit'], {
  cwd: currentFolder
  });

  vsix.process.stderr.on('data', (data) => {
   if(vsix.cancel) {
    vsix.cancel = false;
    vsix.wasCancelled = true;
    vsix.process.kill()
   }

   if(data.toString().indexOf('Error') > -1) {
    statusTimeout(statusError);
    window.showErrorMessage(data.toString());
   }
  });

 vsix.process.on('exit', (code, signal) => {
  if(vsix.wasCancelled) return;

  statusTimeout(statusSuccess);
  window.showInformationMessage('Check the root of your project for a vsix file.');
 });
}

export function activate(context: ExtensionContext) {
 setupStatusbar(context);

 let disposable = vscode.commands.registerCommand('extension.packVsix', () => {
  if(!vscode.workspace.name) {
   vscode.window.showInformationMessage('No active projects.');
   return;
  }

  buildExtension();
 });

 let commandBuild = vscode.commands.registerCommand('extension.buildExtension', buildExtension);
 let commandAbort = vscode.commands.registerCommand('extension.abortBuild', abortBuild)

 context.subscriptions.push(disposable);
 context.subscriptions.push(commandBuild);
 context.subscriptions.push(commandAbort);
}

export function deactivate() {}