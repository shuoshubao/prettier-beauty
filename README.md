# prettier-beauty

[prettier](https://prettier.io/) + [htmlparser2](https://www.npmjs.com/package/htmlparser2)

* 支持格式化 `.vue` 单文件
* 文件夹批量格式化

# Useage

## 全局安装

* npm i -g prettier-beauty
* prettier-beauty --entry=[entry]

## 本地安装

* npm i -S prettier-beauty
* scripts: "prettier-beauty": "prettier-beauty --entry=[entry]"

## 注意事项

* 必须在 git 项目根目录执行此命令 (请确保工作区无修改, 因为会直接修改文件!!!)
* entry 不得包含 `..` 和 `node_modules`
