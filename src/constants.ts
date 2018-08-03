// pom.xml zipkin dependency
export const POM_ZIPKIN_DEP = "<dependency><groupId>org.springframework.cloud</groupId><artifactId>spring-cloud-starter-zipkin</artifactId></dependency>";
export const POM_DEP_MANAGE = "<dependencyManagement><dependencies><dependency><groupId>org.springframework.cloud</groupId><artifactId>spring-cloud-dependencies</artifactId><version>${spring-cloud.version}</version><type>pom</type><scope>import</scope></dependency></dependencies></dependencyManagement>";
export const POM_BUILD_PLUGE = "<build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>";
export const POM_PROP = "<properties><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding><project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding><java.version>1.8</java.version><spring-cloud.version>Finchley.RELEASE</spring-cloud.version></properties>";
export const POM_PARENT = "<parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>2.0.3.RELEASE</version><relativePath/><!-- lookup parent from repository --></parent>";
export const POM_BRAVE_MYSQL_DEP = "<dependency><groupId>io.zipkin.brave</groupId><artifactId>brave-instrumentation-mysql</artifactId><version>5.1.4</version></dependency>";

// spring boot dockerfile
export const DOCKER_SPRING_BOOT = "FROM java:8-alpine\nVOLUME /tmp\nADD ./target/*.jar /hello.jar\nRUN sh -c 'touch /hello.jar'\nENTRYPOINT [\"java\",\"-Djava.security.egd=file:/dev/./urandom\",\"-jar\",\"/hello.jar\"]\n";

// zipkin storage type
export const STORAGE_MEM = "mem";
export const STORAGE_ES = "elasticsearch";
export const STORAGE_MYSQL = "mysql";

// zipkin config status
export const STATUS_UNCHANGED = "unchanged";
export const STATUS_MODIFIED = "modified";
export const STATUS_CREATED = "created";

// backup filename
export const BACKUP_POM = "pom_backup.xml";
export const BACKUP_APP = "application_backup.properties";

// zipkin config filename
export const ZIPKIN_CONFIG = "zipkin.json";
export const ZIPKIN_YAML_CONTEXT = "---\nkind: Service\napiVersion: v1\nmetadata:\n  name: zipkin-svc\n  labels:\n    app: k8s-demo\n    msvc: zipkin\nspec:\n  selector:\n    app: k8s-demo\n    msvc: zipkin\n  ports:\n  - port: 9411\n    targetPort: 9411\n  type: NodePort\n\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: zipkin-deploy\n  labels:\n    app: k8s-demo\n    msvc: zipkin\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: k8s-demo\n      msvc: zipkin\n  template:\n    metadata:\n      labels:\n        app: k8s-demo\n        msvc: zipkin\n    spec:\n      containers:\n      - name: zipkin\n        image: openzipkin/zipkin\n        ports:\n        - containerPort: 9411\n";
export const ZIPKIN_YAML = "zipkin.yaml";

// errors
export const ERROR_ILLEGAL_POM = "Error: can't parse the input pom.xml";
export const ERROR_NO_FOLDER = "Error: no folder is open";

export const COMMAND_OPENFILE = "extension.openFile";
export const COMMAND_OPENWEB = "extension.openWeb";
export const COMMAND_PREPARE = "extension.prepare";
export const COMMAND_UP = "extension.up";
export const COMMAND_CLEAN = "extension.clean";
export const COMMAND_RUN = "extension.run";
export const COMMAND_STOP = "extension.stop";

// k8s yaml service template
export let YAML_SVC = {
    kind: 'Service',
    apiVersion: 'v1',
    metadata: { name: 'demo-svc', labels: { app: 'k8s-demo', msvc: 'demo' } },
    spec:
    {
        selector: { app: 'k8s-demo', msvc: 'demo' },
        ports: [{ port: 8080, targetPort: 8080 }],
        type: 'NodePort'
    }
};

// k8s yaml deploy template
export let YAML_DEPLOY = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata:
    {
        name: 'demo-deploy',
        labels: { app: 'k8s-demo', msvc: 'demo' }
    },
    spec:
    {
        replicas: 1,
        selector: { matchLabels: { app: 'k8s-demo', msvc: 'demo' } },
        template:
        {
            metadata: { labels: { app: 'k8s-demo', msvc: 'demo' } },
            spec:
            {
                containers:
                    [{
                        name: 'demo',
                        image: 'devil4876/k8s-demo:0.0.1',
                        ports: [{ containerPort: 8080 }]
                    }]
            }
        }
    }
};
