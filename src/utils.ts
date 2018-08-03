'use strict';

import * as vscode from 'vscode';
import * as syspath from 'path';
import * as fs from 'fs';
import * as xml_parser from 'xml-js';
import * as yaml_parser from 'js-yaml';
import * as CONST from './constants';


export interface UTILS {
    searchFile(root: string, target: string): string[];
    parsePom(root: string): ParseResult;
    parseApp(root: string, name: string): ParseResult;
    parseDocker(root: string): ParseResult;
    parseYaml(root: string, name: string, label: string): ParseResult;
    getRoot(): string | undefined;
    getHome(): string | undefined;
    setStorage(type: string):void;
    getStorage():string;
}

export const utils: UTILS = {
    searchFile: (root, target) => {
        let res: string[] = [];
        fs_dfs(root, target, res);
        return res;
    },
    parsePom: parse_pom,
    parseApp: parse_app,
    parseDocker: parse_docker,
    parseYaml: parse_yaml,
    getRoot: fs_root,
    getHome: user_home,
    setStorage: setStorage,
    getStorage: getStorage
};

export interface ParseResult {
    name?: string | undefined;
    label?: string | undefined;
    status: string;
    path: string;
    backup?: string | undefined;
    error?: string | undefined;
}

export class MsvcObj {
    status: string;
    path: string;
    backup?: string;
    constructor(obj: { status: string, path: string, backup?: string }) {
        this.path = obj.path;
        this.status = obj.status;
        this.backup = obj.backup;
    }
}
export class Msvc {
    name: string;
    label: string;
    root: string;
    pom: MsvcObj;
    app: MsvcObj;
    dockerfile: MsvcObj;
    yaml: MsvcObj;
    constructor(name: string, label: string, root: string, pom: MsvcObj, app: MsvcObj, dockerfile: MsvcObj, yaml: MsvcObj) {
        this.name = name;
        this.label = label;
        this.root = root;
        this.pom = pom;
        this.app = app;
        this.dockerfile = dockerfile;
        this.yaml = yaml;
    }
}

let storageType = CONST.STORAGE_MEM;

function getStorage():string{
    return storageType;
}

