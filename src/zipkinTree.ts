'use strict';

import * as vscode from 'vscode';
import * as syspath from 'path';
import {utils, Msvc, MsvcObj} from './utils';
import * as CONST from './constants';
import * as cp from 'child_process';


const STATE_Collapsed = vscode.TreeItemCollapsibleState.Collapsed;
const STATE_None = vscode.TreeItemCollapsibleState.None;

const SERVER_STOP = "serverStop";
const SERVER_RUN = "serverRun";

const STATE_INIT = "[init]";
const STATE_PENDING = "[Pending]";
const STATE_RUNNING = "[Running]";
const STATE_TERMINATING = "[Terminating]";
const STATE_STOP = "[Stopped]";

class ZipkinOutline {
    config: Msvc[];
    servers: string[];
    
    constructor(config: Msvc[], servers: string[]) {
        this.config = config;
        this.servers = servers;
    }
}



export class ZipkinTree implements vscode.TreeDataProvider<ZipkinNode>{

    private _onDidChangeTreeData: vscode.EventEmitter<ZipkinNode | undefined> = new vscode.EventEmitter<ZipkinNode | undefined>();
	readonly onDidChangeTreeData: vscode.Event<ZipkinNode | undefined> = this._onDidChangeTreeData.event;

    private _statusBarItem: vscode.StatusBarItem =  vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    private data:ZipkinOutline;
    private config_root:ZipkinNode;
    private server_root:ZipkinNode;

    constructor(){
        this.data = new ZipkinOutline([], []);
        this.config_root = new ZipkinNode("configs", STATE_Collapsed);
        this.server_root = new ZipkinNode("services", STATE_Collapsed);
        this.refresh();
        this._statusBarItem.hide();
    }



    addConfig(msvc_list:Msvc[]){
        this.data.config = msvc_list;
        this.buildTree();
        this.refresh();
    }


    buildItem(name:string, obj:MsvcObj):ZipkinNode{
        let res:ZipkinNode = new ZipkinNode(name+": ["+obj.status+"]", STATE_Collapsed);
        let path:ZipkinNode = new ZipkinNode(syspath.basename(obj.path), STATE_None);
        path.command = {
            command: CONST.COMMAND_OPENFILE,
            title: 'openFile',
            arguments: [obj.path]
        };
        res.children.push(path);
        if(obj.status === CONST.STATUS_MODIFIED){
            let backup:ZipkinNode = new ZipkinNode(syspath.basename(obj.backup!), STATE_None);
            backup.command = {
                command: CONST.COMMAND_OPENFILE,
                title: 'openFile',
                arguments: [obj.backup!]
            };
            res.children.push(backup);
        }
        return res;
    }

    buildTree(){
        if(this.data.config.length){
            this.config_root.children = [];
            this.server_root.children = [];
            for(let obj of this.data.config){
                let root:ZipkinNode = new ZipkinNode(obj.name, STATE_Collapsed);
                root.children.push(new ZipkinNode("label: ["+obj.label+"]", STATE_None));
                root.children.push(new ZipkinNode("root: ["+obj.root+"]", STATE_None));
                root.children.push(this.buildItem("pom", obj.pom));
                root.children.push(this.buildItem("app", obj.app));
                root.children.push(this.buildItem("dockerfile", obj.dockerfile));
                root.children.push(this.buildItem("yaml", obj.yaml));
                this.config_root.children.push(root);

                let svc:ZipkinNode = new ZipkinNode(obj.label+": "+STATE_INIT, STATE_None);
                svc.contextValue = SERVER_STOP;
                svc.svc_label = obj.label;
                svc.svc_root = obj.root;
                svc.svc_name = obj.name;
                this.server_root.children.push(svc);
            }
            let svc:ZipkinNode = new ZipkinNode("zipkin: "+STATE_INIT, STATE_None);
            svc.contextValue = SERVER_STOP;
            svc.svc_label = "zipkin";
            this.server_root.children.push(svc);
        }
    }

