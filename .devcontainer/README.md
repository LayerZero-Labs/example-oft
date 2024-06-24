
## Requirements
```shell
npm install -g @devcontainers/cli
```

## Build the image
```shell
devcontainer build --workspace-folder `pwd` --no-cache
```

## Create a container
```shell
devcontainer up --workspace-folder `pwd` --remove-existing-container --build-no-cache
```
