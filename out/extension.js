"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const activityLogging = __importStar(require("./activityLogging"));
const activateExt_1 = require("./smartCmd/activateExt");
// Global variables
let activityLogPath;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
async function activate(context) {
    console.log('DevBoost extension is now active!');
    // Initialize activity log path
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        activityLogPath = path.join(workspaceRoot, '.vscode', 'activity.log');
    }
    // Setup activity logging
    activityLogging.setupActivityLogging(context, activityLogPath);
    // Initialize global extension paths (in extension's global storage)
    const globalStoragePath = context.globalStorageUri.fsPath;
    const promptInputPath = path.join(globalStoragePath, 'prompt-input.md');
    // // Activate SmartCmd tool
    await (0, activateExt_1.activateSmartCmd)(context, globalStoragePath, activityLogPath, promptInputPath);
    // Register other commands (non-SmartCmd)
    const helloWorldDisposable = vscode.commands.registerCommand('DevBoost.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from DevBoost!');
    });
    context.subscriptions.push(helloWorldDisposable);
    // Listen for workspace folder changes to update activity log path
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
        console.log('DevBoost: Workspace folders changed');
        // Update activity log path for new workspace
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            activityLogPath = path.join(workspaceRoot, '.vscode', 'activity.log');
            console.log('DevBoost: Updated activity log path:', activityLogPath);
        }
        else {
            activityLogPath = undefined;
        }
    }));
}
// This method is called when your extension is deactivated
function deactivate() {
    // Cleanup handled by context.subscriptions
}
//# sourceMappingURL=extension.js.map