'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as syspath from 'path';
import * as fs from 'fs';
import { utils, Msvc, MsvcObj } from './utils';
import * as CONST from './constants';
import { ZipkinTree } from './zipkinTree';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "test-id" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user

        vscode.window.showInformationMessage('Hello World!');
        let _onDidChangeTreeData: vscode.EventEmitter<number | undefined> = new vscode.EventEmitter<number | undefined>();
        let onDidChangeTreeData: vscode.Event<number | undefined> = _onDidChangeTreeData.event;
        onDidChangeTreeData((e: number | undefined) => { vscode.window.showInformationMessage(`hello${e}`); });
        onDidChangeTreeData((e: number | undefined) => { vscode.window.showInformationMessage(`hello2${e}`); });

        _onDidChangeTreeData.fire(100);



    });


    const zipkinTreeDataProvider = new ZipkinTree();


    vscode.window.registerTreeDataProvider('zipkinOutline', zipkinTreeDataProvider);
    let prepare_disposable = vscode.commands.registerCommand(CONST.COMMAND_PREPARE, () => {
        prepare().then((data) => {
            if (data) {
                zipkinTreeDataProvider.addConfig(data);
            }
        });
    });
    let up_disposable = vscode.commands.registerCommand(CONST.COMMAND_UP, up);
    let clean_disposable = vscode.commands.registerCommand(CONST.COMMAND_CLEAN, clean);

    let openfile_disposable = vscode.commands.registerCommand(CONST.COMMAND_OPENFILE, path => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path));
    });
    let openweb_disposable = vscode.commands.registerCommand(CONST.COMMAND_OPENWEB, node => {
        if (node) {
            let path = zipkinTreeDataProvider.getUrl(node);
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(path));
        }

    });
    let run_disposable = vscode.commands.registerCommand(CONST.COMMAND_RUN, node => {
        if (node) {
            zipkinTreeDataProvider.run(node);
        }
    });
    let stop_disposable = vscode.commands.registerCommand(CONST.COMMAND_STOP, node => {
        if (node) {
            zipkinTreeDataProvider.stop(node);
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(prepare_disposable);
    context.subscriptions.push(up_disposable);
    context.subscriptions.push(clean_disposable);
    context.subscriptions.push(openfile_disposable);
    context.subscriptions.push(openweb_disposable);
    context.subscriptions.push(run_disposable);
    context.subscriptions.push(stop_disposable);
    context.subscriptions.push(zipkinTreeDataProvider);
}





async function prepare() {

    let storage = await vscode.window.showQuickPick(
        ["in memory", "mysql", "elastic search"],
        { ignoreFocusOut: true, placeHolder: "storage type" }
    );

    if(storage === "in memory"){
        utils.setStorage(CONST.STORAGE_MEM);
    }
    else if(storage === "mysql"){
        utils.setStorage(CONST.STORAGE_MYSQL);
    }
    else if(storage === "elastic search"){
        utils.setStorage(CONST.STORAGE_ES);
    }
    else{
        utils.setStorage(CONST.STORAGE_MEM);
    }
     
    const root = utils.getRoot();
    if (root === undefined) {
        vscode.window.showErrorMessage(CONST.ERROR_NO_FOLDER);
        return;
    }
    let pom_path_list = utils.searchFile(<string>root, "pom.xml");
    let msvc_list: Msvc[] = [];
    for (let pom_path of pom_path_list) {
        let msvc_root = syspath.dirname(pom_path);

        // pom.xml
        let pom_res = utils.parsePom(pom_path);
        if (pom_res.error) {
            vscode.window.showErrorMessage(pom_res.error);
            return;
        }
        let msvc_name = pom_res.name!;
        let msvc_label = pom_res.label!;
        let pom_obj = new MsvcObj(pom_res);



        //  application.properties
        let app_path = syspath.join(msvc_root, "src", "main", "resources", "application.properties");
        let app_res = utils.parseApp(app_path, msvc_name);
        let app_obj = new MsvcObj(app_res);


        // dockerfile
        let docker_path = syspath.join(msvc_root, "dockerfile");
        let docker_res = utils.parseDocker(docker_path);
        let docker_obj = new MsvcObj(docker_res);

        // deploy.yml
        let yaml_path = syspath.join(msvc_root, "deploy.yaml");
        let yaml_res = utils.parseYaml(yaml_path, msvc_name, msvc_label);
        var yaml_obj = new MsvcObj(yaml_res);
        let msvc = new Msvc(msvc_name, msvc_label, msvc_root, pom_obj, app_obj, docker_obj, yaml_obj);
        msvc_list.push(msvc);
    }
    var config_path = syspath.join(root, CONST.ZIPKIN_CONFIG);
    fs.writeFileSync(config_path, JSON.stringify(msvc_list, null, 4));
    var yaml_path = syspath.join(root, CONST.ZIPKIN_YAML);
    fs.writeFileSync(yaml_path, CONST.ZIPKIN_YAML_CONTEXT);
    vscode.window.showInformationMessage("zipkin prepare success");
    return msvc_list;
}

async function up() {

    vscode.window.showInformationMessage('zipkin up success');
}

async function clean() {
    vscode.window.showInformationMessage('zipkin clean success');
}

// this method is called when your extension is deactivated
export function deactivate() {
}