function parse_pom(xmlpath: string): ParseResult {
    let res: ParseResult = {
        name: undefined,
        label: undefined,
        status: CONST.STATUS_UNCHANGED,
        path: xmlpath,
        backup: undefined,
        error: undefined
    };

    // parse pom.xml to js obj;
    let xml = fs.readFileSync(xmlpath, 'utf8');
    let pom_root = <xml_parser.Element>xml_parser.xml2js(xml);
    if (pom_root.elements === undefined) {
        res.error = CONST.ERROR_ILLEGAL_POM;
        return res;
    }

    // get project obj;
    let pom_project = null;
    for (let obj of pom_root.elements) {
        if (obj.name === "project") {
            pom_project = obj;
        }
    }
    if (!pom_project || !pom_project.elements) {
        res.error = CONST.ERROR_ILLEGAL_POM;
        return res;
    }

    // get name and dependency list;
    let pom_dependency = null;
    let pom_groupId = null;
    let pom_artifactId = null;
    let pom_dep_manage = null;
    let pom_build_pluge = null;
    let pom_parent = null;
    let pom_prop = null;
    for (let obj of pom_project.elements) {
        if (obj.name === "dependencies") {
            pom_dependency = obj;
        }
        else if (obj.name === "groupId") {
            pom_groupId = obj.elements![0].text;
        }
        else if (obj.name === "artifactId") {
            pom_artifactId = obj.elements![0].text;
        }
        else if (obj.name === "parent") {
            pom_parent = obj;
        }
        else if (obj.name === "properties") {
            pom_prop = obj;
        }
        else if (obj.name === "build") {
            pom_build_pluge = obj;
        }
        else if (obj.name === "dependencyManagement") {
            pom_dep_manage = obj;
        }
    }

    if (!pom_groupId || !pom_artifactId) {
        res.error = CONST.ERROR_ILLEGAL_POM;
        return res;
    }
    if (!pom_dependency || !pom_dependency.elements) {
        res.error = CONST.ERROR_ILLEGAL_POM;
        return res;
    }

    // add zipkin dependency;
    let name = pom_groupId + "." + pom_artifactId;
    res.name = name;
    let label = name.split(".").join("-");
    res.label = label;
    let hasZipkin = false;
    let isSpringboot = false;
    let changeFlag = false;
    let hasBraveMysql = false;
    let hasMysql = false;
    for (let dep of pom_dependency.elements) {
        if (dep.type === "element" && dep.elements) {
            for (let obj of dep.elements) {
                if (obj.name === "artifactId" && obj.elements![0].text === "spring-cloud-starter-zipkin") {
                    hasZipkin = true;
                }
                if (obj.name === "groupId" && obj.elements![0].text === "org.springframework.boot") {
                    isSpringboot = true;
                }
                if (obj.name === "artifactId" && obj.elements![0].text === "brave-instrumentation-mysql") {
                    hasBraveMysql = true;
                }
                if (obj.name === "artifactId" && obj.elements![0].text === "mysql-connector-java") {
                    hasMysql = true;
                }

            }
        }
    }

    if (!isSpringboot) {
        res.error = CONST.ERROR_ILLEGAL_POM;
        return res;
    }

    if (!hasZipkin) {
        pom_dependency.elements.push(xml2js(CONST.POM_ZIPKIN_DEP));
        changeFlag = true;
    }

    if (hasMysql && !hasBraveMysql) {
        pom_dependency.elements.push(xml2js(CONST.POM_BRAVE_MYSQL_DEP));
        changeFlag = true;
    }

    if (!pom_parent) {
        pom_project.elements.push(xml2js(CONST.POM_PARENT));
        changeFlag = true;
    }
    else {
        // todo
    }

    if (!pom_build_pluge) {
        pom_project.elements.push(xml2js(CONST.POM_BUILD_PLUGE));
        changeFlag = true;
    }
    else {
        // todo
    }

    if (!pom_dep_manage) {
        pom_project.elements.push(xml2js(CONST.POM_DEP_MANAGE));
        changeFlag = true;
    }
    else {
        // todo
    }

    if (!pom_prop) {
        pom_project.elements.push(xml2js(CONST.POM_PROP));
        changeFlag = true;
    }
    else {
        let target = xml2js(CONST.POM_PROP);
        let add_list: xml_parser.Element[] = [];
        for (let data of target.elements!) {
            let flag = false;
            for (let tmp of pom_prop.elements!) {
                if (data.name === tmp.name) {
                    flag = true;
                }
            }
            if (!flag) {
                add_list.push(data);
            }
        }
        if (add_list.length) {
            changeFlag = true;
        }
        for (let data of add_list) {
            pom_prop.elements!.push(data);
        }
    }

    if (!changeFlag) {
        return res;
    }

    // pom.xml backup;
    let pom_org = syspath.join(syspath.dirname(xmlpath), CONST.BACKUP_POM);
    fs_copyFileSync(xmlpath, pom_org);
    console.log("Backup [" + xmlpath + "] to [" + pom_org + "]");

    // rewrite pom.xml
    let result = xml_parser.js2xml(pom_root, { spaces: 4 });
    fs.writeFileSync(xmlpath, result, 'utf8');

    res.status = CONST.STATUS_MODIFIED;
    res.backup = pom_org;
    return res;
}

// parse application.properties, add zipkin env.
function parse_app(app_path: string, name: string): ParseResult {
    let result: ParseResult = {
        status: CONST.STATUS_UNCHANGED,
        path: app_path,
        backup: undefined,
        error: undefined
    };
    if (!fs.existsSync(app_path)) {
        fs_createFile(app_path);
        result.status = CONST.STATUS_CREATED;
    }
    let hasName = false;
    let hasSampleRate = false;
    let hasZipkinUrl = false;
    let hasZipkinEnable = false;
    let data = fs.readFileSync(app_path, 'utf8');
    let needMysql = false;
    let newdata = "";
    data.toString().split('\n').forEach(function (line) {
        let cur = line.split('#')[0];
        let flag = true;
        if (cur.indexOf("spring.application.name") > -1) {
            hasName = true;
        }
        else if (cur.indexOf("spring.sleuth.sampler.probability") > -1) {
            hasSampleRate = true;
        }
        else if (cur.indexOf("spring.zipkin.baseUrl") > -1) {
            hasZipkinUrl = true;
        }
        else if (cur.indexOf("spring.zipkin.enabled") > -1) {
            hasZipkinEnable = true;
        }
        else if (cur.indexOf("jdbc:mysql") > -1) {
            if (cur.indexOf("statementInterceptors") === -1) {
                needMysql = true;
                flag = false;

                if (cur.indexOf("?") > -1) {
                    if (cur.indexOf("useSSL") > -1) {
                        newdata += line + "&statementInterceptors=brave.mysql.TracingStatementInterceptor\n";
                    }
                    else {
                        newdata += line + "&useSSL=false&statementInterceptors=brave.mysql.TracingStatementInterceptor\n";
                    }
                }
                else {
                    newdata += line + "?useSSL=false&statementInterceptors=brave.mysql.TracingStatementInterceptor\n";
                }
            }
        }
        if (flag) {
            newdata += line + "\n";
        }
    });
    if (hasName && hasSampleRate && hasZipkinEnable && hasZipkinUrl && !needMysql) {
        result.status = CONST.STATUS_UNCHANGED;
        return result;
    }
    let res = newdata
        + "\n"
        + (hasName && hasSampleRate && hasZipkinEnable && hasZipkinUrl ? "" : "# added zipkin dependency \n")
        + (hasName ? "" : ("spring.application.name=" + name + "\n"))
        + (hasSampleRate ? "" : "spring.sleuth.sampler.probability=1.0\n")
        + (hasZipkinUrl ? "" : "spring.zipkin.baseUrl=http://${zipkin_host:zipkin-svc}:${zipkin_port:9411}/\n")
        + (hasZipkinEnable ? "" : "spring.zipkin.enabled=${zipkin_enabled:true}\n");

    if (result.status !== CONST.STATUS_CREATED) {
        let app_org = syspath.join(syspath.dirname(app_path), CONST.BACKUP_APP);
        fs_copyFileSync(app_path, app_org);
        console.log("Backup [" + app_path + "] to [" + app_org + "]");
        result.status = CONST.STATUS_MODIFIED;
        result.backup = app_org;
    }
    fs.writeFileSync(app_path, res, 'utf8');
    return result;
}
function setStorage(type:string){
    storageType = type;
}