    async run(node:ZipkinNode){

        if(node.svc_state === STATE_INIT&&node.svc_label !== "zipkin"){
            node.changeState(STATE_PENDING);
            node.contextValue = "";
            this._onDidChangeTreeData.fire(node);
            this._statusBarItem.text = "";
            this._statusBarItem.show();
            let docker_env = await get_docker_env();
            console.log(docker_env);
            // mvn package
            this._statusBarItem.text = "[step 1/5]: mvn package...";
            this._statusBarItem.show();
            await normal_spawn("mvn package -Dmaven.test.skip=true", node.svc_root);

            // docker build
            this._statusBarItem.text = "[step 2/5]: docker build...";
            this._statusBarItem.show();
            let docker_cmd = docker_env + "docker build . -t devil4876/k8s-"+node.svc_name+":0.0.1";
            await normal_spawn(docker_cmd, node.svc_root);

            // docker push
            this._statusBarItem.text = "[step 3/5]: docker push...";
            this._statusBarItem.show();
            /*
            docker_cmd = docker_env + "docker push devil4876/k8s-"+node.svc_name+":0.0.1";
            await normal_spawn(docker_cmd, node.svc_root);
            */

            // deploy service
            this._statusBarItem.text = "[step 4/5]: deploy service to k8s...";
            this._statusBarItem.show();
            await normal_spawn("kubectl create -f deploy.yaml", node.svc_root);

            // check status
            this._statusBarItem.text = "[step 5/5]: check service status: pending...";
            this._statusBarItem.show();
            let num = 0;
            while(true){
                num = num%4;
                if(check_status(node.svc_label) !== "Running"){
                    this._statusBarItem.text = "[step 5/5]: check service status: pending"+status_bar(num);
                    this._statusBarItem.show();
                }
                else{
                    break;
                }
                num++;
            }
        }
        else{
            node.changeState(STATE_PENDING);
            node.contextValue = "";
            this._onDidChangeTreeData.fire(node);
            this._statusBarItem.text = "";
            this._statusBarItem.show();
            
            // deploy service
            this._statusBarItem.text = "[step 1/2]: deploy service to k8s...";
            this._statusBarItem.show();
            //await normal_spawn("kubectl create -f zipkin.yaml", utils.getRoot()!);
            let storage = utils.getStorage();
            if(node.svc_label === "zipkin" && check_status(node.svc_label) !== "Running"){
                if(storage === CONST.STORAGE_MYSQL){
                    if(check_status("zipkin-mysql")!=="Running"){
                        await normal_spawn("helm install --name=zipkin-mysql https://asd4876.github.io/zipkin-helm/zipkin-repo/zipkin-mysql/zipkin-mysql-0.1.0.tgz", utils.getRoot()!);
                    }
                    while(check_status("zipkin-mysql")!=="Running"){
                        
                    }
                    vscode.window.showInformationMessage("zipkin storage mysql successfully start up!");
                }
                else if(storage === CONST.STORAGE_ES){
                    if(check_status("zipkin-es")!=="Running"){
                        await normal_spawn("helm install --name=zipkin-es https://asd4876.github.io/zipkin-helm/zipkin-repo/zipkin-es/zipkin-elasticsearch-0.1.0.tgz", utils.getRoot()!);
                    }
                    while(check_status("zipkin-es")!=="Running"){

                    }
                    vscode.window.showInformationMessage("zipkin storage elastic search successfully start up!");
                   
                }
                
                await normal_spawn("helm install --name=zipkin --set storage="+storage+" https://asd4876.github.io/zipkin-helm/zipkin-repo/zipkin-helm/zipkin-helm-0.1.0.tgz", utils.getRoot()!);
                
                this._statusBarItem.text = "[step 2/2]: check service status: pending...";
                this._statusBarItem.show();
            }
            else if(node.svc_label !== "zipkin"){
                console.log("starting svcs...");
                await normal_spawn("kubectl create -f deploy.yaml", node.svc_root);
                console.log("svc started success");
                this._statusBarItem.text = "[step 2/2]: check service status: pending...";
                this._statusBarItem.show();

            }
            this._statusBarItem.text = "[step 2/2]: check service status: pending...";
            this._statusBarItem.show();
            // check status
            let num = 0;
            while(true){
                num = num%4;
                if(check_status(node.svc_label) !== "Running"){
                    this._statusBarItem.text = "[step 2/2]: check service status: pending"+status_bar(num);
                    this._statusBarItem.show();
                }
                else{
                    break;
                }
                num++;
            }
        }

        node.contextValue = SERVER_RUN;
        node.changeState(STATE_RUNNING);
        node.svc_url = get_svc_url(node.svc_label)!;
        this._statusBarItem.text = "";
        this._statusBarItem.hide();
        vscode.window.showInformationMessage("service ["+ node.svc_label+"] is running on "+node.svc_url);
        this._onDidChangeTreeData.fire(node);
    }

    async stop(node:ZipkinNode){
        node.changeState(STATE_TERMINATING);
        node.contextValue = "";
        this._onDidChangeTreeData.fire(node);
        this._statusBarItem.text = "";
        this._statusBarItem.show();
        
        this._statusBarItem.text = "[step 1/2]: delete service...";
        if(node.svc_label === "zipkin"){
            await normal_spawn("helm delete --purge zipkin", utils.getRoot()!);
            this._statusBarItem.text = "[step 2/2]: check service status...";
        }
        else{
            await normal_spawn("kubectl delete all -l msvc="+node.svc_label, node.svc_root);
            this._statusBarItem.text = "[step 2/2]: check service status...";
        }

        this._statusBarItem.text = "[step 2/2]: check service status...";

        let num = 0;
        while(true){
            num = num%4;
            if(check_status(node.svc_label) !== ""){
                this._statusBarItem.text = "[step 2/2]: check service status: terminating"+status_bar(num);
                this._statusBarItem.show();
            }
            else{
                break;
            }
            num++;
        }
        node.contextValue = SERVER_STOP;
        node.changeState(STATE_STOP);
        this._statusBarItem.text = "";
        this._statusBarItem.hide();
        this._onDidChangeTreeData.fire(node);
        vscode.window.showInformationMessage("service ["+node.svc_label+"] has stopped.");
    }

    getUrl(node:ZipkinNode):string{
        return node.svc_url;
    }

    refresh(): void {
		this._onDidChangeTreeData.fire();
	}
 
    getTreeItem(element: ZipkinNode): vscode.TreeItem{
        return element;
    }
    getChildren(element?: ZipkinNode | undefined): vscode.ProviderResult<ZipkinNode[]> {
        return new Promise(resolve => {
			if (element) {
				resolve(element.children);
			} else {
                let res : ZipkinNode[] = [];
                res.push(this.config_root);
                res.push(this.server_root);
                resolve(res);
			}
		});
    }
    dispose(){

        this._statusBarItem.dispose();
    }


}

export class ZipkinNode extends vscode.TreeItem{
    public children:ZipkinNode[];
    public svc_root:string;
    public svc_url:string;
    public svc_label:string;
    public svc_name:string;
    public svc_state:string;

	constructor(
        public label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
	) {
        super(label, collapsibleState);
        this.children = [];
        this.svc_label = "";
        this.svc_root = "";
        this.svc_url = "";
        this.svc_name = "";
        this.svc_state = STATE_INIT;
    }
    public changeState(state:string){
        this.svc_state = state;
        this.label = this.svc_label + ": "+state;

    }
}

function get_docker_env():Promise<String>{
	return new Promise(function(resolve, reject){
		cp.exec("minikube docker-env", function(error, stdout){
			if(error) { reject(error); }
			else{
				let env_list = stdout.split('\n', 4);
				let env_cmd = "";
				for(let i=0;i<env_list.length;i++){
					env_cmd += env_list[i] + "&&";
				}
				resolve(env_cmd);
			}
		});
	});
}

function normal_spawn(cmd:string, cwd:string){
	return new Promise(function(resolve, reject){
		const sp = cp.spawn(cmd, [], {shell:true, cwd:cwd});
		sp.on('error', (error)=>{
            console.log(`[Error] ${error}`);
			resolve(error);
		});
		sp.on('exit', (code)=>{
			if(code) { resolve(`exit code ${code}`); }
			else { resolve(); }
		});
	});
}


function get_minikube_ip() {
    let res = cp.execSync("minikube ip").toString().split('\n');
    console.log(res);
	if (res.length < 1) { console.error(res); }
	return res[0];
}

function array_remove(array:string[], delim:string[]) {
	let newarray:string[] = [];
	for (let i = 0; i < array.length; i++) {
		let isFind = false;
		for (let j = 0; j < delim.length; j++) {
			if (delim[j] === array[i]) {
				isFind = true;
				break;
			}
		}
		if (isFind) { continue; }
		newarray.push(array[i]);
	}
	return newarray;
}

function get_svc_url(label:string) {
	let zipkin_ip = get_minikube_ip();
	let info = cp.execSync("kubectl get svc -l msvc="+label).toString();
	let info_list = info.split('\n');
	if (info_list.length < 2) {
		return;
	}
	let title_list = info_list[0].split(' ');
	title_list = array_remove(title_list, ['', ' ']);
	let data_list = info_list[1].split(' ');
	data_list = array_remove(data_list, ['', ' ']);
	if (data_list.length !== title_list.length) {
		console.error("Error: data and title unmatch.");
		return;
	}
	let zipkin_port = "";
	for (let i = 0; i < title_list.length; i++) {
		if (title_list[i] === "PORT(S)") {
			zipkin_port = data_list[i];
			break;
		}
	}
	if (zipkin_port === "") {
		return;
	}
	zipkin_port = zipkin_port.split(':')[1].split('/')[0];
	let zipkin_url = "http://" + zipkin_ip + ":" + zipkin_port;
	return zipkin_url;
}

function check_status(label:string){
	let info = cp.execSync("kubectl get pod -l msvc="+label).toString();
	let info_list = info.split('\n');
	if (info_list.length < 2) {
		//console.error("Error: can't find pod: "+label);
		return "";
	}
	let title_list = info_list[0].split(' ');
	title_list = array_remove(title_list, ['', ' ']);
	let data_list = info_list[1].split(' ');
	data_list = array_remove(data_list, ['', ' ']);
	if (data_list.length !== title_list.length) {
		console.error("Error: data and title unmatch.");
		return "";
	}
	let status = "";
	for (var i = 0; i < title_list.length; i++) {
		if (title_list[i] === "STATUS") {
			status = data_list[i];
			break;
		}
	}
	if (status === "") {
		console.error("Error: can't find status.");
		return "";
	}
	return status;
}
function status_bar(num:number){
	let source = [" ", " ", " ", " "];
	for(let i=0;i<num;i++){
		source[i]=".";
	}
	return source.join("");
}