function parse_docker(path: string): ParseResult {
    let result: ParseResult = {
        status: CONST.STATUS_UNCHANGED,
        path: path,
        backup: undefined,
        error: undefined
    };
    if (!fs.existsSync(path)) {
        result.status = CONST.STATUS_CREATED;
        fs.writeFileSync(path, CONST.DOCKER_SPRING_BOOT);
    }
    return result;
}

function parse_yaml(path: string, name: string, label: string): ParseResult {
    let result: ParseResult = {
        status: CONST.STATUS_UNCHANGED,
        path: path,
        backup: undefined,
        error: undefined
    };
    if (!fs.existsSync(path)) {
        result.status = CONST.STATUS_CREATED;
        fs.writeFileSync(path, generate_yaml(name, label));
    }
    return result;
}

// parse xml return obj;
function xml2js(xml: string): xml_parser.Element {
    let res = <xml_parser.Element>xml_parser.xml2js(xml);
    return res.elements![0];
}

function fs_copyFileSync(src: string, target: string) {
    let data = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(target, data, 'utf8');
}

function fs_dfs(root: string, target: string, res: string[]) {
    let path = fs.readdirSync(root);
    path.forEach((cur) => {
        let next_path = syspath.join(root, cur);
        let info = fs.statSync(next_path);
        if (info.isDirectory()) {
            fs_dfs(next_path, target, res);
        }
        else if (cur === target) {
            res.push(next_path);
        }
    });
}

function fs_createFile(path: string) {
    let sep = syspath.sep;
    let folders = syspath.dirname(path).split(sep);
    let p = '';
    while (folders.length) {
        p += folders.shift() + sep;
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p);
        }
    }
    let filename = syspath.basename(path);
    if (!fs.existsSync(filename)) {
        fs.writeFileSync(path, "");
    }
}

function generate_yaml(name: string, label: string): string {
    let res = "---\n";
    res += "# " + name + " service\n";
    CONST.YAML_SVC.metadata.name = label + "-svc";
    CONST.YAML_SVC.metadata.labels.msvc = label;
    CONST.YAML_SVC.spec.selector.msvc = label;
    res += yaml_parser.safeDump(CONST.YAML_SVC);
    res += "\n---\n";
    res += "# " + name + " deploy\n";
    CONST.YAML_DEPLOY.metadata.name = label + "-deploy";
    CONST.YAML_DEPLOY.metadata.labels.msvc = label;
    CONST.YAML_DEPLOY.spec.selector.matchLabels.msvc = label;
    CONST.YAML_DEPLOY.spec.template.metadata.labels.msvc = label;
    CONST.YAML_DEPLOY.spec.template.spec.containers[0].name = label;
    let image_name = "devil4876/k8s-" + name + ":0.0.1";
    CONST.YAML_DEPLOY.spec.template.spec.containers[0].image = image_name;
    res += yaml_parser.safeDump(CONST.YAML_DEPLOY);
    return res;
}

function user_home(): string | undefined {
    return process.env['HOME'] || process.env['USERPROFILE'];
}

function fs_root(): string | undefined {
    let workspace = vscode.workspace.workspaceFolders;
    if (workspace !== undefined) {
        return workspace[0].uri.fsPath;
    }
    else {
        return undefined;
    }
}